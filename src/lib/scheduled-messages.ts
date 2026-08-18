import { getCurrentProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export type ScheduleStatus = 'pending' | 'recurring' | 'sent' | 'failed';

export interface ScheduledMessageRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  recipient_name: string;
  content: string;
  scheduled_for: string;
  total_days: number;
  days_sent: number;
  status: ScheduleStatus;
  paused: boolean;
  last_sent_at?: string | null;
  last_error?: string | null;
  timezone: string;
  retry_count: number;
  last_attempt_at?: string | null;
  created_at: string;
}

export interface ScheduleRecipient {
  id: string;
  name: string;
}

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function requireProfileId() {
  const profile = await getCurrentProfile();
  if (!profile?.id) throw new Error('Your profile could not be found.');
  return profile.id;
}

export async function getScheduleRecipients(): Promise<ScheduleRecipient[]> {
  const profileId = await requireProfileId();
  const { data: friendships, error: friendshipError } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${profileId},user_b.eq.${profileId}`);
  if (friendshipError) throw friendshipError;

  const ids = [...new Set((friendships ?? []).map((row) => row.user_a === profileId ? row.user_b : row.user_a))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('id, full_name, username').in('id', ids);
  if (error) throw error;
  return (data ?? []).map((profile) => ({
    id: profile.id,
    name: profile.full_name?.trim() || profile.username || 'User',
  }));
}

export async function getScheduledMessages(): Promise<ScheduledMessageRecord[]> {
  const profileId = await requireProfileId();
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('sender_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const recipientIds = [...new Set(rows.map((row) => row.recipient_id))];
  const names = new Map<string, string>();
  if (recipientIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles').select('id, full_name, username').in('id', recipientIds);
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name?.trim() || profile.username || 'User');
  }
  return rows.map((row) => ({ ...row, recipient_name: names.get(row.recipient_id) || 'User' })) as ScheduledMessageRecord[];
}

export async function saveScheduledMessage(input: {
  id?: string;
  recipientId: string;
  content: string;
  scheduledFor: Date;
  totalDays: number;
  timeZone: string;
}) {
  const senderId = await requireProfileId();
  const payload = {
    sender_id: senderId,
    recipient_id: input.recipientId,
    content: input.content.trim(),
    scheduled_for: input.scheduledFor.toISOString(),
    total_days: input.totalDays,
    timezone: input.timeZone,
    paused: false,
    retry_count: 0,
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabase.from('scheduled_messages').update({ ...payload, status: 'pending' }).eq('id', input.id).eq('sender_id', senderId)
    : supabase.from('scheduled_messages').insert({ ...payload, days_sent: 0, status: 'pending' });
  const { error } = await query;
  if (error) throw error;
}

export async function deleteScheduledMessage(id: string) {
  const { error } = await supabase.from('scheduled_messages').delete().eq('id', id);
  if (error) throw error;
}

export async function setScheduledMessagePaused(id: string, paused: boolean) {
  const { error } = await supabase.from('scheduled_messages').update({ paused, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function sendScheduledMessageNow(id: string) {
  const { data, error } = await supabase.rpc('send_scheduled_message_now', { schedule_id: id });
  if (error) throw error;
  if (data !== true) throw new Error('This scheduled message could not be sent.');
}
