import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, DollarSign, TrendingUp, Link } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminReferrals() {
  const { data: referralCodes, isLoading: codesLoading } = useQuery({
    queryKey: ['admin-referral-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .order('total_referrals', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalReferrals = referralCodes?.reduce((sum, code) => sum + (code.total_referrals || 0), 0) || 0;
  const totalEarnings = referralCodes?.reduce((sum, code) => sum + (code.total_earnings || 0), 0) || 0;
  const activeReferrers = referralCodes?.filter(code => (code.total_referrals || 0) > 0).length || 0;

  const stats = [
    { title: "Total Referrals", value: totalReferrals.toString(), icon: Users },
    { title: "Total Earnings", value: `₦${totalEarnings.toLocaleString()}`, icon: DollarSign },
    { title: "Active Referrers", value: activeReferrers.toString(), icon: TrendingUp },
    { title: "Referral Codes", value: (referralCodes?.length || 0).toString(), icon: Link },
  ];

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold">Referrals</h1>
          <p className="text-muted-foreground">Manage platform referral program</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Codes Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Referral Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {codesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : referralCodes && referralCodes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Total Referrals</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-medium">{code.code}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{code.user_id.substring(0, 8)}...</TableCell>
                      <TableCell>{code.total_referrals || 0}</TableCell>
                      <TableCell>₦{(code.total_earnings || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(code.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No referral codes yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : referrals && referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral Code</TableHead>
                    <TableHead>Referrer ID</TableHead>
                    <TableHead>Referred ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-mono">{referral.referral_code}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{referral.referrer_id.substring(0, 8)}...</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{referral.referred_id.substring(0, 8)}...</TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>₦{(referral.reward_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No referrals yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
