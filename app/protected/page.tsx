"use client"
import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Conversations() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState<{ type: string, content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Fetch initial conversations
    fetchConversations();

    // Set up real-time subscription
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, handleConversationChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        status,
        rfa,
        guardians (first_name, last_name),
        messages (content)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
    } else {
      setConversations(data);
    }
  };

  const handleConversationChange = (payload) => {
    console.log('Conversation change:', payload);
    fetchConversations(); // Refetch all conversations for simplicity
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: "error", content: "Please select a file to upload" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/initiate_conversations", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to initiate conversations");
      }

      const result = await response.json();
      setMessage({
        type: "success",
        content: `Initiated ${result.initiated_conversations.length} conversations`
      });
    } catch (error: any) {
      setMessage({ type: "error", content: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Conversations</h1>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} className="w-64" />
          <Button onClick={handleUpload} disabled={isLoading}>
            {isLoading ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {message ? (
            <p className={`text-sm ${message.type === "error" ? "text-red-500" : "text-green-500"}`}>
              {message.content}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to initiate conversations
            </p>
          )}
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guardian Name</TableHead>
            <TableHead>Latest Message</TableHead>
            <TableHead>RFA</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conversation) => (
            <TableRow key={conversation.id}>
              <TableCell>{`${conversation.guardians.first_name} ${conversation.guardians.last_name}`}</TableCell>
              <TableCell>{conversation.messages[0]?.content || 'No messages yet'}</TableCell>
              <TableCell>{conversation.rfa || 'Not set'}</TableCell>
              <TableCell>{conversation.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}