
import { Conversation, Message, MessageSender } from "@/lib/types";
import { UUID } from "crypto";

export const dummyConversationHistory1: Message[] = [
  {
    id: crypto.randomUUID(),
    content: "Hello why did your kid miss school today?",
    sent_date: new Date(),
    sender: MessageSender.Agent,
  },
  {
    id: crypto.randomUUID(),
    content: "He was feeling sick",
    sent_date: new Date(),
    sender: MessageSender.Guardian,
  },
];

export const dummyConversationHistory2: Message[] = [
  {
    id: crypto.randomUUID(),
    content: "Hello why did your kid miss school today?",
    sent_date: new Date(),
    sender: MessageSender.Agent,
  },
  {
    id: crypto.randomUUID(),
    content: "He missed the bus",
    sent_date: new Date(),
    sender: MessageSender.Guardian,
  },
];

export const dummyConversation1: Conversation = {
  id: crypto.randomUUID(),
  student_name: "Jonny Appleseed",
  guardian_name: "Mrs. Appleseed",
  status: "Active",
  chat_history: dummyConversationHistory1,
};

export const dummyConversation2: Conversation = {
  id: crypto.randomUUID(),
  student_name: "Jane Doe",
  guardian_name: "Mr. Doe",
  status: "Active",
  chat_history: dummyConversationHistory2,
};

const dummyConversations: Conversation[] = [dummyConversation1, dummyConversation2];
export default dummyConversations;