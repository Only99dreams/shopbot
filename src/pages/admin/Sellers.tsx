import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function Sellers() {
  const [search, setSearch] = useState('');

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Fetch all shops
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, is_active, owner_id');
      
      if (shopsError) throw shopsError;

      // Map shops to profiles by owner_id
      return profiles.map(profile => ({
        ...profile,
        shop: shops.find(shop => shop.owner_id === profile.id) || null
      }));
    }
  });

  const filtered = sellers?.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" /> Sellers
            </h1>
            <p className="text-muted-foreground">Manage all registered sellers</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search sellers..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10" 
          />
        </div>

        <div className="border rounded-lg">
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
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No sellers found
                  </TableCell>
                </TableRow>
              ) : filtered?.map(seller => (
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
