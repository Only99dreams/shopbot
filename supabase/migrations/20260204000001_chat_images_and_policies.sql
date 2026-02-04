-- Enable chat image upload and secure chat access

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Conversations policies
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
ON public.conversations
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = conversations.shop_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;
CREATE POLICY "Participants can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = conversations.shop_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
ON public.conversations
FOR UPDATE
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = conversations.shop_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Messages policies
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
ON public.messages
FOR SELECT
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.shops s ON s.id = c.shop_id
    WHERE c.id = messages.conversation_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.buyer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.shops s ON s.id = c.shop_id
      WHERE c.id = messages.conversation_id
        AND s.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
CREATE POLICY "Participants can update messages"
ON public.messages
FOR UPDATE
USING (
  sender_id = auth.uid()
  OR receiver_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read chat images" ON storage.objects;
CREATE POLICY "Public read chat images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS "Authenticated upload chat images" ON storage.objects;
CREATE POLICY "Authenticated upload chat images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');
