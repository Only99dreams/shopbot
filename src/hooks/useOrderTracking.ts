import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrackedOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface TrackedShop {
  id: string;
  name: string;
  logo_url: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface TrackedDestination {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  state: string | null;
  city: string | null;
}

export interface TrackedAgent {
  full_name: string;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  rating: number | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_accuracy: number | null;
  last_location_at: string | null;
}

export interface TrackedDelivery {
  assignment_id: string;
  status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  agent: TrackedAgent | null;
}

export interface TrackedOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  redemption_confirmed: boolean;
  shops: TrackedShop | null;
  order_items: TrackedOrderItem[];
  destination: TrackedDestination | null;
  delivery: TrackedDelivery | null;
}

export const LIVE_TRACKING_STATUSES: TrackedDelivery['status'][] = ['accepted', 'picked_up'];

export function useOrderTracking(orderNumber: string | null) {
  const normalized = orderNumber?.trim().toUpperCase() ?? '';

  return useQuery({
    queryKey: ['order-tracking', normalized],
    enabled: normalized.length >= 4,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('track_order_by_number', {
        p_order_number: normalized,
      });
      if (error) throw error;
      return (data ?? null) as unknown as TrackedOrder | null;
    },
    refetchInterval: (query) => {
      const data = query.state.data as TrackedOrder | null | undefined;
      const status = data?.delivery?.status;
      return status && LIVE_TRACKING_STATUSES.includes(status) ? 10000 : false;
    },
    staleTime: 5000,
  });
}
