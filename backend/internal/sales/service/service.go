package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/notify"
	docstorage "github.com/datacenterla/platform/internal/platform/storage"
	pricingservice "github.com/datacenterla/platform/internal/pricing/service"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/datacenterla/platform/internal/sales/repository"
	stockdomain "github.com/datacenterla/platform/internal/stock/domain"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
	"github.com/google/uuid"
)

type Service struct {
	repo    *repository.Postgres
	pricing *pricingservice.Service
	stock   *stockservice.Service
}

func New(repo *repository.Postgres, pricing *pricingservice.Service, stock *stockservice.Service) *Service {
	return &Service{repo: repo, pricing: pricing, stock: stock}
}

type CheckoutInput struct {
	SessionID   string              `json:"session_id"`
	Name        string              `json:"name"`
	Email       *string             `json:"email,omitempty"`
	Phone       *string             `json:"phone,omitempty"`
	DocumentID  *string             `json:"document_id,omitempty"`
	WarehouseID uuid.UUID           `json:"warehouse_id"`
	Payment     domain.PaymentInput `json:"payment"`
	CreatedBy   uuid.UUID           `json:"-"`
}

// --- Customers ---

func (s *Service) CreateCustomer(ctx context.Context, in domain.CreateCustomerInput) (*domain.Customer, error) {
	if strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.Type == "" {
		in.Type = "b2b"
	}
	normalizeIdentity(&in)
	return s.repo.CreateCustomer(ctx, in)
}

func (s *Service) CreatePOSCustomer(ctx context.Context, in domain.CreateCustomerInput) (*domain.Customer, error) {
	if in.Type == "" {
		in.Type = "b2c"
	}
	in.CreditLimitUSD = 0
	in.PaymentTermsDays = 0
	if strings.TrimSpace(in.Name) == "" {
		return nil, domain.ErrInvalidInput
	}
	if in.Residency == nil || strings.TrimSpace(*in.Residency) == "" {
		return nil, domain.ErrInvalidInput
	}
	normalizeIdentity(&in)
	if in.DocumentType != nil && *in.DocumentType == "ruc_pj" {
		in.Type = "b2b"
	}
	return s.repo.CreateCustomer(ctx, in)
}

func normalizeIdentity(in *domain.CreateCustomerInput) {
	if in.Residency != nil {
		v := strings.ToLower(strings.TrimSpace(*in.Residency))
		if v == "paraguayan" || v == "foreigner" {
			in.Residency = &v
		} else {
			in.Residency = nil
		}
	}
	if in.Nationality != nil {
		v := strings.ToUpper(strings.TrimSpace(*in.Nationality))
		if len(v) > 2 {
			v = v[:2]
		}
		if v == "" {
			in.Nationality = nil
		} else {
			in.Nationality = &v
		}
	}
	if in.DocumentType != nil {
		v := strings.ToLower(strings.TrimSpace(*in.DocumentType))
		switch v {
		case "ci_py", "cpf", "rg", "passport", "dni", "other", "ruc_pf", "ruc_pj", "ruc":
			in.DocumentType = &v
		default:
			in.DocumentType = nil
		}
	}
	if in.DocumentID != nil {
		v := strings.TrimSpace(*in.DocumentID)
		if v == "" {
			in.DocumentID = nil
		} else {
			in.DocumentID = &v
		}
	}
}

func (s *Service) SearchCustomers(ctx context.Context, query string) ([]domain.Customer, error) {
	return s.repo.SearchCustomers(ctx, query, 30)
}

func (s *Service) SaveCustomerDocument(ctx context.Context, id uuid.UUID, ext string, body []byte) (*domain.Customer, error) {
	if _, err := s.repo.GetCustomer(ctx, id); err != nil {
		return nil, err
	}
	path, err := docstorage.SaveCustomerDocument(id, ext, body)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetCustomerDocumentScan(ctx, id, path); err != nil {
		return nil, err
	}
	return s.repo.GetCustomer(ctx, id)
}

func (s *Service) GetCustomer(ctx context.Context, id uuid.UUID) (*domain.Customer, error) {
	return s.repo.GetCustomer(ctx, id)
}

func (s *Service) ListCustomers(ctx context.Context, activeOnly bool) ([]domain.Customer, error) {
	return s.repo.ListCustomers(ctx, activeOnly)
}

