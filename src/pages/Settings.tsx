import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, User, Bell, Lock, Upload, Loader2, ExternalLink, Share2, MapPin, CreditCard, Wallet } from "lucide-react";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShopQRCodeCard } from "@/components/shop/ShopQRCode";

// Nigerian states for location
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export default function Settings() {
  const { shop, updateShop, refetch } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [shopData, setShopData] = useState({
    name: "",
    description: "",
    whatsapp_number: "",
    state: "",
    city: "",
    address: "",
    bank_name: "",
    account_number: "",
    account_name: "",
  });

  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const [notifications, setNotifications] = useState({
    orderAlerts: true,
    lowStockAlerts: true,
    customerMessages: true,
    marketingEmails: false,
  });

  const [walletBalance, setWalletBalance] = useState(0);
  const [referralBalance, setReferralBalance] = useState(0);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [payoutType, setPayoutType] = useState<'sales' | 'referral'>('sales');
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (shop) {
      setShopData({
        name: shop.name || "",
        description: shop.description || "",
        whatsapp_number: shop.whatsapp_number || "",
        state: shop.state || "",
        city: shop.city || "",
        address: shop.address || "",
        bank_name: shop.bank_name || "",
        account_number: shop.account_number || "",
        account_name: shop.account_name || "",
      });
    }
  }, [shop]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (shop?.id && user?.id) {
      fetchPaymentsData();
    }
  }, [shop?.id, user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfileData({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
      });
    }
  };

  const fetchPaymentsData = async () => {
    if (!shop?.id || !user?.id) return;
    setLoadingPayments(true);
    try {
      const [{ data: wallet }, { data: referralCode }, { data: requests }] = await Promise.all([
        supabase.from('seller_wallets').select('balance').eq('shop_id', shop.id).maybeSingle(),
        supabase.from('referral_codes').select('available_balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('payout_requests').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false }),
      ]);

      setWalletBalance(Number(wallet?.balance || 0));
      setReferralBalance(Number(referralCode?.available_balance || 0));
      setPayoutRequests(requests || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment data.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPayments(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!shop?.id) return;
    if (!shopData.bank_name || !shopData.account_number || !shopData.account_name) {
      toast({
        title: 'Bank details required',
        description: 'Please add your bank details before requesting a withdrawal.',
        variant: 'destructive',
      });
      return;
    }

    const available = payoutType === 'sales' ? walletBalance : referralBalance;
    if (!payoutAmount || payoutAmount <= 0 || payoutAmount > available) {
      toast({
        title: 'Invalid amount',
        description: 'Enter an amount within your available balance.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('payout_requests')
      .insert({
        shop_id: shop.id,
        amount: payoutAmount,
        payout_type: payoutType,
        bank_name: shopData.bank_name,
        account_number: shopData.account_number,
        account_name: shopData.account_name,
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit payout request. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Request sent',
      description: 'Your payout request has been submitted for review.',
    });

    setPayoutAmount(0);
    await fetchPaymentsData();
  };

  const handleShopUpdate = async () => {
    if (!shop?.id) return;
    setLoading(true);
    
    try {
      await updateShop(shopData);
      toast({
        title: "Settings saved",
        description: "Your shop settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleProfileUpdate = async () => {
    if (!user?.id) return;
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileData.full_name,
        phone: profileData.phone,
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shop?.id) return;

    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${shop.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("shop-logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("shop-logos")
      .getPublicUrl(filePath);

    await updateShop({ logo_url: urlData.publicUrl });
    await refetch();
    
    toast({
      title: "Logo updated",
      description: "Your shop logo has been updated.",
    });
    
    setUploading(false);
  };

  const shopUrl = shop?.id ? `${window.location.origin}/shop/${shop.id}` : "";

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and shop settings</p>
        </div>

        <Tabs defaultValue="shop" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 sm:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="shop" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <Store className="h-4 w-4 hidden sm:block" />
              Shop
            </TabsTrigger>
            <TabsTrigger value="share" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <Share2 className="h-4 w-4 hidden sm:block" />
              Share
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <User className="h-4 w-4 hidden sm:block" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <Bell className="h-4 w-4 hidden sm:block" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <Lock className="h-4 w-4 hidden sm:block" />
              Security
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
              <Wallet className="h-4 w-4 hidden sm:block" />
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Shop Settings */}
          <TabsContent value="shop" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Shop Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                    <AvatarImage src={shop?.logo_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl">
                      {shop?.name?.slice(0, 2).toUpperCase() || "SH"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center sm:text-left">
                    <Label 
                      htmlFor="logo-upload" 
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload Logo
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Recommended: 200x200px, PNG or JPG
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop-name">Shop Name</Label>
                    <Input
                      id="shop-name"
                      value={shopData.name}
                      onChange={(e) => setShopData({ ...shopData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shop-description">Description</Label>
                    <Textarea
                      id="shop-description"
                      value={shopData.description}
                      onChange={(e) => setShopData({ ...shopData, description: e.target.value })}
                      rows={3}
                      placeholder="Tell customers about your shop..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp Number</Label>
                    <Input
                      id="whatsapp"
                      value={shopData.whatsapp_number}
                      onChange={(e) => setShopData({ ...shopData, whatsapp_number: e.target.value })}
                      placeholder="+234 800 000 0000"
                    />
                  </div>

                  {/* Location Section */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">Shop Location</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Setting your location helps customers find your shop in the marketplace
                    </p>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Select 
                          value={shopData.state} 
                          onValueChange={(value) => setShopData({ ...shopData, state: value })}
                        >
                          <SelectTrigger id="state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {NIGERIAN_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={shopData.city}
                          onChange={(e) => setShopData({ ...shopData, city: e.target.value })}
                          placeholder="e.g., Ikeja, Victoria Island"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Label htmlFor="address">Full Address (Optional)</Label>
                      <Input
                        id="address"
                        value={shopData.address}
                        onChange={(e) => setShopData({ ...shopData, address: e.target.value })}
                        placeholder="Street address or landmark"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Shop URL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={shopUrl} readOnly className="bg-muted/50" />
                      <Button variant="outline" size="icon" asChild>
                        <a href={shopUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <Button onClick={handleShopUpdate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Share Shop Tab */}
          <TabsContent value="share" className="space-y-6">
            {shop?.id && (
              <ShopQRCodeCard shopId={shop.id} shopName={shop.name} />
            )}
          </TabsContent>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input
                      id="full-name"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={handleProfileUpdate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: "orderAlerts", label: "Order Alerts", desc: "Get notified when you receive new orders" },
                  { id: "lowStockAlerts", label: "Low Stock Alerts", desc: "Get notified when products are running low" },
                  { id: "customerMessages", label: "Customer Messages", desc: "Get notified when customers send messages" },
                  { id: "marketingEmails", label: "Marketing Emails", desc: "Receive tips and updates about ShopAfrica" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={item.id} className="font-medium">{item.label}</Label>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      id={item.id}
                      checked={notifications[item.id as keyof typeof notifications]}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, [item.id]: checked })
                      }
                    />
                  </div>
                ))}

                <Button>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>

                <Button>Update Password</Button>
              </CardContent>
            </Card>

            <Card className="shadow-card border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button variant="destructive">Delete Account</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments & Withdrawals */}
          <TabsContent value="payments" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Bank Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={shopData.bank_name}
                      onChange={(e) => setShopData((p) => ({ ...p, bank_name: e.target.value }))}
                      placeholder="e.g. GTBank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={shopData.account_number}
                      onChange={(e) => setShopData((p) => ({ ...p, account_number: e.target.value }))}
                      placeholder="0123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input
                      value={shopData.account_name}
                      onChange={(e) => setShopData((p) => ({ ...p, account_name: e.target.value }))}
                      placeholder="Account holder"
                    />
                  </div>
                </div>
                <Button onClick={handleShopUpdate} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Bank Details
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Business Wallet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦{walletBalance.toLocaleString()}</div>
                  <p className="text-sm text-muted-foreground">Available for withdrawal</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Referral Wallet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦{referralBalance.toLocaleString()}</div>
                  <p className="text-sm text-muted-foreground">Available for withdrawal</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Request Withdrawal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Wallet Type</Label>
                    <Select value={payoutType} onValueChange={(v) => setPayoutType(v as 'sales' | 'referral')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Business Wallet</SelectItem>
                        <SelectItem value="referral">Referral Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₦)</Label>
                    <Input
                      type="number"
                      value={payoutAmount || ''}
                      onChange={(e) => setPayoutAmount(Number(e.target.value))}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handlePayoutRequest} disabled={loadingPayments} className="w-full">
                      {loadingPayments ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit Request
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Requests are reviewed by admin. Approved payouts will be processed to your bank account.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="text-muted-foreground">Loading...</div>
                ) : payoutRequests.length === 0 ? (
                  <div className="text-muted-foreground">No payout requests yet.</div>
                ) : (
                  <div className="space-y-3">
                    {payoutRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{req.payout_type === 'referral' ? 'Referral Wallet' : 'Business Wallet'}</p>
                          <p className="text-sm text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₦{Number(req.amount).toLocaleString()}</p>
                          <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {req.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
