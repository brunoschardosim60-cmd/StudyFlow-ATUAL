
CREATE TABLE public.flora_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flora_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages"
  ON public.flora_chat_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_flora_chat_user_created ON public.flora_chat_messages(user_id, created_at DESC);
