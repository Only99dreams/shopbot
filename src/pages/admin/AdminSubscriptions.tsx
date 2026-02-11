import { AdminLayout } from '@/components/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminSubscriptions() {
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, shops(id, name, is_active)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalSubs = subscriptions?.length || 0;
  const activeSubs = subscriptions?.filter(s => s.status === 'active').length || 0;

  const activateMutation = useMutation({
    mutationFn: async ({ subId, shopId }: { subId: string; shopId: string }) => {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq('id', subId);

      if (subError) throw subError;

      const { error: shopError } = await supabase
        .from('shops')
        .update({ is_active: true })
        .eq('id', shopId);

      if (shopError) throw shopError;
    },
    onSuccess: () => {
      toast.success('Subscription activated and shop opened!');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to activate: ' + error.message);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async ({ subId, shopId }: { subId: string; shopId: string }) => {
      const { error: subError } = await supabase
        .from('subscriptions')
        .update({ status: 'inactive' })
        .eq('id', subId);

      if (subError) throw subError;

      const { error: shopError } = await supabase
        .from('shops')
        .update({ is_active: false })
        .eq('id', shopId);

      if (shopError) throw shopError;
    },
    onSuccess: () => {
      toast.success('Subscription deactivated and shop closed.');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to deactivate: ' + error.message);
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-7 w-7 lg:h-8 lg:w-8" /> Subscriptions
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">Manage all seller subscriptions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalSubs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-green-600">{activeSubs}</div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : subscriptions?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No subscriptions found</div>
          ) : subscriptions?.map(sub => {
            const shopData = sub.shops as { id: string; name: string; is_active: boolean } | null;
            const isPending = activateMutation.isPending || deactivateMutation.isPending;

            return (
              <Card key={sub.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold truncate">{shopData?.name || 'Unknown'}</p>
                    <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                      {sub.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Plan</span>
                      <p className="font-medium capitalize">{sub.plan}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Shop Active</span>
                      <p>
                        <Badge variant={shopData?.is_active ? 'default' : 'secondary'} className="text-xs">
                          {shopData?.is_active ? 'Yes' : 'No'}
                        </Badge>
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Created</span>
                      <p>{format(new Date(sub.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  {shopData && (
                    <div className="flex gap-2 pt-2 border-t">
                      {sub.status !== 'active' ? (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => activateMutation.mutate({ subId: sub.id, shopId: shopData.id })}
                          disabled={isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => deactivateMutation.mutate({ subId: sub.id, shopId: shopData.id })}
                          disabled={isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shop Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : subscriptions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No subscriptions found</TableCell>
                </TableRow>
              ) : subscriptions?.map(sub => {
                const shopData = sub.shops as { id: string; name: string; is_active: boolean } | null;
                const isPending = activateMutation.isPending || deactivateMutation.isPending;

                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{shopData?.name || 'Unknown'}</TableCell>
                    <TableCell className="capitalize">{sub.plan}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shopData?.is_active ? 'default' : 'secondary'}>
                        {shopData?.is_active ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(sub.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {shopData && (
                        <div className="flex gap-2">
                          {sub.status !== 'active' ? (
                            <Button
                              size="sm"
                              onClick={() => activateMutation.mutate({ subId: sub.id, shopId: shopData.id })}
                              disabled={isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deactivateMutation.mutate({ subId: sub.id, shopId: shopData.id })}
                              disabled={isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Deactivate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
