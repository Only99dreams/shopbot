import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Image, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Conversation {
  id: string;
  shop_id: string;
  buyer_id: string;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number | null;
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

export default function ShopChat() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id || null;
      setCurrentUserId(userId);

      if (!userId) return;

      if (shopId) {
        const { data: shopData } = await supabase
          .from("shops")
          .select("name, owner_id")
          .eq("id", shopId)
          .maybeSingle();
        setShopName(shopData?.name || null);
        setSellerId(shopData?.owner_id || null);

        const { data: existing } = await supabase
          .from("conversations")
          .select("*")
          .eq("shop_id", shopId)
          .eq("buyer_id", userId)
          .maybeSingle();

        if (existing) {
          setConversation(existing as Conversation);
          fetchMessages(existing.id);
        } else {
          const { data: created, error } = await supabase
            .from("conversations")
            .insert({ shop_id: shopId, buyer_id: userId })
            .select("*")
            .single();

          if (error) {
            toast.error("Unable to start conversation");
            return;
          }

          setConversation(created as Conversation);
          setMessages([]);
        }
      }
    };

    init();
  }, [shopId]);

  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase.channel(`public:messages:${conversation.id}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new as Message;
        if (msg.conversation_id === conversation.id) {
          setMessages((prev) => [...prev, msg]);
        }
      }
    ).subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversation?.id]);

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data as Message[]);
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
    if (!conversation || !currentUserId) return;
    if (!sellerId) return;

    const hasText = newMessage.trim().length > 0;
    if (!hasText && !imageUrl) return;

    const receiverId = currentUserId === conversation.buyer_id ? sellerId : conversation.buyer_id;
    const content = hasText ? newMessage.trim() : "";

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: currentUserId,
      receiver_id: receiverId,
      content,
      image_url: imageUrl || null,
      is_read: false,
    });

    if (!error) {
      setNewMessage("");
      await supabase.from("conversations").update({
        last_message: content || "📷 Photo",
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
      }).eq("id", conversation.id);
      fetchMessages(conversation.id);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation?.id) return;
    const imageUrl = await uploadChatImage(file, conversation.id);
    if (imageUrl) {
      await sendMessage(imageUrl);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!currentUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold mb-2">Sign in to message the seller</h1>
          <p className="text-muted-foreground mb-6">
            You need to sign in before you can send messages.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate("/auth?mode=login")}>Sign In</Button>
            <Link to={`/shop/${shopId}`}>
              <Button variant="outline">Back to Shop</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${shopId}`)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="font-semibold">{shopName ? `Message ${shopName}` : "Message Seller"}</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        <Card className="shadow-card flex flex-col min-h-[calc(100vh-9rem)] h-[calc(100vh-9rem)]">
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
              messages.map((msg) => {
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
                    {msg.content && <p>{msg.content}</p>}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Chat upload"
                        className="mt-2 rounded-md max-h-64 object-cover"
                      />
                    )}
                    <span className={cn(
                      "text-xs mt-1 block",
                      isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

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
              >
                <Image className="h-5 w-5" />
              </Button>
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1"
              />
              <Button onClick={() => sendMessage()} disabled={!newMessage.trim() && !uploading}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
