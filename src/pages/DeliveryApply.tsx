import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Bike, BadgeCheck, CheckCircle2, Clock,
  Loader2, MapPin, ShieldCheck, Truck, Wallet, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useDelivery, type DeliveryApplication } from '@/hooks/useDelivery';
import { NIGERIAN_STATES, citiesForState } from '@/lib/nigeria';
import { toast } from 'sonner';

const VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van / Pickup' },
  { value: 'tricycle', label: 'Tricycle (Keke)' },
];

const ID_TYPES = [
  { value: 'nin', label: 'National ID (NIN)' },
  { value: 'drivers_license', label: "Driver's Licence" },
  { value: 'voter_card', label: 'Voter Card' },
  { value: 'passport', label: 'International Passport' },
];

const EMPTY_FORM: DeliveryApplication = {
  full_name: '',
  phone: '',
  email: '',
  state: '',
  city: '',
  address: '',
  vehicle_type: 'motorcycle',
  vehicle_plate: '',
  id_type: 'nin',
  id_number: '',
  id_document_url: '',
  selfie_url: '',
};

export default function DeliveryApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { agent, isLoading, apply, uploadDocument } = useDelivery();

  const [form, setForm] = useState<DeliveryApplication>(EMPTY_FORM);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setForm({
      full_name: agent.full_name,
      phone: agent.phone,
      email: agent.email ?? '',
      state: agent.state,
      city: agent.city,
      address: agent.address ?? '',
      vehicle_type: agent.vehicle_type,
      vehicle_plate: agent.vehicle_plate ?? '',
      id_type: agent.id_type,
      id_number: agent.id_number,
      id_document_url: agent.id_document_url ?? '',
      selfie_url: agent.selfie_url ?? '',
    });
  }, [agent]);

  const update = (field: keyof DeliveryApplication, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.full_name.trim() || form.full_name.trim().length < 3) {
      toast.error('Enter your full name');
      return;
    }
    if (!form.phone.trim() || form.phone.trim().length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    if (!form.state || !form.city.trim()) {
      toast.error('Select your state and enter your city');
      return;
    }
    if (!form.id_number.trim()) {
      toast.error('Enter your ID number');
      return;
    }
    if (!agent && (!idDocument || !selfie)) {
      toast.error('Upload your ID document and a clear selfie');
      return;
    }

    setSubmitting(true);
    try {
      let idDocumentUrl = form.id_document_url || '';
      let selfieUrl = form.selfie_url || '';

      if (idDocument) {
        idDocumentUrl = await uploadDocument(idDocument, 'id-document');
      }
      if (selfie) {
        selfieUrl = await uploadDocument(selfie, 'selfie');
      }

      await apply.mutateAsync({
        ...form,
        id_document_url: idDocumentUrl,
        selfie_url: selfieUrl,
      });

      setShowForm(false);
      setIdDocument(null);
      setSelfie(null);
    } catch (error) {
      console.error('Delivery application failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
        <header className="border-b bg-background/80 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ShopAfrica" className="h-9 w-9 object-contain" />
              <span className="text-lg font-bold">ShopAfrica</span>
            </Link>
            <Link to="/marketplace">
              <Button variant="ghost" size="sm">Marketplace</Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
              <Truck className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mb-4 rounded-full" variant="secondary">Now hiring delivery agents</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Earn money delivering orders in your city
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Join the ShopAfrica delivery network. Accept deliveries near you, track your
              earnings in real time, and get paid straight to your bank account.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/auth?mode=register&account=delivery_agent">
                <Button size="lg" className="h-12 rounded-full px-8">
                  Become a delivery agent
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-12 rounded-full px-8">
                  I already have an account
                </Button>
              </Link>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                { icon: MapPin, title: 'Work around you', text: 'See only deliveries in your state and city.' },
                { icon: Wallet, title: 'Keep up to 85%', text: 'The delivery fee is yours, minus a small platform commission.' },
                { icon: ShieldCheck, title: 'Fast payouts', text: 'Request a payout to your bank whenever you are ready.' },
              ].map(({ icon: Icon, title, text }) => (
                <Card key={title} className="text-left">
                  <CardContent className="p-5">
                    <Icon className="mb-3 h-6 w-6 text-primary" />
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border bg-card p-5 text-left text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">What you'll need</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  'A valid government ID (NIN, licence, voter card or passport)',
                  'A clear selfie for identity matching',
                  'A motorcycle, bicycle, car, van or tricycle',
                  'A phone number and bank account for payouts',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const status = agent?.status;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ShopAfrica" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold">ShopAfrica</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/marketplace">
              <Button variant="ghost" size="sm">Marketplace</Button>
            </Link>
            {agent && (
              <Link to="/delivery/dashboard">
                <Button size="sm" variant="outline">My dashboard</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {agent && (
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {status === 'approved' && <BadgeCheck className="mt-0.5 h-6 w-6 text-green-600" />}
                {status === 'pending' && <Clock className="mt-0.5 h-6 w-6 text-amber-500" />}
                {(status === 'rejected' || status === 'suspended') && <XCircle className="mt-0.5 h-6 w-6 text-destructive" />}
                <div>
                  <p className="font-semibold">
                    {status === 'approved' && 'You are an approved delivery agent'}
                    {status === 'pending' && 'Your application is under review'}
                    {status === 'rejected' && 'Your application was rejected'}
                    {status === 'suspended' && 'Your delivery account is suspended'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status === 'approved' && 'Go to your dashboard to start accepting deliveries.'}
                    {status === 'pending' && 'We usually review applications within 24 hours. You can update your details below.'}
                    {status === 'rejected' && (agent.rejection_reason || 'Update your details and resubmit for review.')}
                    {status === 'suspended' && (agent.rejection_reason || 'Contact support if you believe this is a mistake.')}
                  </p>
                </div>
              </div>
              {status === 'approved' ? (
                <Button onClick={() => navigate('/delivery/dashboard')}>
                  Open dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setShowForm((value) => !value)}>
                  {showForm ? 'Hide form' : 'Update application'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {(!agent || showForm) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                {agent ? 'Update your delivery details' : 'Delivery agent application'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name *</Label>
                    <Input id="full_name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="e.g. Musa Ibrahim" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number *</Label>
                    <Input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="08012345678" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} placeholder="you@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle type *</Label>
                    <Select value={form.vehicle_type} onValueChange={(value) => update('vehicle_type', value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((vehicle) => (
                          <SelectItem key={vehicle.value} value={vehicle.value}>{vehicle.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_plate">Vehicle plate number</Label>
                    <Input id="vehicle_plate" value={form.vehicle_plate ?? ''} onChange={(e) => update('vehicle_plate', e.target.value)} placeholder="e.g. KJA 123 AB" />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Select value={form.state} onValueChange={(value) => { update('state', value); update('city', ''); }}>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {NIGERIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City / area *</Label>
                    <Input
                      id="city"
                      list="delivery-cities"
                      value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      placeholder="e.g. Ikeja"
                    />
                    <datalist id="delivery-cities">
                      {citiesForState(form.state).map((city) => <option key={city} value={city} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Home address</Label>
                    <Input id="address" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} placeholder="Street, area" />
                  </div>
                </div>

                <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ID type *</Label>
                    <Select value={form.id_type} onValueChange={(value) => update('id_type', value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ID_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="id_number">ID number *</Label>
                    <Input id="id_number" value={form.id_number} onChange={(e) => update('id_number', e.target.value)} placeholder="Enter your ID number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="id_document">ID document {agent ? '' : '*'}</Label>
                    <Input id="id_document" type="file" accept="image/*,.pdf" onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)} />
                    {form.id_document_url && !idDocument && (
                      <p className="text-xs text-green-600">A document is already on file. Upload a new one to replace it.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selfie">Selfie {agent ? '' : '*'}</Label>
                    <Input id="selfie" type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
                    {form.selfie_url && !selfie && (
                      <p className="text-xs text-green-600">A selfie is already on file. Upload a new one to replace it.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Your documents are private
                  </p>
                  <p className="mt-1">
                    Only ShopAfrica admins can view your ID and selfie. They are used solely to verify your identity.
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    <>{agent ? 'Resubmit application' : 'Submit application'} <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {agent?.status === 'approved' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Bike, label: 'Deliveries completed', value: agent.total_deliveries },
              { icon: MapPin, label: 'Coverage', value: `${agent.city}, ${agent.state}` },
              { icon: BadgeCheck, label: 'Rating', value: `${Number(agent.rating).toFixed(1)} / 5` },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
