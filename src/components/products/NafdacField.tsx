import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ProductVerificationBadge,
  type VerificationDetails,
  type VerificationStatus,
} from './ProductVerificationBadge';

export interface NafdacVerificationResult {
  status: VerificationStatus;
  details: VerificationDetails;
}

export function NafdacField({
  value,
  onChange,
  productId,
  status,
  details,
  onVerified,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  productId?: string;
  status?: VerificationStatus | string | null;
  details?: VerificationDetails | null;
  onVerified?: (result: NafdacVerificationResult) => void;
  disabled?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState<NafdacVerificationResult | null>(null);

  useEffect(() => {
    setPreview(null);
  }, [value]);

  const verify = async () => {
    if (!value.trim()) {
      toast.error('Enter a NAFDAC registration number first');
      return;
    }

    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-nafdac', {
        body: {
          nafdacNumber: value.trim(),
          productId: productId || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Verification failed');
      }

      const result: NafdacVerificationResult = {
        status: data.status,
        details: data.details,
      };
      setPreview(result);
      onVerified?.(result);

      if (data.status === 'verified') {
        toast.success('Verified in the NAFDAC Greenbook');
      } else {
        toast.warning('This NAFDAC number was not found as an active registration');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setChecking(false);
    }
  };

  const effectiveStatus = preview?.status ?? status;
  const effectiveDetails = preview?.details ?? details;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="nafdac_number">NAFDAC number</Label>
        {effectiveStatus && effectiveStatus !== 'unverified' && (
          <ProductVerificationBadge status={effectiveStatus} details={effectiveDetails} compact />
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id="nafdac_number"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="e.g. 01-1234 or B4-2768"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={verify}
          disabled={checking || disabled || !value.trim()}
          className="flex-shrink-0"
        >
          {checking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
          Verify
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Found on the product packaging. We check it against the official NAFDAC Greenbook.
        Products without a number stay marked "Not verified".
      </p>
    </div>
  );
}
