import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Ban, Check, FileText, Loader2, MapPin, Plus,
  RefreshCw, Trash2, Truck, X,
} from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LeafletMap, type MapPoint } from '@/components/map/LeafletMap';
import { useDeliveryAdmin, type DeliveryAgent } from '@/hooks/useDelivery';
import { supabase } from '@/integrations/supabase/client';
import { formatNaira, NIGERIAN_STATES } from '@/lib/nigeria';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminPayout {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  admin_notes: string | null;
  created_at: string;
  delivery_agents?: {
    full_name: string;
    phone: string;
    state: string;
    city: string;
  } | null;
}

interface DeliveryFee {
  id: string;
  state: string;
  city: string;
  fee: number;
  is_active: boolean;
}

interface ActiveDeliveryMapRow {
  assignment_id: string;
  order_id: string;
  order_number: string;
  status: 'accepted' | 'picked_up';
  state: string;
  city: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  agent_lat: number | null;
  agent_lng: number | null;
  agent_accuracy: number | null;
  agent_location_at: string | null;
  shop_name: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string | null;
}

interface AgentMapRow {
  agent_id: string;
  full_name: string;
  phone: string;
  state: string;
  city: string;
  vehicle_type: string;
  is_available: boolean;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  active_deliveries: number | string;
}

const STALE_AFTER_MS = 5 * 60 * 1000;

function isStale(timestamp: string | null) {
  if (!timestamp) return true;
  return Date.now() - new Date(timestamp).getTime() > STALE_AFTER_MS;
}

const statusStyles: Record<DeliveryAgent['status'], string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  approved: 'border-green-500/30 bg-green-500/10 text-green-600',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  suspended: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
};

