import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Store } from 'lucide-react';
import { format } from 'date-fns';

export default function Shops() {
  const [search, setSearch] = useState('');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shops').select('*, products(id), orders(id)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filtered = shops?.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Store className="h-8 w-8" /> Shops</h1><p className="text-muted-foreground">Manage all shops</p></div>
        <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search shops..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Shop Name</TableHead><TableHead>Products</TableHead><TableHead>Orders</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow> : filtered?.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No shops found</TableCell></TableRow> : filtered?.map(shop => (
                <TableRow key={shop.id}>
                  <TableCell className="font-medium">{shop.name}</TableCell>
                  <TableCell>{(shop.products as { id: string }[])?.length || 0}</TableCell>
                  <TableCell>{(shop.orders as { id: string }[])?.length || 0}</TableCell>
                  <TableCell><Badge variant={shop.is_active ? 'default' : 'destructive'}>{shop.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
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
