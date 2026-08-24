package service

import (
	"strings"

	purchdomain "github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/google/uuid"
)

func itemLandedUnitCost(po *purchdomain.PurchaseOrder, skuID uuid.UUID, baseCost float64) float64 {
	for _, item := range po.Items {
		if item.SKUID == skuID {
			if item.UnitLandedCostUSD > 0 {
				return item.UnitLandedCostUSD
			}
			break
		}
	}
	var itemsTotal float64
	var lineTotal float64
	var qty int
	for _, item := range po.Items {
		lt := float64(item.QuantityOrdered) * item.UnitCostUSD
		itemsTotal += lt
		if item.SKUID == skuID {
			lineTotal = lt
			qty = item.QuantityOrdered
		}
	}
	if itemsTotal <= 0 || qty <= 0 {
		return baseCost
	}
	extra := po.FreightUSD + po.DutiesUSD
	return baseCost + extra*(lineTotal/itemsTotal)/float64(qty)
}

func normalizeImportOrigin(origin string) string {
	switch strings.ToLower(strings.TrimSpace(origin)) {
	case "china", "cn":
		return "china"
	case "usa", "us":
		return "usa"
	case "other":
		return "other"
	default:
		return "local"
	}
}

func validateOriginCountry(origin string, code *string) error {
	if origin == "other" && (code == nil || strings.TrimSpace(*code) == "") {
		return purchdomain.ErrInvalidInput
	}
	return nil
}
