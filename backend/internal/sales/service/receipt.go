package service

import (
	"context"
	"math"
	"strings"

	pricingdomain "github.com/datacenterla/platform/internal/pricing/domain"
	"github.com/datacenterla/platform/internal/platform/receipts"
	"github.com/google/uuid"
)

func (s *Service) ReceiptHTML(ctx context.Context, orderID uuid.UUID) ([]byte, error) {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	customer, err := s.repo.GetCustomer(ctx, order.CustomerID)
	if err != nil {
		return nil, err
	}
	payments, err := s.repo.ListPaymentsByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	rec := receipts.Receipt{
		StoreName:    "Data Center LA",
		StoreCity:    "Ciudad del Este — Paraguay",
		OrderNumber:  order.OrderNumber,
		IssuedAt:     order.CreatedAt,
		Channel:      order.Channel,
		Status:       order.Status,
		CustomerName: customer.Name,
		SubtotalUSD:  order.SubtotalUSD,
		DiscountPct:  order.DiscountPct,
		TotalUSD:     order.TotalUSD,
	}
	if order.PaidAt != nil {
		rec.IssuedAt = *order.PaidAt
	} else if order.ConfirmedAt != nil {
		rec.IssuedAt = *order.ConfirmedAt
	}

	if order.BuyerName != nil && *order.BuyerName != "" {
		rec.CustomerName = *order.BuyerName
	}
	rec.Residency = deref(order.BuyerResidency, customer.Residency)
	rec.Nationality = deref(order.BuyerNationality, customer.Nationality)
	rec.DocumentType = deref(order.BuyerDocumentType, customer.DocumentType)
	rec.DocumentID = deref(order.BuyerDocumentID, customer.DocumentID)

	anonymousWalkIn := order.BuyerName != nil &&
		strings.EqualFold(strings.TrimSpace(*order.BuyerName), "Consumidor final") &&
		(order.BuyerResidency == nil || strings.TrimSpace(*order.BuyerResidency) == "")

	if anonymousWalkIn {
		rec.Residency = ""
		rec.Nationality = ""
		rec.DocumentType = ""
		rec.DocumentID = ""
		rec.HasDocument = false
	} else {
		rec.HasDocument = rec.DocumentID != ""
		if rec.Residency == "paraguayan" {
			rec.BuyerKindLabel = paraguayBuyerKindLabel(rec.DocumentType)
		}
	}
	if rec.Residency == "paraguayan" && order.SubtotalUSD > 0 {
		rec.ShowIVA = true
		rec.SubtotalNetUSD = math.Round(order.SubtotalUSD/(1+pricingdomain.TaxRateParaguay)*100) / 100
		rec.IVAAmountUSD = math.Round((order.SubtotalUSD-rec.SubtotalNetUSD)*100) / 100
	}

	if order.SellerID != nil {
		if name, err := s.repo.GetSellerName(ctx, *order.SellerID); err == nil {
			rec.SellerName = name
		}
	}

	for _, item := range order.Items {
		desc := item.SKUName
		if desc == "" {
			desc = item.SKUCode
		}
		rec.Items = append(rec.Items, receipts.Line{
			SKUCode:      item.SKUCode,
			Description:  desc,
			Quantity:     item.Quantity,
			UnitPriceUSD: item.UnitPriceUSD,
			LineTotalUSD: item.LineTotalUSD,
		})
	}
	for _, p := range payments {
		ref := ""
		if p.Reference != nil {
			ref = *p.Reference
		}
		rec.Payments = append(rec.Payments, receipts.Payment{
			Method:    p.Method,
			AmountUSD: p.AmountUSD,
			Reference: ref,
		})
	}

	if rates, err := s.pricing.ListTodayExchangeRates(ctx); err == nil {
		for _, q := range rates.Rates {
			converted := order.TotalUSD * q.Rate
			switch q.ToCurrency {
			case "PYG":
				rec.FX.PYG = converted
			case "BRL":
				rec.FX.BRL = converted
			case "ARS":
				rec.FX.ARS = converted
			}
		}
	}

	return receipts.RenderHTML(rec)
}

func paraguayBuyerKindLabel(documentType string) string {
	switch strings.ToLower(strings.TrimSpace(documentType)) {
	case "ci_py":
		return "Pessoa física — consumidor final (C.I.)"
	case "ruc_pf":
		return "Pessoa física contribuinte (RUC)"
	case "ruc_pj":
		return "Empresa (RUC — razão social)"
	default:
		return ""
	}
}

func deref(primary *string, fallback *string) string {
	if primary != nil && *primary != "" {
		return *primary
	}
	if fallback != nil {
		return *fallback
	}
	return ""
}