function AdminLiveMap() {
  const [layer, setLayer] = useState<'deliveries' | 'agents'>('deliveries');
  const [selectedAssignment, setSelectedAssignment] = useState('all');

  const deliveriesQuery = useQuery({
    queryKey: ['admin-live-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_delivery_map');
      if (error) throw error;
      return (data ?? []) as ActiveDeliveryMapRow[];
    },
    refetchInterval: 15000,
  });

  const agentsQuery = useQuery({
    queryKey: ['admin-map-agents'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agent_map_overview');
      if (error) throw error;
      return (data ?? []) as AgentMapRow[];
    },
    refetchInterval: 15000,
  });

  const activeDeliveries = deliveriesQuery.data ?? [];
  const mapAgents = agentsQuery.data ?? [];

  const visibleDeliveries = useMemo(
    () => (selectedAssignment === 'all'
      ? activeDeliveries
      : activeDeliveries.filter((row) => row.assignment_id === selectedAssignment)),
    [activeDeliveries, selectedAssignment],
  );

  const deliveryPoints = useMemo<MapPoint[]>(() => {
    const points: MapPoint[] = [];
    for (const row of visibleDeliveries) {
      if (row.agent_lat != null && row.agent_lng != null) {
        points.push({
          id: `agent-${row.assignment_id}`,
          kind: 'agent',
          lat: row.agent_lat,
          lng: row.agent_lng,
          label: row.agent_name ?? 'Delivery agent',
          description: `${row.order_number} · ${row.status === 'picked_up' ? 'On the way' : 'Assigned'}`,
          accuracy: row.agent_accuracy,
          stale: isStale(row.agent_location_at),
        });
      }
      if (row.shop_lat != null && row.shop_lng != null) {
        points.push({
          id: `shop-${row.assignment_id}`,
          kind: 'shop',
          lat: row.shop_lat,
          lng: row.shop_lng,
          label: row.shop_name ?? 'Shop',
          description: `Pickup · ${row.order_number}`,
        });
      }
      if (row.destination_lat != null && row.destination_lng != null) {
        points.push({
          id: `destination-${row.assignment_id}`,
          kind: 'destination',
          lat: row.destination_lat,
          lng: row.destination_lng,
          label: `Drop-off · ${row.order_number}`,
          description: row.destination_address ?? undefined,
        });
      }
    }
    return points;
  }, [visibleDeliveries]);

  const agentPoints = useMemo<MapPoint[]>(() => mapAgents
    .filter((agent) => agent.last_lat != null && agent.last_lng != null)
    .map((agent) => ({
      id: `overview-${agent.agent_id}`,
      kind: 'agent' as const,
      lat: agent.last_lat!,
      lng: agent.last_lng!,
      label: agent.full_name,
      description: [
        `${agent.city || 'Unknown city'}, ${agent.state}`,
        agent.is_available ? 'Available' : 'Offline',
        Number(agent.active_deliveries) > 0 ? `${agent.active_deliveries} active` : 'No active jobs',
      ].join(' · '),
      stale: isStale(agent.last_location_at),
    })), [mapAgents]);

  const points = layer === 'deliveries' ? deliveryPoints : agentPoints;
  const isFetching = deliveriesQuery.isFetching || agentsQuery.isFetching;
  const error = deliveriesQuery.error || agentsQuery.error;
  const sharingAgents = mapAgents.filter((agent) => agent.last_lat != null && agent.last_lng != null).length;
  const onlineAgents = mapAgents.filter((agent) => agent.is_available).length;

  const refresh = () => {
    void deliveriesQuery.refetch();
    void agentsQuery.refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Live delivery map</p>
          <p className="text-sm text-muted-foreground">
            {activeDeliveries.length} active {activeDeliveries.length === 1 ? 'delivery' : 'deliveries'} ·{' '}
            {sharingAgents} agents sharing location · {onlineAgents} online · refreshes every 15s
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
          <RefreshCw className={cn('mr-1.5 h-4 w-4', isFetching && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            variant={layer === 'deliveries' ? 'secondary' : 'ghost'}
            className="h-7 rounded-md px-2"
            onClick={() => setLayer('deliveries')}
          >
            Active deliveries
          </Button>
          <Button
            size="sm"
            variant={layer === 'agents' ? 'secondary' : 'ghost'}
            className="h-7 rounded-md px-2"
            onClick={() => setLayer('agents')}
          >
            All agents
          </Button>
        </div>
        {layer === 'deliveries' && activeDeliveries.length > 1 && (
          <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue placeholder="All active deliveries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All active deliveries</SelectItem>
              {activeDeliveries.map((row) => (
                <SelectItem key={row.assignment_id} value={row.assignment_id}>
                  {row.order_number} · {row.agent_name ?? 'Unassigned'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load live delivery data. {error instanceof Error ? error.message : ''}
        </div>
      )}

      {deliveriesQuery.isLoading || agentsQuery.isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : points.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {layer === 'deliveries'
              ? 'No agents are sharing a location for active deliveries right now.'
              : 'No delivery agents have shared a location yet.'}
          </CardContent>
        </Card>
      ) : (
        <LeafletMap
          points={points}
          height={460}
          connectPoints={layer === 'deliveries' && selectedAssignment !== 'all'}
        />
      )}

      {layer === 'deliveries' && activeDeliveries.length > 0 && (
        <div className="space-y-2">
          {activeDeliveries.map((row) => {
            const stale = isStale(row.agent_location_at);
            return (
              <Card key={row.assignment_id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {row.order_number}
                      <Badge variant="outline" className="rounded-full capitalize">{row.status.replace('_', ' ')}</Badge>
                      {stale && <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">stale GPS</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.agent_name ?? 'No agent'}{row.agent_phone ? ` · ${row.agent_phone}` : ''} · {row.city}, {row.state}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.agent_location_at
                        ? `GPS updated ${formatDistanceToNow(new Date(row.agent_location_at), { addSuffix: true })}`
                        : 'Agent has not shared GPS yet'}
                      {row.destination_address ? ` · ${row.destination_address}` : ''}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/marketplace?track=${encodeURIComponent(row.order_number)}`} target="_blank" rel="noreferrer">
                      Open tracking
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {layer === 'agents' && mapAgents.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {mapAgents.slice(0, 12).map((agent) => (
            <div key={agent.agent_id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <div>
                <p className="font-medium">{agent.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {agent.city}, {agent.state} · {Number(agent.active_deliveries)} active
                </p>
              </div>
              <span className={cn('text-xs', agent.last_lat != null && !isStale(agent.last_location_at) ? 'text-green-600' : 'text-muted-foreground')}>
                {agent.last_lat == null
                  ? 'No GPS yet'
                  : isStale(agent.last_location_at)
                    ? 'Last seen earlier'
                    : 'Live'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDeliveryAgents() {
  const { agents, payouts, fees, isLoading, reviewAgent, reviewPayout, saveFee, deleteFee } = useDeliveryAdmin();
  const [reviewTarget, setReviewTarget] = useState<{ agent: DeliveryAgent; action: 'reject' | 'suspend' } | null>(null);
  const [reason, setReason] = useState('');
  const [newFee, setNewFee] = useState({ state: '', city: '', fee: '' });
  const [feeEdits, setFeeEdits] = useState<Record<string, string>>({});

  const stats = useMemo(() => ({
    total: agents.length,
    pending: agents.filter((agent) => agent.status === 'pending').length,
    approved: agents.filter((agent) => agent.status === 'approved').length,
    pendingPayouts: (payouts as AdminPayout[]).filter((payout) => payout.status === 'pending').length,
  }), [agents, payouts]);

  const openDocument = async (path: string | null) => {
    if (!path) {
      toast.error('No document uploaded');
      return;
    }
    const { data, error } = await supabase.storage
      .from('delivery-documents')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Could not open the document');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleReview = (agent: DeliveryAgent, action: 'approve' | 'reject' | 'suspend' | 'reinstate') => {
    if (action === 'reject' || action === 'suspend') {
      setReviewTarget({ agent, action });
      setReason('');
      return;
    }
    reviewAgent.mutate({ agentId: agent.id, action });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Truck className="h-6 w-6 text-primary" /> Delivery agents
            </h1>
            <p className="text-muted-foreground">Review applications, payouts and delivery fees.</p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total agents', value: stats.total },
            { label: 'Awaiting review', value: stats.pending },
            { label: 'Approved', value: stats.approved },
            { label: 'Pending payouts', value: stats.pendingPayouts },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="agents">
          <TabsList className="mb-4 grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="payouts">Payouts {stats.pendingPayouts > 0 && `(${stats.pendingPayouts})`}</TabsTrigger>
            <TabsTrigger value="fees">Delivery fees</TabsTrigger>
            <TabsTrigger value="live">Live map</TabsTrigger>
          </TabsList>

          <TabsContent value="agents">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : agents.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">No delivery agent applications yet.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => (
                  <Card key={agent.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{agent.full_name}</p>
                            <Badge variant="outline" className={cn('rounded-full capitalize', statusStyles[agent.status])}>
                              {agent.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{agent.phone} · {agent.email || 'No email'}</p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {agent.city}, {agent.state} · {agent.vehicle_type}
                            {agent.vehicle_plate ? ` · ${agent.vehicle_plate}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {agent.id_type.replace('_', ' ')}: {agent.id_number} · Applied {new Date(agent.created_at).toLocaleDateString()}
                          </p>
                          {agent.rejection_reason && (
                            <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                              {agent.rejection_reason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openDocument(agent.id_document_url)}>
                            <FileText className="mr-1.5 h-4 w-4" /> ID
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openDocument(agent.selfie_url)}>
                            <FileText className="mr-1.5 h-4 w-4" /> Selfie
                          </Button>
                          {agent.status !== 'approved' && (
                            <Button size="sm" onClick={() => handleReview(agent, 'approve')} disabled={reviewAgent.isPending}>
                              <Check className="mr-1.5 h-4 w-4" /> Approve
                            </Button>
                          )}
                          {agent.status === 'pending' && (
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReview(agent, 'reject')}>
                              <X className="mr-1.5 h-4 w-4" /> Reject
                            </Button>
                          )}
                          {agent.status === 'approved' && (
                            <Button size="sm" variant="outline" className="text-orange-600" onClick={() => handleReview(agent, 'suspend')}>
                              <Ban className="mr-1.5 h-4 w-4" /> Suspend
                            </Button>
                          )}
                          {agent.status === 'suspended' && (
                            <Button size="sm" variant="outline" onClick={() => handleReview(agent, 'reinstate')}>
                              <RefreshCw className="mr-1.5 h-4 w-4" /> Reinstate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts">
            {(payouts as AdminPayout[]).length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">No payout requests yet.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {(payouts as AdminPayout[]).map((payout) => (
                  <Card key={payout.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold">{formatNaira(payout.amount)}</p>
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
                        <p className="mt-1 text-sm">
                          {payout.delivery_agents?.full_name || 'Agent'} · {payout.delivery_agents?.phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payout.bank_name} · {payout.account_number} · {payout.account_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested {new Date(payout.created_at).toLocaleString()}
                        </p>
                      </div>
                      {payout.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => reviewPayout.mutate({ requestId: payout.id, action: 'approve' })}
                            disabled={reviewPayout.isPending}
                          >
                            <Check className="mr-1.5 h-4 w-4" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => reviewPayout.mutate({ requestId: payout.id, action: 'reject' })}
                            disabled={reviewPayout.isPending}
                          >
                            <X className="mr-1.5 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fees">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Add a delivery fee</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Select value={newFee.state} onValueChange={(value) => setNewFee((current) => ({ ...current, state: value }))}>
                    <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="City (blank = state-wide)"
                    value={newFee.city}
                    onChange={(e) => setNewFee((current) => ({ ...current, city: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Fee (₦)"
                    value={newFee.fee}
                    onChange={(e) => setNewFee((current) => ({ ...current, fee: e.target.value }))}
                  />
                  <Button
                    disabled={!newFee.state || !newFee.fee || saveFee.isPending}
                    onClick={async () => {
                      await saveFee.mutateAsync({
                        state: newFee.state,
                        city: newFee.city.trim(),
                        fee: Number(newFee.fee),
                        isActive: true,
                      });
                      setNewFee({ state: '', city: '', fee: '' });
                    }}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add fee
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current delivery fees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(fees as DeliveryFee[]).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No fees configured.</p>
                ) : (
                  (fees as DeliveryFee[]).map((fee) => (
                    <div key={fee.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="font-medium">{fee.state}{fee.city ? ` · ${fee.city}` : ' · State-wide'}</p>
                        <p className="text-xs text-muted-foreground">{fee.is_active ? 'Active' : 'Inactive'}</p>
                      </div>
                      <Input
                        type="number"
                        className="w-32"
                        value={feeEdits[fee.id] ?? String(fee.fee)}
                        onChange={(e) => setFeeEdits((current) => ({ ...current, [fee.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const value = Number(feeEdits[fee.id] ?? fee.fee);
                          saveFee.mutate({ id: fee.id, state: fee.state, city: fee.city, fee: value, isActive: fee.is_active });
                        }}
                      >
                        Save
                      </Button>
                      <Switch
                        checked={fee.is_active}
                        onCheckedChange={(checked) => saveFee.mutate({ id: fee.id, state: fee.state, city: fee.city, fee: fee.fee, isActive: checked })}
                      />
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteFee.mutate(fee.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live">
            <AdminLiveMap />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'reject' ? 'Reject application' : 'Suspend agent'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to the agent)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Explain what needs to be fixed" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={reviewAgent.isPending}
              onClick={() => {
                if (!reviewTarget) return;
                reviewAgent.mutate(
                  { agentId: reviewTarget.agent.id, action: reviewTarget.action, reason: reason || undefined },
                  { onSuccess: () => setReviewTarget(null) },
                );
              }}
            >
              {reviewTarget?.action === 'reject' ? 'Reject' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
