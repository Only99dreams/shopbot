import { useMemo, useState } from 'react';
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

const statusStyles: Record<DeliveryAgent['status'], string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  approved: 'border-green-500/30 bg-green-500/10 text-green-600',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  suspended: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
};

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
          <TabsList className="mb-4 grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="payouts">Payouts {stats.pendingPayouts > 0 && `(${stats.pendingPayouts})`}</TabsTrigger>
            <TabsTrigger value="fees">Delivery fees</TabsTrigger>
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
