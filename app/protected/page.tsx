import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronDownIcon, AlertCircle } from 'lucide-react'

// Define the type for a conversation based on your schema
type Conversation = {
  id: string
  latestMessage: {
    content: string
    sender: {
      name: string
      relation: string
    }
    timestamp: string
  }
  student: {
    name: string
  }
  topic: string
  status: 'in_progress' | 'action_needed' | 'completed'
  reasonForAbsence: string
}

// Mock data based on the schema
const conversations: Conversation[] = [
  {
    id: '1',
    latestMessage: {
      content: "Thank you for letting me know and I'm really sorry to hear that. It's crucial that J...",
      sender: {
        name: "Stacy Spencer",
        relation: "Jamie's mother"
      },
      timestamp: "4:14 PM"
    },
    student: {
      name: "Jamie Spencer"
    },
    topic: "Absent Monday, 9/12",
    status: "action_needed",
    reasonForAbsence: "Excused - Bullying"
  },
  {
    id: '2',
    latestMessage: {
      content: "Hi Marcus! It's Crystal Springs Middle School. We noticed Shelly wasn't at scho...",
      sender: {
        name: "Marcus Anthony",
        relation: "Shelly's father"
      },
      timestamp: "4:14 PM"
    },
    student: {
      name: "Shelly Anthony"
    },
    topic: "Absent Monday, 9/11",
    status: "action_needed",
    reasonForAbsence: "Excused - Bullying"
  },
  // Add more mock data as needed
]

export default function Conversations() {
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
          <Button variant='secondary' className='rounded-full border-none'>In Progress</Button>
          <Button variant='secondary' className='rounded-full border-none'>Action Needed</Button>
          <Button variant='secondary' className='rounded-full border-none'>Completed</Button>
        </div>
      </div>
      {/* Table */}
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
                    {conversation.latestMessage.sender.name.charAt(0)}
                  </div>
                  <div>
                    <div className='flex flex-row gap-2 items-center'>
                      <div className="font-semibold">{conversation.latestMessage.sender.name}</div>
                      <div className="text-sm bg-secondary py-1 px-2 rounded-md">{conversation.latestMessage.sender.relation}</div>
                    </div>
                    <div className="text-sm truncate max-w-80">{conversation.latestMessage.content}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className='truncate'>{conversation.student.name}</TableCell>
              <TableCell className='truncate'>{conversation.topic}</TableCell>
              <TableCell>
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                  <span className='truncate'>{conversation.status.replace('_', ' ')}</span>
                  <ChevronDownIcon className="w-4 h-4 ml-2" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <span className='truncate'>{conversation.reasonForAbsence}</span>
                  <ChevronDownIcon className="w-4 h-4 ml-2" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}