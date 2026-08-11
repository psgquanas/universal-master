import { getCurrentProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export interface FeedPostRecord {
  id: string;
  author_id: string;
  content: string;
  content_type: string;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export async function getFeedPosts(limit = 20): Promise<FeedPostRecord[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, author_id, content, content_type, created_at, profiles!posts_author_id_fkey(full_name, username, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as FeedPostRecord[] | null) ?? [];
}

export async function createStatusPost(content: string): Promise<FeedPostRecord | null> {
  const profile = await getCurrentProfile();

  if (!profile?.id) {
    throw new Error('A profile is required before posting.');
  }

  const payload = {
    author_id: profile.id,
    content,
    content_type: 'status',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('posts').insert(payload).select('id, author_id, content, content_type, created_at').single();

  if (error) {
    throw error;
  }

  return (data as FeedPostRecord | null) ?? null;
}
