import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PaymentProof {
  id: string;
  payment_type: 'subscription' | 'order';
  reference_id: string;
  shop_id: string;
  amount: number;
  proof_image_url: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
}

export function useBankDetails() {
  return useQuery({
    queryKey: ['bank-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'bank_details')
        .single();

      if (error) throw error;
      return data?.value as unknown as BankDetails;
    },
  });
}

export function usePaymentProofs(status?: string) {
  return useQuery({
    queryKey: ['payment-proofs', status],
    queryFn: async () => {
      let query = supabase
        .from('payment_proofs')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentProof[];
    },
  });
}

export function useCreatePaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proof: {
      payment_type: 'subscription' | 'order';
      reference_id: string;
      shop_id: string;
      amount: number;
      proof_image_url?: string;
      customer_name?: string;
      customer_phone?: string;
    }) => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .insert(proof)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      toast.success("Payment proof submitted for review");
    },
    onError: (error) => {
      console.error("Error creating payment proof:", error);
      toast.error("Failed to submit payment proof");
    },
  });
}

export function useReviewPaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proofId,
      status,
      adminNotes,
      reviewedBy,
    }: {
      proofId: string;
      status: 'approved' | 'rejected';
      adminNotes?: string;
      reviewedBy: string;
    }) => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', proofId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
    },
    onError: (error) => {
      console.error("Error reviewing payment proof:", error);
      toast.error("Failed to review payment proof");
    },
  });
}

export async function uploadPaymentProof(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `proofs/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(filePath);

  return publicUrl;
}
