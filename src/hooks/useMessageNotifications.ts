import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMessageNotifications() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.data?.user?.id;
      if (!userId) return;

      const { count: c } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);
      if (mounted) setCount(c || 0);

      const channel = supabase.channel('public:messages').on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          if (msg && msg.receiver_id === userId) {
            setCount((n) => n + 1);
          }
        }
      ).subscribe();

      // listen to updates (mark read)
      const channel2 = supabase.channel('public:messages:update').on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          const old = payload.old as any;
          if (msg && old && msg.receiver_id === userId) {
            // if is_read changed from false to true, decrement
            if (!old.is_read && msg.is_read) setCount((n) => Math.max(0, n - 1));
          }
        }
      ).subscribe();

      return () => {
        channel.unsubscribe();
        channel2.unsubscribe();
      };
    }
    init();
    return () => { mounted = false; };
  }, []);

  return { count };
}