func (s *Service) ListQuotes(ctx context.Context, limit, offset int, status string) ([]domain.QuoteListItem, int, error) {
	return s.repo.ListQuotes(ctx, limit, offset, status)
}

func (s *Service) ListOrders(ctx context.Context, limit, offset int, status, channel, query string) ([]domain.OrderListItem, int, error) {
	return s.repo.ListOrders(ctx, limit, offset, status, channel, query)
}

func (s *Service) ListReceivables(ctx context.Context, limit, offset int, status string) ([]domain.ReceivableListItem, int, error) {
	return s.repo.ListReceivables(ctx, limit, offset, status)
}

func (s *Service) RecordReceivablePayment(ctx context.Context, receivableID uuid.UUID, in domain.PaymentInput, recordedBy uuid.UUID) (*domain.ReceivableListItem, error) {
	if in.AmountUSD <= 0 || strings.TrimSpace(in.Method) == "" {
		return nil, domain.ErrInvalidInput
	}
	rcv, err := s.repo.GetReceivable(ctx, receivableID)
	if err != nil {
		return nil, err
	}
	if rcv.Status == "paid" || rcv.Status == "cancelled" {
		return nil, domain.ErrInvalidState
	}
	if _, err := s.repo.ApplyReceivablePayment(ctx, receivableID, in.AmountUSD); err != nil {
		return nil, err
	}
	paymentID, err := s.repo.InsertPayment(ctx, rcv.OrderID, in, &recordedBy)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CompletePayment(ctx, paymentID); err != nil {
		return nil, err
	}
	paid, err := s.repo.SumCompletedPayments(ctx, rcv.OrderID)
	if err != nil {
		return nil, err
	}
	o, err := s.repo.GetOrder(ctx, rcv.OrderID)
	if err != nil {
		return nil, err
	}
	if paid >= o.TotalUSD {
		now := time.Now().UTC()
		_ = s.repo.SetOrderPaid(ctx, rcv.OrderID, now)
		_ = s.repo.UpdateOrderStatus(ctx, rcv.OrderID, "paid")
	}
	return s.repo.GetReceivable(ctx, receivableID)
}

func (s *Service) GetDashboard(ctx context.Context) (map[string]any, error) {
	stats, err := s.repo.GetDashboardStats(ctx)
	if err != nil {
		return nil, err
	}
	pending, err := s.repo.ListPendingOrders(ctx, 5)
	if err != nil {
		return nil, err
	}
	lowStock, err := s.repo.ListLowStockSKUs(ctx, 2, 50)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"stats":          stats,
		"pending_orders": pending,
		"low_stock_skus": lowStock,
	}, nil
}

// --- Quotes ---

func (s *Service) CreateQuote(ctx context.Context, in domain.CreateQuoteInput) (*domain.Quote, error) {
	if in.CustomerID == uuid.Nil || in.SellerID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}
	customer, err := s.repo.GetCustomer(ctx, in.CustomerID)
	if err != nil {
		return nil, err
	}
	priceChannel := pricingChannel(customer.Type, in.Channel)

	q, err := s.repo.CreateQuote(ctx, in)
	if err != nil {
		return nil, err
	}

	items, err := s.buildQuoteItems(ctx, in.Items, 0, priceChannel)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddQuoteItems(ctx, q.ID, items); err != nil {
		return nil, err
	}
	return s.repo.GetQuote(ctx, q.ID)
}

func (s *Service) GetQuote(ctx context.Context, id uuid.UUID) (*domain.Quote, error) {
	return s.repo.GetQuote(ctx, id)
}

func (s *Service) SendQuote(ctx context.Context, quoteID uuid.UUID) (*domain.Quote, error) {
	q, err := s.repo.GetQuote(ctx, quoteID)
	if err != nil {
		return nil, err
	}
	if q.Status != "draft" && q.Status != "negotiating" {
		return nil, domain.ErrInvalidState
	}
	validUntil := time.Now().UTC().Add(7 * 24 * time.Hour)
	if err := s.repo.UpdateQuoteStatus(ctx, quoteID, "sent"); err != nil {
		return nil, err
	}
	if err := s.repo.SetQuoteValidUntil(ctx, quoteID, validUntil); err != nil {
		return nil, err
	}
	return s.repo.GetQuote(ctx, quoteID)
}

