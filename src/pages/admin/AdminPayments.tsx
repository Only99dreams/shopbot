import { useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, DollarSign, TrendingUp, Clock, Check, X, Receipt, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaymentProof, usePaymentProofs, useReviewPaymentProof } from '@/hooks/usePaymentProofs';
import { PaymentProofReviewDialog } from '@/components/admin/PaymentProofReviewDialog';

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch payment proofs
  const { data: paymentProofs, refetch: refetchProofs } = usePaymentProofs();
  const pendingProofs = paymentProofs?.filter(p => p.status === 'pending') || [];

  // Fetch payments summary
  const { data: payments } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, orders(order_number), shops(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch payout requests
  const { data: payoutRequests } = useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*, shops(id, owner_id, name, bank_name, account_number, account_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch seller wallets
  const { data: wallets } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_wallets')
        .select('*, shops(name)')
        .order('balance', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate totals
  const totalRevenue = payments?.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalPlatformFees = payments?.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.platform_fee), 0) || 0;
  const pendingPayouts = payoutRequests?.filter(p => p.status === 'pending').length || 0;
  const totalSellerBalances = wallets?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;

  // Process payout mutation
  const processPayout = useMutation({
    mutationFn: async ({ payoutId, status }: { payoutId: string, status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status,
          admin_notes: adminNotes,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId);

      if (error) throw error;

      // If approved, deduct from wallet
      if (status === 'approved' && selectedPayout) {
        if (selectedPayout.payout_type === 'referral') {
          const ownerId = selectedPayout.shops?.owner_id;
          if (ownerId) {
            const { data: code } = await supabase
              .from('referral_codes')
              .select('id, available_balance, total_withdrawn')
              .eq('user_id', ownerId)
              .maybeSingle();

            if (code) {
              await supabase
                .from('referral_codes')
                .update({
                  available_balance: Number(code.available_balance || 0) - selectedPayout.amount,
                  total_withdrawn: Number(code.total_withdrawn || 0) + selectedPayout.amount,
                })
                .eq('id', code.id);
            }
          }
        } else {
          const { data: wallet } = await supabase
            .from('seller_wallets')
            .select('*')
            .eq('shop_id', selectedPayout.shop_id)
            .single();

          if (wallet) {
            await supabase
              .from('seller_wallets')
              .update({
                balance: wallet.balance - selectedPayout.amount,
                total_withdrawn: wallet.total_withdrawn + selectedPayout.amount,
              })
              .eq('id', wallet.id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      toast.success('Payout request processed');
      setSelectedPayout(null);
      setAdminNotes('');
    },
    onError: () => {
      toast.error('Failed to process payout request');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'approved':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
      case 'rejected':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8" /> Payments & Payouts
          </h1>
          <p className="text-muted-foreground">Manage platform payments and seller payouts</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Platform Fees (5%)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{totalPlatformFees.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payment Proofs</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingProofs.length}</div>
              <p className="text-xs text-muted-foreground">Pending review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingPayouts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Seller Balances</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{totalSellerBalances.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="proofs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="proofs" className="relative">
              Payment Proofs
              {pendingProofs.length > 0 && (
                <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingProofs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
            <TabsTrigger value="wallets">Seller Wallets</TabsTrigger>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
          </TabsList>

          {/* Payment Proofs Tab */}
          <TabsContent value="proofs">
            <Card>
              <CardHeader>
                <CardTitle>Payment Proofs Awaiting Review</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentProofs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No payment proofs
                        </TableCell>
                      </TableRow>
                    ) : paymentProofs?.map((proof) => (
                      <TableRow key={proof.id}>
                        <TableCell>
                          <Badge variant={proof.payment_type === 'subscription' ? 'default' : 'secondary'}>
                            {proof.payment_type === 'subscription' ? 'Subscription' : 'Order'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{proof.customer_name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{proof.customer_phone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">₦{proof.amount.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(proof.status)}</TableCell>
                        <TableCell>{format(new Date(proof.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => setSelectedProof(proof)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payout Requests Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <CardTitle>Payout Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Bank Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutRequests?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No payout requests
                        </TableCell>
                      </TableRow>
                    ) : payoutRequests?.map((payout: any) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">{payout.shops?.name || 'Unknown'}</TableCell>
                        <TableCell>{payout.payout_type === 'referral' ? 'Referral' : 'Sales'}</TableCell>
                        <TableCell>₦{Number(payout.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          <div>{payout.bank_name || payout.shops?.bank_name || 'N/A'}</div>
                          <div className="text-muted-foreground">{payout.account_number || payout.shops?.account_number}</div>
                          <div className="text-muted-foreground">{payout.account_name || payout.shops?.account_name}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell>{format(new Date(payout.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          {payout.status === 'pending' && (
                            <Button size="sm" onClick={() => setSelectedPayout(payout)}>
                              Process
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seller Wallets Tab */}
          <TabsContent value="wallets">
            <Card>
              <CardHeader>
                <CardTitle>Seller Wallets</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Total Earned</TableHead>
                      <TableHead>Total Withdrawn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No seller wallets
                        </TableCell>
                      </TableRow>
                    ) : wallets?.map((wallet: any) => (
                      <TableRow key={wallet.id}>
                        <TableCell className="font-medium">{wallet.shops?.name || 'Unknown'}</TableCell>
                        <TableCell className="font-bold text-green-600">₦{Number(wallet.balance).toLocaleString()}</TableCell>
                        <TableCell>₦{Number(wallet.total_earned).toLocaleString()}</TableCell>
                        <TableCell>₦{Number(wallet.total_withdrawn).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Platform Fee</TableHead>
                      <TableHead>Seller Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No payments yet
                        </TableCell>
                      </TableRow>
                    ) : payments?.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.orders?.order_number || 'N/A'}</TableCell>
                        <TableCell>{payment.shops?.name || 'Unknown'}</TableCell>
                        <TableCell>₦{Number(payment.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">₦{Number(payment.platform_fee).toLocaleString()}</TableCell>
                        <TableCell className="text-green-600">₦{Number(payment.seller_amount).toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>{format(new Date(payment.created_at), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Process Payout Dialog */}
      <Dialog open={!!selectedPayout} onOpenChange={() => setSelectedPayout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Shop: {selectedPayout?.shops?.name}</p>
              <p className="text-lg font-bold">Amount: ₦{selectedPayout?.amount?.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Bank Details:</p>
              <p className="text-sm">{selectedPayout?.bank_name || selectedPayout?.shops?.bank_name}</p>
              <p className="text-sm">{selectedPayout?.account_number || selectedPayout?.shops?.account_number}</p>
              <p className="text-sm">{selectedPayout?.account_name || selectedPayout?.shops?.account_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this payout..."
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => processPayout.mutate({ payoutId: selectedPayout.id, status: 'rejected' })}
              disabled={processPayout.isPending}
            >
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button
              onClick={() => processPayout.mutate({ payoutId: selectedPayout.id, status: 'approved' })}
              disabled={processPayout.isPending}
            >
              <Check className="h-4 w-4 mr-1" /> Approve & Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Review Dialog */}
      <PaymentProofReviewDialog
        open={!!selectedProof}
        onOpenChange={(open) => !open && setSelectedProof(null)}
        proof={selectedProof}
        onReviewComplete={() => {
          refetchProofs();
          queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
          queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
        }}
      />
    </AdminLayout>
  );
}
