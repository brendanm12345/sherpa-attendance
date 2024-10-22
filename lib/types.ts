
export type Conversation = {
  id: string;
  student_name: string;
  guardian_name: string;
  status: string;
  chat_history: Message[];
}

export type Message = {
  id: string;
  content: string;
  sent_date: Date;
  sender: MessageSender;
}


export enum MessageSender {
  Guardian = "Guardian",
  Student = "Student",
  Teacher = "Teacher",
  Counselor = "Counselor",
  Officer = "Officer",
  Agent = "Agent",
}