func (s *Service) ConvertQuoteToOrder(ctx context.Context, quoteID, warehouseID uuid.UUID, sellerID *uuid.UUID) (*domain.Order, error) {
	q, err := s.repo.GetQuote(ctx, quoteID)
	if err != nil {
		return nil, err
	}
	if q.Status != "approved" && q.Status != "sent" {
		return nil, domain.ErrInvalidState
	}
	if len(q.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	orderIn := domain.CreateOrderInput{
		CustomerID:  q.CustomerID,
		SellerID:    sellerID,
		QuoteID:     &quoteID,
		Channel:     q.Channel,
		WarehouseID: warehouseID,
		DiscountPct: q.DiscountPct,
	}
	if orderIn.SellerID == nil {
		sid := q.SellerID
		orderIn.SellerID = &sid
	}
	o, err := s.repo.CreateOrder(ctx, orderIn)
	if err != nil {
		return nil, err
	}

	orderItems := make([]domain.OrderItem, len(q.Items))
	for i, qi := range q.Items {
		orderItems[i] = domain.OrderItem{
			SKUID:        qi.SKUID,
			Quantity:     qi.Quantity,
			UnitPriceUSD: qi.UnitPriceUSD,
			DiscountPct:  qi.DiscountPct,
			LineTotalUSD: qi.LineTotalUSD,
		}
	}
	if err := s.repo.AddOrderItems(ctx, o.ID, orderItems); err != nil {
		return nil, err
	}
	subtotal, total := orderTotals(orderItems, q.DiscountPct)
	if err := s.repo.SetOrderTotals(ctx, o.ID, subtotal, total); err != nil {
		return nil, err
	}
	if err := s.repo.MarkQuoteConverted(ctx, quoteID, o.ID); err != nil {
		return nil, err
	}
	return s.repo.GetOrder(ctx, o.ID)
}

// --- Orders ---

func (s *Service) CreateOrder(ctx context.Context, in domain.CreateOrderInput) (*domain.Order, error) {
	if in.CustomerID == uuid.Nil || in.WarehouseID == uuid.Nil || len(in.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	var orderItems []domain.OrderItem
	if in.QuoteID != nil {
		q, err := s.repo.GetQuote(ctx, *in.QuoteID)
		if err != nil {
			return nil, err
		}
		orderItems = make([]domain.OrderItem, len(q.Items))
		for i, qi := range q.Items {
			orderItems[i] = domain.OrderItem{
				SKUID:        qi.SKUID,
				Quantity:     qi.Quantity,
				UnitPriceUSD: qi.UnitPriceUSD,
				DiscountPct:  qi.DiscountPct,
				LineTotalUSD: qi.LineTotalUSD,
			}
		}
		in.DiscountPct = q.DiscountPct
	} else {
		customer, err := s.repo.GetCustomer(ctx, in.CustomerID)
		if err != nil {
			return nil, err
		}
		priceChannel := pricingChannel(customer.Type, in.Channel)
		applyIVA := customerAppliesIVA(customer)
		if profile := strings.TrimSpace(in.BuyerProfile); profile != "" {
			applyIVA = posBuyerProfileAppliesIVA(profile)
		}
		items, err := s.buildOrderItems(ctx, in.Items, 0, priceChannel, applyIVA)
		if err != nil {
			return nil, err
		}
		orderItems = items
	}

	o, err := s.repo.CreateOrder(ctx, in)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddOrderItems(ctx, o.ID, orderItems); err != nil {
		return nil, err
	}
	subtotal, total := orderTotals(orderItems, in.DiscountPct)
	if err := s.repo.SetOrderTotals(ctx, o.ID, subtotal, total); err != nil {
		return nil, err
	}
	if profile := strings.TrimSpace(in.BuyerProfile); profile != "" {
		if cust, err := s.repo.GetCustomer(ctx, in.CustomerID); err == nil {
			_ = s.repo.SetOrderBuyerSnapshot(ctx, o.ID, posBuyerSnapshot(profile, cust))
		}
	} else if cust, err := s.repo.GetCustomer(ctx, in.CustomerID); err == nil {
		_ = s.repo.SetOrderBuyer(ctx, o.ID, cust)
	}
	return s.repo.GetOrder(ctx, o.ID)
}

func (s *Service) GetOrder(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	return s.repo.GetOrder(ctx, id)
}

func (s *Service) ConfirmOrder(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID) (*domain.Order, error) {
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "draft" {
		return nil, domain.ErrInvalidState
	}
	if len(o.Items) == 0 {
		return nil, domain.ErrInvalidInput
	}

	customer, err := s.repo.GetCustomer(ctx, o.CustomerID)
	if err != nil {
		return nil, err
	}

	reserveItems := make([]stockdomain.ReserveItemInput, len(o.Items))
	for i, item := range o.Items {
		reserveItems[i] = stockdomain.ReserveItemInput{
			OrderItemID: item.ID,
			SKUID:       item.SKUID,
			WarehouseID: o.WarehouseID,
			Quantity:    item.Quantity,
		}
	}
	_, err = s.stock.CreateReservation(ctx, stockservice.ReserveInput{
		OrderID:   o.ID,
		Items:     reserveItems,
		ExpiresAt: reservationExpiry(o.Channel, customer.Type),
		CreatedBy: createdBy,
	})
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.repo.SetOrderConfirmed(ctx, orderID, now); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateOrderStatus(ctx, orderID, "confirmed"); err != nil {
		return nil, err
	}
	return s.repo.GetOrder(ctx, orderID)
}

func (s *Service) RecordPayment(ctx context.Context, orderID uuid.UUID, in domain.PaymentInput, recordedBy uuid.UUID) (*domain.Order, error) {
	if in.AmountUSD <= 0 || strings.TrimSpace(in.Method) == "" {
		return nil, domain.ErrInvalidInput
	}
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}

	paymentID, err := s.repo.InsertPayment(ctx, orderID, in, &recordedBy)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CompletePayment(ctx, paymentID); err != nil {
		return nil, err
	}

	paid, err := s.repo.SumCompletedPayments(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if paid >= o.TotalUSD {
		now := time.Now().UTC()
		if err := s.repo.SetOrderPaid(ctx, orderID, now); err != nil {
			return nil, err
		}
		if err := s.repo.UpdateOrderStatus(ctx, orderID, "paid"); err != nil {
			return nil, err
		}
		_ = s.repo.InsertOutboxEvent(ctx, "sales.order.paid", map[string]any{"order_id": orderID})
	}
	if rcv, err := s.repo.GetReceivableByOrderID(ctx, orderID); err == nil {
		_, _ = s.repo.ApplyReceivablePayment(ctx, rcv.ID, in.AmountUSD)
	}
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status == "paid" && strings.ToLower(order.Channel) == "ecommerce" {
		s.notifyOrderEvent(ctx, order, "order_paid")
	}
	return order, nil
}

func (s *Service) ConfirmCreditOrder(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID) (*domain.Order, error) {
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "draft" {
		return nil, domain.ErrInvalidState
	}

	customer, err := s.repo.GetCustomer(ctx, o.CustomerID)
	if err != nil {
		return nil, err
	}
	if customer.Type != "b2b" && customer.Type != "reseller" {
		return nil, domain.ErrInvalidInput
	}
	if o.TotalUSD > customer.CreditLimitUSD {
		return nil, domain.ErrInsufficientCredit
	}

	dueDate := time.Now().UTC().AddDate(0, 0, customer.PaymentTermsDays).Format("2006-01-02")
	if _, err := s.repo.CreateReceivable(ctx, orderID, o.CustomerID, o.TotalUSD, dueDate); err != nil {
		return nil, err
	}

	confirmed, err := s.ConfirmOrder(ctx, orderID, createdBy)
	if err != nil {
		return nil, err
	}
	return confirmed, nil
}

func (s *Service) ShipOrder(ctx context.Context, orderID uuid.UUID, createdBy uuid.UUID) (*domain.Order, error) {
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status != "confirmed" && o.Status != "paid" {
		return nil, domain.ErrInvalidState
	}

	if err := s.stock.StartPick(ctx, orderID, createdBy); err != nil {
		return nil, err
	}
	if err := s.stock.Ship(ctx, orderID, createdBy); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if err := s.repo.SetOrderShipped(ctx, orderID, now); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateOrderStatus(ctx, orderID, "shipped"); err != nil {
		return nil, err
	}
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if strings.ToLower(order.Channel) == "ecommerce" {
		s.notifyOrderEvent(ctx, order, "order_shipped")
	}
	return order, nil
}

func (s *Service) CancelOrder(ctx context.Context, orderID uuid.UUID, cancelledBy uuid.UUID) (*domain.Order, error) {
	o, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o.Status == "cancelled" {
		return o, nil
	}
	switch o.Status {
	case "draft":
		// no stock impact
	case "confirmed", "paid":
		if err := s.stock.ReleaseReservationByOrder(ctx, orderID, cancelledBy, "order cancelled"); err != nil {
			return nil, err
		}
		if rcv, err := s.repo.GetReceivableByOrderID(ctx, orderID); err == nil {
			_ = s.repo.CancelReceivable(ctx, rcv.ID)
		}
	default:
		return nil, domain.ErrInvalidState
	}
	now := time.Now().UTC()
	if err := s.repo.SetOrderCancelled(ctx, orderID, now); err != nil {
		return nil, err
	}
	return s.repo.GetOrder(ctx, orderID)
}

// --- E-commerce ---

func (s *Service) ListCatalog(ctx context.Context, warehouseID uuid.UUID, categoryID *uuid.UUID, search string) ([]domain.CatalogProduct, error) {
	products, err := s.repo.ListEcommerceCatalog(ctx, warehouseID, categoryID, search)
	if err != nil {
		return nil, err
	}
	for i := range products {
		p := &products[i]
		price, err := s.pricing.Resolve(ctx, p.SKUID, "b2c")
		if err != nil {
			continue
		}
		p.PriceUSD = price.BasePriceUSD
		p.PriceWithIVA = price.PriceWithIVA
		p.PricePYG = price.PricePYG
		p.PriceWithIVAPYG = price.PriceWithIVAPYG
		p.ExchangeRateUSDToPYG = price.ExchangeRateUSDToPYG

		avail, err := s.stock.GetAvailability(ctx, p.SKUID, warehouseID)
		if err == nil {
			p.Available = avail.QtyAvailable
		}
	}
	return products, nil
}

func (s *Service) ListEcommerceCategories(ctx context.Context) ([]domain.EcommerceCategory, error) {
	return s.repo.ListEcommerceCategories(ctx)
}

func (s *Service) ListOrdersPublic(ctx context.Context, email string) ([]domain.PublicOrderSummary, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, domain.ErrInvalidInput
	}
	orders, err := s.repo.ListPublicOrdersByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		orders[i].StatusLabel = notify.PublicStatusLabel(orders[i].Status)
	}
	return orders, nil
}

