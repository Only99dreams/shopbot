import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSubscriptionPlans, useReferralEarnings, useUpdatePlatformSetting, usePlatformSettings } from '@/hooks/usePlatformSettings';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';

export default function AdminSettings() {
  const { data: platformSettings, isLoading: settingsLoading } = usePlatformSettings();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: referrals, isLoading: referralsLoading } = useReferralEarnings();
  const updateSetting = useUpdatePlatformSetting();

  const [planPrices, setPlanPrices] = useState({ starter: 0, pro: 5000, business: 15000 });
  const [referralSettings, setReferralSettings] = useState({ signup_bonus: 500, subscription_percentage: 10, min_payout: 5000 });

  useEffect(() => {
    if (plans) setPlanPrices({ starter: plans.starter?.price || 0, pro: plans.pro?.price || 5000, business: plans.business?.price || 15000 });
  }, [plans]);

  useEffect(() => {
    if (referrals) setReferralSettings({ signup_bonus: referrals.signup_bonus || 500, subscription_percentage: referrals.subscription_percentage || 10, min_payout: referrals.min_payout || 5000 });
  }, [referrals]);

  const savePlanPrices = () => {
    if (!plans) return;
    const updated = {
      starter: { ...plans.starter, price: planPrices.starter },
      pro: { ...plans.pro, price: planPrices.pro },
      business: { ...plans.business, price: planPrices.business }
    };
    updateSetting.mutate({ key: 'subscription_plans', value: updated }, { onSuccess: () => toast.success('Subscription prices updated!'), onError: () => toast.error('Failed to update prices') });
  };

  const saveReferralSettings = () => {
    updateSetting.mutate({ key: 'referral_earnings', value: referralSettings }, { onSuccess: () => toast.success('Referral settings updated!'), onError: () => toast.error('Failed to update settings') });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" /> Platform Settings
          </h1>
          <p className="text-muted-foreground">Configure subscription prices and referral earnings</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Prices</CardTitle>
              <CardDescription>Set monthly prices for each plan (₦)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plansLoading ? (
                <p>Loading...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Starter Plan (₦)</Label>
                    <Input type="number" value={planPrices.starter} onChange={e => setPlanPrices(p => ({ ...p, starter: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pro Plan (₦)</Label>
                    <Input type="number" value={planPrices.pro} onChange={e => setPlanPrices(p => ({ ...p, pro: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Plan (₦)</Label>
                    <Input type="number" value={planPrices.business} onChange={e => setPlanPrices(p => ({ ...p, business: Number(e.target.value) }))} />
                  </div>
                  <Button onClick={savePlanPrices} disabled={updateSetting.isPending}>
                    <Save className="mr-2 h-4 w-4" />Save Prices
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referral Earnings</CardTitle>
              <CardDescription>Configure referral program rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {referralsLoading ? (
                <p>Loading...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Signup Bonus (₦)</Label>
                    <Input type="number" value={referralSettings.signup_bonus} onChange={e => setReferralSettings(r => ({ ...r, signup_bonus: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subscription Commission (%)</Label>
                    <Input type="number" value={referralSettings.subscription_percentage} onChange={e => setReferralSettings(r => ({ ...r, subscription_percentage: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Payout (₦)</Label>
                    <Input type="number" value={referralSettings.min_payout} onChange={e => setReferralSettings(r => ({ ...r, min_payout: Number(e.target.value) }))} />
                  </div>
                  <Button onClick={saveReferralSettings} disabled={updateSetting.isPending}>
                    <Save className="mr-2 h-4 w-4" />Save Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
