import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/providers/auth-provider';
import { api, apiErrorMessage } from '@/lib/api';
import { clearCartToken } from '@/lib/cart-token';
import { formatMoney } from '@/lib/utils';
import type { Cart } from '@/lib/types';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

interface AddressState {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface CheckoutSession {
  orderNumber: string;
  amount: number;
  currency: string;
  clientSecret: string;
}

function OrderSummary({ cart }: { cart: Cart }) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardContent className="space-y-5 p-6">
        <h2 className="font-semibold">Order summary</h2>
        <div className="space-y-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                ) : (
                  <div className="size-full bg-gradient-to-br from-secondary to-background" />
                )}
              </div>
              <div className="flex flex-1 justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium leading-tight">{item.name}</p>
                  <p className="text-muted-foreground">
                    {item.variantName} · Qty {item.quantity}
                  </p>
                </div>
                <span>{formatMoney(item.lineTotal, cart.currency)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatMoney(cart.subtotal, cart.currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  id: keyof AddressState;
  label: string;
  value: string;
  onChange: (id: keyof AddressState, value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </div>
  );
}

function AddressForm({
  address,
  onChange,
  onSubmit,
  submitting,
}: {
  address: AddressState;
  onChange: (id: keyof AddressState, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <section className="space-y-4">
        <h2 className="font-semibold">Contact</h2>
        <Field id="email" label="Email" type="email" value={address.email} onChange={onChange} />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Shipping address</h2>
        <Field id="fullName" label="Full name" value={address.fullName} onChange={onChange} />
        <Field id="line1" label="Address" value={address.line1} onChange={onChange} />
        <Field
          id="line2"
          label="Apartment, suite (optional)"
          value={address.line2}
          onChange={onChange}
          required={false}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="city" label="City" value={address.city} onChange={onChange} />
          <Field
            id="region"
            label="State / Region"
            value={address.region}
            onChange={onChange}
            required={false}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="postalCode" label="Postal code" value={address.postalCode} onChange={onChange} />
          <Field id="country" label="Country" value={address.country} onChange={onChange} />
        </div>
        <Field
          id="phone"
          label="Phone (optional)"
          value={address.phone}
          onChange={onChange}
          required={false}
        />
      </section>

      <section className="space-y-2">
        <Label htmlFor="note">Order note (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note for your order"
        />
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Preparing payment…' : 'Continue to payment'}
      </Button>
    </form>
  );
}

function PaymentForm({
  amount,
  currency,
  onSuccess,
}: {
  amount: number;
  currency: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? 'Payment failed');
      return;
    }
    onSuccess();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PaymentElement />
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : `Pay ${formatMoney(amount, currency)}`}
      </Button>
    </form>
  );
}

function DemoPayment({
  amount,
  currency,
  onSuccess,
}: {
  amount: number;
  currency: string;
  onSuccess: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        Stripe keys are not configured. Set VITE_STRIPE_PUBLISHABLE_KEY to collect real payments.
        Use the button below to simulate a completed order.
      </div>
      <Button size="lg" className="w-full" onClick={onSuccess}>
        Pay {formatMoney(amount, currency)} (demo)
      </Button>
    </div>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();

  const [address, setAddress] = useState<AddressState>({
    email: user?.email ?? '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    phone: '',
  });
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <PageLoader />;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        <EmptyState title="Your bag is empty" description="Add items before checking out." />
        <div className="flex justify-center">
          <Button asChild>
            <Link to="/">Continue shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  function updateField(id: keyof AddressState, value: string) {
    setAddress((prev) => ({ ...prev, [id]: value }));
  }

  async function startPayment() {
    setSubmitting(true);
    try {
      const { data } = await api.post<CheckoutSession & { orderId: string }>('/checkout', {
        email: address.email,
        shippingAddress: {
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          region: address.region || undefined,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone || undefined,
        },
      });
      setSession({
        orderNumber: data.orderNumber,
        amount: data.amount,
        currency: data.currency,
        clientSecret: data.clientSecret,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not start checkout'));
    } finally {
      setSubmitting(false);
    }
  }

  function completeOrder(orderNumber: string) {
    clearCartToken();
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    navigate(`/order-confirmation?order=${orderNumber}`);
  }

  const canUseStripe = Boolean(session?.clientSecret) && Boolean(stripePromise);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {!session ? (
            <AddressForm
              address={address}
              onChange={updateField}
              onSubmit={startPayment}
              submitting={submitting}
            />
          ) : (
            <div className="space-y-6">
              <h2 className="font-semibold">Payment</h2>
              {canUseStripe && stripePromise ? (
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret: session.clientSecret, appearance: { theme: 'night' } }}
                >
                  <PaymentForm
                    amount={session.amount}
                    currency={session.currency}
                    onSuccess={() => completeOrder(session.orderNumber)}
                  />
                </Elements>
              ) : (
                <DemoPayment
                  amount={session.amount}
                  currency={session.currency}
                  onSuccess={() => completeOrder(session.orderNumber)}
                />
              )}
            </div>
          )}
        </div>

        <OrderSummary cart={cart} />
      </div>
    </div>
  );
}
