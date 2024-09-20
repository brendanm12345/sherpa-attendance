import json
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
import httpx
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from datetime import date
import os
from dotenv import load_dotenv

# Initialize FastAPI app
app = FastAPI()

load_dotenv()

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
INITIAL_MESSAGE_TEMPLATE = "Hello, our records show that {student_name} was absent today. Can you please provide a reason for their absence?"
AUTO_APPROVE = False

# Pydantic models


class Absence(BaseModel):
    id: str
    student_id: str
    student_name: str
    date: date
    rfa: str
    guardian_phone: str


class AttendanceReport(BaseModel):
    date: date
    school_id: str
    absences: List[Absence]


class Participant(BaseModel):
    conversation_id: str
    conversation_role: str
    first_name: str = None
    last_name: str = None
    phone_number: str = None
    user_id: str = None


class Message(BaseModel):
    conversation_id: str
    content: str
    sender_id: str
    status: str
    was_downgraded: Optional[bool] = None
    sendblue_message_handle: Optional[str] = None

# Helper Functions


def get_attendance_report() -> AttendanceReport:
    # Hardcoded attendance report for now
    return AttendanceReport(
        date=date.today(),
        school_id="62566731-2ddc-475c-9778-a6106928d2a0",
        absences=[
            Absence(id="1", student_id="S001", student_name="John Doe", date=date.today(
            ), rfa="Unexplained", guardian_phone="+16509245188"),
            Absence(id="2", student_id="S002", student_name="Jane Smith", date=date.today(
            ), rfa="Excused - Doctor's appointment", guardian_phone="+16509245188"),
            Absence(id="3", student_id="S003", student_name="Bob Johnson", date=date.today(
            ), rfa="Unexplained", guardian_phone="+16509245188"),
        ]
    )


async def sendblue_send_message(phone_number: str, content: str) -> dict:
    url = f"{SENDBLUE_BASE_URL}/send-message"
    payload = json.dumps({
        "number": phone_number,
        "content": content,
        "status_callback": f"https://b5cb-173-13-131-249.ngrok-free.app/sendblue_callback"
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


def create_conversation(student_id: str, absence_id: str, school_id: str) -> str:
    conversation_data = {
        "topic": "Absence Inquiry",
        "student_id": student_id,
        "school_id": school_id,
        "status": "in_progress",
        "absence_id": absence_id,
    }
    result = supabase.table("conversations").insert(
        conversation_data).execute()
    return result.data[0]['id']


def create_conversation_participant(participant: Participant) -> str:
    participant_data = {
        "conversation_id": participant.conversation_id,
        "conversation_role": participant.conversation_role,
        "first_name": participant.first_name,
        "last_name": participant.last_name,
        "phone_number": participant.phone_number,
        "user_id": participant.user_id
    }
    result = supabase.table("conversation_participants").insert(
        participant_data).execute()
    return result.data[0]['id']


def create_message(message: Message) -> str:
    message_data = {
        "conversation_id": message.conversation_id,
        "content": message.content,
        "sender_id": message.sender_id,
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

    # If we're here, either auto_approve is False or the Sendblue message was sent successfully
    conversation_id = create_conversation(
        absence.student_id, absence.id, school_id)

    ai_participant = Participant(
        conversation_id=conversation_id,
        conversation_role="attendance_officer",
        first_name="Attendance",
        last_name="Officer"
    )
    ai_participant_id = create_conversation_participant(ai_participant)

    guardian_participant = Participant(
        conversation_id=conversation_id,
        conversation_role="guardian",
        phone_number=absence.guardian_phone
    )
    create_conversation_participant(guardian_participant)

    message = Message(
        conversation_id=conversation_id,
        content=initial_message,
        sender_id=ai_participant_id,
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
# Endpoints


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/initiate_conversations")
async def initiate_conversations(background_tasks: BackgroundTasks):
    attendance_report = get_attendance_report()
    initiated_conversations = []

    for absence in attendance_report.absences:
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
    # Fetch the message from the database
    message_result = supabase.table("messages").select(
        "*").eq("id", message_id).execute()
    if not message_result.data:
        raise HTTPException(status_code=404, detail="Message not found")

    message = Message(**message_result.data[0])

    if message.status != "AWAITING_APPROVAL":
        raise HTTPException(
            status_code=400, detail="Message is not in AWAITING_APPROVAL status")

    # Fetch the conversation and guardian's phone number
    conversation_result = supabase.table("conversations").select(
        "*").eq("id", message.conversation_id).execute()
    if not conversation_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    guardian_result = supabase.table("conversation_participants").select(
        "*").eq("conversation_id", message.conversation_id).eq("conversation_role", "guardian").execute()
    if not guardian_result.data:
        raise HTTPException(status_code=404, detail="Guardian not found")

    guardian_phone = guardian_result.data[0]["phone_number"]

    # Send the message via Sendblue
    sendblue_response = await sendblue_send_message(guardian_phone, message.content)

    # Update the message status in the database
    updated_message = supabase.table("messages").update({
        "status": sendblue_response.get("status"),
        "was_downgraded": sendblue_response.get("was_downgraded"),
        "sendblue_message_handle": sendblue_response.get("message_handle")
    }).eq("id", message_id).execute()

    return {"status": "Message approved and sent", "sendblue_response": sendblue_response}


@app.post("/sendblue_callback")
async def sendblue_callback(callback_data: dict):
    # Update the message status in the database based on the callback data
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
