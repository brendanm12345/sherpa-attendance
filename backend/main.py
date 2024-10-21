from typing import Literal, Optional
import logging
import json
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from supabase import create_client, Client
from datetime import date
import os
from dotenv import load_dotenv
from openai import OpenAI
from enum import Enum
import csv
from io import StringIO

load_dotenv()

app = FastAPI()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)


# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Get sendblue constants
SENDBLUE_BASE_URL = os.environ.get("SENDBLUE_BASE_URL")
SENDBLUE_API_KEY = os.environ.get("SENDBLUE_API_KEY")
SENDBLUE_API_SECRET = os.environ.get("SENDBLUE_API_SECRET")

# Global variables
BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL")
NGROK_BASE_URL = os.environ.get("NGROK_BASE_URL")
INITIAL_MESSAGE_TEMPLATE = "Hi there! This is Crystal Springs Middle School. We noticed that {student_name} was not able to make it to school today. Can you please provide a reason for their absence? Also please let us know how we can help. Thanks!"
AUTO_APPROVE = True


logger = logging.getLogger("uvicorn")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTPException: {exc.status_code} - {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
# Pydantic models


class Absence(BaseModel):
    id: str
    student_id: str
    student_name: str
    date: date
    rfa: str
    guardian_name: str
    guardian_phone: str


class AttendanceReport(BaseModel):
    date: date
    school_id: str
    absences: List[Absence]


class Message(BaseModel):
    conversation_id: str
    content: str
    sender_type: Literal["guardian", "admin"]
    status: str
    was_downgraded: Optional[bool] = None
    sendblue_message_handle: Optional[str] = None

class ConversationStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    ACTION_NEEDED = "action_needed"
    COMPLETED = "completed"
    AWAITING_MESSAGE_APPROVAL = "awaiting_message_approval"

class RecommendedAction(str, Enum):
    MARK_AS_COMPLETED = "mark_as_completed"
    ATTENDANCE_OFFICER_TAKE_OVER = "attendance_officer_take_over"


class AIResponseSchema(BaseModel):
    rfa: Optional[Literal[
        None,
        "Excused - Sick",
        "Excused - appointment",
        "Excused - Travel",
        "Excused - Family emergency",
        "Excused - Bereavement",
        "Excused - Religious observance",
        "Excused - School-approved activity",
        # "Excused - Legal or court appearance",
        "Excused - Severe weather or natural disaster",
        "Excused - Mental health day",
        "Excused - Therapy or counseling appointment",
        "Excused - College visit",
        "Excused - Military duty (for family member)",
        "Excused - Cultural observance",
        "Unexcused - Sick (without proper notification)",
        "Unexcused - Travel (non-approved)",
        "Unexcused - Overslept",
        "Unexcused - Transportation issues",
        "Unexcused - Skipping class",
        "Unexcused - Family vacation (non-approved)",
        "Unexcused - Work (non-school related)",
        "Unexcused - Forgot to attend online class",
        "Unexcused - Technology issues (for remote learning)",
        "Unexcused - Misunderstanding of schedule"
    ]] = Field(None, description="Reason for absence, if clear.")

    conversation_status: Literal[ConversationStatus.IN_PROGRESS, ConversationStatus.ACTION_NEEDED] = Field(
        ..., description="The status of the conversation"
    )

    recommended_action: Optional[Literal[RecommendedAction.MARK_AS_COMPLETED, RecommendedAction.ATTENDANCE_OFFICER_TAKE_OVER]] = Field(
        None, description="The recommended action if the status is action_needed"
    )

    response_content: str = Field(...,
                                  description="The response content to send to the recipient")

# Helper Functions


def get_attendance_report() -> AttendanceReport:
    # Hardcoded attendance report for now
    return AttendanceReport(
        date=date.today(),
        school_id="62566731-2ddc-475c-9778-a6106928d2a0",
        absences=[
            Absence(id="2", student_id="S002", student_name="Jane Smith", date=date.today(),
                    rfa="Excused - Doctor's appointment", guardian_name="Sally Smith", guardian_phone="+16509245188"),
            Absence(id="3", student_id="S003", student_name="Bob Johnson", date=date.today(),
                    rfa="Unexplained", guardian_name="Jessy Johnson", guardian_phone="+16509245188"),
        ]
    )


async def sendblue_send_message(phone_number: str, content: str) -> dict:
    url = f"{SENDBLUE_BASE_URL}/send-message"
    payload = json.dumps({
        "number": phone_number,
        "content": content,
        # our ngrok reverse proxy to http://127.0.0.1:8000
        "status_callback": f"{NGROK_BASE_URL}/sendblue_status_callback"
    })

    headers = {
        "sb-api-key-id": SENDBLUE_API_KEY,
        "sb-api-secret-key": SENDBLUE_API_SECRET,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, content=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = f"HTTP Status Error: {
                e.response.status_code} - {e.response.text}"
            print(f"Error sending message: {error_detail}")
            raise HTTPException(status_code=e.response.status_code,
                                detail=f"Error sending message: {error_detail}")
        except httpx.RequestError as e:
            error_detail = f"Request Error: {str(e)}"
            print(f"Error sending message: {error_detail}")
            raise HTTPException(
                status_code=500, detail=f"Error sending message: {error_detail}")
        except Exception as e:
            error_detail = f"Unexpected error: {str(e)}"
            print(f"Error sending message: {error_detail}")
            raise HTTPException(
                status_code=500, detail=f"Error sending message: {error_detail}")


def get_or_create_guardian(phone_number: str, school_id: str, first_name: str, last_name: str) -> str:
    # Try to find an existing guardian
    existing_guardian = supabase.table("guardians").select(
        "*").eq("phone_number", phone_number).eq("school_id", school_id).execute()

    if existing_guardian.data:
        return existing_guardian.data[0]['id']

    # If not found, create a new guardian
    new_guardian = supabase.table("guardians").insert({
        "phone_number": phone_number,
        "school_id": school_id,
        "first_name": first_name,
        "last_name": last_name
    }).execute()

    return new_guardian.data[0]['id']


def create_conversation(student_id: str, absence_id: str, school_id: str, guardian_id: str) -> str:
    conversation_data = {
        "topic": "Absence Inquiry",
        "student_id": student_id,
        "school_id": school_id,
        "status": "in_progress",
        "absence_id": absence_id,
        "guardian_id": guardian_id,
        "user_id": None  # Leave this null for the MVP
    }
    result = supabase.table("conversations").insert(
        conversation_data).execute()
    return result.data[0]['id']


def create_message(message: Message) -> str:
    message_data = {
        "conversation_id": message.conversation_id,
        "content": message.content,
        "sender_type": message.sender_type,
        "status": message.status,
        "was_downgraded": message.was_downgraded,
        "sendblue_message_handle": message.sendblue_message_handle
    }
    result = supabase.table("messages").insert(message_data).execute()
    return result.data[0]['id']


async def initiate_conversation(absence: Absence, school_id: str, auto_approve: bool) -> dict:
    initial_message = INITIAL_MESSAGE_TEMPLATE.format(
        student_name=absence.student_name)
    sendblue_response = None

    if auto_approve:
        try:
            sendblue_response = await sendblue_send_message(absence.guardian_phone, initial_message)
        except HTTPException as e:
            print(f"Failed to send message via Sendblue: {str(e)}")
            raise e

    # Get or create guardian
    guardian_first_name, guardian_last_name = absence.guardian_name.split(
        " ", 1)
    guardian_id = get_or_create_guardian(
        absence.guardian_phone, school_id, guardian_first_name, guardian_last_name)

    # Create conversation
    conversation_id = create_conversation(
        absence.student_id, absence.id, school_id, guardian_id)

    # Create message
    message = Message(
        conversation_id=conversation_id,
        content=initial_message,
        sender_type="admin",
        status="AWAITING_APPROVAL" if not auto_approve else sendblue_response.get(
            "status"),
        was_downgraded=sendblue_response.get(
            "was_downgraded") if auto_approve else None,
        sendblue_message_handle=sendblue_response.get(
            "message_handle") if auto_approve else None
    )
    message_id = create_message(message)

    return {
        "conversation_id": conversation_id,
        "message_id": message_id,
        "status": message.status
    }


async def ai_process_conversation(conversation_history: List[dict], conversation: dict) -> AIResponseSchema:
    prompt = f"""
    Given the following conversation history and participant roles, please analyze the conversation and provide:
    1. A reason for absence (RFA) if one has been made clear. If not clear, respond with null.
    2. A an update to the conversation status if needed. This should be chosen from Literal["in_progress", "action_needed"]
    3. (optional) IF the updated conversation_status is "action_needed" THEN choose a recommended_action (sort of like a 
    next step) BASED on the conversation history. Chosen from Optional[Literal["mark_as_completed", "attendance_officer_take_over"]]
    4. A text response to send to the recipient based on the above choices.

    Conversation History:
    {json.dumps(conversation_history)}

    Participant Roles:
    A guardian of a student who was recently absent and a school admin who reacahed out to understand why the student was absent are participating in the conversation.

    Please respond in JSON format with the following structure:
    {{
        "rfa": "excused - sick" or null,
        "convsersation_status": "action_needed",
        "recommended_action": "mark_as_completed" or null,
        "response_content": "I'm sorry to hear that. Could you provide more details about the illness?"
    }}

    Here are some helpful tips and guidelines:
    - Be friendly and empathetic in your responses.
    - If you decide that the rfa is "excused - [anything]", the "recommended_action" should typically be "mark_as_completed".
    - If the guardian provides a clear rfa but you're unsure whether it should be excused or unexcused, you can choose one and set the "recommended_action" to "attendance_officer_take_over".
    - If you decide to escalate the conversation to the attendance officer, you should let the guardian know that you will let the attendance officer know and that they will be in touch soon.
    - If users ask about how to inform the school about future absences, you can instruct them to send a text message to this phone number.
    - Please be pretty concise in the "response_content" since these will be sent as text messages and avoid repeating yourself too much.
    """

    print(f"Prompt: {prompt}")

    completion = client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",
        messages=[
            {"role": "system", "content": "You are an AI assistant helping to process school absence conversations."},
            {"role": "user", "content": prompt}
        ],
        response_format=AIResponseSchema
    )

    return completion.choices[0].message.parsed

