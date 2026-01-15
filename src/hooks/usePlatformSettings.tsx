import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface SubscriptionPlan {
  name: string;
  price: number;
  features: string[];
}

export interface SubscriptionPlans {
  starter: SubscriptionPlan;
  pro: SubscriptionPlan;
  business: SubscriptionPlan;
}

export interface ReferralEarnings {
  signup_bonus: number;
  subscription_percentage: number;
  min_payout: number;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;

      // Transform array to object keyed by setting key
      const settings: Record<string, PlatformSetting> = {};
      data?.forEach((setting) => {
        settings[setting.key] = setting as PlatformSetting;
      });

      return settings;
    }
  });
}

export function useSubscriptionPlans() {
  const { data: settings, ...rest } = usePlatformSettings();
  
  const plans = settings?.subscription_plans?.value as SubscriptionPlans | undefined;
  
  return {
    data: plans,
    ...rest
  };
}

export function useReferralEarnings() {
  const { data: settings, ...rest } = usePlatformSettings();
  
  const earnings = settings?.referral_earnings?.value as ReferralEarnings | undefined;
  
  return {
    data: earnings,
    ...rest
  };
}

export function useUpdatePlatformSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => {
      const { data, error } = await supabase
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    }
  });
}
