"use client";


import { Conversation } from '@/lib/types'
import ConversationPane from '@/app/dashboard/_components/conversation-pane'
import dummyConversations from '@/lib/dummy_data';

export default function Page() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(dummyConversations[0]);
  return (
    <ConversationPane conversation={selectedConversation ? selectedConversation : null} />
  )
}



import { useEffect, useState, useRef } from 'react'
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDownIcon, AlertCircle, Upload, Loader2 } from 'lucide-react'
import { Card, CardDescription } from "@/components/ui/card"
import { ProcessedConversation, RawConversation, processConversations } from '@/utils/types';
import { Database } from '@/database.types'
import { useToast } from "@/hooks/use-toast"
import { PlusIcon } from '@/components/icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { dummy } from '@/app/dashboard/_components/conversations';

const statusMapping = {
  action_needed: "Action Needed",
  awaiting_message_approval: "Awaiting Approval",
  in_progress: "In Progress",
  completed: "Completed",
};

type StatusKey = keyof typeof statusMapping;
type FilterOption = StatusKey | 'all';
const filterOptions: FilterOption[] = ['all', ...Object.keys(statusMapping) as StatusKey[]];

const rfaOptions = [
  "Excused - Sick",
  "Excused - Appointment",
  "Excused - Travel",
  "Excused - Family emergency",
  "Excused - Bereavement",
  "Excused - Religious observance",
  "Excused - School-approved activity",
  "Excused - Weather ornatural disaster",
  "Excused - Mental health day",
  "Excused - Therapy or counseling appointment",
  "Excused - College visit",
  "Excused - Military duty (for family member)",
  "Excused - Cultural observance",
  "Excused - Other",
  "Unexcused - Sick (non-approved)",
  "Unexcused - Travel (non-approved)",
  "Unexcused - Overslept",
  "Unexcused - Transportation issues",
  "Unexcused - Skipping class",
  "Unexcused - Family vacation (non-approved)",
  "Unexcused - Work",
  "Unexcused - Forgot to attend online class",
  "Unexcused - Technology issues",
  "Unexcused - Misunderstanding of schedule",
  "Unexcused - Other"
];

