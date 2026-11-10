import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle, Clock, Loader2, MapPin, Package, Phone, RefreshCw, Star, Store, Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeafletMap, type MapPoint } from '@/components/map/LeafletMap';
import { LIVE_TRACKING_STATUSES, type TrackedDelivery, type TrackedOrder } from '@/hooks/useOrderTracking';
import { cn } from '@/lib/utils';

const STALE_AFTER_MS = 5 * 60 * 1000;

const statusLabel: Record<TrackedDelivery['status'], string> = {
  open: 'Finding a delivery agent',
  accepted: 'Agent assigned',
  picked_up: 'Picked up — on the way',
  delivered: 'Delivered',
  cancelled: 'Delivery cancelled',
};

const statusTone: Record<TrackedDelivery['status'], string> = {
  open: 'bg-amber-500/10 text-amber-600',
  accepted: 'bg-blue-500/10 text-blue-600',
  picked_up: 'bg-indigo-500/10 text-indigo-600',
  delivered: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-destructive/10 text-destructive',
};

interface TrackedOrderPanelProps {
  order: TrackedOrder;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onReset?: () => void;
  onConfirm?: () => void;
  confirmPending?: boolean;
  showConfirm?: boolean;
}

export function TrackedOrderPanel({
  order,
  isRefreshing = false,
  onRefresh,
  onReset,
  onConfirm,
  confirmPending = false,
  showConfirm = true,
}: TrackedOrderPanelProps) {
  const delivery = order.delivery;
  const agent = delivery?.agent;
  const isLive = delivery ? LIVE_TRACKING_STATUSES.includes(delivery.status) : false;

  const points = useMemo<MapPoint[]>(() => {
    const next: MapPoint[] = [];
    const shop = order.shops;
    if (shop?.latitude != null && shop.longitude != null) {
      next.push({
        id: 'shop',
        kind: 'shop',
        lat: shop.latitude,
        lng: shop.longitude,
        label: shop.name,
        description: [shop.city, shop.state].filter(Boolean).join(', ') || undefined,
      });
    }

    if (agent?.last_lat != null && agent.last_lng != null) {
      const lastSeen = agent.last_location_at ? new Date(agent.last_location_at).getTime() : null;
      const stale = !lastSeen || Date.now() - lastSeen > STALE_AFTER_MS;
      next.push({
        id: 'agent',
        kind: 'agent',
        lat: agent.last_lat,
        lng: agent.last_lng,
        label: agent.full_name,
        description: stale ? 'Last known position' : 'Live position',
        accuracy: agent.last_location_accuracy,
        stale,
      });
    }

    const destination = order.destination;
    if (destination?.latitude != null && destination.longitude != null) {
      next.push({
        id: 'destination',
        kind: 'destination',
        lat: destination.latitude,
        lng: destination.longitude,
        label: 'Delivery address',
        description: destination.address ?? [destination.city, destination.state].filter(Boolean).join(', '),
      });
    }

    return next;
  }, [order, agent]);

  const hasMap = points.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
              {order.shops?.logo_url ? (
                <img src={order.shops.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Store className="h-6 w-6" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold">{order.shops?.name}</h3>
              <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">₦{order.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {delivery && (
          <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3', statusTone[delivery.status])}>
            <span className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4" />
              {statusLabel[delivery.status]}
            </span>
            {isLive && (
              <span className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                Live updates every 10s
              </span>
            )}
          </div>
        )}

        {hasMap ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Delivery map
              </p>
              {onRefresh && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('mr-1 h-3 w-3', isRefreshing && 'animate-spin')} />
                  Refresh
                </Button>
              )}
            </div>
            <LeafletMap
              points={points}
              connectPoints={points.length > 1}
              followPointId={agent?.last_lat != null ? 'agent' : null}
              height={300}
            />
            {agent && isLive && (
              <p className="text-xs text-muted-foreground">
                {agent.last_location_at
                  ? `Agent position updated ${formatDistanceToNow(new Date(agent.last_location_at), { addSuffix: true })}`
                  : 'Waiting for the agent to share their position'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This order has no map location yet. Map tracking appears once the shop and delivery address
              have coordinates.
            </p>
          </div>
        )}

        {agent && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  {agent.full_name}
                  {agent.rating ? (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {agent.rating.toFixed(1)}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[agent.vehicle_type, agent.vehicle_plate].filter(Boolean).join(' · ') || 'Delivery agent'}
                </p>
              </div>
              {agent.phone && (
                <Button asChild size="sm" variant="outline" className="rounded-lg">
                  <a href={`tel:${agent.phone}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                    Call agent
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {order.destination?.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="whitespace-pre-line text-muted-foreground">{order.destination.address}</p>
          </div>
        )}

        <div className="space-y-3">
          {order.order_items.map((item, index) => (
            <div key={`${item.product_name}-${index}`} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{item.product_name}</span>
                <Badge variant="secondary" className="text-xs">{item.quantity}x</Badge>
              </div>
              <span className="text-sm font-medium">₦{item.total_price.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {onReset && (
            <Button variant="outline" className="flex-1" onClick={onReset}>
              Track another order
            </Button>
          )}
          {showConfirm && onConfirm && !order.redemption_confirmed && (
            <Button className="flex-1" onClick={onConfirm} disabled={confirmPending}>
              {confirmPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Confirm receipt
            </Button>
          )}
          {showConfirm && order.redemption_confirmed && (
            <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500/10 py-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Receipt confirmed
            </span>
          )}
        </div>

        {delivery?.delivered_at && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Delivered {formatDistanceToNow(new Date(delivery.delivered_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