# Endpoints


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/initiate_conversations")
async def initiate_conversations(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Process the uploaded CSV file and initiate conversations for unexplained absences
    """
    content = await file.read()
    csv_data = content.decode('utf-8')
    csv_reader = csv.DictReader(StringIO(csv_data))

    attendance_report = AttendanceReport(
        date=date.today(), school_id="", absences=[])
    initiated_conversations = []

    for row in csv_reader:
        absence = Absence(
            # Using student_id as absence id for simplicity
            id=row['student_id'],
            student_id=row['student_id'],
            student_name=row['student_name'],
            date=date.fromisoformat(row['date']),
            rfa=row['rfa'],
            guardian_name=row['guardian_name'],
            guardian_phone=row['guardian_phone']
        )
        attendance_report.absences.append(absence)
        attendance_report.school_id = row['school_id']

        if absence.rfa == "Unexplained":
            background_tasks.add_task(
                initiate_conversation,
                absence,
                attendance_report.school_id,
                AUTO_APPROVE
            )
            initiated_conversations.append({
                "student_id": absence.student_id,
                "absence_id": absence.id,
                "guardian_phone": absence.guardian_phone
            })

    return {"status": "Conversation initiation tasks added for unexplained absences", "initiated_conversations": initiated_conversations}


@app.post("/approve_and_send_message/{message_id}")
async def approve_and_send_message(message_id: str):
    # Fetch the message
    message_result = supabase.table("messages").select(
        "*").eq("id", message_id).single().execute()
    if not message_result.data:
        raise HTTPException(status_code=404, detail="Message not found")

    message = Message(**message_result.data)

    if message.status != "AWAITING_APPROVAL":
        raise HTTPException(
            status_code=400, detail="Message is not in AWAITING_APPROVAL status")

    # Fetch the conversation
    conversation_result = supabase.table("conversations").select(
        "*").eq("id", message.conversation_id).single().execute()
    if not conversation_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    guardian_id = conversation_result.data.get("guardian_id")
    if not guardian_id:
        raise HTTPException(
            status_code=404, detail="Guardian not associated with conversation")

    # Fetch the guardian
    guardian_result = supabase.table("guardians").select(
        "phone_number").eq("id", guardian_id).single().execute()
    if not guardian_result.data:
        raise HTTPException(status_code=404, detail="Guardian not found")

    guardian_phone = guardian_result.data["phone_number"]
    if not guardian_phone:
        raise HTTPException(
            status_code=404, detail="Guardian phone number not found")

    # Send the message
    try:
        sendblue_response = await sendblue_send_message(guardian_phone, message.content)
    except HTTPException as e:
        # Log the error and re-raise
        print(f"Failed to send message via Sendblue: {str(e)}")
        raise

    # Update the message status
    updated_message = supabase.table("messages").update({
        "status": sendblue_response.get("status"),
        "was_downgraded": sendblue_response.get("was_downgraded"),
        "sendblue_message_handle": sendblue_response.get("message_handle")
    }).eq("id", message_id).execute()

    return {"status": "Message approved and sent", "sendblue_response": sendblue_response}


@app.post("/sendblue_status_callback")
async def sendblue_status_callback(callback_data: dict):
    # TODO: change the ngrok url for this
    message_handle = callback_data.get("message_handle")
    new_status = callback_data.get("status")

    if not message_handle or not new_status:
        raise HTTPException(status_code=400, detail="Invalid callback data")

    updated_message = supabase.table("messages").update({
        "status": new_status,
        "was_downgraded": callback_data.get("was_downgraded")
    }).eq("sendblue_message_handle", message_handle).execute()

    if not updated_message.data:
        raise HTTPException(status_code=404, detail="Message not found")

    return {"status": "Message status updated"}


@app.post("/process_response")
async def process_response(payload: dict):
    print(f"Received webhook payload: {payload}")
    sender_phone = payload.get("from_number")
    to_phone = payload.get("to_number")
    message_content = payload.get("content")
    sendblue_message_handle = payload.get("message_handle")

    if not sender_phone or not to_phone or not message_content or not sendblue_message_handle:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    
    normalized_sender_phone = sender_phone.lstrip('+')

    # Find the guardian based on the sender's phone number
    guardian = supabase.table("guardians").select("id, school_id").eq(
        "phone_number", normalized_sender_phone).single().execute()
    if not guardian.data:
        raise HTTPException(status_code=404, detail="Guardian not found")

    guardian_id = guardian.data['id']
    school_id = guardian.data['school_id']

    # Find the most recent active conversation for this guardian
    conversation = supabase.table("conversations").select("*").eq("guardian_id", guardian_id).eq(
        "school_id", school_id).order("created_at", desc=True).limit(1).execute()

    if not conversation.data:
        # Handle case where no active conversation is found
        raise HTTPException(
            status_code=404, detail="No active conversation found for this guardian")

    conversation_id = conversation.data[0]['id']

    new_message = Message(
        conversation_id=conversation_id,
        content=message_content,
        sender_type="guardian",
        status="RECEIVED",
        sendblue_message_handle=conversation_id
    )
    # Create the recevied message in DB
    create_message(new_message)

    # Get the conversation from conversation_id
    conversation = supabase.table("conversations").select(
        "*").eq("id", conversation_id).single().execute()
    if not conversation.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not conversation.data.get("rfa") or conversation.data.get("status") == ConversationStatus.ACTION_NEEDED:
        """
        If the conversation does not have an RFA, this means the AI should re-consider the conversation with it's new message and see it can label it with an RFA and next action.
        """

        # Get the conversation's messages using the conversation_id
        messages = supabase.table("messages").select(
            "*").eq("conversation_id", conversation_id).order("created_at").execute()

        # Pass the conversation to GPT to get RFA, next action, and response content
        ai_response = await ai_process_conversation(messages.data, conversation.data)
        print("Received AI response:" + str(ai_response))

        # Update the conversation with the new RFA and status in DB
        update_data = {
            "status": ai_response.conversation_status,
            "rfa": ai_response.rfa
        }
        if ai_response.conversation_status == ConversationStatus.ACTION_NEEDED:
            update_data["recommended_action"] = ai_response.recommended_action

        supabase.table("conversations").update(
            update_data).eq("id", conversation_id).execute()

        if AUTO_APPROVE:
            """
            If auto approve is on, try sending the message via Sendblue
            """

            # Get conversation from conversation_id
            conversation_result = supabase.table("conversations").select(
                "*").eq("id", conversation_id).single().execute()
            if not conversation_result.data:
                raise HTTPException(
                    status_code=404, detail="Conversation not found")

            # Get guardian_id from conversation
            guardian_id = conversation_result.data.get("guardian_id")
            if not guardian_id:
                raise HTTPException(
                    status_code=404, detail="Guardian not associated with conversation")

            # Get the guardian (phone number col only) from guardian_id
            guardian_result = supabase.table("guardians").select(
                "phone_number").eq("id", guardian_id).single().execute()
            if not guardian_result.data:
                raise HTTPException(
                    status_code=404, detail="Guardian not found")

            guardian_phone = guardian_result.data["phone_number"]
            if not guardian_phone:
                raise HTTPException(
                    status_code=404, detail="Guardian phone number not found")

            # Send the message
            try:
                sendblue_response = await sendblue_send_message(guardian_phone, ai_response.response_content)
            except HTTPException as e:
                # Log the error and re-raise
                print(f"Failed to send message via Sendblue: {str(e)}")
                raise

        # Create message in DB
        ai_message = Message(
            conversation_id=conversation_id,
            content=ai_response.response_content,
            sender_type="admin",
            status="AWAITING_APPROVAL" if not AUTO_APPROVE else sendblue_response.get(
                "status"),
            was_downgraded=sendblue_response.get(
                "was_downgraded") if AUTO_APPROVE else None,
            sendblue_message_handle=sendblue_response.get(
                "message_handle") if AUTO_APPROVE else None
        )
        ai_message_id = create_message(ai_message)
        return {
            "conversation_id": conversation_id,
            "message_id": ai_message_id,
            "status": ai_message.status
        }

    else:
        """
         If the conversation already has an RFA that means that we've already escalated this to a human and they should be handling it. We'll just notify them.
         """
        print("TODO: Notify admin that the guardian sent a new message")

    return {"status": "Message processed successfully"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
