import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Package, Box, AlertCircle } from 'lucide-react';

export default function AdminProducts() {
  const [search, setSearch] = useState('');

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

  const totalProducts = products?.length || 0;
  const availableProducts = products?.filter(p => p.is_available).length || 0;
  const outOfStock = products?.filter(p => p.stock_quantity !== null && p.stock_quantity <= 0).length || 0;

  const filtered = products?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.shops as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="grid grid-cols-3 gap-3 lg:gap-4">
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
        </div>

        <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : filtered?.map((product: any) => (
            <Card key={product.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{(product.shops as any)?.name}</p>
                  </div>
                  <Badge variant={product.is_available ? 'default' : 'secondary'} className="flex-shrink-0">
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{(product.categories as any)?.name || 'N/A'}</p>
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
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : filtered?.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{(product.shops as any)?.name}</TableCell>
                  <TableCell>{(product.categories as any)?.name || 'Uncategorized'}</TableCell>
                  <TableCell>₦{Number(product.price).toLocaleString()}</TableCell>
                  <TableCell>{product.stock_quantity ?? 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_available ? 'default' : 'secondary'}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
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
