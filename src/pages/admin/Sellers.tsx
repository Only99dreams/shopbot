import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function Sellers() {
  const [search, setSearch] = useState('');

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, is_active, owner_id');

      if (shopsError) throw shopsError;

      return profiles.map(profile => ({
        ...profile,
        shop: shops.find(shop => shop.owner_id === profile.id) || null
      }));
    }
  });

  const totalSellers = sellers?.length || 0;
  const withShops = sellers?.filter(s => s.shop).length || 0;

  const filtered = sellers?.filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 lg:h-8 lg:w-8" /> Sellers
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">Manage all registered sellers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Sellers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalSellers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">With Shops</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-green-600">{withShops}</div>
            </CardContent>
          </Card>
        </div>

        <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search sellers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sellers found</div>
          ) : filtered?.map((seller: any) => (
            <Card key={seller.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{seller.full_name || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground truncate">{seller.email}</p>
                  </div>
                  {seller.shop && (
                    <Badge variant={seller.shop.is_active ? 'default' : 'destructive'} className="flex-shrink-0">
                      {seller.shop.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <p className="font-medium">{seller.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Shop</span>
                    <p className="font-medium truncate">{seller.shop?.name || 'No shop'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Joined</span>
                    <p className="font-medium">{format(new Date(seller.created_at), 'MMM d, yyyy')}</p>
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sellers found</TableCell></TableRow>
              ) : filtered?.map((seller: any) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">{seller.full_name || 'N/A'}</TableCell>
                  <TableCell>{seller.email}</TableCell>
                  <TableCell>{seller.phone || 'N/A'}</TableCell>
                  <TableCell>
                    {seller.shop?.name || 'No shop'}
                    {seller.shop && !seller.shop.is_active && (
                      <Badge variant="destructive" className="ml-2">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(seller.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
