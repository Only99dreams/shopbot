import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, Phone, MoreVertical, Image, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  direction: string;
  content: string | null;
  message_type: string;
  created_at: string;
}

export default function Messages() {
  const { shop } = useShop();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (shop?.id) {
      fetchConversations();
    }
  }, [shop?.id]);

  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const fetchConversations = async () => {
    if (!shop?.id) return;
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("shop_id", shop.id)
      .order("last_message_at", { ascending: false });
    
    if (data) setConversations(data);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    // TODO: Integrate with Twilio to actually send the message
    const { error } = await supabase.from("whatsapp_messages").insert({
      conversation_id: selectedConversation.id,
      direction: "outbound",
      content: newMessage,
      message_type: "text",
    });

    if (!error) {
      setNewMessage("");
      fetchMessages(selectedConversation.id);
      
      // Update last message
      await supabase.from("whatsapp_conversations").update({
        last_message: newMessage,
        last_message_at: new Date().toISOString(),
      }).eq("id", selectedConversation.id);
    }
  };

  const filteredConversations = conversations.filter(conv => 
    conv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.customer_phone.includes(searchQuery)
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  // Demo data for empty state
  const demoConversations: Conversation[] = [
    { id: "1", customer_phone: "+234 801 234 5678", customer_name: "John Doe", last_message: "I'd like to order the white sneakers", last_message_at: new Date().toISOString(), unread_count: 2 },
    { id: "2", customer_phone: "+234 802 345 6789", customer_name: "Jane Smith", last_message: "Is the leather bag still available?", last_message_at: new Date(Date.now() - 3600000).toISOString(), unread_count: 0 },
    { id: "3", customer_phone: "+234 803 456 7890", customer_name: "Mike Johnson", last_message: "Thanks for the quick delivery!", last_message_at: new Date(Date.now() - 86400000).toISOString(), unread_count: 0 },
  ];

  const displayConversations = conversations.length > 0 ? filteredConversations : demoConversations;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] p-6 lg:p-8">
        <div className="h-full flex gap-6">
          {/* Conversations List */}
          <Card className="w-full max-w-sm shadow-card flex flex-col">
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-bold mb-4">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search conversations..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {displayConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border",
                    selectedConversation?.id === conv.id && "bg-muted/50"
                  )}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(conv.customer_name || conv.customer_phone).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate">
                        {conv.customer_name || conv.customer_phone}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message || "No messages yet"}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 shadow-card flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(selectedConversation.customer_name || selectedConversation.customer_phone).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {selectedConversation.customer_name || selectedConversation.customer_phone}
                      </h3>
                      <p className="text-sm text-muted-foreground">{selectedConversation.customer_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="p-4 rounded-full bg-primary/10 mb-4">
                        <Send className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold">No messages yet</h3>
                      <p className="text-muted-foreground text-sm">
                        Start the conversation by sending a message
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "max-w-[70%] p-3 rounded-lg",
                          msg.direction === "outbound"
                            ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted rounded-bl-none"
                        )}
                      >
                        <p>{msg.content}</p>
                        <span className={cn(
                          "text-xs mt-1 block",
                          msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Image className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="p-4 rounded-full bg-primary/10 mb-6">
                  <img src="/logo.png" alt="ShopAfrica" className="h-16 w-16 object-contain" />
                </div>
                <h2 className="text-2xl font-bold mb-2">WhatsApp Messages</h2>
                <p className="text-muted-foreground max-w-md">
                  Select a conversation to view messages or wait for customers to reach out via WhatsApp.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
