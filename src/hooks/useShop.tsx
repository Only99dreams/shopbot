import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

interface Shop {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  whatsapp_number: string | null;
  is_active: boolean;
  settings: Json;
  state: string | null;
  city: string | null;
  address: string | null;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export function useShop() {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchShop();
    } else {
      setShop(null);
      setSubscription(null);
      setLoading(false);
    }
  }, [user]);

  const fetchShop = async () => {
    if (!user) return;

    try {
      // Fetch shop
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (shopError) throw shopError;
      if (shopData) {
        setShop({
          id: shopData.id,
          name: shopData.name,
          description: shopData.description,
          logo_url: shopData.logo_url,
          whatsapp_number: shopData.whatsapp_number,
          is_active: shopData.is_active ?? true,
          settings: shopData.settings ?? {},
          state: shopData.state,
          city: shopData.city,
          address: shopData.address
        });

        // Fetch subscription if shop exists
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('shop_id', shopData.id)
          .maybeSingle();

        if (subError) throw subError;
        setSubscription(subData);
      }
    } catch (error) {
      console.error('Error fetching shop:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateShop = async (updates: Partial<Omit<Shop, 'settings'>> & { settings?: Json }) => {
    if (!shop) return { error: new Error('No shop found') };

    const { error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shop.id);

    if (!error) {
      setShop(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error };
  };

  return { shop, subscription, loading, updateShop, refetch: fetchShop };
}
