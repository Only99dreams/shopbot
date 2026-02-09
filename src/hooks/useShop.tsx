import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface ShopContextType {
  shop: Shop | null;
  subscription: Subscription | null;
  loading: boolean;
  updateShop: (updates: Partial<Omit<Shop, 'settings'>> & { settings?: Json }) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShop = useCallback(async () => {
    if (!user) return;

    try {
      console.log('Fetching shop for user:', user.id);
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (shopError) throw shopError;
      
      console.log('Shop data:', shopData);
      
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
          address: shopData.address,
          bank_name: shopData.bank_name ?? null,
          account_number: shopData.account_number ?? null,
          account_name: shopData.account_name ?? null,
        });

        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('shop_id', shopData.id)
          .maybeSingle();

        if (subError) throw subError;
        
        console.log('Subscription data:', subData);
        setSubscription(subData);
      }
    } catch (error) {
      console.error('Error fetching shop:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchShop();
    } else {
      setShop(null);
      setSubscription(null);
      setLoading(false);
    }
  }, [user, fetchShop]);

  // Realtime listener: auto-refresh when subscription or shop status changes
  useEffect(() => {
    if (!shop?.id) return;

    const channel = supabase
      .channel(`shop-sub-${shop.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `shop_id=eq.${shop.id}`,
        },
        (payload) => {
          console.log('Subscription changed (realtime):', payload);
          if (payload.new) {
            setSubscription(payload.new as Subscription);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shops',
          filter: `id=eq.${shop.id}`,
        },
        (payload) => {
          console.log('Shop changed (realtime):', payload);
          if (payload.new) {
            setShop(prev => prev ? { ...prev, is_active: (payload.new as any).is_active } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shop?.id]);

  const updateShop = useCallback(async (updates: Partial<Omit<Shop, 'settings'>> & { settings?: Json }) => {
    if (!shop) return { error: new Error('No shop found') };

    const { error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shop.id);

    if (!error) {
      setShop(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error: error ? new Error(error.message) : null };
  }, [shop]);

  return (
    <ShopContext.Provider value={{ shop, subscription, loading, updateShop, refetch: fetchShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
