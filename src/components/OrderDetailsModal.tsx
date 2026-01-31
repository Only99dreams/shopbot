import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, User, Phone, Calendar, CreditCard } from "lucide-react";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  payment_status: string;
  payment_method: string;
  redemption_confirmed: boolean;
  notes: string;
  created_at: string;
  customers: {
    name: string | null;
    phone: string;
  } | null;
  order_items: OrderItem[];
  redemption_codes: {
    code: string;
    status: string;
  } | null;
}

interface OrderDetailsModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function OrderDetailsModal({ orderId, open, onOpenChange }: OrderDetailsModalProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId && open) {
      fetchOrderDetails();
    }
  }, [orderId, open]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          total_price
        ),
        redemption_codes!order_id (code, status)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order details:', error);
    } else {
      setOrder(data);
    }
    setLoading(false);
  };

  if (!orderId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Details - {order?.order_number}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Order Status and Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge className={statusColors[order.status]}>
                    {order.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Payment:</span>
                  <Badge className={order.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }>
                    {order.payment_status}
                  </Badge>
                </div>
                {order.payment_method && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground capitalize">
                      {order.payment_method}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Redemption:</span>
                  <Badge className={order.redemption_confirmed
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }>
                    {order.redemption_confirmed ? 'Confirmed' : 'Pending'}
                  </Badge>
                </div>
                {order.redemption_codes && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Code:</span>
                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {order.redemption_codes.code}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            {order.customers && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">{order.customers.name || 'Guest'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">{order.customers.phone}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Order Items */}
            <Separator />
            <div className="space-y-4">
              <h3 className="font-medium">Order Items</h3>
              <div className="space-y-3">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        ₦{item.unit_price.toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₦{item.total_price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>₦{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-medium text-lg">
                <span>Total:</span>
                <span>₦{order.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-medium">Notes</h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {order.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Order not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}