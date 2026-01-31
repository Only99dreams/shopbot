import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  shopName: z.string().min(2, "Shop name must be at least 2 characters").max(50),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const benefits = [
  "Set up your shop in 5 minutes",
  "AI handles customer questions 24/7",
  "Accept payments via Paystack & Flutterwave",
  "Track sales and analytics in real-time",
];

type AuthStep = 'form' | 'otp' | 'success';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<AuthStep>('form');
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const referralCode = searchParams.get('ref');
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    shopName: "",
    email: "",
    phone: "",
    password: "",
  });

  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 234
    if (cleaned.startsWith('0')) {
      cleaned = '234' + cleaned.slice(1);
    }
    
    // If doesn't start with country code, assume Nigeria
    if (!cleaned.startsWith('234')) {
      cleaned = '234' + cleaned;
    }
    
    return cleaned;
  };

  const sendOTP = async (phone: string): Promise<boolean> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { phone: formattedPhone }
      });

      if (error) {
        console.error('OTP send error:', error);
        toast({
          title: "Failed to send OTP",
          description: "Please check your phone number and try again.",
          variant: "destructive",
        });
        return false;
      }

      if (data?.success) {
        toast({
          title: "OTP Sent!",
          description: "Check your WhatsApp for the verification code.",
        });
        setResendCooldown(60);
        return true;
      }

      return false;
    } catch (err) {
      console.error('OTP send error:', err);
      toast({
        title: "Failed to send OTP",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const verifyOTP = async (): Promise<boolean> => {
    try {
      const formattedPhone = formatPhoneNumber(registerData.phone);
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: formattedPhone, otp: otpValue }
      });

      if (error) {
        console.error('OTP verify error:', error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('OTP verify error:', err);
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setLoading(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message === "Invalid login credentials" 
          ? "Email or password is incorrect" 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
      navigate('/dashboard');
    }
  };

  const handleRegisterStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(registerData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Skip OTP verification - directly create account
    setLoading(true);
    const { error, data } = await signUp(registerData.email, registerData.password, {
      full_name: registerData.shopName,
      phone: formatPhoneNumber(registerData.phone),
      shop_name: registerData.shopName,
    });

    // Process referral if there's a referral code
    if (!error && data?.user && referralCode) {
      try {
        // Find the referrer by code
        const { data: codeData } = await supabase
          .from('referral_codes')
          .select('user_id')
          .eq('code', referralCode.toUpperCase())
          .single();

        if (codeData?.user_id) {
          // Create referral record
          await supabase.from('referrals').insert({
            referrer_id: codeData.user_id,
            referred_id: data.user.id,
            referral_code: referralCode.toUpperCase(),
            status: 'pending',
            reward_amount: 200, // ₦200 reward when referred user pays
          });

          // Update referrer's total referrals count
          await supabase.rpc('increment_referral_count', { 
            referrer_user_id: codeData.user_id 
          });
        }
      } catch (refError) {
        console.error('Error processing referral:', refError);
        // Don't fail registration if referral processing fails
      }
    }

    setLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes("already registered")) {
        message = "An account with this email already exists. Please log in instead.";
      }
      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
    } else {
      setStep('success');
      toast({
        title: "Account created!",
        description: "Welcome to ShopAfrica. Your subscription is pending activation.",
      });
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpValue.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter all 6 digits.",
        variant: "destructive",
      });
      return;
    }

    setOtpLoading(true);
    const verified = await verifyOTP();
    
    if (!verified) {
      setOtpLoading(false);
      toast({
        title: "Invalid OTP",
        description: "The code you entered is incorrect or expired. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // OTP verified, now create the account
    const { error, data } = await signUp(registerData.email, registerData.password, {
      full_name: registerData.shopName,
      phone: formatPhoneNumber(registerData.phone),
      shop_name: registerData.shopName,
    });

    // Process referral if there's a referral code
    if (!error && data?.user && referralCode) {
      try {
        // Find the referrer by code
        const { data: codeData } = await supabase
          .from('referral_codes')
          .select('user_id')
          .eq('code', referralCode.toUpperCase())
          .single();

        if (codeData?.user_id) {
          // Create referral record
          await supabase.from('referrals').insert({
            referrer_id: codeData.user_id,
            referred_id: data.user.id,
            referral_code: referralCode.toUpperCase(),
            status: 'pending',
            reward_amount: 200, // ₦200 reward when referred user pays
          });

          // Update referrer's total referrals count
          await supabase.rpc('increment_referral_count', { 
            referrer_user_id: codeData.user_id 
          });
        }
      } catch (refError) {
        console.error('Error processing referral:', refError);
        // Don't fail registration if referral processing fails
      }
    }

    setOtpLoading(false);

    if (error) {
      let message = error.message;
      if (error.message.includes("already registered")) {
        message = "An account with this email already exists. Please log in instead.";
      }
      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
      setStep('form');
    } else {
      setStep('success');
      toast({
        title: "Account created!",
        description: "Welcome to ShopAfrica. Your subscription is pending activation.",
      });
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    await sendOTP(registerData.phone);
    setLoading(false);
  };

  const handleLoginChange = (field: keyof typeof loginData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleRegisterChange = (field: keyof typeof registerData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // OTP Verification Step
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold">Verify your WhatsApp</h1>
            <p className="mt-2 text-muted-foreground">
              We sent a 6-digit code to <strong>{registerData.phone}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                value={otpValue}
                onChange={setOtpValue}
                maxLength={6}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={otpLoading || otpValue.length !== 6}>
              {otpLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Verify & Create Account
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?{" "}
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary font-semibold hover:underline"
                >
                  Resend OTP
                </button>
              )}
            </p>
            <button
              onClick={() => { setStep('form'); setOtpValue(''); }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success Step
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="h-20 w-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold">Welcome to ShopAfrica!</h1>
          <p className="text-muted-foreground">Your account has been created. Redirecting to dashboard...</p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Benefits (shown for register) / Illustration (shown for login) */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12">
        <div className="max-w-lg text-primary-foreground">
          {isLogin ? (
            <div className="text-center">
              <div className="h-32 w-32 mx-auto mb-8 rounded-full bg-primary-foreground/20 flex items-center justify-center p-4">
                <img src="/logo.png" alt="ShopAfrica" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-3xl font-bold mb-4">
                "Sell Smarter on WhatsApp"
              </h2>
              <p className="text-primary-foreground/80 text-lg">
                Access your dashboard to manage products, track orders, and grow your business with AI-powered insights.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-4xl font-bold mb-6">
                Start Selling on WhatsApp Today
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8">
                Join 10,000+ sellers who are growing their business with WhatsApp Shop.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
                    <span className="text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="ShopAfrica" className="h-10 w-10 object-contain" />
              <span className="text-2xl font-bold">ShopAfrica</span>
            </Link>
            <h1 className="mt-8 text-3xl font-bold">
              {isLogin ? "Welcome back" : "Create your shop"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isLogin 
                ? "Sign in to manage your WhatsApp shop" 
                : "Start your 14-day free trial. No credit card required."}
            </p>
          </div>

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginData.email}
                  onChange={handleLoginChange("email")}
                  className={`h-12 ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/reset-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={handleLoginChange("password")}
                    className={`h-12 pr-12 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegisterStep1} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="shopName">Business Name</Label>
                <Input
                  id="shopName"
                  type="text"
                  placeholder="Your Store Name"
                  value={registerData.shopName}
                  onChange={handleRegisterChange("shopName")}
                  className={`h-12 ${errors.shopName ? 'border-destructive' : ''}`}
                />
                {errors.shopName && <p className="text-sm text-destructive">{errors.shopName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="regEmail">Email</Label>
                <Input
                  id="regEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={registerData.email}
                  onChange={handleRegisterChange("email")}
                  className={`h-12 ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={registerData.phone}
                  onChange={handleRegisterChange("phone")}
                  className={`h-12 ${errors.phone ? 'border-destructive' : ''}`}
                />
                <p className="text-xs text-muted-foreground">We'll send a verification code to this number</p>
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="regPassword">Password</Label>
                <div className="relative">
                  <Input
                    id="regPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={registerData.password}
                    onChange={handleRegisterChange("password")}
                    className={`h-12 pr-12 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Verify WhatsApp & Continue
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                By signing up, you agree to our{" "}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </p>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep('form'); setOtpValue(''); }}
              className="text-primary font-semibold hover:underline"
            >
              {isLogin ? "Sign up free" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
