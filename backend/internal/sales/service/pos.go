package service

import (
	"context"
	"math"
	"strings"

	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (s *Service) GetWalkInCustomer(ctx context.Context) (*domain.Customer, error) {
	return s.repo.GetCustomer(ctx, domain.WalkInCustomerID)
}

func (s *Service) GetPOSExchangeRates(ctx context.Context) (*pricingdomain.ExchangeRatesToday, error) {
	return s.pricing.ListTodayExchangeRates(ctx)
}

func (s *Service) POSCheckout(ctx context.Context, in domain.POSCheckoutInput, sellerID uuid.UUID) (*domain.Order, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	if strings.TrimSpace(in.Payment.Method) == "" {
		return nil, domain.ErrInvalidInput
	}

	customerID := domain.WalkInCustomerID
	if in.CustomerID != nil && *in.CustomerID != uuid.Nil {
		customerID = *in.CustomerID
	}
	if _, err := s.repo.GetCustomer(ctx, customerID); err != nil {
		return nil, err
	}

	sellerIDPtr := &sellerID
	order, err := s.CreateOrder(ctx, domain.CreateOrderInput{
		CustomerID:  customerID,
		SellerID:    sellerIDPtr,
		Channel:     "store",
		WarehouseID: in.WarehouseID,
		DiscountPct: in.DiscountPct,
		Items:       in.Items,
	})
	if err != nil {
		return nil, err
	}

	order, err = s.ConfirmOrder(ctx, order.ID, sellerID)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, err
	}

	payment := in.Payment
	if payment.AmountUSD <= 0 {
		payment.AmountUSD = order.TotalUSD
	}
	if math.Abs(payment.AmountUSD-order.TotalUSD) > 0.01 {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, domain.ErrInvalidInput
	}

	order, err = s.RecordPayment(ctx, order.ID, payment, sellerID)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, err
	}

	if in.ShipImmediately && order.Status == "paid" {
		order, err = s.ShipOrder(ctx, order.ID, sellerID)
		if err != nil {
			return order, err
		}
	}

	return order, nil
}
