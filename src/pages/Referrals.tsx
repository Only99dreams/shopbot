import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Users, DollarSign, TrendingUp, Check, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ReferralCode {
  id: string;
  code: string;
  total_referrals: number;
  total_earnings: number;
}

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: string;
  reward_amount: number;
  created_at: string;
  referred_profile: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function Referrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchReferralData();
    }
  }, [user?.id]);

  const fetchReferralData = async () => {
    if (!user?.id) return;

    // Fetch referral code
    const { data: codeData } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (codeData) setReferralCode(codeData);

    // Fetch referrals
    const { data: referralData } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    if (referralData && referralData.length > 0) {
      // Fetch profiles for referred users
      const referredIds = referralData.map(r => r.referred_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", referredIds);

      // Map profiles to referrals
      const referralsWithProfiles = referralData.map(r => ({
        ...r,
        referred_profile: profilesData?.find(p => p.id === r.referred_id) || null
      }));
      setReferrals(referralsWithProfiles as Referral[]);
    } else {
      setReferrals([]);
    }
  };

  const copyToClipboard = () => {
    if (!referralCode) return;
    const referralLink = `${window.location.origin}/auth?mode=register&ref=${referralCode.code}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = async () => {
    if (!referralCode) return;
    const referralLink = `${window.location.origin}/auth?mode=register&ref=${referralCode.code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join ShopAfrica",
          text: "Start selling on WhatsApp with ShopAfrica! Use my referral link to get started:",
          url: referralLink,
        });
      } catch (err) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  // Calculate conversion rate (completed referrals / total referrals)
  const completedReferrals = referrals.filter(r => r.status === 'completed').length;
  const totalReferrals = referralCode?.total_referrals || 0;
  const conversionRate = totalReferrals > 0 
    ? Math.round((completedReferrals / totalReferrals) * 100) 
    : 0;

  const stats = [
    { 
      title: "Total Referrals", 
      value: totalReferrals, 
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    { 
      title: "Total Earnings", 
      value: `₦${(referralCode?.total_earnings || 0).toLocaleString()}`, 
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    { 
      title: "Pending Rewards", 
      value: `₦${referrals.filter(r => r.status === 'pending').reduce((acc, r) => acc + (r.reward_amount || 0), 0).toLocaleString()}`,
      icon: Gift,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    { 
      title: "Conversion Rate", 
      value: `${conversionRate}%`, 
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
  ];

  const referralLink = referralCode 
    ? `${window.location.origin}/auth?mode=register&ref=${referralCode.code}`
    : "";

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Referrals</h1>
          <p className="text-muted-foreground">Earn rewards by inviting friends</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-card">
              <CardContent className="p-6">
                <div className={`inline-flex p-3 rounded-lg ${stat.bg} mb-4`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Link Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Your Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Share your unique referral link and earn ₦200 for every friend who signs up and pays for their subscription!
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="pr-12 bg-muted/50"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={shareReferral} className="gap-2">
                <Share2 className="h-4 w-4" />
                Share Link
              </Button>
            </div>
            {referralCode && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium">Your Referral Code</p>
                <p className="text-2xl font-bold text-primary">{referralCode.code}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: 1, title: "Share Your Link", description: "Send your unique referral link to friends who might be interested in selling on WhatsApp" },
                { step: 2, title: "They Sign Up & Pay", description: "When they create an account using your link and pay ₦1,000 for their subscription" },
                { step: 3, title: "Earn ₦200", description: "Get ₦200 for each successful referral. Rewards are added to your account automatically" },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No referrals yet</h3>
                <p className="text-muted-foreground">Share your referral link to start earning rewards!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="border-b border-border">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{referral.referred_profile?.full_name || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground">{referral.referred_profile?.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            referral.status === 'completed' 
                              ? 'bg-green-500/10 text-green-500' 
                              : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {referral.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          ₦{(referral.reward_amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
