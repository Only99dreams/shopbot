import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GREENBOOK_URL = 'http://greenbook.nafdac.gov.ng/';

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeNrn(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '').trim();
}

interface GreenbookRow {
  product_id?: number;
  product_name?: string;
  NAFDAC?: string;
  status?: string;
  approval_date?: string;
  expiry_date?: string;
  deleted_at?: string | null;
  applicant_name?: string;
  manufacturer_name?: string;
  category_name?: string;
  form_name?: string;
  strength?: string;
  pack_size?: string;
}

async function lookupGreenbook(nrn: string): Promise<{
  found: boolean;
  active: boolean;
  row: GreenbookRow | null;
  recordsFiltered: number;
}> {
  const params = new URLSearchParams({
    draw: '1',
    start: '0',
    length: '25',
    'search[value]': nrn,
    'search[regex]': 'false',
  });

  const response = await fetch(`${GREENBOOK_URL}?${params.toString()}`, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': 'ShopAfrica/1.0 (NAFDAC verification)',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Greenbook responded with ${response.status}`);
  }

  const payload = await response.json();
  const rows: GreenbookRow[] = Array.isArray(payload?.data) ? payload.data : [];
  const target = normalizeNrn(nrn);

  const exact = rows.find((row) => normalizeNrn(row?.NAFDAC) === target) ?? null;
  if (!exact) {
    return { found: false, active: false, row: null, recordsFiltered: Number(payload?.recordsFiltered ?? 0) };
  }

  const statusText = String(exact.status ?? '').toLowerCase();
  const expired = exact.expiry_date ? new Date(exact.expiry_date) < new Date() : false;
  const active = !exact.deleted_at && !expired && !statusText.includes('inactive')
    && !statusText.includes('withdrawn') && !statusText.includes('cancelled');

  return { found: true, active, row: exact, recordsFiltered: Number(payload?.recordsFiltered ?? 0) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Authentication required' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ success: false, error: 'Authentication required' });
    }

    const body = await req.json().catch(() => ({}));
    const productId = body?.productId as string | undefined;
    let nafdacNumber = normalizeNrn(body?.nafdacNumber);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!roleRow;

    let product: Record<string, unknown> | null = null;

    if (productId) {
      const { data, error } = await admin
        .from('products')
        .select('id, shop_id, name, nafdac_number, shops(owner_id)')
        .eq('id', productId)
        .maybeSingle();

      if (error || !data) {
        return jsonResponse({ success: false, error: 'Product not found' });
      }

      const ownerId = (data as { shops?: { owner_id?: string } }).shops?.owner_id;
      if (!isAdmin && ownerId !== userData.user.id) {
        return jsonResponse({ success: false, error: 'You can only verify your own products' });
      }

      product = data as Record<string, unknown>;
      if (!nafdacNumber) {
        nafdacNumber = normalizeNrn(data.nafdac_number);
      }
    }

    if (!nafdacNumber) {
      return jsonResponse({
        success: false,
        error: 'A NAFDAC registration number is required',
      });
    }

    let result;
    try {
      result = await lookupGreenbook(nafdacNumber);
    } catch (lookupError) {
      console.error('Greenbook lookup failed:', lookupError);
      return jsonResponse({
        success: false,
        error: 'The NAFDAC Greenbook is currently unreachable. Please try again later.',
      });
    }

    const status = result.found && result.active ? 'verified' : 'flagged';
    const details = {
      source: 'NAFDAC Greenbook',
      checked_at: new Date().toISOString(),
      nafdac_number: nafdacNumber,
      found: result.found,
      active: result.active,
      records_filtered: result.recordsFiltered,
      product_name: result.row?.product_name ?? null,
      registration_status: result.row?.status ?? null,
      approval_date: result.row?.approval_date ?? null,
      expiry_date: result.row?.expiry_date ?? null,
      applicant: result.row?.applicant_name ?? null,
      category: result.row?.category_name ?? null,
      form: result.row?.form_name ?? null,
      strength: result.row?.strength ?? null,
      pack_size: result.row?.pack_size ?? null,
    };

    if (productId) {
      const { error: updateError } = await admin
        .from('products')
        .update({
          nafdac_number: nafdacNumber,
          verification_status: status,
          verification_details: details,
          verified_at: new Date().toISOString(),
          verified_by: null,
        })
        .eq('id', productId);

      if (updateError) {
        console.error('Failed to save verification:', updateError);
        return jsonResponse({ success: false, error: 'Could not save the verification result' });
      }
    }

    return jsonResponse({
      success: true,
      status,
      found: result.found,
      active: result.active,
      nafdac_number: nafdacNumber,
      details,
    });
  } catch (error) {
    console.error('verify-nafdac error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    });
  }
});
