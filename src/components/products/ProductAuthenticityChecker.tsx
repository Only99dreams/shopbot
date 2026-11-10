import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Loader2, ShieldAlert, ShieldCheck, ShieldX, Sparkles, Upload, X,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1280;

type Verdict = 'original' | 'suspicious' | 'fake' | 'needs_photo';
type Stage = 'photo' | 'analyzing' | 'result';

interface CheckResult {
  verdict: Verdict;
  summary?: string;
  pack: {
    product_name: string;
    brand: string;
    nafdac_number: string;
    batch_number: string;
    manufacturer: string;
    confidence: number;
  };
  registration: {
    product_name: string | null;
    status: string | null;
    approval_date: string | null;
    expiry_date: string | null;
    applicant: string | null;
    manufacturer: string | null;
    category: string | null;
    form: string | null;
    strength: string | null;
    pack_size: string | null;
  } | null;
  name_match: boolean | null;
  checked_at?: string;
}

interface PreparedPhoto {
  base64: string;
  mimeType: string;
  preview: string;
}

interface ProductAuthenticityCheckerProps {
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

const VERDICT_STYLES: Record<Verdict, {
  title: string;
  icon: typeof ShieldCheck;
  wrapper: string;
  badge: string;
}> = {
  original: {
    title: 'Looks original',
    icon: ShieldCheck,
    wrapper: 'border-green-500/30 bg-green-500/5',
    badge: 'border-green-500/30 bg-green-500/10 text-green-700',
  },
  suspicious: {
    title: 'Be careful',
    icon: ShieldAlert,
    wrapper: 'border-amber-500/30 bg-amber-500/5',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  },
  fake: {
    title: 'Likely fake',
    icon: ShieldX,
    wrapper: 'border-destructive/30 bg-destructive/5',
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  needs_photo: {
    title: 'NAFDAC number not visible',
    icon: Camera,
    wrapper: 'border-muted-foreground/30 bg-muted/40',
    badge: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read this photo. Try another one.'));
    image.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this photo'));
    reader.readAsDataURL(blob);
  });
}

async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this photo');
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not prepare this photo');

    const dataUrl = await blobToDataUrl(blob);
    return {
      base64: dataUrl.split(',')[1] ?? '',
      mimeType: 'image/jpeg',
      preview: URL.createObjectURL(blob),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ProductAuthenticityChecker({
  label = 'Check if a product is real',
  variant = 'default',
  size = 'lg',
  className,
}: ProductAuthenticityCheckerProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('photo');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<string | null>(null);

  const clearPhoto = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPhoto(null);
    setFileName(null);
  }, []);

