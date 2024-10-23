
import { Conversation, MessageSender } from "@/lib/types";

export default function ConversationPane( {conversation} : {conversation: Conversation | null}) {
  return (
    conversation ? (
      <div className="flex flex-col w-full m-5">
        <div>
          <h1 className="font-bold text-xl mb-5">
            Conversation with {conversation.guardian_name}
          </h1>
        </div>
        <div>
          {conversation.chat_history.map((message) => (
            <div className={`mb-10 flex flex-col w-full ${message.sender === MessageSender.Agent ? "items-end" : ""}`}>
              <div className="bg-gray-200 p-2 rounded-md w-fit">
                <p className="text-md">{message.content}</p>
              </div> 
              <p className="text-xs">{message.sender}</p>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div>
        No conversation selected
      </div>
    )
  )
}