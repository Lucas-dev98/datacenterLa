package service

import (
	"context"

	"github.com/datacenterla/platform/internal/platform/labels"
	"github.com/datacenterla/platform/internal/stock/domain"
)

func (s *Service) GetUnitLabel(ctx context.Context, unitCode string) (*labels.UnitLabel, error) {
	data, err := s.repo.GetUnitLabelData(ctx, unitCode)
	if err != nil {
		return nil, err
	}
	desc := unitDescription(data)
	label := labels.BuildUnitLabel(data.UnitCode, desc, data.SKUCode)
	return &label, nil
}

func unitDescription(data *domain.UnitLabelData) string {
	if data.GeneratedDescription != nil && *data.GeneratedDescription != "" {
		return *data.GeneratedDescription
	}
	categoryName := ""
	if data.CategoryName != nil {
		categoryName = *data.CategoryName
	}
	return labels.FormatCadastroDescription(categoryName, data.AttributeValues, data.Brand)
}
