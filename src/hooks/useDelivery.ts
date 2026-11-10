import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface DeliveryAgent {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  state: string;
  city: string;
  address: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  id_type: string;
  id_number: string;
  id_document_url: string | null;
  selfie_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_available: boolean;
  rejection_reason: string | null;
  rating: number;
  total_deliveries: number;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryWallet {
  id: string;
  agent_id: string;
  available_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface DeliveryPayoutRequest {
  id: string;
  agent_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface AgentDelivery {
  assignment_id: string;
  order_id: string;
  order_number: string;
  status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  delivery_fee: number;
  agent_earning: number;
  state: string;
  city: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  item_count: number;
  items: { name: string; quantity: number }[];
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
}

export interface DeliveryApplication {
  full_name: string;
  phone: string;
  email?: string | null;
  state: string;
  city: string;
  address?: string | null;
  vehicle_type: string;
  vehicle_plate?: string | null;
  id_type: string;
  id_number: string;
  id_document_url?: string | null;
  selfie_url?: string | null;
}

const DELIVERIES_KEY = 'agent-deliveries';

export function useDelivery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const agentQuery = useQuery({
    queryKey: ['delivery-agent', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_agents')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DeliveryAgent | null;
    },
  });

  const agent = agentQuery.data ?? null;

  const walletQuery = useQuery({
    queryKey: ['delivery-wallet', agent?.id],
    enabled: !!agent?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_wallets')
        .select('*')
        .eq('agent_id', agent!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DeliveryWallet | null;
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ['delivery-payouts', agent?.id],
    enabled: !!agent?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_payout_requests')
        .select('*')
        .eq('agent_id', agent!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliveryPayoutRequest[];
    },
  });

  const deliveriesQuery = useQuery({
    queryKey: [DELIVERIES_KEY, agent?.id, agent?.status],
    enabled: !!agent?.id && agent?.status === 'approved',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_deliveries');
      if (error) throw error;
      return (data ?? []) as AgentDelivery[];
    },
  });

  // Refresh whenever any assignment changes (another agent accepts, status
  // moves, or a new paid order appears).
  useEffect(() => {
    if (!agent?.id || agent.status !== 'approved') return;
    const channel = supabase
      .channel(`agent-deliveries:${agent.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignments' },
        () => {
          queryClient.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
          queryClient.invalidateQueries({ queryKey: ['delivery-wallet', agent.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agent?.id, agent?.status, queryClient]);

  const apply = useMutation({
    mutationFn: async (application: DeliveryApplication) => {
      if (!userId) throw new Error('Please sign in first');

      const existing = agentQuery.data;
      if (existing) {
        const { data, error } = await supabase
          .from('delivery_agents')
          .update(application)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as DeliveryAgent;
      }

      const { data, error } = await supabase
        .from('delivery_agents')
        .insert({ ...application, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as DeliveryAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-agent', userId] });
      toast.success('Application submitted', {
        description: 'We will review your details and notify you once approved.',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not submit your application');
    },
  });

  const setAvailability = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (!agent?.id) throw new Error('Delivery agent profile not found');
      const { error } = await supabase
        .from('delivery_agents')
        .update({ is_available: isAvailable })
        .eq('id', agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-agent', userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptDelivery = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase.rpc('accept_delivery', {
        p_assignment_id: assignmentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
      toast.success('Delivery accepted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not accept this delivery'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: 'picked_up' | 'delivered' | 'cancelled' }) => {
      const { data, error } = await supabase.rpc('update_delivery_status', {
        p_assignment_id: assignmentId,
        p_status: status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DELIVERIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ['delivery-wallet', agent?.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-agent', userId] });
      toast.success('Delivery updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update the delivery'),
  });

  const requestPayout = useMutation({
    mutationFn: async (input: {
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName: string;
    }) => {
      const { data, error } = await supabase.rpc('request_delivery_payout', {
        p_amount: input.amount,
        p_bank_name: input.bankName,
        p_account_number: input.accountNumber,
        p_account_name: input.accountName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-wallet', agent?.id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-payouts', agent?.id] });
      toast.success('Payout request submitted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not request payout'),
  });

  const uploadDocument = async (file: File, folder: string): Promise<string> => {
    if (!userId) throw new Error('Please sign in first');
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
    const { error } = await supabase.storage.from('delivery-documents').upload(path, file);
    if (error) throw error;
    return path;
  };

  return {
    agent,
    wallet: walletQuery.data ?? null,
    payouts: payoutsQuery.data ?? [],
    deliveries: deliveriesQuery.data ?? [],
    isLoading: agentQuery.isLoading,
    isApproved: agent?.status === 'approved',
    apply,
    setAvailability,
    acceptDelivery,
    updateStatus,
    requestPayout,
    uploadDocument,
    refetchAgent: agentQuery.refetch,
    refetchDeliveries: deliveriesQuery.refetch,
  };
}

export function useDeliveryAdmin() {
  const queryClient = useQueryClient();

  const agentsQuery = useQuery({
    queryKey: ['admin-delivery-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_agents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeliveryAgent[];
    },
  });

  const payoutsQuery = useQuery({
    queryKey: ['admin-delivery-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_payout_requests')
        .select('*, delivery_agents(full_name, phone, state, city)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const feesQuery = useQuery({
    queryKey: ['admin-delivery-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_fees')
        .select('*')
        .order('state')
        .order('city');
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewAgent = useMutation({
    mutationFn: async ({ agentId, action, reason }: { agentId: string; action: 'approve' | 'reject' | 'suspend' | 'reinstate'; reason?: string }) => {
      const { data, error } = await supabase.rpc('review_delivery_agent', {
        p_agent_id: agentId,
        p_action: action,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-agents'] });
      toast.success('Delivery agent updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewPayout = useMutation({
    mutationFn: async ({ requestId, action, note }: { requestId: string; action: 'approve' | 'reject'; note?: string }) => {
      const { data, error } = await supabase.rpc('review_delivery_payout', {
        p_request_id: requestId,
        p_action: action,
        p_note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-payouts'] });
      toast.success('Payout updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveFee = useMutation({
    mutationFn: async ({ id, state, city, fee, isActive }: { id?: string; state: string; city: string; fee: number; isActive: boolean }) => {
      if (id) {
        const { error } = await supabase
          .from('delivery_fees')
          .update({ fee, is_active: isActive })
          .eq('id', id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('delivery_fees')
        .insert({ state, city, fee, is_active: isActive });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-fees'] });
      toast.success('Delivery fee saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delivery_fees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-fees'] });
      toast.success('Delivery fee removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    agents: agentsQuery.data ?? [],
    payouts: payoutsQuery.data ?? [],
    fees: feesQuery.data ?? [],
    isLoading: agentsQuery.isLoading,
    reviewAgent,
    reviewPayout,
    saveFee,
    deleteFee,
  };
}