export function Conversations() {
  const [conversations, setConversations] = useState<ProcessedConversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ProcessedConversation[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const supabase = createClientComponentClient<Database>()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredConversations(conversations);
    } else {
      setFilteredConversations(conversations.filter(conv => conv.status === activeFilter));
    }
  }, [activeFilter, conversations]);

  const getStatusCounts = () => {
    const counts = {
      awaiting_message_approval: 0,
      action_needed: 0,
      in_progress: 0,
      completed: 0
    };
    conversations.forEach(conv => {
      counts[conv.status]++;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const handleFilterClick = (filter: FilterOption) => {
    setActiveFilter(filter);
  };

  useEffect(() => {
    fetchConversations()

    // Set up real-time subscription
    const conversationChannel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('Conversation change received!', payload)
          fetchConversations()
        }
      )
      .subscribe()

    const messageChannel = supabase
      .channel('messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Message change received!', payload)
          fetchConversations()
        }
      )
      .subscribe()

    // Clean up subscription on component unmount
    return () => {
      supabase.removeChannel(conversationChannel)
      supabase.removeChannel(messageChannel)
    }
  }, [])


  async function fetchConversations() {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        guardian:guardians!conversations_guardian_id_fkey(*),
        messages:messages(content, created_at, sender_type)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch conversations. Please try again.",
        variant: "destructive",
      });
    } else if (data) {
      console.log(data);
      if (Array.isArray(data) && data.every(item =>
        typeof item === 'object' && item !== null &&
        'id' in item && 'created_at' in item && 'guardian_id' in item
      )) {
        setConversations(processConversations(data as RawConversation[]));
      } else {
        console.error('Received unexpected data format:', data);
        toast({
          title: "Error",
          description: "Received unexpected data format. Please try again.",
          variant: "destructive",
        });
      }
    }
  }

  const handleStatusChange = async (conversationId: string, newStatus: StatusKey) => {
    const { error } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating conversation status:', error);
      toast({
        title: "Error",
        description: "Failed to update conversation status. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Conversation status updated successfully.",
      });
      fetchConversations(); // Refresh the conversations list
    }
  };

  const handleRfaChange = async (conversationId: string, newRfa: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ rfa: newRfa })
      .eq('id', conversationId);

    if (error) {
      console.error('Error updating conversation RFA:', error);
      toast({
        title: "Error",
        description: "Failed to update reason for absence. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Reason for absence updated successfully.",
      });
      fetchConversations(); // Refresh the conversations list
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file first.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://127.0.0.1:8000/initiate_conversations', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log('Upload successful:', data);
      toast({
        title: "Success",
        description: `File uploaded and processed. ${data.initiated_conversations.length} conversations initiated.`,
      });

      // Refresh the conversations list
      fetchConversations();

      // Reset the file input after upload
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className='flex flex-col p-6'>
      {/* Header */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-row flex-1 justify-between'>
          <div className='flex flex-row gap-4'>
            <h1 className='text-3xl'>Conversations</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className='rounded-full font-normal flex flex-row gap-2'>
                  <PlusIcon />Create Conversations
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Attendance Report</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to initiate conversations based on student absences.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="flex-grow"
                    aria-label="Select CSV file"
                    disabled={isUploading}
                  />
                  <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {/* Filters */}
        <div className='flex flex-row w-full border-b border-border mb-2'>
          {filterOptions.map((filter) => (
            <Button
              key={filter}
              variant='ghost'
              className={`rounded-none font-normal px-4 py-2 ${activeFilter === filter ? 'border-b-2 border-black' : 'border-b-2 border-transparent'}`}
              onClick={() => handleFilterClick(filter)}
            >
              {filter === 'all' ? 'All' : statusMapping[filter]}
              {(filter === 'awaiting_message_approval' || filter === 'action_needed') && statusCounts[filter] > 0 && (
                <span className="ml-2 w-[22px] h-[22px] items-center bg-[#F5EE9E] rounded-md px-2 py-1 text-xs">
                  {statusCounts[filter]}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>
      {/* Table */}
      {filteredConversations.length > 0 ? (
        <Table className='overflow-x-scroll'>
          <TableHeader>
            <TableRow>
              <TableHead>Latest Message</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Conversation Status</TableHead>
              <TableHead>Reason for Absence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConversations.map((conversation) => (
              <TableRow key={conversation.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="min-w-[50px] h-[50px] square rounded-full bg-green-100 flex items-center justify-center mr-3">
                      {conversation.guardian.first_name?.charAt(0) || ''}
                    </div>
                    <div>
                      <div className='flex flex-row gap-2 items-center'>
                        <div className="font-medium truncate">{conversation.guardian.first_name} {conversation.guardian.last_name}</div>
                        <div className="text-sm bg-secondary py-1 px-2 rounded-md">Guardian</div>
                      </div>
                      <div className="text-sm truncate max-w-80">{conversation.latestMessage?.content}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='truncate'>{conversation.studentId}</TableCell>
                <TableCell className='truncate'>{conversation.topic}</TableCell>
                <TableCell>
                  <Select
                    value={conversation.status}
                    onValueChange={(value: StatusKey) => handleStatusChange(conversation.id, value)}
                  >
                    <SelectTrigger className="w-[180px] border-none bg-secondary">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className=''>
                      {Object.entries(statusMapping).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={conversation.rfa || ''}
                    onValueChange={(value) => handleRfaChange(conversation.id, value)}
                  >
                    <SelectTrigger className="w-[250px]">
                      <div
                        className="rounded-md px-2 py-1 -ml-1 mr-1 w-fit truncate"
                        style={{
                          backgroundColor: conversation.rfa?.startsWith('Excused') ? '#FFEBDD' :
                            conversation.rfa?.startsWith('Unexcused') ? '#FFD5E1' :
                              'transparent'
                        }}
                      >
                        <SelectValue placeholder="-" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">
                        <span className="text-muted-foreground">-</span>
                      </SelectItem>
                      {rfaOptions.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card className='p-6'>
          <CardDescription>No conversations found. Click "Create Conversations" to upload an attendance report</CardDescription>
        </Card>
      )}
    </div>
  )
}