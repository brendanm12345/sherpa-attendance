"use client";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProcessedConversation, RawConversation, processConversations } from '@/types/conversations';
import { Database } from '@/database.types'
import { useToast } from "@/hooks/use-toast"

export default function Conversations() {
  const [conversations, setConversations] = useState<ProcessedConversation[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const supabase = createClientComponentClient<Database>()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className='flex flex-col gap-2 mb-6'>
        <div className='flex flex-row flex-1 justify-between'>
          <h1 className='text-3xl'>Conversations</h1>
          {/* Search bar */}
          <Input className='rounded-full bg-secondary max-w-80 border-none' placeholder='Search' />
        </div>
        {/* Filters */}
        <div className='flex flex-row gap-2'>
          <Button variant='secondary' className='rounded-full border-none font-normal'>In Progress</Button>
          <Button variant='secondary' className='rounded-full border-none font-normal'>Action Needed</Button>
          <Button variant='secondary' className='rounded-full border-none font-normal'>Completed</Button>
        </div>
      </div>
      {/* Upload Report Banner */}
      <Card className="mb-6 bg-accent">
        <CardHeader>
          <CardTitle className='text-md font-medium'>Upload a CSV file to initiate conversations based on student absences.</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      {/* Table */}
      {conversations.length > 0 ? (
        <Table>
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
            {conversations.map((conversation) => (
              <TableRow key={conversation.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="min-w-[50px] h-[50px] square rounded-full bg-green-100 flex items-center justify-center mr-3">
                      {conversation.guardian.first_name?.charAt(0) || ''}
                    </div>
                    <div>
                      <div className='flex flex-row gap-2 items-center'>
                        <div className="font-semibold truncate">{conversation.guardian.first_name} {conversation.guardian.last_name}</div>
                        <div className="text-sm bg-secondary py-1 px-2 rounded-md">Guardian</div>
                      </div>
                      <div className="text-sm truncate max-w-80">{conversation.latestMessage?.content}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='truncate'>{conversation.studentId}</TableCell>
                <TableCell className='truncate'>{conversation.topic}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                    <span className='truncate'>{conversation.status}</span>
                    <ChevronDownIcon className="w-4 h-4 ml-2" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <span className='truncate'>{conversation.rfa || 'N/A'}</span>
                    <ChevronDownIcon className="w-4 h-4 ml-2" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card className='p-6'>
          <CardDescription>No conversations found. Try uploading an attendance report</CardDescription>
        </Card>
      )}
    </div>
  )
}