package service

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/datacenterla/platform/internal/payments/domain"
	"github.com/datacenterla/platform/internal/payments/gateway"
	"github.com/datacenterla/platform/internal/payments/repository"
	salesdomain "github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

type OrderPayer interface {
	RecordPayment(ctx context.Context, orderID uuid.UUID, in salesdomain.PaymentInput, recordedBy uuid.UUID) (*salesdomain.Order, error)
	GetOrder(ctx context.Context, id uuid.UUID) (*salesdomain.Order, error)
	CancelOrder(ctx context.Context, orderID uuid.UUID, cancelledBy uuid.UUID) (*salesdomain.Order, error)
}

type CartClearer interface {
	ClearCartForSession(ctx context.Context, sessionID string) error
}

type Service struct {
	repo  *repository.Postgres
	sales OrderPayer
	cart  CartClearer
	gw    gateway.Gateway
}

func New(repo *repository.Postgres, sales OrderPayer, gw gateway.Gateway) *Service {
	if gw == nil {
		gw = gateway.Mock{}
	}
	return &Service{repo: repo, sales: sales, gw: gw}
}

func NewWithCart(repo *repository.Postgres, sales OrderPayer, cart CartClearer, gw gateway.Gateway) *Service {
	s := New(repo, sales, gw)
	s.cart = cart
	return s
}

type PublicConfig struct {
	Provider             string `json:"provider"`
	StripePublishableKey string `json:"stripe_publishable_key,omitempty"`
}

func (s *Service) PublicConfig() PublicConfig {
	return PublicConfig{
		Provider:             s.gw.Name(),
		StripePublishableKey: os.Getenv("STRIPE_PUBLISHABLE_KEY"),
	}
}

func (s *Service) CreateIntent(ctx context.Context, orderID uuid.UUID, provider string) (*domain.PaymentIntent, error) {
	order, err := s.sales.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != "confirmed" && order.Status != "draft" {
		return nil, domain.ErrInvalidState
	}
	gw := s.gw
	if provider == "mock" {
		gw = gateway.Mock{}
	}
	pi, err := s.repo.InsertIntent(ctx, domain.CreateIntentInput{
		OrderID:   orderID,
		AmountUSD: order.TotalUSD,
	}, gw.Name())
	if err != nil {
		return nil, err
	}
	clientSecret, providerRef, err := gw.CreatePayment(ctx, order.TotalUSD, orderID, pi.ID)
	if err != nil {
		_ = s.repo.MarkIntentFailed(ctx, pi.ID)
		return nil, err
	}
	return s.repo.UpdateIntentGateway(ctx, pi.ID, clientSecret, providerRef, gw.Name())
}

func (s *Service) ConfirmIntent(ctx context.Context, intentID uuid.UUID, recordedBy uuid.UUID) (*domain.PaymentIntent, error) {
	return s.ConfirmIntentForSession(ctx, intentID, recordedBy, "")
}

func (s *Service) ConfirmIntentForSession(ctx context.Context, intentID uuid.UUID, recordedBy uuid.UUID, sessionID string) (*domain.PaymentIntent, error) {
	pi, err := s.repo.GetIntent(ctx, intentID)
	if err != nil {
		return nil, err
	}
	if pi.Status != "pending" {
		return nil, domain.ErrInvalidState
	}
	completed, err := s.completeIntent(ctx, pi, recordedBy)
	if err != nil {
		return nil, err
	}
	if sessionID != "" && s.cart != nil {
		_ = s.cart.ClearCartForSession(ctx, sessionID)
	}
	return completed, nil
}

func (s *Service) CompleteByProviderRef(ctx context.Context, providerRef string, recordedBy uuid.UUID) (*domain.PaymentIntent, error) {
	pi, err := s.repo.GetIntentByProviderRef(ctx, providerRef)
	if err != nil {
		return nil, err
	}
	if pi.Status == "completed" {
		return pi, nil
	}
	if pi.Status != "pending" {
		return nil, domain.ErrInvalidState
	}
	return s.completeIntent(ctx, pi, recordedBy)
}

func (s *Service) completeIntent(ctx context.Context, pi *domain.PaymentIntent, recordedBy uuid.UUID) (*domain.PaymentIntent, error) {
	gw := s.gatewayFor(pi.Provider)
	if pi.ProviderRef != nil && *pi.ProviderRef != "" {
		paid, err := gw.IsPaid(ctx, *pi.ProviderRef)
		if err != nil {
			return nil, err
		}
		if !paid && gw.Name() == "stripe" {
			return nil, domain.ErrInvalidState
		}
	}
	ref := "mock"
	if pi.ProviderRef != nil && *pi.ProviderRef != "" {
		ref = *pi.ProviderRef
	}
	method := "gateway_" + pi.Provider
	if _, err := s.sales.RecordPayment(ctx, pi.OrderID, salesdomain.PaymentInput{
		AmountUSD: pi.AmountUSD,
		Method:    method,
		Reference: &ref,
	}, recordedBy); err != nil {
		_ = s.repo.MarkIntentFailed(ctx, pi.ID)
		_, _ = s.sales.CancelOrder(ctx, pi.OrderID, recordedBy)
		return nil, err
	}
	if err := s.repo.MarkIntentCompleted(ctx, pi.ID, ref); err != nil {
		return nil, err
	}
	return s.repo.GetIntent(ctx, pi.ID)
}

func (s *Service) HandleStripeWebhook(ctx context.Context, payload []byte, signature string, recordedBy uuid.UUID) error {
	providerRef, err := s.parseWebhookProviderRef(payload, signature)
	if err != nil {
		if strings.Contains(err.Error(), "ignored event") {
			return nil
		}
		return err
	}
	_, err = s.CompleteByProviderRef(ctx, providerRef, recordedBy)
	return err
}

func (s *Service) parseWebhookProviderRef(payload []byte, signature string) (string, error) {
	if s.gw.Name() != "mock" {
		if ref, err := s.gw.ParseWebhook(payload, signature); err == nil {
			return ref, nil
		} else if !strings.Contains(err.Error(), "mock gateway") && !strings.Contains(err.Error(), "no webhooks") {
			return "", err
		}
	}
	stripeGW, ok := s.resolveStripe()
	if !ok {
		return "", fmt.Errorf("stripe not configured")
	}
	return stripeGW.ParseWebhook(payload, signature)
}

func (s *Service) resolveStripe() (gateway.Stripe, bool) {
	if sg, ok := s.gw.(gateway.Stripe); ok {
		return sg, true
	}
	secret := os.Getenv("STRIPE_SECRET_KEY")
	if secret == "" {
		return gateway.Stripe{}, false
	}
	return gateway.NewStripe(secret, os.Getenv("STRIPE_WEBHOOK_SECRET")), true
}

func (s *Service) gatewayFor(provider string) gateway.Gateway {
	if provider == "stripe" {
		if sg, ok := s.resolveStripe(); ok {
			return sg
		}
	}
	if provider == "mock" {
		return gateway.Mock{}
	}
	return s.gw
}

func (s *Service) GetIntent(ctx context.Context, id uuid.UUID) (*domain.PaymentIntent, error) {
	return s.repo.GetIntent(ctx, id)
}
