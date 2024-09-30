import { Database } from '@/database.types';

// Extend the base types for joined data
type ExtendedGuardian = Database['public']['Tables']['guardians']['Row'];

type ExtendedMessage = Database['public']['Tables']['messages']['Row'];

// Define the raw conversation type returned from the query
export type RawConversation = Database['public']['Tables']['conversations']['Row'] & {
  guardian: ExtendedGuardian;
  messages: ExtendedMessage[];
};


// Define the processed conversation type for use in the component
export type ProcessedConversation = {
  id: string;
  topic: string;
  studentId: string;
  schoolId: string;
  status: Database['public']['Enums']['conversation_status'];
  rfa: string | null;
  absenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  guardianId: string;
  guardian: ExtendedGuardian;
  latestMessage?: ExtendedMessage;
};

// Function to process the raw data
export function processConversations(rawData: RawConversation[]): ProcessedConversation[] {
  return rawData.map(conversation => {
    const sortedMessages = conversation.messages.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      id: conversation.id,
      topic: conversation.topic,
      studentId: conversation.student_id,
      schoolId: conversation.school_id,
      status: conversation.status as Database['public']['Enums']['conversation_status'],
      rfa: conversation.rfa,
      absenceId: conversation.absence_id,
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at),
      userId: conversation.user_id,
      guardianId: conversation.guardian_id,
      guardian: conversation.guardian,
      latestMessage: sortedMessages[0],
      messages: sortedMessages,
    };
  });
}
