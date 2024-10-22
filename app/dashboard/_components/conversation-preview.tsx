
import { Conversation } from "@/lib/types";

import Image from "next/image";

export default function ConversationPreview( { conversation }: { conversation: Conversation }) {
  return (
    <div className="flex flex-row items-center justify-between p-4 border-b border-b-foreground/10">
      <Image src="/avatar.png" width={50} height={50} className="rounded-full" alt={""} />
      <div className="flex flex-col">
        <div className="font-medium text-md">{conversation.guardian_name}</div>
        <div className="text-sm">{conversation.chat_history[conversation.chat_history.length - 1].content}</div>
      </div>
      <div className="flex flex-col items-end">
        <div className="text-sm text-foreground/50">{conversation.chat_history[conversation.chat_history.length - 1].sent_date.toLocaleString()}</div>
        <div className="text-sm text-foreground/50">{conversation.status}</div>
      </div>
    </div>
  );
}