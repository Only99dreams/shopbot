import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const MODEL = 'gemini-2.5-flash';
const MAX_BYTES = 120 * 1024 * 1024; // 120 MB
const POLL_TIMEOUT_MS = 110_000;

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const responseSchema = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string' },
          suggested_price_ngn: { type: 'number' },
          nafdac_number: { type: 'string' },
          confidence: { type: 'number' },
          best_frame_seconds: { type: 'number' },
          bounding_box: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            required: ['x', 'y', 'width', 'height'],
          },
        },
        required: ['name', 'description', 'suggested_price_ngn', 'confidence', 'best_frame_seconds'],
      },
    },
  },
  required: ['products'],
};

const prompt = `You are cataloguing the physical products shown in a Nigerian shop walkthrough video.

Watch the whole video. Products are shown one after another. For EACH distinct product that is clearly visible, return one entry.

Rules:
- "name": a specific, shopper-friendly product name including brand, variant and size when visible (e.g. "Indomie Instant Noodles Chicken Flavour 70g", "Dettol Original Soap 110g"). Do not use generic names like "product" or "item".
- "description": one or two sentences describing what it is.
- "category": a short category such as Food & Groceries, Beverages, Beauty & Personal Care, Household, Electronics, Fashion, Baby Care, Health.
- "brand": brand name if visible, otherwise empty string.
- "suggested_price_ngn": a realistic retail price in Nigerian Naira based on the product and size. Use 0 if you genuinely cannot estimate.
- "nafdac_number": the NAFDAC registration number ONLY if it is clearly readable on the packaging (formats look like 01-1234, A7-5678, B4-2768). Never guess or invent a number. Use an empty string when it is not clearly visible.
- "best_frame_seconds": the timestamp (in seconds from the start) where this product is clearest and most complete.
- "bounding_box": the product's bounding box in that frame, with x, y, width and height as fractions of the frame size (0 to 1).
- "confidence": 0 to 1, how confident you are that this is a real, distinct product.

Skip hands, faces, shop fittings, shelves, price tags, and duplicate views of the same product. Return at most 30 products. If no products are visible, return an empty array.`;

interface GeminiFile {
  name: string;
  uri: string;
  mimeType?: string;
  state?: string;
  error?: { message?: string };
}

async function uploadToGemini(apiKey: string, bytes: Uint8Array, mimeType: string): Promise<GeminiFile> {
  const startResponse = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `shop-video-${Date.now()}` } }),
  });

  if (!startResponse.ok) {
    const text = await startResponse.text();
    throw new Error(`Gemini upload could not start (${startResponse.status}): ${text.slice(0, 300)}`);
  }

  const uploadUrl = startResponse.headers.get('x-goog-upload-url')
    ?? startResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('Gemini did not return an upload URL');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Gemini upload failed (${uploadResponse.status}): ${text.slice(0, 300)}`);
  }

  const uploaded = await uploadResponse.json();
  const file = uploaded?.file as GeminiFile | undefined;
  if (!file?.name || !file?.uri) {
    throw new Error('Gemini did not return a file reference');
  }
  return file;
}

async function waitForActive(apiKey: string, file: GeminiFile): Promise<GeminiFile> {
  const startedAt = Date.now();
  let current = file;

  while (current.state !== 'ACTIVE') {
    if (current.state === 'FAILED') {
      throw new Error(current.error?.message || 'Gemini could not process this video');
    }
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('The video is taking too long to process. Please upload a shorter clip.');
    }
    await sleep(3000);
    const response = await fetch(`${GEMINI_BASE}/v1beta/${current.name}?key=${apiKey}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error(`Could not check the Gemini file (${response.status})`);
    }
    current = await response.json() as GeminiFile;
  }

  return current;
}

async function deleteGeminiFile(apiKey: string, name: string) {
  try {
    await fetch(`${GEMINI_BASE}/v1beta/${name}?key=${apiKey}`, { method: 'DELETE' });
  } catch (error) {
    console.warn('Could not delete Gemini file:', error);
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error('Gemini returned an unreadable response');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let geminiFileName: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  let videoPath: string | null = null;

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return jsonResponse({
        success: false,
        configured: false,
        error: 'Video analysis is not configured yet (GEMINI_API_KEY is missing). Ask the platform admin to add it.',
      });
    }

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
    videoPath = body?.videoPath as string | undefined;
    const shopId = body?.shopId as string | undefined;
    const mimeType = (body?.mimeType as string | undefined) || 'video/mp4';

    if (!videoPath || !shopId) {
      return jsonResponse({ success: false, error: 'A video path and shop id are required' });
    }

    admin = createClient(supabaseUrl, serviceKey);

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, owner_id, name')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError || !shop) {
      return jsonResponse({ success: false, error: 'Shop not found' });
    }

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!roleRow;

    if (!isAdmin && shop.owner_id !== userData.user.id) {
      return jsonResponse({ success: false, error: 'You can only import products for your own shop' });
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from('product-videos')
      .download(videoPath);

    if (downloadError || !blob) {
      console.error('Video download error:', downloadError);
      return jsonResponse({ success: false, error: 'Could not read the uploaded video' });
    }

    if (blob.size > MAX_BYTES) {
      return jsonResponse({
        success: false,
        error: 'The video is too large. Please upload a clip under 120 MB (about 2-3 minutes).',
      });
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());

    console.log('Uploading video to Gemini:', { bytes: bytes.byteLength, mimeType });
    const file = await uploadToGemini(apiKey, bytes, mimeType);
    geminiFileName = file.name;
    const activeFile = await waitForActive(apiKey, file);

    const generationResponse = await fetch(
      `${GEMINI_BASE}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { file_data: { mime_type: activeFile.mimeType || mimeType, file_uri: activeFile.uri } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        signal: AbortSignal.timeout(120000),
      },
    );

    if (!generationResponse.ok) {
      const text = await generationResponse.text();
      console.error('Gemini generateContent failed:', text);
      return jsonResponse({
        success: false,
        error: `Video analysis failed (${generationResponse.status}). Please try a shorter video.`,
      });
    }

    const generation = await generationResponse.json();
    const blockReason = generation?.promptFeedback?.blockReason;
    if (blockReason) {
      return jsonResponse({ success: false, error: `The video was blocked by the AI provider (${blockReason})` });
    }

    const text = generation?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('') ?? '';

    if (!text) {
      return jsonResponse({ success: false, error: 'The AI did not return any products' });
    }

    const parsed = extractJson(text) as { products?: unknown[] };
    const products = Array.isArray(parsed?.products) ? parsed.products : [];

    return jsonResponse({
      success: true,
      configured: true,
      products,
      product_count: products.length,
      model: MODEL,
    });
  } catch (error) {
    console.error('analyze-shop-video error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Video analysis failed',
    });
  } finally {
    if (geminiFileName) {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (apiKey) await deleteGeminiFile(apiKey, geminiFileName);
    }
    // The uploaded source video is no longer needed once analysis finishes.
    if (admin && videoPath) {
      try {
        await admin.storage.from('product-videos').remove([videoPath]);
      } catch (cleanupError) {
        console.warn('Could not remove source video:', cleanupError);
      }
    }
  }
});
