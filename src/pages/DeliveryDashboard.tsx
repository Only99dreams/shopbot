import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  BadgeCheck, Bike, Clock, Loader2, MapPin, Package, Phone, Truck,
  Wallet, ArrowRight, CheckCircle2, XCircle, Banknote, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationBell } from '@/components/NotificationBell';
import { LeafletMap, type MapPoint } from '@/components/map/LeafletMap';
import { useAuth } from '@/hooks/useAuth';
import { useDelivery, type AgentDelivery } from '@/hooks/useDelivery';
import { useAgentLocationSharing } from '@/hooks/useAgentLocationSharing';
import { formatNaira } from '@/lib/nigeria';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function StatusBadge({ status }: { status: AgentDelivery['status'] }) {
  const map: Record<AgentDelivery['status'], { label: string; className: string }> = {
    open: { label: 'Available', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    accepted: { label: 'Accepted', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    picked_up: { label: 'On the way', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    delivered: { label: 'Delivered', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  };
  const item = map[status];
  return <Badge variant="outline" className={cn('rounded-full', item.className)}>{item.label}</Badge>;
}

function DeliveryCard({
  delivery,
  onAccept,
  onStatus,
  busy,
  agentPosition,
}: {
  delivery: AgentDelivery;
  onAccept: () => void;
  onStatus: (status: 'picked_up' | 'delivered' | 'cancelled') => void;
  busy: boolean;
  agentPosition?: { lat: number; lng: number } | null;
}) {
  const routePoints = useMemo(() => {
    const points: MapPoint[] = [];
    if (delivery.shop_latitude != null && delivery.shop_longitude != null) {
      points.push({
        id: 'shop',
        kind: 'shop',
        lat: delivery.shop_latitude,
        lng: delivery.shop_longitude,
        label: delivery.shop_name ?? 'Pickup shop',
        description: 'Pick the order up here',
      });
    }
    if (agentPosition) {
      points.push({
        id: 'agent',
        kind: 'agent',
        lat: agentPosition.lat,
        lng: agentPosition.lng,
        label: 'You',
        description: 'Your shared position',
      });
    }
    if (delivery.delivery_latitude != null && delivery.delivery_longitude != null) {
      points.push({
        id: 'destination',
        kind: 'destination',
        lat: delivery.delivery_latitude,
        lng: delivery.delivery_longitude,
        label: 'Drop-off',
        description: delivery.delivery_address ?? undefined,
      });
    }
    return points;
  }, [delivery, agentPosition]);

  const showRoute = (delivery.status === 'accepted' || delivery.status === 'picked_up') && routePoints.length > 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{delivery.order_number}</span>
              <StatusBadge status={delivery.status} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {delivery.city ? `${delivery.city}, ` : ''}{delivery.state}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">You earn</p>
            <p className="text-lg font-bold text-green-600">{formatNaira(delivery.agent_earning)}</p>
            <p className="text-xs text-muted-foreground">Fee {formatNaira(delivery.delivery_fee)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Package className="h-4 w-4 text-primary" />
            {delivery.item_count} item{delivery.item_count === 1 ? '' : 's'}
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {delivery.items.slice(0, 4).map((item, index) => (
              <li key={`${item.name}-${index}`} className="line-clamp-1">
                {item.quantity}× {item.name}
              </li>
            ))}
            {delivery.items.length > 4 && <li>+{delivery.items.length - 4} more</li>}
          </ul>
        </div>

        {delivery.status !== 'open' && (
          <div className="mt-3 space-y-1 text-sm">
            {delivery.customer_name && (
              <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" />{delivery.customer_name}</p>
            )}
            {delivery.customer_phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a href={`tel:${delivery.customer_phone}`} className="hover:underline">{delivery.customer_phone}</a>
              </p>
            )}
            {delivery.address && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>{delivery.address}</span>
              </p>
            )}
          </div>
        )}

        {showRoute && (
          <div className="mt-3">
            <LeafletMap points={routePoints} connectPoints height={220} showLegend={false} className="rounded-lg" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {delivery.status === 'open' && (
            <Button onClick={onAccept} disabled={busy} className="rounded-full">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
              Accept delivery
            </Button>
          )}
          {delivery.status === 'accepted' && (
            <>
              <Button onClick={() => onStatus('picked_up')} disabled={busy} className="rounded-full">
                <Bike className="mr-2 h-4 w-4" /> Mark picked up
              </Button>
              <Button variant="outline" onClick={() => onStatus('cancelled')} disabled={busy} className="rounded-full">
                Cancel
              </Button>
            </>
          )}
          {delivery.status === 'picked_up' && (
            <>
              <Button onClick={() => onStatus('delivered')} disabled={busy} className="rounded-full bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark delivered
              </Button>
              <Button variant="outline" onClick={() => onStatus('cancelled')} disabled={busy} className="rounded-full">
                Cancel
              </Button>
            </>
          )}
          {delivery.status === 'delivered' && (
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Completed {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleDateString() : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    agent, wallet, payouts, deliveries, isLoading, isApproved,
    setAvailability, acceptDelivery, updateStatus, requestPayout,
  } = useDelivery();

  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/delivery', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isLoading && user && !agent) {
      navigate('/delivery', { replace: true });
    }
  }, [isLoading, user, agent, navigate]);

  useEffect(() => {
    const last = payouts.find((item) => item.bank_name);
    if (last) {
      setPayoutForm((current) => ({
        ...current,
        bankName: current.bankName || last.bank_name,
        accountNumber: current.accountNumber || last.account_number,
        accountName: current.accountName || last.account_name,
      }));
    }
  }, [payouts]);

  const grouped = useMemo(() => ({
    available: deliveries.filter((item) => item.status === 'open'),
    active: deliveries.filter((item) => item.status === 'accepted' || item.status === 'picked_up'),
    completed: deliveries.filter((item) => item.status === 'delivered'),
  }), [deliveries]);

  const hasActiveDeliveries = grouped.active.length > 0;
  const locationSharing = useAgentLocationSharing(isApproved && hasActiveDeliveries);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) return null;

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ShopAfrica" className="h-9 w-9 object-contain" />
              <span className="text-lg font-bold">ShopAfrica</span>
            </Link>
            <NotificationBell />
          </div>
        </header>
        <main className="container mx-auto max-w-xl px-4 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              {agent.status === 'pending' && <Clock className="mx-auto mb-4 h-12 w-12 text-amber-500" />}
              {agent.status === 'rejected' && <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />}
              {agent.status === 'suspended' && <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />}
              <h1 className="text-2xl font-bold">
                {agent.status === 'pending' && 'Application under review'}
                {agent.status === 'rejected' && 'Application rejected'}
                {agent.status === 'suspended' && 'Account suspended'}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {agent.status === 'pending' && 'We will notify you here as soon as an admin reviews your documents.'}
                {(agent.status === 'rejected' || agent.status === 'suspended') && (agent.rejection_reason || 'Please review your details and try again.')}
              </p>
              <Link to="/delivery">
                <Button className="mt-6 rounded-full">
                  {agent.status === 'pending' ? 'View application' : 'Update application'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handlePayout = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(payoutForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    await requestPayout.mutateAsync({
      amount,
      bankName: payoutForm.bankName,
      accountNumber: payoutForm.accountNumber,
      accountName: payoutForm.accountName,
    });
    setPayoutForm((current) => ({ ...current, amount: '' }));
  };

  const renderList = (items: AgentDelivery[], emptyText: string) => (
    <div className="space-y-4">
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{emptyText}</CardContent>
        </Card>
      ) : (
        items.map((delivery) => (
          <DeliveryCard
            key={delivery.assignment_id}
            delivery={delivery}
            busy={acceptDelivery.isPending || updateStatus.isPending}
            agentPosition={locationSharing.position}
            onAccept={() => acceptDelivery.mutate(delivery.assignment_id)}
            onStatus={(status) => updateStatus.mutate({ assignmentId: delivery.assignment_id, status })}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ShopAfrica" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold">ShopAfrica</span>
            <Badge variant="secondary" className="ml-2 hidden rounded-full sm:inline-flex">Delivery</Badge>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link to="/marketplace">
              <Button variant="ghost" size="sm">Marketplace</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Welcome, {agent.full_name.split(' ')[0]}</p>
              <p className="text-sm text-muted-foreground">
                {agent.city}, {agent.state} · {agent.total_deliveries} deliveries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border px-4 py-2">
            <div>
              <p className="text-sm font-medium">{agent.is_available ? 'Online' : 'Offline'}</p>
              <p className="text-xs text-muted-foreground">
                {agent.is_available ? 'Receiving new jobs' : 'Turn on to receive jobs'}
              </p>
            </div>
            <Switch
              checked={agent.is_available}
              disabled={setAvailability.isPending}
              onCheckedChange={(checked) => setAvailability.mutate(checked)}
            />
          </div>
        </div>

        {hasActiveDeliveries && (
          <div
            className={cn(
              'mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm',
              locationSharing.error
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                : 'border-green-500/30 bg-green-500/10 text-green-700',
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  locationSharing.error ? 'bg-amber-500' : 'bg-green-500 animate-pulse',
                )}
              />
              {locationSharing.error
                ? locationSharing.error
                : locationSharing.lastSharedAt
                  ? `Sharing live location · updated ${formatDistanceToNow(locationSharing.lastSharedAt, { addSuffix: true })}`
                  : 'Starting live location sharing...'}
            </span>
            {locationSharing.accuracy != null && !locationSharing.error && (
              <span className="text-xs">GPS accuracy ±{Math.round(locationSharing.accuracy)}m</span>
            )}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, label: 'Available balance', value: formatNaira(wallet?.available_balance ?? 0) },
            { icon: Banknote, label: 'Total earned', value: formatNaira(wallet?.total_earned ?? 0) },
            { icon: Bike, label: 'Completed deliveries', value: String(agent.total_deliveries) },
            { icon: BadgeCheck, label: 'Rating', value: `${Number(agent.rating).toFixed(1)} / 5` },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <Icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="available">
          <TabsList className="mb-4 grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="available">
              Available
              {grouped.available.length > 0 && (
                <Badge className="ml-2 h-5 rounded-full px-1.5 text-[10px]">{grouped.available.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active {grouped.active.length > 0 && `(${grouped.active.length})`}</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            {!agent.is_available && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                <Bell className="h-4 w-4" />
                You are offline. Turn availability on to accept new deliveries.
              </div>
            )}
            {renderList(grouped.available, 'No deliveries are available in your area right now. New paid orders will appear here automatically.')}
          </TabsContent>

          <TabsContent value="active">
            {renderList(grouped.active, 'You have no active deliveries. Accept one from the Available tab.')}
          </TabsContent>

          <TabsContent value="completed">
            {renderList(grouped.completed, 'Completed deliveries will appear here.')}
          </TabsContent>

          <TabsContent value="earnings">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-primary" /> Request a payout
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePayout} className="space-y-4">
                    <div className="rounded-xl bg-muted/60 p-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-semibold">{formatNaira(wallet?.available_balance ?? 0)}</span>
                      </div>
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">Total withdrawn</span>
                        <span>{formatNaira(wallet?.total_withdrawn ?? 0)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (₦)</Label>
                      <Input id="amount" type="number" min="1" value={payoutForm.amount} onChange={(e) => setPayoutForm((current) => ({ ...current, amount: e.target.value }))} placeholder="Minimum ₦2,000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank name</Label>
                      <Input id="bankName" value={payoutForm.bankName} onChange={(e) => setPayoutForm((current) => ({ ...current, bankName: e.target.value }))} placeholder="e.g. GTBank" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account number</Label>
                      <Input id="accountNumber" value={payoutForm.accountNumber} onChange={(e) => setPayoutForm((current) => ({ ...current, accountNumber: e.target.value }))} placeholder="0123456789" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountName">Account name</Label>
                      <Input id="accountName" value={payoutForm.accountName} onChange={(e) => setPayoutForm((current) => ({ ...current, accountName: e.target.value }))} placeholder="Name on the account" />
                    </div>
                    <Button type="submit" className="w-full rounded-full" disabled={requestPayout.isPending}>
                      {requestPayout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                      Request payout
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Payouts are reviewed by an admin and sent to your bank. You can only have one pending request at a time.
                    </p>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payout history</CardTitle>
                </CardHeader>
                <CardContent>
                  {payouts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No payout requests yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {payouts.map((payout) => (
                        <div key={payout.id} className="flex items-center justify-between rounded-xl border p-3">
                          <div>
                            <p className="font-semibold">{formatNaira(payout.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {payout.bank_name} · {new Date(payout.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'rounded-full capitalize',
                              payout.status === 'approved' && 'border-green-500/30 bg-green-500/10 text-green-600',
                              payout.status === 'pending' && 'border-amber-500/30 bg-amber-500/10 text-amber-600',
                              payout.status === 'rejected' && 'border-destructive/30 bg-destructive/10 text-destructive',
                            )}
                          >
                            {payout.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
