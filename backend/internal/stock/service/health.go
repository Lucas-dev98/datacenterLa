package service

import (
	"context"

	"github.com/datacenterla/platform/internal/stock/domain"
	"github.com/google/uuid"
)

func (s *Service) GetHealthDashboard(ctx context.Context) (*domain.HealthDashboard, error) {
	return s.repo.GetHealthDashboard(ctx)
}

func (s *Service) ListExpiringReservations(ctx context.Context, withinHours, limit int) ([]domain.ExpiringReservation, error) {
	return s.repo.ListExpiringReservations(ctx, withinHours, limit)
}

func (s *Service) ListHealthIssues(ctx context.Context, status string, limit int) ([]domain.HealthIssue, error) {
	return s.repo.ListHealthIssues(ctx, status, limit)
}

func (s *Service) ResolveHealthIssue(ctx context.Context, id, resolvedBy uuid.UUID, notes string) error {
	return s.repo.ResolveHealthIssue(ctx, id, resolvedBy, notes)
}

func (s *Service) ScanHealthIssues(ctx context.Context) (int, error) {
	return s.repo.ScanHealthIssues(ctx)
}

func (s *Service) GetHealthOverview(ctx context.Context) (map[string]any, error) {
	dash, err := s.GetHealthDashboard(ctx)
	if err != nil {
		return nil, err
	}
	expiring, err := s.ListExpiringReservations(ctx, 48, 10)
	if err != nil {
		return nil, err
	}
	issues, err := s.ListHealthIssues(ctx, "open", 10)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"stats":                 dash,
		"expiring_reservations": expiring,
		"open_issues":           issues,
	}, nil
}
