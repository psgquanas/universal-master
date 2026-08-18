import { supabase } from '@/lib/supabase';
import { notifyFeedChanged } from '@/lib/feed-events';

export type SocialMediaType = 'image' | 'video';

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in first.');
  return data.user.id;
}

export async function getConnectedUserIds(userId: string) {
  const { data, error } = await supabase.from('friendships').select('user_a, user_b').or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (error) throw error;
  return Array.from(new Set((data ?? []).flatMap((row) => [row.user_a, row.user_b]).filter((id) => id !== userId)));
}

export async function getConnectedProfiles(userId: string) {
  const ids = await getConnectedUserIds(userId);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', ids);
  if (error) throw error;
  return data ?? [];
}

export async function getNotifications() {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(full_name, username, avatar_url)').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationsRead(ids?: string[]) {
  const userId = await currentUserId();
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
  if (ids?.length) query = query.in('id', ids);
  const { error } = await query;
  if (error) throw error;
}

export async function getConnectedStories(userId: string) {
  const ids = await getConnectedUserIds(userId);
  const visibleIds = [userId, ...ids];
  const { data, error } = await supabase.from('stories').select('*, profiles!stories_author_id_fkey(full_name, username, avatar_url)').in('author_id', visibleIds).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getConnectedFeed(userId: string) {
  const ids = await getConnectedUserIds(userId);
  const { data: posts, error } = await supabase.from('posts').select('id, author_id, content, content_type, media_url, media_type, created_at, profiles!posts_author_id_fkey(full_name, username, avatar_url)').in('author_id', [userId, ...ids]).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const postIds = (posts ?? []).map((post) => post.id);
  if (!postIds.length) return [];
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id, content, profiles!post_comments_author_id_fkey(full_name, username)').in('post_id', postIds).order('created_at', { ascending: false }),
  ]);
  return (posts ?? []).map((post: any) => ({ ...post, likes: (likes ?? []).filter((like) => like.post_id === post.id), comments: (comments ?? []).filter((comment) => comment.post_id === post.id) }));
}

export async function createPost(input: { content?: string; mediaUrl?: string | null; mediaType?: SocialMediaType | null }) {
  const userId = await currentUserId();
  const content = input.content?.trim() ?? '';

  if (!content && !input.mediaUrl) {
    throw new Error('Write something or add a photo before posting.');
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      content,
      content_type: 'status',
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
    })
    .select('id, author_id, content, content_type, media_url, media_type, created_at, profiles!posts_author_id_fkey(full_name, username, avatar_url)')
    .single();

  if (error) throw error;
  notifyFeedChanged();
  return data;
}

export async function createStory(input: { content?: string; contentType: string; mediaUrl?: string | null }) {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('stories').insert({ author_id: userId, content: input.content?.trim() || null, content_type: input.contentType, media_url: input.mediaUrl ?? null }).select().single();
  if (error) throw error;
  return data;
}

export async function uploadSocialMedia(uri: string, mimeType: string) {
  const userId = await currentUserId();
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const path = `${userId}/${Date.now()}.${extension}`;
  const response = await fetch(uri);
  const file = await response.arrayBuffer();
  const { error } = await supabase.storage.from('social-media').upload(path, file, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return supabase.storage.from('social-media').getPublicUrl(path).data.publicUrl;
}

export async function togglePostLike(postId: string, liked: boolean) {
  const userId = await currentUserId();
  const result = liked ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId) : await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
  if (result.error) throw result.error;
}

export async function addPostComment(postId: string, content: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: userId, content: content.trim() });
  if (error) throw error;
}

export async function toggleStoryLike(storyId: string, liked: boolean) {
  const userId = await currentUserId();
  const result = liked ? await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId) : await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
  if (result.error) throw result.error;
}

export async function addStoryComment(storyId: string, content: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('story_comments').insert({ story_id: storyId, author_id: userId, content: content.trim() });
  if (error) throw error;
}

export async function sharePost(postId: string, recipientId: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('post_shares').insert({ post_id: postId, sender_id: userId, recipient_id: recipientId });
  if (error) throw error;
}

export async function shareStory(storyId: string, recipientId: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('story_shares').insert({ story_id: storyId, sender_id: userId, recipient_id: recipientId });
  if (error) throw error;
}
