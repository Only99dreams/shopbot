import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Users,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";

interface Customer {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const { shop } = useShop();

  useEffect(() => {
    if (shop) {
      fetchCustomers();
    }
  }, [shop]);

  const fetchCustomers = async () => {
    if (!shop) return;
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">Manage your customer base</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Customers Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No customers yet</h3>
            <p className="text-sm text-muted-foreground">
              Customers who interact with your shop will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{customer.name || 'Guest'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="truncate ml-4">{customer.email}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium">{customer.name || 'Guest'}</td>
                        <td className="p-4">{customer.phone}</td>
                        <td className="p-4 text-muted-foreground">{customer.email || '-'}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
