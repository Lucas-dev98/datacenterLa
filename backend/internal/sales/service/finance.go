package service

import (
	"context"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
)

func (s *Service) RecordRefund(ctx context.Context, orderID uuid.UUID, amountUSD float64, recordedBy uuid.UUID) error {
	if amountUSD <= 0 {
		return domain.ErrInvalidInput
	}
	ref := "rma-refund"
	method := "refund"
	in := domain.PaymentInput{
		AmountUSD: amountUSD,
		Method:    method,
		Reference: &ref,
	}
	paymentID, err := s.repo.InsertPayment(ctx, orderID, in, &recordedBy)
	if err != nil {
		return err
	}
	if err := s.repo.CompletePayment(ctx, paymentID); err != nil {
		return err
	}
	if rcv, err := s.repo.GetReceivableByOrderID(ctx, orderID); err == nil {
		if _, err := s.repo.ApplyReceivableRefund(ctx, rcv.ID, amountUSD); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) GetFinanceSummary(ctx context.Context) (*domain.FinanceSummary, error) {
	return s.repo.GetFinanceSummary(ctx)
}

func (s *Service) ListOrderMargins(ctx context.Context, limit int) ([]domain.OrderMarginRow, error) {
	return s.repo.ListOrderMargins(ctx, limit)
}