  const reset = useCallback(() => {
    setStage('photo');
    setResult(null);
    setError(null);
    setPreparing(false);
    clearPhoto();
    if (inputRef.current) inputRef.current.value = '';
  }, [clearPhoto]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFile = async (file: File | null) => {
    setError(null);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo of the product.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That photo is too large. Please use an image under 15 MB.');
      return;
    }

    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = prepared.preview;
      setPhoto(prepared);
      setFileName(file.name);
      setResult(null);
      setStage('photo');
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'Could not read this photo');
    } finally {
      setPreparing(false);
    }
  };

  const analyze = async () => {
    if (!photo) {
      setError('Take or choose a photo first.');
      return;
    }

    setStage('analyzing');
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('check-product-authenticity', {
        body: {
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
        },
      });

      if (invokeError) {
        let message = invokeError.message || 'Could not check this product';
        try {
          if (invokeError.context && typeof invokeError.context.json === 'function') {
            const body = await invokeError.context.json();
            message = body?.error || message;
          }
        } catch {
          // Keep the original message.
        }
        throw new Error(message);
      }

      if (data?.configured === false) {
        throw new Error(data?.error || 'Product checks are not available yet.');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Could not check this product');
      }

      setResult(data as CheckResult);
      setStage('result');
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : 'Could not check this product');
      setStage('photo');
    }
  };

  const verdict = result ? VERDICT_STYLES[result.verdict] : null;
  const VerdictIcon = verdict?.icon;
  const confidence = result ? Math.round((result.pack.confidence ?? 0) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={cn('gap-2', className)}>
          <Camera className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check if a product is real</DialogTitle>
          <DialogDescription>
            Take a clear photo of the pack, including the NAFDAC number, and we will check it
            against the NAFDAC Greenbook.
          </DialogDescription>
        </DialogHeader>

        {stage !== 'result' && (
          <div className="space-y-4">
            <div
              className={cn(
                'rounded-2xl border-2 border-dashed p-6 text-center',
                error ? 'border-destructive/40 bg-destructive/5' : 'border-muted-foreground/25 bg-muted/30',
              )}
            >
              {photo ? (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border bg-background">
                    <img src={photo.preview} alt="Product pack" className="h-56 w-full object-contain" />
                  </div>
                  {fileName && <p className="truncate text-xs text-muted-foreground">{fileName}</p>}
                  <div className="flex justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Change photo
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    {preparing ? (
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    ) : (
                      <Camera className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Take a photo of the pack</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Front of the pack, well lit, with the NAFDAC number readable.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={preparing}>
                    <Camera className="mr-2 h-4 w-4" />
                    {preparing ? 'Preparing photo...' : 'Open camera or choose photo'}
                  </Button>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  handleFile(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {stage === 'analyzing' ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                <p className="font-medium">Reading the pack...</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This usually takes a few seconds.
                </p>
              </div>
            ) : (
              <Button className="w-full rounded-full" onClick={analyze} disabled={!photo || preparing}>
                <Sparkles className="mr-2 h-4 w-4" />
                Check this product
              </Button>
            )}
          </div>
        )}

        {stage === 'result' && result && verdict && VerdictIcon && (
          <div className="space-y-4">
            <div className={cn('rounded-2xl border p-4', verdict.wrapper)}>
              <div className="flex items-start gap-3">
                <VerdictIcon className="mt-0.5 h-6 w-6 flex-shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{verdict.title}</p>
                    <Badge variant="outline" className={cn('rounded-full', verdict.badge)}>
                      {result.verdict === 'needs_photo' ? 'Retake needed' : 'NAFDAC check'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.summary || (result.verdict === 'needs_photo'
                      ? 'We could not read a NAFDAC number. Move closer, avoid glare, and keep the number in focus.'
                      : 'Check the details below before buying.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-3 text-sm">
              <DetailRow label="NAFDAC number" value={result.pack.nafdac_number || null} />
              <DetailRow label="Product on pack" value={result.pack.product_name || null} />
              <DetailRow label="Brand" value={result.pack.brand || null} />
              <DetailRow label="Batch number" value={result.pack.batch_number || null} />
              <DetailRow label="Manufacturer on pack" value={result.pack.manufacturer || null} />
              <DetailRow label="Registered product" value={result.registration?.product_name ?? null} />
              <DetailRow label="Registration status" value={result.registration?.status ?? null} />
              <DetailRow label="Approved" value={formatDate(result.registration?.approval_date)} />
              <DetailRow label="Expires" value={formatDate(result.registration?.expiry_date)} />
              <DetailRow label="Applicant" value={result.registration?.applicant ?? null} />
              <DetailRow
                label="Photo clarity"
                value={result.pack.confidence > 0 ? `${confidence}%` : null}
              />
            </div>

            {result.name_match === false && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                The number is registered, but the product name on the pack differs from the
                registered product. Ask the seller to explain before buying.
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1 rounded-full" onClick={reset}>
                <Camera className="mr-2 h-4 w-4" />
                Check another photo
              </Button>
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This checks the NAFDAC number printed on the pack against the official Greenbook.
          It cannot detect a counterfeit that copies a genuine number.
        </p>
      </DialogContent>
    </Dialog>
  );
}
