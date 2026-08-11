import { supabase } from '@/lib/supabase';

export interface ProfileRecord {
  id: string;
  email?: string | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  gender?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio_status?: string | null;
  username?: string | null;
  last_seen?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Please verify your email and sign in first.');
  return user;
}

export async function getCurrentProfile(): Promise<ProfileRecord | null> {
  const user = await requireUser();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data as ProfileRecord | null) ?? null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const user = await requireUser();
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).neq('id', user.id).maybeSingle();
  if (error) throw error;
  return !data;
}

export async function uploadProfileAvatar(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const user = await requireUser();
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${user.id}/avatar-${Date.now()}.${extension}`;
  const response = await fetch(uri);
  const file = await response.arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: mimeType, upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function saveProfileDraft(input: {
  fullName?: string | null;
  email?: string | null;
  gender?: string | null;
  username?: string | null;
  about?: string | null;
  avatarUrl?: string | null;
}): Promise<ProfileRecord | null> {
  const user = await requireUser();
  const payload = {
    id: user.id,
    email: input.email ?? user.email ?? null,
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.about !== undefined ? { bio_status: input.about } : {}),
    ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select('*').single();
  if (error) throw error;

  const authMetadata = {
    ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
    ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
  };
  if (Object.keys(authMetadata).length > 0) {
    const { error: authError } = await supabase.auth.updateUser({ data: authMetadata });
    if (authError) console.warn('[profile] profile saved but auth metadata sync failed', authError);
  }

  return data as ProfileRecord;
}

export function normalizePhoneNumber(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
}

export function isValidInternationalPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(value));
}

export async function requestPhoneChangeEmailVerification(): Promise<string> {
  const user = await requireUser();
  if (!user.email) throw new Error('A verified email address is required to change your phone number.');

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return user.email;
}

export async function verifyPhoneChangeEmailCode(token: string, newPhone: string): Promise<ProfileRecord> {
  const user = await requireUser();
  if (!user.email) throw new Error('A verified email address is required to change your phone number.');

  const { data: verification, error: verificationError } = await supabase.auth.verifyOtp({
    email: user.email,
    token: token.trim(),
    type: 'email',
  });
  if (verificationError) throw verificationError;
  if (!verification.session) throw new Error('Email verification did not create a secure session.');

  const normalizedPhone = normalizePhoneNumber(newPhone);
  const { data, error } = await supabase.rpc('change_phone_after_email_verification', {
    new_phone: normalizedPhone,
  });
  if (error) throw error;
  if (!data) throw new Error('The phone number could not be updated.');

  const profile = data as ProfileRecord;
  const { error: metadataError } = await supabase.auth.updateUser({ data: { phone: normalizedPhone } });
  if (metadataError) console.warn('[profile] phone saved but auth metadata sync failed', metadataError);
  return profile;
}
