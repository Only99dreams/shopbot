import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Store } from 'lucide-react';
import { format } from 'date-fns';

export default function Shops() {
  const [search, setSearch] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*, products(id), orders(id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalShops = shops?.length || 0;
  const activeShops = shops?.filter(s => s.is_active).length || 0;

  const filtered = shops?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Store className="h-7 w-7 lg:h-8 lg:w-8" /> Shops
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">Manage all shops</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Shops</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalShops}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-green-600">{activeShops}</div>
            </CardContent>
          </Card>
        </div>

        <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search shops..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No shops found</div>
          ) : filtered?.map((shop: any) => (
            <Card key={shop.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold truncate">{shop.name}</p>
                  <Badge variant={shop.is_active ? 'default' : 'destructive'} className="flex-shrink-0">
                    {shop.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Products</span>
                    <p className="font-bold">{(shop.products as any[])?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Orders</span>
                    <p className="font-bold">{(shop.orders as any[])?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium text-xs">{format(new Date(shop.created_at), 'MMM d, yy')}</p>
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
                <TableHead>Shop Name</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No shops found</TableCell></TableRow>
              ) : filtered?.map((shop: any) => (
                <TableRow key={shop.id}>
                  <TableCell className="font-medium">{shop.name}</TableCell>
                  <TableCell>{(shop.products as any[])?.length || 0}</TableCell>
                  <TableCell>{(shop.orders as any[])?.length || 0}</TableCell>
                  <TableCell>
                    <Badge variant={shop.is_active ? 'default' : 'destructive'}>
                      {shop.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(shop.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
