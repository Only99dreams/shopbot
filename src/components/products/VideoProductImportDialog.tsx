import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useShop } from '@/hooks/useShop';
import { useProducts, type Category } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Clapperboard, ImageOff, Loader2, RefreshCw,
  Sparkles, Trash2, Upload, Wand2,
} from 'lucide-react';

const MAX_BYTES = 120 * 1024 * 1024;

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnalyzedProduct {
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  suggested_price_ngn?: number;
  nafdac_number?: string;
  confidence?: number;
  best_frame_seconds?: number;
  bounding_box?: BoundingBox;
}

interface DraftProduct {
  key: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  categoryId: string;
  nafdac: string;
  include: boolean;
  confidence: number;
  frameSeconds: number;
  imageFile: File | null;
  imagePreview: string | null;
  imageError: string | null;
}

type Stage = 'idle' | 'analyzing' | 'review' | 'saving';

interface VideoProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImported?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };
    video.onloadedmetadata = () => {
      cleanup();
      resolve({ video, url });
    };
    video.onerror = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this video file. Try an MP4 or MOV clip.'));
    };
  });
}

function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = clamp(seconds, 0, Math.max(0, (video.duration || 0) - 0.05));
    if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
      resolve();
      return;
    }

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const onSeeked = () => finish();
    const onError = () => finish(new Error('Could not read this video file'));
    const timer = window.setTimeout(() => finish(), 8000);

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = target;
    } catch {
      finish();
    }
  });
}

