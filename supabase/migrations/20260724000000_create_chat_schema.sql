-- 1. Create custom Enums (if they don't exist)
DO $$ BEGIN
  CREATE TYPE chat_type AS ENUM ('individual', 'group');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'voice', 'sticker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create 'profiles' table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio_status TEXT DEFAULT 'Hey there! I am using ChatApp',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'chats' table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type chat_type NOT NULL DEFAULT 'individual',
  name TEXT, -- only required for group chats
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create 'chat_participants' table
CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role chat_role NOT NULL DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, profile_id)
);

-- 5. Create 'messages' table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_type message_type NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
DO $$ BEGIN
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 7. Define RLS Policies

-- Profiles: Anyone can view profiles, but only the user can update their own profile.
DO $$ BEGIN
  CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Chats: Users can only see chats they are a participant in.
DO $$ BEGIN
  CREATE POLICY "Users can view their chats" ON chats FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants 
      WHERE chat_id = chats.id AND profile_id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create chats" ON chats FOR INSERT WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Chat Participants: Users can see participants of chats they belong to.
DO $$ BEGIN
  CREATE POLICY "Users can view participants of their chats" ON chat_participants FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants AS cp
      WHERE cp.chat_id = chat_participants.chat_id AND cp.profile_id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can add participants" ON chat_participants FOR INSERT WITH CHECK (
    profile_id = auth.uid() OR -- User adding themselves (e.g. creating a chat)
    EXISTS (
      SELECT 1 FROM chat_participants 
      WHERE chat_id = chat_participants.chat_id AND profile_id = auth.uid() AND role = 'admin'
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Messages: Users can see and send messages in chats they are part of.
DO $$ BEGIN
  CREATE POLICY "Users can view messages in their chats" ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants 
      WHERE chat_id = messages.chat_id AND profile_id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert messages in their chats" ON messages FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_participants 
      WHERE chat_id = messages.chat_id AND profile_id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. Create Trigger to automatically create a profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name)
  VALUES (
    new.id,
    new.phone,
    new.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
