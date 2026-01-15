import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminSubscriptions() {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*, shops(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><CreditCard className="h-8 w-8" /> Subscriptions</h1><p className="text-muted-foreground">Manage all subscriptions</p></div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Shop</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Trial Ends</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow> : subscriptions?.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No subscriptions found</TableCell></TableRow> : subscriptions?.map(sub => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{(sub.shops as { name: string })?.name}</TableCell>
                  <TableCell className="capitalize">{sub.plan}</TableCell>
                  <TableCell><Badge variant={sub.status === 'active' ? 'default' : sub.status === 'trial' ? 'secondary' : 'destructive'}>{sub.status}</Badge></TableCell>
                  <TableCell>{sub.trial_ends_at ? format(new Date(sub.trial_ends_at), 'MMM d, yyyy') : 'N/A'}</TableCell>
                  <TableCell>{format(new Date(sub.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
