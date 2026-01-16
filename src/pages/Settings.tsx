import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, User, Bell, Lock, Upload, Loader2, ExternalLink, Share2, MapPin } from "lucide-react";
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

  useEffect(() => {
    if (shop) {
      setShopData({
        name: shop.name || "",
        description: shop.description || "",
        whatsapp_number: shop.whatsapp_number || "",
        state: shop.state || "",
        city: shop.city || "",
        address: shop.address || "",
      });
    }
  }, [shop]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and shop settings</p>
        </div>

        <Tabs defaultValue="shop" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-5 h-auto">
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
