package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/paymentintent"
	"github.com/stripe/stripe-go/v81/webhook"
)

type Gateway interface {
	Name() string
	CreatePayment(ctx context.Context, amountUSD float64, orderID uuid.UUID, internalIntentID uuid.UUID) (clientSecret, providerRef string, err error)
	IsPaid(ctx context.Context, providerRef string) (bool, error)
	ParseWebhook(payload []byte, signature string) (providerRef string, err error)
}

type Mock struct{}

func (Mock) Name() string { return "mock" }

func (Mock) CreatePayment(_ context.Context, _ float64, _ uuid.UUID, internalIntentID uuid.UUID) (string, string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	secret := "pi_mock_" + hex.EncodeToString(b)
	ref := "mock_" + internalIntentID.String()[:8]
	return secret, ref, nil
}

func (Mock) IsPaid(_ context.Context, _ string) (bool, error) { return true, nil }

func (Mock) ParseWebhook(_ []byte, _ string) (string, error) {
	return "", fmt.Errorf("mock gateway has no webhooks")
}

type Stripe struct {
	webhookSecret string
}

func NewStripe(secretKey, webhookSecret string) Stripe {
	stripe.Key = secretKey
	return Stripe{webhookSecret: webhookSecret}
}

func (s Stripe) Name() string { return "stripe" }

func (s Stripe) CreatePayment(_ context.Context, amountUSD float64, orderID, internalIntentID uuid.UUID) (string, string, error) {
	if stripe.Key == "" {
		return "", "", fmt.Errorf("stripe secret key not configured")
	}
	amountCents := int64(amountUSD * 100)
	if amountCents < 50 {
		amountCents = 50
	}
	pi, err := paymentintent.New(&stripe.PaymentIntentParams{
		Amount:   stripe.Int64(amountCents),
		Currency: stripe.String("usd"),
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
		Metadata: map[string]string{
			"order_id":  orderID.String(),
			"intent_id": internalIntentID.String(),
		},
	})
	if err != nil {
		return "", "", err
	}
	return pi.ClientSecret, pi.ID, nil
}

func (s Stripe) IsPaid(_ context.Context, providerRef string) (bool, error) {
	pi, err := paymentintent.Get(providerRef, nil)
	if err != nil {
		return false, err
	}
	return pi.Status == stripe.PaymentIntentStatusSucceeded, nil
}

func (s Stripe) ParseWebhook(payload []byte, signature string) (string, error) {
	event, err := webhook.ConstructEvent(payload, signature, s.webhookSecret)
	if err != nil {
		return "", err
	}
	if event.Type != "payment_intent.succeeded" {
		return "", fmt.Errorf("ignored event %s", event.Type)
	}
	var pi stripe.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
		return "", err
	}
	return pi.ID, nil
}

// TestWebhook parses JSON {"provider_ref":"..."} for integration tests.
type TestWebhook struct{ Mock }

func (TestWebhook) Name() string { return "test_webhook" }

func (TestWebhook) ParseWebhook(payload []byte, _ string) (string, error) {
	var body struct {
		ProviderRef string `json:"provider_ref"`
	}
	if err := json.Unmarshal(payload, &body); err != nil || body.ProviderRef == "" {
		return "", fmt.Errorf("invalid test webhook payload")
	}
	return body.ProviderRef, nil
}

func NewFromEnv() Gateway {
	secret := os.Getenv("STRIPE_SECRET_KEY")
	if secret != "" {
		return NewStripe(secret, os.Getenv("STRIPE_WEBHOOK_SECRET"))
	}
	return Mock{}
}
