import { useCallback, useEffect } from 'react';

import { useRealtimeRecovery } from '@/hooks/use-realtime-recovery';
import { markAllChatsDelivered, markChatDelivered } from '@/lib/chats';
import { supabase } from '@/lib/supabase';

export function RealtimeLifecycle({ userId }: { userId?: string }) {
  const recover = useCallback(async () => {
    if (!userId) return;
    await markAllChatsDelivered().catch((error) => console.warn('[realtime] delivery recovery failed', error));
  }, [userId]);

  useRealtimeRecovery(recover);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`delivery:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const chatId = (payload.new as { chat_id?: string }).chat_id;
        if (chatId) void markChatDelivered(chatId);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void recover();
      });

    return () => { void supabase.removeChannel(channel); };
  }, [recover, userId]);

  return null;
}
