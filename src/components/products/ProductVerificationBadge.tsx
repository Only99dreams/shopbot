import { AlertTriangle, BadgeCheck, Clock, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'flagged';

export interface VerificationDetails {
  source?: string;
  checked_at?: string;
  nafdac_number?: string;
  product_name?: string | null;
  registration_status?: string | null;
  approval_date?: string | null;
  expiry_date?: string | null;
  applicant?: string | null;
  category?: string | null;
  found?: boolean;
  active?: boolean;
}

const CONFIG: Record<VerificationStatus, {
  label: string;
  shortLabel: string;
  icon: typeof BadgeCheck;
  className: string;
}> = {
  verified: {
    label: 'NAFDAC Verified Original',
    shortLabel: 'Verified',
    icon: BadgeCheck,
    className: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  },
  flagged: {
    label: 'Not found in the NAFDAC Greenbook',
    shortLabel: 'Unverified NAFDAC',
    icon: AlertTriangle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  pending: {
    label: 'NAFDAC verification pending',
    shortLabel: 'Pending',
    icon: Clock,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  unverified: {
    label: 'No NAFDAC number provided',
    shortLabel: 'Not verified',
    icon: HelpCircle,
    className: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
};

export function ProductVerificationBadge({
  status,
  details,
  compact = false,
  className,
}: {
  status?: VerificationStatus | string | null;
  details?: VerificationDetails | null;
  compact?: boolean;
  className?: string;
}) {
  const key = (status ?? 'unverified') as VerificationStatus;
  const config = CONFIG[key] ?? CONFIG.unverified;
  const Icon = config.icon;

  const badge = (
    <Badge variant="outline" className={cn('gap-1 rounded-full', config.className, className)}>
      <Icon className="h-3.5 w-3.5" />
      {compact ? config.shortLabel : config.label}
    </Badge>
  );

  if (!details) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">
        <p className="font-semibold">{config.label}</p>
        {details.nafdac_number && <p>NRN: {details.nafdac_number}</p>}
        {details.product_name && <p>Greenbook name: {details.product_name}</p>}
        {details.registration_status && <p>Status: {details.registration_status}</p>}
        {details.applicant && <p>Applicant: {details.applicant}</p>}
        {details.expiry_date && <p>Expires: {details.expiry_date}</p>}
        {details.checked_at && (
          <p className="text-muted-foreground">
            Checked {new Date(details.checked_at).toLocaleString()}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
