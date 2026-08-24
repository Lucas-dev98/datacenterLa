package service

import (
	"context"
	"fmt"
	"math"

	pixpkg "github.com/datacenterla/platform/internal/payments/pix"
	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (s *Service) POSPixInit(ctx context.Context, in domain.POSPixInitInput, sellerID uuid.UUID) (*domain.POSPixInitResponse, error) {
	if in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
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

	rates, err := s.pricing.ListTodayExchangeRates(ctx)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, err
	}
	brlRate, err := brlRateFromToday(rates)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, err
	}

	amountBRL := math.Round(order.TotalUSD*brlRate*100) / 100
	cfg := pixpkg.ConfigFromEnv()
	charge, err := pixpkg.BuildCharge(cfg, amountBRL, order.OrderNumber)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, sellerID)
		return nil, err
	}

	return &domain.POSPixInitResponse{
		Order:           *order,
		AmountBRL:       charge.AmountBRL,
		BRLRate:         brlRate,
		CopyPaste:       charge.CopyPaste,
		QRCodePNGBase64: charge.QRCodePNGBase64,
		TXID:            charge.TXID,
		DevMode:         charge.DevMode,
	}, nil
}

func (s *Service) POSPixConfirm(ctx context.Context, orderID uuid.UUID, in domain.POSPixConfirmInput, sellerID uuid.UUID) (*domain.Order, error) {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != "confirmed" {
		return nil, domain.ErrInvalidState
	}
	if order.Channel != "store" {
		return nil, domain.ErrInvalidState
	}

	order, err = s.RecordPayment(ctx, orderID, domain.PaymentInput{
		AmountUSD: order.TotalUSD,
		Method:    "pix",
		Reference: in.Reference,
	}, sellerID)
	if err != nil {
		return nil, err
	}

	if in.ShipImmediately && order.Status == "paid" {
		order, err = s.ShipOrder(ctx, orderID, sellerID)
		if err != nil {
			return order, err
		}
	}
	return order, nil
}

func (s *Service) POSPixCancel(ctx context.Context, orderID uuid.UUID, sellerID uuid.UUID) (*domain.Order, error) {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != "confirmed" {
		return nil, domain.ErrInvalidState
	}
	return s.CancelOrder(ctx, orderID, sellerID)
}

func brlRateFromToday(rates *pricingdomain.ExchangeRatesToday) (float64, error) {
	for _, q := range rates.Rates {
		if q.ToCurrency == "BRL" && q.Rate > 0 {
			return q.Rate, nil
		}
	}
	return 0, fmt.Errorf("cotação BRL indisponível")
}
