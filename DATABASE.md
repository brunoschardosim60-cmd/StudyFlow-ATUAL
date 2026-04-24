# Database Documentation (Supabase)

## Overview

StudyFlow utiliza Supabase como backend, fornecendo PostgreSQL gerenciado, autenticação, realtime, etc.

## Setup Inicial

### 1. Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova organização/projeto
3. Copie `SUPABASE_URL` e `SUPABASE_ANON_KEY`
4. Adicione a `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Inicializar Cliente Local

```bash
supabase init
supabase start
```

## Estrutura de Migrations

### Diretório

```
supabase/
├── migrations/
│   ├── 20240101000000_initial_schema.sql
│   ├── 20240102000000_add_users_table.sql
│   └── ...
├── functions/
└── config.toml
```

### Criar Nova Migration

```bash
supabase migration new create_users_table
```

Edite em `supabase/migrations/TIMESTAMP_create_users_table.sql`:

```sql
-- Create users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own data
CREATE POLICY "Users can view own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy: Users can update their own data
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);
```

## Principais Tabelas

### Users

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  streak INT DEFAULT 0,
  total_study_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Study Sessions

```sql
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  focus_mode BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_created_at ON public.study_sessions(created_at DESC);
```

### Topics/Subjects

```sql
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_topics_user_id ON public.topics(user_id);
```

### Study Materials

```sql
CREATE TABLE public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_materials_user_id ON public.study_materials(user_id);
CREATE INDEX idx_materials_topic_id ON public.study_materials(topic_id);
```

### Spaced Repetition

```sql
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ease_factor NUMERIC DEFAULT 2.5,
  interval_days INT DEFAULT 1,
  next_review TIMESTAMP DEFAULT NOW(),
  review_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_flashcards_user_id ON public.flashcards(user_id);
CREATE INDEX idx_flashcards_next_review ON public.flashcards(next_review);
```

## Row Level Security (RLS)

### Padrão Básico

```sql
-- Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Allow users to read own data
CREATE POLICY "Users can view own data"
  ON public.table_name
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update own data
CREATE POLICY "Users can update own data"
  ON public.table_name
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to insert own data
CREATE POLICY "Users can insert own data"
  ON public.table_name
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete own data
CREATE POLICY "Users can delete own data"
  ON public.table_name
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Verificar RLS

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

## Seeding Data

### Criar Seed File

`supabase/seeds/sample_data.sql`:

```sql
-- Sample data for development

-- Insert test user
INSERT INTO public.users (email, name, avatar_url)
VALUES ('test@example.com', 'Test User', NULL)
ON CONFLICT DO NOTHING;

-- Get the inserted user ID
WITH user_data AS (
  SELECT id FROM public.users WHERE email = 'test@example.com'
)
INSERT INTO public.topics (user_id, name, description, color)
SELECT id, 'Mathematics', 'Study materials for math', '#3B82F6' FROM user_data
ON CONFLICT DO NOTHING;
```

### Executar Seed

```bash
# Local
supabase db push
supabase db seed -- seed/sample_data.sql

# Production (use with caution)
psql -d "postgresql://..." -f supabase/seeds/production_seed.sql
```

## Realtime Subscriptions

### Subscribe a Changes

```typescript
import { supabase } from "@/integrations/supabase/client";

// Subscribe to study sessions
const subscription = supabase
  .channel("study_sessions")
  .on(
    "postgres_changes",
    {
      event: "*", // INSERT, UPDATE, DELETE
      schema: "public",
      table: "study_sessions",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      console.log("Change received:", payload);
    }
  )
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

## Backups

### Automated Backups

Supabase fornece backups automáticos diários (planos pagos).

### Manual Backup

```bash
# Export database
supabase db pull

# Backup arquivo
pg_dump "postgresql://..." > backup_$(date +%s).sql
```

## Performance & Indexes

### Criar Índices

```sql
-- Index para queries frequentes
CREATE INDEX idx_study_sessions_date ON public.study_sessions(created_at DESC);
CREATE INDEX idx_flashcards_review ON public.flashcards(next_review, user_id);
CREATE INDEX idx_topics_user_priority ON public.topics(user_id, priority DESC);
```

### EXPLAIN Query

```sql
EXPLAIN ANALYZE
SELECT * FROM public.study_sessions 
WHERE user_id = '...' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Monitoramento

### Query Performance

Acesse Supabase Dashboard → Logs → Queries

### Database Usage

- Storage limite
- Real-time connections
- API requests

## Troubleshooting

### RLS Policies Blocking Queries

```typescript
// Use service_role key para bypass RLS (apenas backend)
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(URL, SERVICE_ROLE_KEY);
```

### Migration Conflicts

```bash
# Reset local database
supabase db reset

# Start fresh
supabase start
```

### Connection Issues

Verify `.env` variables:
```bash
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

## Próximos Passos

- [ ] Implementar audit logs (track data changes)
- [ ] Setup automatic backups
- [ ] Configure webhooks para eventos importantes
- [ ] Implement cache invalidation strategy
- [ ] Setup monitoring alerts