async function captureFrame(video: HTMLVideoElement, product: AnalyzedProduct): Promise<File> {
  const seconds = Number(product.best_frame_seconds ?? 0);
  await seekVideo(video, Number.isFinite(seconds) ? seconds : 0);

  const frameWidth = video.videoWidth || 1280;
  const frameHeight = video.videoHeight || 720;
  const box = product.bounding_box;

  let sx = 0;
  let sy = 0;
  let sw = frameWidth;
  let sh = frameHeight;

  if (box && box.width > 0 && box.height > 0) {
    sx = clamp(box.x, 0, 1) * frameWidth;
    sy = clamp(box.y, 0, 1) * frameHeight;
    sw = clamp(box.width, 0.01, 1) * frameWidth;
    sh = clamp(box.height, 0.01, 1) * frameHeight;

    // Add a little breathing room around the product so the image is not
    // cropped tight to its edges.
    const padX = sw * 0.08;
    const padY = sh * 0.08;
    sx = clamp(sx - padX, 0, frameWidth - 1);
    sy = clamp(sy - padY, 0, frameHeight - 1);
    sw = clamp(sw + padX * 2, 1, frameWidth - sx);
    sh = clamp(sh + padY * 2, 1, frameHeight - sy);
  }

  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the product image');
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not capture a product image');

  return new File([blob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

function guessCategoryId(categoryName: string | undefined, categories: Category[]): string {
  if (!categoryName) return '';
  const target = categoryName.trim().toLowerCase();
  if (!target) return '';

  const exact = categories.find((category) => category.name.trim().toLowerCase() === target);
  if (exact) return exact.id;

  const partial = categories.find((category) => {
    const name = category.name.trim().toLowerCase();
    return name.includes(target) || target.includes(name);
  });
  return partial?.id ?? '';
}

export function VideoProductImportDialog({
  open,
  onOpenChange,
  categories,
  onImported,
}: VideoProductImportDialogProps) {
  const { user } = useAuth();
  const { shop } = useShop();
  const { createProduct, uploadImage } = useProducts();

  const [stage, setStage] = useState<Stage>('idle');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const revokePreviews = useCallback((items: DraftProduct[]) => {
    items.forEach((item) => {
      if (item.imagePreview) URL.revokeObjectURL(item.imagePreview);
    });
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setVideoFile(null);
    setVideoError(null);
    setAnalyzeError(null);
    setSavedCount(0);
    setSaveTotal(0);
    setDrafts((current) => {
      revokePreviews(current);
      return [];
    });
    videoElementRef.current = null;
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [revokePreviews]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
  }, []);

  const handleFileChange = (file: File | null) => {
    setAnalyzeError(null);
    setVideoError(null);

    if (!file) {
      setVideoFile(null);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setVideoError('Please choose a video file (MP4 or MOV).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setVideoError('The video is too large. Please upload a clip under 120 MB (about 2-3 minutes).');
      return;
    }

    setVideoFile(file);
  };

  const analyze = async () => {
    if (!videoFile) {
      setVideoError('Choose a video first.');
      return;
    }
    if (!user?.id) {
      setAnalyzeError('Please sign in again before importing products.');
      return;
    }
    if (!shop?.id) {
      setAnalyzeError('We could not find your shop. Please refresh and try again.');
      return;
    }

    setStage('analyzing');
    setAnalyzeError(null);

    let loaded: { video: HTMLVideoElement; url: string };
    try {
      loaded = await loadVideo(videoFile);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : 'Could not read this video file.');
      setStage('idle');
      return;
    }

    const { video, url } = loaded;

    videoElementRef.current = video;
    videoUrlRef.current = url;

    try {
      const extension = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const videoPath = `${user.id}/${unique}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('product-videos')
        .upload(videoPath, videoFile, {
          contentType: videoFile.type || 'video/mp4',
          upsert: false,
        });

      if (uploadError) throw new Error(`Could not upload the video: ${uploadError.message}`);

      const { data, error } = await supabase.functions.invoke('analyze-shop-video', {
        body: {
          videoPath,
          shopId: shop.id,
          mimeType: videoFile.type || 'video/mp4',
        },
      });

      if (error) {
        let message = error.message || 'Video analysis failed';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            message = body?.error || message;
          }
        } catch {
          // Keep the original message.
        }
        throw new Error(message);
      }

      if (data?.configured === false) {
        throw new Error(data?.error || 'Video analysis is not configured yet.');
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Video analysis failed');
      }

      const analyzed: AnalyzedProduct[] = Array.isArray(data.products) ? data.products : [];
      if (analyzed.length === 0) {
        throw new Error('No products were detected in this video. Try a clearer, well-lit walkthrough.');
      }

      const nextDrafts: DraftProduct[] = analyzed.slice(0, 30).map((product, index) => ({
        key: `product-${index}-${Date.now()}`,
        name: (product.name || '').trim(),
        description: (product.description || '').trim(),
        price: product.suggested_price_ngn && product.suggested_price_ngn > 0
          ? String(Math.round(product.suggested_price_ngn))
          : '',
        stock: '1',
        categoryId: guessCategoryId(product.category, categories),
        nafdac: (product.nafdac_number || '').trim().toUpperCase(),
        include: true,
        confidence: Number(product.confidence ?? 0),
        frameSeconds: Number(product.best_frame_seconds ?? 0),
        imageFile: null,
        imagePreview: null,
        imageError: null,
      }));

      // Capture product images in the browser from the local video so the
      // original upload never has to be sent to us again.
      const captured: DraftProduct[] = [];
      for (let index = 0; index < nextDrafts.length; index += 1) {
        const draft = nextDrafts[index];
        try {
          const frame = await captureFrame(video, analyzed[index]);
          captured.push({
            ...draft,
            imageFile: frame,
            imagePreview: URL.createObjectURL(frame),
          });
        } catch (error) {
          captured.push({
            ...draft,
            imageError: error instanceof Error ? error.message : 'Could not capture an image',
          });
        }
      }

      setDrafts(captured);
      setStage('review');
      toast.success(`Found ${captured.length} product${captured.length === 1 ? '' : 's'}`);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : 'Video analysis failed');
      setStage('idle');
    }
  };

  const updateDraft = (key: string, updates: Partial<DraftProduct>) => {
    setDrafts((current) => current.map((draft) => (
      draft.key === key ? { ...draft, ...updates } : draft
    )));
  };

  const removeDraft = (key: string) => {
    setDrafts((current) => {
      const target = current.find((draft) => draft.key === key);
      if (target?.imagePreview) URL.revokeObjectURL(target.imagePreview);
      return current.filter((draft) => draft.key !== key);
    });
  };

  const selectedDrafts = drafts.filter((draft) => draft.include);

  const importProducts = async () => {
    if (selectedDrafts.length === 0) {
      toast.error('Select at least one product to import');
      return;
    }

    const missingPrice = selectedDrafts.find((draft) => !draft.price || Number(draft.price) <= 0);
    if (missingPrice) {
      toast.error(`Enter a price for "${missingPrice.name || 'this product'}"`);
      return;
    }

    const missingName = selectedDrafts.find((draft) => !draft.name.trim());
    if (missingName) {
      toast.error('Every selected product needs a name');
      return;
    }

    setStage('saving');
    setSavedCount(0);
    setSaveTotal(selectedDrafts.length);

    let saved = 0;
    try {
      for (const draft of selectedDrafts) {
        let imageUrl: string | undefined;
        if (draft.imageFile) {
          imageUrl = await uploadImage(draft.imageFile);
        }

        const created = await createProduct.mutateAsync({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          price: Number(draft.price),
          compare_at_price: null,
          stock_quantity: draft.stock ? Math.max(0, parseInt(draft.stock, 10)) : 0,
          category_id: draft.categoryId || null,
          nafdac_number: draft.nafdac.trim() || null,
          is_available: true,
          images: imageUrl ? [imageUrl] : [],
        });

        if (created?.id && draft.nafdac.trim()) {
          supabase.functions
            .invoke('verify-nafdac', { body: { productId: created.id } })
            .catch((error) => console.error('NAFDAC verification failed:', error));
        }

        saved += 1;
        setSavedCount(saved);
      }

      toast.success(`Imported ${saved} product${saved === 1 ? '' : 's'} from your video`);
      onImported?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import the products');
      setStage('review');
    }
  };

  const progress = saveTotal > 0 ? Math.round((savedCount / saveTotal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && stage !== 'saving') onOpenChange(false); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            Import products from a video
          </DialogTitle>
          <DialogDescription>
            Record a short walkthrough of your goods, one after another. We will detect each
            product, capture its image, and let you review the details before saving.
          </DialogDescription>
        </DialogHeader>

        {stage === 'idle' && (
          <div className="space-y-5">
            <div
              className={cn(
                'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
                videoError ? 'border-destructive/40 bg-destructive/5' : 'border-muted-foreground/25 bg-muted/30',
              )}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <p className="font-medium">
                {videoFile ? videoFile.name : 'Choose a walkthrough video'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                MP4 or MOV, up to 120 MB. Show each product clearly for a few seconds.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {videoFile ? 'Choose a different video' : 'Select video'}
                </Button>
                {videoFile && (
                  <Button variant="ghost" onClick={() => handleFileChange(null)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
            </div>

            {videoError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {videoError}
              </div>
            )}

            {analyzeError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {analyzeError}
              </div>
            )}

            <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                What happens next
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>1. We scan the video and find each distinct product.</li>
                <li>2. We capture a photo of each product from the video.</li>
                <li>3. You edit names, prices and stock, then import.</li>
                <li>4. NAFDAC numbers are checked against the Greenbook.</li>
              </ul>
            </div>

            <Button
              className="w-full rounded-full"
              size="lg"
              onClick={analyze}
              disabled={!videoFile}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Analyze video
            </Button>
          </div>
        )}

        {stage === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">Watching your video...</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              This can take up to a minute or two depending on the length of the clip.
              Please keep this window open.
            </p>
          </div>
        )}

        {stage === 'review' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {drafts.length} product{drafts.length === 1 ? '' : 's'} found
                </p>
                <p className="text-sm text-muted-foreground">
                  Review the details and edit prices before importing.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedDrafts.length} selected</Badge>
                <Button variant="outline" size="sm" onClick={reset}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Start over
                </Button>
              </div>
            </div>

            {analyzeError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {analyzeError}
              </div>
            )}

            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.key}
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    draft.include ? 'bg-card' : 'bg-muted/40 opacity-70',
                  )}
                >
                  <div className="flex gap-3">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      {draft.imagePreview ? (
                        <img
                          src={draft.imagePreview}
                          alt={draft.name || 'Product'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px] text-muted-foreground">
                          <ImageOff className="h-5 w-5" />
                          {draft.imageError ? 'No image' : 'No image'}
                        </div>
                      )}
                      {draft.confidence > 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          {Math.round(draft.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={draft.include}
                          onCheckedChange={(checked) => updateDraft(draft.key, { include: checked === true })}
                          className="mt-2.5"
                        />
                        <div className="min-w-0 flex-1">
                          <Input
                            value={draft.name}
                            onChange={(event) => updateDraft(draft.key, { name: event.target.value })}
                            placeholder="Product name"
                            className="font-medium"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeDraft(draft.key)}
                          aria-label="Remove product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Textarea
                        value={draft.description}
                        onChange={(event) => updateDraft(draft.key, { description: event.target.value })}
                        placeholder="Description (optional)"
                        rows={2}
                        className="resize-none text-sm"
                      />

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Price (₦) *</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={draft.price}
                            onChange={(event) => updateDraft(draft.key, { price: event.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Stock</Label>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={draft.stock}
                            onChange={(event) => updateDraft(draft.key, { stock: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Category</Label>
                          <Select
                            value={draft.categoryId || 'none'}
                            onValueChange={(value) => updateDraft(draft.key, { categoryId: value === 'none' ? '' : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Uncategorized</SelectItem>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">NAFDAC number</Label>
                          <Input
                            value={draft.nafdac}
                            onChange={(event) => updateDraft(draft.key, { nafdac: event.target.value.toUpperCase() })}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 -mx-6 flex flex-col gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedDrafts.length} of {drafts.length} products will be imported.
              </p>
              <Button
                className="rounded-full"
                onClick={importProducts}
                disabled={selectedDrafts.length === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Import {selectedDrafts.length} product{selectedDrafts.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}

        {stage === 'saving' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">Saving your products...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedCount} of {saveTotal} done
            </p>
            <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
