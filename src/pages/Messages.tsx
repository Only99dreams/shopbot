import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, Image, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Conversation {
  id: string;
  shop_id: string;
  buyer_id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  // Joined from profiles
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  is_read?: boolean;
  created_at: string;
}

export default function Messages() {
  const { shop } = useShop();
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const selectedConversationRef = useRef<Conversation | null>(null);

  // Keep ref in sync with state for use in realtime callback
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  // Fetch conversations when shop is available
  useEffect(() => {
    if (shop?.id) {
      fetchConversations();
    }
  }, [shop?.id]);

  // Handle navigation state to open a specific conversation
  useEffect(() => {
    const state: any = (location && (location as any).state) || {};
    const convId = state?.conversationId;
    if (convId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [location, conversations]);

  // Fetch messages when selected conversation changes
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id);
      setShowMobileChat(true);
    }
  }, [selectedConversation?.id]);

  // Real-time listener for new messages
  useEffect(() => {
    if (!shop?.id) return;

    const channel = supabase
      .channel(`seller-messages-${shop.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          const currentConv = selectedConversationRef.current;

          // If message belongs to currently open conversation, append it
          if (currentConv?.id && msg.conversation_id === currentConv.id) {
            setMessages((prev) => {
              // Prevent duplicates
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
          }

          // Update conversations list
          setConversations((prev) =>
            prev.map((c) =>
              c.id === msg.conversation_id
                ? {
                    ...c,
                    last_message: msg.content || "📷 Photo",
                    last_message_at: msg.created_at,
                    unread_count:
                      currentConv?.id === msg.conversation_id
                        ? c.unread_count
                        : (c.unread_count || 0) + 1,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [shop?.id, scrollToBottom]);

  const fetchConversations = async () => {
    if (!shop?.id) return;

    // Fetch conversations for this shop, joining buyer profile data
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        profiles:buyer_id (
          full_name,
          email,
          phone
        )
      `)
      .eq("shop_id", shop.id)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }

    if (data) {
      const mapped: Conversation[] = data.map((conv: any) => ({
        id: conv.id,
        shop_id: conv.shop_id,
        buyer_id: conv.buyer_id,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: conv.unread_count,
        buyer_name: conv.profiles?.full_name || null,
        buyer_email: conv.profiles?.email || null,
        buyer_phone: conv.profiles?.phone || null,
      }));
      setConversations(mapped);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    if (data) {
      setMessages(data as Message[]);
      scrollToBottom();
    }
  };

  const uploadChatImage = async (file: File, conversationId: string) => {
    if (!currentUserId) return null;
    setUploading(true);
    try {
      const filePath = `chat/${conversationId}/${currentUserId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("chat-images").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error(error);
      toast.error("Image upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (imageUrl?: string | null) => {
    if (!selectedConversation || !currentUserId || !shop) return;
    const hasText = newMessage.trim().length > 0;
    if (!hasText && !imageUrl) return;

    const content = hasText ? newMessage.trim() : "";
    const receiverId = selectedConversation.buyer_id;

    // Clear input immediately for responsiveness
    const msgText = content;
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      receiver_id: receiverId,
      content: msgText,
      image_url: imageUrl || null,
      is_read: false,
    });

    if (error) {
      toast.error("Failed to send message");
      setNewMessage(msgText); // Restore on failure
      return;
    }

    // Update conversation metadata
    await supabase
      .from("conversations")
      .update({
        last_message: msgText || "📷 Photo",
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selectedConversation.id);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation?.id) return;
    const imageUrl = await uploadChatImage(file, selectedConversation.id);
    if (imageUrl) {
      await sendMessage(imageUrl);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);

    // Mark messages as read
    if (conv.id && currentUserId) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conv.id)
        .eq("receiver_id", currentUserId);
      await supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conv.id);

      // Update local state
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
      );
    }
  };

  const getBuyerDisplayName = (conv: Conversation) => {
    return conv.buyer_name || conv.buyer_email || conv.buyer_phone || "Customer";
  };

  const getBuyerInitials = (conv: Conversation) => {
    const name = getBuyerDisplayName(conv);
    return name.slice(0, 2).toUpperCase();
  };

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.buyer_name?.toLowerCase().includes(q) ||
      conv.buyer_email?.toLowerCase().includes(q) ||
      conv.buyer_phone?.includes(q) ||
      conv.last_message?.toLowerCase().includes(q)
    );
  });

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);

    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-5.5rem)] lg:min-h-[calc(100vh-2rem)] p-4 sm:p-6 lg:p-8">
        <div className="h-full flex flex-col lg:flex-row gap-6">
          {/* Conversations List */}
          <Card className={cn(
            "w-full lg:max-w-sm shadow-card flex flex-col",
            showMobileChat ? "hidden lg:flex" : "flex"
          )}>
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
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">
                    {conversations.length === 0
                      ? "No conversations yet. Customers can message you from your shop page."
                      : "No conversations match your search."}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border",
                      selectedConversation?.id === conv.id && "bg-muted/50"
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getBuyerInitials(conv)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">
                          {getBuyerDisplayName(conv)}
                        </h3>
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || "No messages yet"}
                      </p>
                    </div>
                    {conv.unread_count != null && conv.unread_count > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Chat Area */}
          <Card className={cn(
            "flex-1 shadow-card flex flex-col min-h-[calc(100vh-15.5rem)] lg:min-h-[calc(100vh-12rem)]",
            showMobileChat ? "flex" : "hidden lg:flex"
          )}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden flex-shrink-0"
                    onClick={() => setShowMobileChat(false)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getBuyerInitials(selectedConversation)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">
                      {getBuyerDisplayName(selectedConversation)}
                    </h3>
                    {selectedConversation.buyer_email && (
                      <p className="text-sm text-muted-foreground truncate">
                        {selectedConversation.buyer_email}
                      </p>
                    )}
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
                    <>
                      {messages.map((msg) => {
                        const isOutbound = msg.sender_id === currentUserId;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "max-w-[70%] p-3 rounded-lg",
                              isOutbound
                                ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted rounded-bl-none"
                            )}
                          >
                            {msg.content && <p className="break-words">{msg.content}</p>}
                            {msg.image_url && (
                              <img
                                src={msg.image_url}
                                alt="Chat upload"
                                className="mt-2 rounded-md max-h-64 object-cover cursor-pointer"
                                onClick={() => window.open(msg.image_url!, '_blank')}
                              />
                            )}
                            <span className={cn(
                              "text-xs mt-1 block",
                              isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {formatTime(msg.created_at)}
                              {isOutbound && msg.is_read && " ✓✓"}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-shrink-0"
                    >
                      <Image className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button onClick={() => sendMessage()} disabled={!newMessage.trim() && !uploading} className="flex-shrink-0">
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
                <h2 className="text-2xl font-bold mb-2">Messages</h2>
                <p className="text-muted-foreground max-w-md">
                  Select a conversation to view messages or wait for customers to reach out.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
