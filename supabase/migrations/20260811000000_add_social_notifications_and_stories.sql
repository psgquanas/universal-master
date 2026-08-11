ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT;

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.story_likes (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.story_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Connected users can view stories" ON public.stories;
CREATE POLICY "Connected users can view stories" ON public.stories FOR SELECT USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.friendships f WHERE (f.user_a = auth.uid() AND f.user_b = author_id) OR (f.user_b = auth.uid() AND f.user_a = author_id))
);
DROP POLICY IF EXISTS "Users can create their stories" ON public.stories;
CREATE POLICY "Users can create their stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Users can view post likes" ON public.post_likes;
CREATE POLICY "Users can view post likes" ON public.post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their post likes" ON public.post_likes;
CREATE POLICY "Users can remove their post likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view post comments" ON public.post_comments;
CREATE POLICY "Users can view post comments" ON public.post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can comment on posts" ON public.post_comments;
CREATE POLICY "Users can comment on posts" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Users can view shares they sent or received" ON public.post_shares;
CREATE POLICY "Users can view shares they sent or received" ON public.post_shares FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can share posts" ON public.post_shares;
CREATE POLICY "Users can share posts" ON public.post_shares FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Users can record story views" ON public.story_views;
CREATE POLICY "Users can record story views" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
DROP POLICY IF EXISTS "Users can view story likes" ON public.story_likes;
CREATE POLICY "Users can view story likes" ON public.story_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can like stories" ON public.story_likes;
CREATE POLICY "Users can like stories" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their story likes" ON public.story_likes;
CREATE POLICY "Users can remove their story likes" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view story comments" ON public.story_comments;
CREATE POLICY "Users can view story comments" ON public.story_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can comment on stories" ON public.story_comments;
CREATE POLICY "Users can comment on stories" ON public.story_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Users can view story shares they sent or received" ON public.story_shares;
CREATE POLICY "Users can view story shares they sent or received" ON public.story_shares FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can share stories" ON public.story_shares;
CREATE POLICY "Users can share stories" ON public.story_shares FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);
DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Social media is publicly readable" ON storage.objects;
CREATE POLICY "Social media is publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'social-media');
DROP POLICY IF EXISTS "Users can upload social media" ON storage.objects;
CREATE POLICY "Users can upload social media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'social-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.create_social_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
  notification_type TEXT;
  notification_message TEXT;
  target_post UUID;
  target_story UUID;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    SELECT author_id INTO target_user FROM public.posts WHERE id = NEW.post_id;
    notification_type := 'post_like'; notification_message := 'liked your post'; target_post := NEW.post_id;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    SELECT author_id INTO target_user FROM public.posts WHERE id = NEW.post_id;
    notification_type := 'post_comment'; notification_message := 'commented on your post'; target_post := NEW.post_id;
  ELSIF TG_TABLE_NAME = 'post_shares' THEN
    target_user := NEW.recipient_id;
    notification_type := 'post_share'; notification_message := 'shared a post with you'; target_post := NEW.post_id;
  ELSIF TG_TABLE_NAME = 'story_likes' THEN
    SELECT author_id INTO target_user FROM public.stories WHERE id = NEW.story_id;
    notification_type := 'story_like'; notification_message := 'liked your moment'; target_story := NEW.story_id;
  ELSIF TG_TABLE_NAME = 'story_comments' THEN
    SELECT author_id INTO target_user FROM public.stories WHERE id = NEW.story_id;
    notification_type := 'story_comment'; notification_message := 'commented on your moment'; target_story := NEW.story_id;
  ELSIF TG_TABLE_NAME = 'story_shares' THEN
    target_user := NEW.recipient_id;
    notification_type := 'story_share'; notification_message := 'shared a moment with you'; target_story := NEW.story_id;
  END IF;

  IF target_user IS NOT NULL AND target_user <> auth.uid() THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, post_id, story_id, message)
    VALUES (target_user, auth.uid(), notification_type, 'New activity', notification_message, target_post, target_story, notification_message);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_post_like ON public.post_likes;
CREATE TRIGGER notify_post_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
CREATE TRIGGER notify_post_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
DROP TRIGGER IF EXISTS notify_post_share ON public.post_shares;
CREATE TRIGGER notify_post_share AFTER INSERT ON public.post_shares FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
DROP TRIGGER IF EXISTS notify_story_like ON public.story_likes;
CREATE TRIGGER notify_story_like AFTER INSERT ON public.story_likes FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
DROP TRIGGER IF EXISTS notify_story_comment ON public.story_comments;
CREATE TRIGGER notify_story_comment AFTER INSERT ON public.story_comments FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();
DROP TRIGGER IF EXISTS notify_story_share ON public.story_shares;
CREATE TRIGGER notify_story_share AFTER INSERT ON public.story_shares FOR EACH ROW EXECUTE FUNCTION public.create_social_notification();

CREATE OR REPLACE FUNCTION public.create_connection_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, message)
    VALUES (NEW.recipient_id, NEW.sender_id, 'friend_request', 'New connection request', 'sent you a connection request', 'sent you a connection request');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, title, body, message)
    VALUES (NEW.sender_id, NEW.recipient_id, 'friend_accepted', 'Connection accepted', 'accepted your connection request', 'accepted your connection request');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_friend_request ON public.friend_requests;
CREATE TRIGGER notify_friend_request AFTER INSERT OR UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.create_connection_notification();