func (s *Service) LookupOrderPublic(ctx context.Context, email, orderNumber string) (*domain.PublicOrderSummary, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	orderNumber = normalizePublicOrderNumber(orderNumber)
	if email == "" || orderNumber == "" {
		return nil, domain.ErrInvalidInput
	}
	o, err := s.repo.LookupOrderPublic(ctx, email, orderNumber)
	if err != nil {
		return nil, err
	}
	o.StatusLabel = notify.PublicStatusLabel(o.Status)
	return o, nil
}

func normalizePublicOrderNumber(raw string) string {
	s := strings.TrimSpace(strings.ToUpper(raw))
	if s == "" {
		return s
	}
	if strings.HasPrefix(s, "PED-") {
		return s
	}
	var digits strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	if d == "" {
		return s
	}
	n, err := strconv.Atoi(d)
	if err != nil {
		return s
	}
	return fmt.Sprintf("PED-%06d", n)
}

func (s *Service) notifyOrderEvent(ctx context.Context, order *domain.Order, eventType string) {
	customer, err := s.repo.GetCustomer(ctx, order.CustomerID)
	if err != nil || customer.Email == nil {
		return
	}
	notify.SendOrderEvent(ctx, notify.OrderEvent{
		Type:         eventType,
		OrderNumber:  order.OrderNumber,
		Email:        *customer.Email,
		CustomerName: customer.Name,
		Status:       notify.PublicStatusLabel(order.Status),
		TotalUSD:     order.TotalUSD,
	})
}

