import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search, Package } from 'lucide-react';

export default function AdminProducts() {
  const [search, setSearch] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*, shops(name), categories(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filtered = products?.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> All Products</h1><p className="text-muted-foreground">View products across all shops</p></div>
        <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Shop</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow> : filtered?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow> : filtered?.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{(product.shops as { name: string })?.name}</TableCell>
                  <TableCell>{(product.categories as { name: string })?.name || 'Uncategorized'}</TableCell>
                  <TableCell>₦{product.price.toLocaleString()}</TableCell>
                  <TableCell>{product.stock_quantity ?? 'N/A'}</TableCell>
                  <TableCell><Badge variant={product.is_available ? 'default' : 'secondary'}>{product.is_available ? 'Available' : 'Unavailable'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
