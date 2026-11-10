import { AdminLayout } from '@/components/AdminLayout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Search, Package, ShieldCheck, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { ProductVerificationBadge, type VerificationDetails } from '@/components/products/ProductVerificationBadge';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface AdminProductRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number | null;
  is_available: boolean | null;
  nafdac_number: string | null;
  verification_status: string | null;
  verification_details: Json | null;
  shops: { name: string } | null;
  categories: { name: string } | null;
}

const VERIFICATION_FILTERS = [
  { value: 'all', label: 'All verification states' },
  { value: 'verified', label: 'Verified' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'pending', label: 'Pending' },
  { value: 'unverified', label: 'Not verified' },
];

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, shops(name), categories(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const reverify = useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.functions.invoke('verify-nafdac', {
        body: { productId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Verification failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success(
        data?.status === 'verified'
          ? 'Product verified against the NAFDAC Greenbook'
          : 'Product flagged: NAFDAC number not found as active',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Verification failed');
    },
  });

  const rows = (products ?? []) as unknown as AdminProductRow[];
  const totalProducts = rows.length;
  const availableProducts = rows.filter(p => p.is_available).length;
  const outOfStock = rows.filter(p => p.stock_quantity !== null && p.stock_quantity <= 0).length;
  const flaggedProducts = rows.filter(p => p.verification_status === 'flagged').length;

  const filtered = rows.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.shops?.name?.toLowerCase().includes(search.toLowerCase());
    const status = p.verification_status || 'unverified';
    const matchesVerification = verificationFilter === 'all' || status === verificationFilter;
    return matchesSearch && matchesVerification;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 lg:h-8 lg:w-8" /> All Products
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">View products across all shops</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Available</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-green-600">{availableProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Out of Stock</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-red-600">{outOfStock}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> NAFDAC Flagged
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-amber-600">{flaggedProducts}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={verificationFilter} onValueChange={setVerificationFilter}>
            <SelectTrigger className="sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : filtered?.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{product.shops?.name}</p>
                  </div>
                  <Badge variant={product.is_available ? 'default' : 'secondary'} className="flex-shrink-0">
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{product.categories?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <p className="font-bold">₦{Number(product.price).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock</span>
                    <p className="font-medium">{product.stock_quantity ?? 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-2">
                  <ProductVerificationBadge
                    status={product.verification_status}
                    details={product.verification_details as unknown as VerificationDetails | null}
                    compact
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reverify.mutate(product.id)}
                    disabled={reverify.isPending || !product.nafdac_number}
                  >
                    {reverify.isPending && reverify.variables === product.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Re-check</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>NAFDAC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : filtered?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.shops?.name}</TableCell>
                  <TableCell>{product.categories?.name || 'Uncategorized'}</TableCell>
                  <TableCell>₦{Number(product.price).toLocaleString()}</TableCell>
                  <TableCell>{product.stock_quantity ?? 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ProductVerificationBadge
                        status={product.verification_status}
                        details={product.verification_details as unknown as VerificationDetails | null}
                        compact
                      />
                      {product.nafdac_number && (
                        <span className="font-mono text-xs text-muted-foreground">{product.nafdac_number}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.is_available ? 'default' : 'secondary'}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reverify.mutate(product.id)}
                      disabled={reverify.isPending || !product.nafdac_number}
                      title={product.nafdac_number ? 'Re-check against the NAFDAC Greenbook' : 'No NAFDAC number provided'}
                    >
                      {reverify.isPending && reverify.variables === product.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <ShieldCheck className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">Re-check</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