func (s *Service) GetCart(ctx context.Context, sessionID string) (*domain.Cart, error) {
	cart, err := s.repo.GetCartWithItems(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if cart.Items == nil {
		cart.Items = []domain.CartItem{}
	}
	for i := range cart.Items {
		item := &cart.Items[i]
		price, err := s.pricing.Resolve(ctx, item.SKUID, "b2c")
		if err != nil {
			continue
		}
		item.PriceUSD = price.BasePriceUSD
	}
	return cart, nil
}

func (s *Service) AddToCart(ctx context.Context, sessionID string, skuID, warehouseID uuid.UUID, qty int) (*domain.Cart, error) {
	if skuID == uuid.Nil || qty <= 0 {
		return nil, domain.ErrInvalidInput
	}
	if warehouseID != uuid.Nil {
		if err := s.ensureSKUAvailable(ctx, skuID, warehouseID, qty); err != nil {
			return nil, err
		}
	}
	cart, err := s.repo.GetOrCreateCart(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddCartItem(ctx, cart.ID, skuID, qty); err != nil {
		return nil, err
	}
	return s.GetCart(ctx, sessionID)
}

func (s *Service) UpdateCartItem(ctx context.Context, sessionID string, skuID, warehouseID uuid.UUID, qty int) (*domain.Cart, error) {
	if skuID == uuid.Nil || qty < 0 {
		return nil, domain.ErrInvalidInput
	}
	if qty > 0 && warehouseID != uuid.Nil {
		if err := s.ensureSKUAvailable(ctx, skuID, warehouseID, qty); err != nil {
			return nil, err
		}
	}
	cart, err := s.repo.GetOrCreateCart(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetCartItemQuantity(ctx, cart.ID, skuID, qty); err != nil {
		return nil, err
	}
	return s.GetCart(ctx, sessionID)
}

func (s *Service) Checkout(ctx context.Context, in CheckoutInput) (*domain.Order, error) {
	order, err := s.CheckoutWithoutPayment(ctx, in)
	if err != nil {
		return nil, err
	}
	if in.Payment.AmountUSD <= 0 {
		return order, nil
	}
	return s.RecordPayment(ctx, order.ID, in.Payment, in.CreatedBy)
}

func (s *Service) CheckoutWithoutPayment(ctx context.Context, in CheckoutInput) (*domain.Order, error) {
	if strings.TrimSpace(in.SessionID) == "" || strings.TrimSpace(in.Name) == "" || in.WarehouseID == uuid.Nil {
		return nil, domain.ErrInvalidInput
	}

	cart, err := s.repo.GetCartWithItems(ctx, in.SessionID)
	if err != nil {
		return nil, err
	}
	if len(cart.Items) == 0 {
		return nil, domain.ErrEmptyCart
	}

	customer, err := s.resolveCheckoutCustomer(ctx, in)
	if err != nil {
		return nil, err
	}
	if err := s.cancelUnpaidEcommerceOrders(ctx, customer.ID, in.CreatedBy); err != nil {
		return nil, err
	}
	if err := s.validateCheckoutStock(ctx, cart.Items, in.WarehouseID); err != nil {
		return nil, err
	}

	lineInputs := make([]domain.LineInput, len(cart.Items))
	for i, item := range cart.Items {
		lineInputs[i] = domain.LineInput{SKUID: item.SKUID, Quantity: item.Quantity}
	}

	sellerID := in.CreatedBy
	order, err := s.CreateOrder(ctx, domain.CreateOrderInput{
		CustomerID:  customer.ID,
		SellerID:    &sellerID,
		Channel:     "ecommerce",
		WarehouseID: in.WarehouseID,
		Items:       lineInputs,
	})
	if err != nil {
		return nil, err
	}

	order, err = s.ConfirmOrder(ctx, order.ID, in.CreatedBy)
	if err != nil {
		_, _ = s.CancelOrder(ctx, order.ID, in.CreatedBy)
		return nil, err
	}
	return order, nil
}

func (s *Service) cancelUnpaidEcommerceOrders(ctx context.Context, customerID, cancelledBy uuid.UUID) error {
	ids, err := s.repo.ListUnpaidEcommerceOrderIDs(ctx, customerID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := s.CancelOrder(ctx, id, cancelledBy); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ClearCartForSession(ctx context.Context, sessionID string) error {
	cart, err := s.repo.GetCartWithItems(ctx, sessionID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil
		}
		return err
	}
	return s.repo.ClearCart(ctx, cart.ID)
}

func (s *Service) resolveCheckoutCustomer(ctx context.Context, in CheckoutInput) (*domain.Customer, error) {
	if in.Email != nil {
		if existing, err := s.repo.GetCustomerByEmail(ctx, *in.Email); err == nil {
			return existing, nil
		} else if !errors.Is(err, domain.ErrNotFound) {
			return nil, err
		}
	}
	return s.repo.CreateCustomer(ctx, domain.CreateCustomerInput{
		Type:       "b2c",
		Name:       in.Name,
		Email:      in.Email,
		Phone:      in.Phone,
		DocumentID: in.DocumentID,
	})
}

func (s *Service) validateCheckoutStock(ctx context.Context, items []domain.CartItem, warehouseID uuid.UUID) error {
	for _, item := range items {
		if err := s.ensureSKUAvailable(ctx, item.SKUID, warehouseID, item.Quantity); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ensureSKUAvailable(ctx context.Context, skuID, warehouseID uuid.UUID, qty int) error {
	avail, err := s.stock.GetAvailability(ctx, skuID, warehouseID)
	if err != nil {
		return err
	}
	if avail.QtyAvailable < qty {
		return fmt.Errorf("%w: disponível %d, solicitado %d", stockdomain.ErrInsufficientStock, avail.QtyAvailable, qty)
	}
	return nil
}

// --- helpers ---

func (s *Service) buildQuoteItems(ctx context.Context, lines []domain.LineInput, lineDiscountPct float64, priceChannel string) ([]domain.QuoteItem, error) {
	items := make([]domain.QuoteItem, len(lines))
	for i, line := range lines {
		if line.SKUID == uuid.Nil || line.Quantity <= 0 {
			return nil, domain.ErrInvalidInput
		}
		price, err := s.pricing.Resolve(ctx, line.SKUID, priceChannel)
		if err != nil {
			return nil, err
		}
		lineTotal := lineTotal(price.BasePriceUSD, line.Quantity, lineDiscountPct)
		items[i] = domain.QuoteItem{
			SKUID:        line.SKUID,
			Quantity:     line.Quantity,
			UnitPriceUSD: price.BasePriceUSD,
			DiscountPct:  lineDiscountPct,
			LineTotalUSD: lineTotal,
		}
	}
	return items, nil
}

func (s *Service) buildOrderItems(ctx context.Context, lines []domain.LineInput, lineDiscountPct float64, priceChannel string, applyIVA bool) ([]domain.OrderItem, error) {
	items := make([]domain.OrderItem, len(lines))
	for i, line := range lines {
		if line.SKUID == uuid.Nil || line.Quantity <= 0 {
			return nil, domain.ErrInvalidInput
		}
		price, err := s.pricing.Resolve(ctx, line.SKUID, priceChannel)
		if err != nil {
			return nil, err
		}
		unitPrice := price.BasePriceUSD
		if applyIVA {
			unitPrice = price.PriceWithIVA
		}
		lineTotal := lineTotal(unitPrice, line.Quantity, lineDiscountPct)
		items[i] = domain.OrderItem{
			SKUID:        line.SKUID,
			Quantity:     line.Quantity,
			UnitPriceUSD: unitPrice,
			DiscountPct:  lineDiscountPct,
			LineTotalUSD: lineTotal,
		}
	}
	return items, nil
}

func customerAppliesIVA(c *domain.Customer) bool {
	return c.Residency != nil && strings.EqualFold(*c.Residency, "paraguayan")
}

func lineTotal(unitPrice float64, qty int, discountPct float64) float64 {
	return math.Round(unitPrice*float64(qty)*(1-discountPct/100)*100) / 100
}

func orderTotals(items []domain.OrderItem, headerDiscountPct float64) (subtotal, total float64) {
	for _, item := range items {
		subtotal += item.LineTotalUSD
	}
	subtotal = math.Round(subtotal*100) / 100
	if headerDiscountPct <= 0 {
		return subtotal, subtotal
	}
	total = math.Round(subtotal*(1-headerDiscountPct/100)*100) / 100
	return subtotal, total
}

func pricingChannel(customerType, salesChannel string) string {
	switch strings.ToLower(customerType) {
	case "b2c":
		return "b2c"
	case "reseller":
		return "reseller"
	default:
		if strings.ToLower(salesChannel) == "ecommerce" || strings.ToLower(salesChannel) == "store" {
			return "b2c"
		}
		return "b2b"
	}
}

func reservationExpiry(channel, customerType string) time.Time {
	if strings.ToLower(channel) == "ecommerce" || strings.ToLower(channel) == "store" || strings.ToLower(customerType) == "b2c" {
		return time.Now().UTC().Add(48 * time.Hour)
	}
	return time.Now().UTC().Add(120 * time.Hour)
}
