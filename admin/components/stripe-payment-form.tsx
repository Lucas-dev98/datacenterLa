"use client";

/**
 * Formulário Stripe Elements — pagamento com cartão no admin.
 *
 * O estado `busy` e `confirmPayment` ficam aqui (SDK Stripe), não em useApiMutation,
 * porque o fluxo depende de `stripe` + `elements` do React Stripe.js.
 *
 * @see hooks/use-payment-mutations.ts — cria/confirma PaymentIntent no backend
 */
import { FormEvent, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui";

type Props = {
  publishableKey: string;
  clientSecret: string;
  onSuccess: () => void | Promise<void>;
  submitLabel?: string;
};

function InnerForm({ onSuccess, submitLabel }: Pick<Props, "onSuccess" | "submitLabel">) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Pagamento recusado");
      setBusy(false);
      return;
    }
    try {
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar pagamento");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <PaymentElement />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={!stripe || busy}>
        {busy ? "Processando…" : submitLabel ?? "Confirmar pagamento"}
      </Button>
    </form>
  );
}

export function StripePaymentForm({ publishableKey, clientSecret, onSuccess, submitLabel }: Props) {
  const [stripePromise] = useState<Promise<Stripe | null>>(() => loadStripe(publishableKey));

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerForm onSuccess={onSuccess} submitLabel={submitLabel} />
    </Elements>
  );
}
