package service

import (
	"strings"

	"github.com/datacenterla/platform/internal/sales/domain"
)

func posBuyerProfileAppliesIVA(profile string) bool {
	return strings.EqualFold(strings.TrimSpace(profile), "paraguayan")
}

func posBuyerSnapshot(profile string, customer *domain.Customer) *domain.OrderBuyer {
	if customer == nil {
		return nil
	}
	profile = strings.ToLower(strings.TrimSpace(profile))

	switch profile {
	case "walkin":
		name := "Consumidor Final"
		return &domain.OrderBuyer{Name: &name}
	case "paraguayan":
		snap := customerOrderBuyer(customer)
		residency := "paraguayan"
		snap.Residency = &residency
		if snap.Nationality == nil || strings.TrimSpace(*snap.Nationality) == "" {
			py := "PY"
			snap.Nationality = &py
		}
		if customer.DocumentType != nil && strings.EqualFold(*customer.DocumentType, "ci_py") {
			cf := "Consumidor Final"
			snap.Name = &cf
		}
		return snap
	case "foreigner":
		snap := customerOrderBuyer(customer)
		residency := "foreigner"
		snap.Residency = &residency
		return snap
	default:
		return nil
	}
}

func customerOrderBuyer(c *domain.Customer) *domain.OrderBuyer {
	name := strings.TrimSpace(c.Name)
	var namePtr *string
	if name != "" {
		namePtr = &name
	}
	return &domain.OrderBuyer{
		Name:         namePtr,
		Residency:    c.Residency,
		Nationality:  c.Nationality,
		DocumentType: c.DocumentType,
		DocumentID:   c.DocumentID,
	}
}
