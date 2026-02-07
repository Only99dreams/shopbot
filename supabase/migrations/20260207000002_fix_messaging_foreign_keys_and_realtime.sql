-- Add foreign key from conversations.buyer_id to profiles.id
-- so we can join buyer profile data when listing conversations

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_buyer_id_fkey
FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from conversations.shop_id to shops.id
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_shop_id_fkey
FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;

-- Enable realtime for messages and conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
