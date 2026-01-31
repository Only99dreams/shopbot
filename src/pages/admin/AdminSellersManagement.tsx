import { AdminLayout } from '@/components/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Users, Search, Edit, Eye, Store, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminSellersManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<any>(null);
  const [editingShop, setEditingShop] = useState<any>(null);

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['admin-sellers-full'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Fetch all shops with wallets
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('*, seller_wallets(*), subscriptions(*)');
      
      if (shopsError) throw shopsError;

      // Fetch order stats per shop
      const { data: orderStats } = await supabase
        .from('orders')
        .select('shop_id, total, payment_status');

      // Fetch ratings
      const { data: ratings } = await supabase
        .from('seller_ratings')
        .select('seller_id, rating');

      // Map shops to profiles with stats
      return profiles.map(profile => {
        const shop = shops.find(s => s.owner_id === profile.id);
        const shopOrders = shop ? orderStats?.filter(o => o.shop_id === shop.id) : [];
        const totalOrders = shopOrders?.length || 0;
        const totalRevenue = shopOrders?.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total), 0) || 0;
        
        const sellerRatings = ratings?.filter(r => r.seller_id === profile.id) || [];
        const ratingCount = sellerRatings.length;
        const ratingAvg = ratingCount > 0 ? (sellerRatings.reduce((s, r) => s + Number(r.rating), 0) / ratingCount) : null;

        return {
          ...profile,
          shop: shop || null,
          wallet: shop?.seller_wallets?.[0] || null,
          subscription: shop?.subscriptions?.[0] || null,
          totalOrders,
          totalRevenue,
          ratingAvg,
          ratingCount,
        };
      });
    }
  });

  // Toggle shop active status with optimistic updates
  const toggleShopStatus = useMutation({
    mutationFn: async ({ shopId, isActive }: { shopId: string, isActive: boolean }) => {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: isActive })
        .eq('id', shopId);
      if (error) throw error;
    },
    onMutate: async ({ shopId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-sellers-full'] });
      const previous = queryClient.getQueryData<any[]>(['admin-sellers-full']);
      queryClient.setQueryData(['admin-sellers-full'], (old: any[]) => {
        if (!old) return old;
        return old.map(item => {
          if (item.shop && item.shop.id === shopId) {
            return { ...item, shop: { ...item.shop, is_active: isActive } };
          }
          return item;
        });
      });
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-sellers-full'], context.previous);
      }
      toast.error('Failed to update shop status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers-full'] });
    },
    onSuccess: () => {
      toast.success('Shop status updated');
    }
  });

  // Update shop details
  const updateShop = useMutation({
    mutationFn: async (shopData: any) => {
      const { error } = await supabase
        .from('shops')
        .update({
          name: shopData.name,
          description: shopData.description,
          bank_name: shopData.bank_name,
          account_number: shopData.account_number,
          account_name: shopData.account_name,
        })
        .eq('id', shopData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sellers-full'] });
      toast.success('Shop updated successfully');
      setEditingShop(null);
    }
  });

  // Calculate totals
  const totalSellers = sellers?.length || 0;
  const activeShops = sellers?.filter(s => s.shop?.is_active).length || 0;
  const totalRevenue = sellers?.reduce((sum, s) => sum + (s.totalRevenue || 0), 0) || 0;
  const totalOrders = sellers?.reduce((sum, s) => sum + (s.totalOrders || 0), 0) || 0;

  const filtered = sellers?.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.shop?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" /> Seller Management
          </h1>
          <p className="text-muted-foreground">Full control over all sellers and their shops</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sellers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSellers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeShops}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sellers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sellers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seller</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No sellers found
                    </TableCell>
                  </TableRow>
                ) : filtered?.map(seller => (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="font-medium">{seller.full_name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{seller.email}</div>
                      <div className="text-sm text-muted-foreground">{seller.phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell>
                      {seller.shop ? (
                        <div>
                          <div className="font-medium">{seller.shop.name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No shop</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.ratingAvg ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{Number(seller.ratingAvg).toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({seller.ratingCount})</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.shop && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={seller.shop.is_active}
                            onCheckedChange={(checked) => 
                              toggleShopStatus.mutate({ shopId: seller.shop.id, isActive: checked })
                            }
                          />
                          <span className={seller.shop.is_active ? 'text-green-600' : 'text-red-600'}>
                            {seller.shop.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{seller.totalOrders}</TableCell>
                    <TableCell>₦{seller.totalRevenue.toLocaleString()}</TableCell>
                    <TableCell>
                      {seller.wallet ? (
                        <span className="font-medium text-green-600">₦{Number(seller.wallet.balance).toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">₦0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.subscription ? (
                        <Badge variant={seller.subscription.status === 'active' ? 'default' : 'secondary'}>
                          {seller.subscription.plan} ({seller.subscription.status})
                        </Badge>
                      ) : (
                        <Badge variant="outline">None</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedSeller(seller)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {seller.shop && (
                          <Button size="sm" variant="outline" onClick={() => setEditingShop(seller.shop)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Seller Details Dialog */}
      <Dialog open={!!selectedSeller} onOpenChange={() => setSelectedSeller(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seller Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{selectedSeller?.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{selectedSeller?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{selectedSeller?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Joined</p>
                <p className="font-medium">{selectedSeller && format(new Date(selectedSeller.created_at), 'MMM d, yyyy')}</p>
              </div>
            </div>

            {selectedSeller?.shop && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Shop Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Shop Name</p>
                      <p className="font-medium">{selectedSeller.shop.name}</p>
                    </div>
                    {/* WhatsApp removed — using in-app messages instead */}
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="font-medium">{selectedSeller.shop.description || 'No description'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={selectedSeller.shop.is_active ? 'default' : 'destructive'}>
                        {selectedSeller.shop.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Bank Details</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Bank</p>
                      <p className="font-medium">{selectedSeller.shop.bank_name || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Number</p>
                      <p className="font-medium">{selectedSeller.shop.account_number || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Name</p>
                      <p className="font-medium">{selectedSeller.shop.account_name || 'Not set'}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Performance</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-xl font-bold">{selectedSeller.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-xl font-bold">₦{selectedSeller.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Wallet Balance</p>
                      <p className="text-xl font-bold text-green-600">
                        ₦{(selectedSeller.wallet?.balance || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Shop Dialog */}
      <Dialog open={!!editingShop} onOpenChange={() => setEditingShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shop Name</Label>
              <Input
                value={editingShop?.name || ''}
                onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editingShop?.description || ''}
                onChange={(e) => setEditingShop({ ...editingShop, description: e.target.value })}
              />
            </div>
            {/* WhatsApp field removed — storing in-app messaging instead */}
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={editingShop?.bank_name || ''}
                onChange={(e) => setEditingShop({ ...editingShop, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={editingShop?.account_number || ''}
                onChange={(e) => setEditingShop({ ...editingShop, account_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={editingShop?.account_name || ''}
                onChange={(e) => setEditingShop({ ...editingShop, account_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShop(null)}>Cancel</Button>
            <Button onClick={() => updateShop.mutate(editingShop)} disabled={updateShop.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
