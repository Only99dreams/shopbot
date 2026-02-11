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

      if (!data || data.length === 0) return [];

      const userIds = data.map(code => code.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return data.map(code => ({
        ...code,
        profile: profilesData?.find(profile => profile.id === code.user_id) || null,
      }));
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

      if (!data || data.length === 0) return [];

      const profileIds = Array.from(new Set([
        ...data.map(referral => referral.referrer_id),
        ...data.map(referral => referral.referred_id),
      ]));

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);

      if (profilesError) throw profilesError;

      return data.map(referral => ({
        ...referral,
        referrer_profile: profilesData?.find(profile => profile.id === referral.referrer_id) || null,
        referred_profile: profilesData?.find(profile => profile.id === referral.referred_id) || null,
      }));
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Referrals</h1>
          <p className="text-muted-foreground text-sm lg:text-base">Manage platform referral program</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-3 lg:pt-6 lg:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs lg:text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-lg lg:text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Referral Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {codesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : referralCodes && referralCodes.length > 0 ? (
              <>
                {/* Mobile */}
                <div className="lg:hidden space-y-3">
                  {referralCodes.map((code) => (
                    <Card key={code.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold">{code.code}</span>
                          <span className="text-sm font-bold">₦{(code.total_earnings || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium">{code.profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{code.profile?.email || code.user_id.substring(0, 8) + '...'}</p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Referrals: <strong>{code.total_referrals || 0}</strong></span>
                          <span className="text-muted-foreground">{new Date(code.created_at).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop */}
                <Table className="hidden lg:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Total Referrals</TableHead>
                      <TableHead>Total Earnings</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-medium">{code.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{code.profile?.full_name || 'Unknown Seller'}</p>
                            <p className="text-xs text-muted-foreground">{code.profile?.email || code.user_id.substring(0, 8) + '...'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{code.total_referrals || 0}</TableCell>
                        <TableCell>₦{(code.total_earnings || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(code.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No referral codes yet</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : referrals && referrals.length > 0 ? (
              <>
                {/* Mobile */}
                <div className="lg:hidden space-y-3">
                  {referrals.map((referral) => (
                    <Card key={referral.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{referral.referral_code}</span>
                          {getStatusBadge(referral.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Referrer</span>
                            <p className="font-medium truncate">{referral.referrer_profile?.full_name || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Referred</span>
                            <p className="font-medium truncate">{referral.referred_profile?.full_name || 'Unknown'}</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-bold">₦{(referral.reward_amount || 0).toLocaleString()}</span>
                          <span className="text-muted-foreground">{new Date(referral.created_at).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop */}
                <Table className="hidden lg:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Referrer</TableHead>
                      <TableHead>Referred</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-mono">{referral.referral_code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referral.referrer_profile?.full_name || 'Unknown Seller'}</p>
                            <p className="text-xs text-muted-foreground">{referral.referrer_profile?.email || referral.referrer_id.substring(0, 8) + '...'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referral.referred_profile?.full_name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground">{referral.referred_profile?.email || referral.referred_id.substring(0, 8) + '...'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(referral.status)}</TableCell>
                        <TableCell>₦{(referral.reward_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No referrals yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
