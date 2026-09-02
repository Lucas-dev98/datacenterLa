package handler

import (
	"context"
	"net/http"

	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	paydomain "github.com/datacenterla/platform/internal/payments/domain"
	"github.com/datacenterla/platform/internal/platform/settings"
	"github.com/datacenterla/platform/internal/sales/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	svc      *service.Service
	pay      PaymentIntentCreator
	shopAuth func(http.Handler) http.Handler
	settings *settings.Repository
}

type PaymentIntentCreator interface {
	CreateIntent(ctx context.Context, orderID uuid.UUID, provider string) (*paydomain.PaymentIntent, error)
}

func New(svc *service.Service, pay PaymentIntentCreator, shopAuth func(http.Handler) http.Handler, settings *settings.Repository) *Handler {
	return &Handler{svc: svc, pay: pay, shopAuth: shopAuth, settings: settings}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	perm := authmiddleware.RequirePermission

	r.Route("/customers", func(r chi.Router) {
		r.With(perm("crm.customers.write")).Get("/", h.listCustomers)
		r.With(perm("crm.customers.write")).Post("/", h.createCustomer)
		r.With(perm("crm.customers.write")).Get("/{id}", h.getCustomer)
		r.With(perm("crm.customers.write")).Post("/{id}/document-scan", h.uploadCustomerDocument)
	})

	r.Route("/quotes", func(r chi.Router) {
		r.With(perm("sales.quotes.write")).Get("/", h.listQuotes)
		r.With(perm("sales.quotes.write")).Post("/", h.createQuote)
		r.With(perm("sales.quotes.write")).Get("/website-requests", h.listWebsiteQuoteRequests)
		r.With(perm("sales.quotes.write")).Patch("/website-requests/{id}/status", h.updateWebsiteQuoteStatus)
		r.With(perm("sales.quotes.write")).Get("/{id}", h.getQuote)
		r.With(perm("sales.quotes.write")).Post("/{id}/send", h.sendQuote)
		r.With(perm("sales.orders.write")).Post("/{id}/convert", h.convertQuote)
	})

	r.Route("/orders", func(r chi.Router) {
		r.With(perm("sales.orders.write")).Get("/", h.listOrders)
		r.With(perm("sales.orders.write")).Post("/", h.createOrder)
		r.With(perm("sales.orders.write")).Get("/{id}", h.getOrder)
		r.With(perm("sales.orders.write")).Get("/{id}/receipt", h.orderReceipt)
		r.With(perm("sales.orders.confirm")).Post("/{id}/confirm", h.confirmOrder)
		r.With(perm("sales.orders.confirm")).Post("/{id}/confirm-credit", h.confirmCredit)
		r.With(perm("finance.payments.write")).Post("/{id}/payments", h.recordPayment)
		r.With(perm("sales.orders.confirm")).Post("/{id}/ship", h.shipOrder)
		r.With(perm("sales.orders.write")).Get("/{id}/ship-photos/{photo_id}/file", h.orderShipPhotoFile)
		r.Post("/{id}/cancel", h.cancelOrder)
	})

	r.With(perm("finance.receivables.read")).Get("/receivables", h.listReceivables)
	r.With(authmiddleware.RequireAnyPermission("finance.receivables.read", "sales.orders.write", "inventory.read")).Get("/dashboard", h.dashboard)
	r.With(perm("finance.receivables.read")).Get("/finance/summary", h.financeSummary)
	r.With(perm("finance.receivables.read")).Get("/finance/margins", h.listOrderMargins)
	r.With(perm("finance.receivables.read")).Get("/finance/margins/export", h.exportOrderMargins)
	r.With(perm("finance.receivables.read")).Get("/analytics/dashboard", h.analyticsDashboard)
	r.With(perm("finance.payments.write")).Post("/receivables/{id}/payments", h.recordReceivablePayment)
	r.With(perm("finance.payables.read")).Get("/payables", h.listPayables)
	r.With(perm("finance.payables.write")).Post("/payables/{id}/payments", h.payPayable)
	r.With(perm("crm.leads.write")).Get("/leads", h.listLeads)
	r.With(perm("crm.leads.write")).Post("/leads", h.createLead)
	r.With(perm("crm.leads.write")).Patch("/leads/{id}/status", h.updateLeadStatus)

	r.Route("/rma", func(r chi.Router) {
		r.With(perm("sales.rma.write")).Get("/", h.listRMAs)
		r.With(perm("sales.rma.write")).Get("/warranty-days", h.getRMAWarrantyDays)
		r.With(perm("sales.rma.write")).Get("/warranty-check", h.checkRMAWarranty)
		r.With(perm("sales.rma.write")).Get("/eligibility", h.checkRMAEligibility)
		r.With(perm("sales.rma.write")).Post("/", h.createRMA)
		r.With(perm("sales.rma.write")).Get("/{id}", h.getRMA)
		r.With(perm("sales.rma.write")).Get("/{id}/test-photos/{photo_id}/file", h.rmaTestPhotoFile)
		r.With(perm("sales.rma.write")).Post("/{id}/approve", h.approveRMA)
		r.With(perm("sales.rma.write")).Post("/{id}/receive", h.receiveRMA)
		r.With(perm("sales.rma.write")).Post("/{id}/resolve", h.resolveRMA)
	})

	r.Route("/returns", func(r chi.Router) {
		r.With(perm("sales.returns.write")).Get("/", h.listCustomerReturns)
		r.With(perm("sales.returns.write")).Get("/window-days", h.getReturnWindowDays)
		r.With(perm("sales.returns.write")).Get("/window-check", h.checkReturnWindow)
		r.With(perm("sales.returns.write")).Get("/eligibility", h.checkReturnEligibility)
		r.With(perm("sales.returns.write")).Post("/", h.createCustomerReturn)
		r.With(perm("sales.returns.write")).Get("/{id}", h.getCustomerReturn)
		r.With(perm("sales.returns.write")).Get("/{id}/photos/{photo_id}/file", h.customerReturnPhotoFile)
		r.With(perm("sales.returns.write")).Post("/{id}/approve", h.approveCustomerReturn)
		r.With(perm("sales.returns.write")).Post("/{id}/receive", h.receiveCustomerReturn)
		r.With(perm("sales.returns.write")).Post("/{id}/resolve", h.resolveCustomerReturn)
	})

	r.Route("/pos", func(r chi.Router) {
		r.With(perm("sales.pos.write")).Get("/walk-in-customer", h.getWalkInCustomer)
		r.With(perm("sales.pos.write")).Get("/exchange-rates", h.getPOSExchangeRates)
		r.With(perm("sales.pos.write")).Get("/customers", h.searchPOSCustomers)
		r.With(perm("sales.pos.write")).Post("/customers", h.createPOSCustomer)
		r.With(perm("sales.pos.write")).Post("/customers/{id}/document-scan", h.uploadCustomerDocument)
		r.With(perm("sales.pos.write")).Get("/orders/{order_id}/receipt", h.posOrderReceipt)
		r.With(perm("sales.pos.write")).Post("/checkout", h.posCheckout)
		r.With(perm("sales.pos.write")).Post("/pix/init", h.posPixInit)
		r.With(perm("sales.pos.write")).Post("/pix/{order_id}/confirm", h.posPixConfirm)
		r.With(perm("sales.pos.write")).Post("/pix/{order_id}/cancel", h.posPixCancel)
	})

	return r
}

func (h *Handler) EcommerceRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/storefront", h.storefront)
	r.Get("/catalog", h.catalog)
	r.Get("/catalog/{sku_id}", h.catalogProduct)
	r.Get("/categories", h.listCategories)
	r.Get("/cart", h.getCart)
	r.Post("/cart/items", h.addToCart)
	r.Put("/cart/items", h.updateCartItem)
	r.Post("/checkout", h.checkout)
	r.Post("/quote", h.publicQuote)

	if h.shopAuth != nil {
		r.Group(func(r chi.Router) {
			r.Use(h.shopAuth)
			r.Get("/orders/me", h.listMyOrders)
			r.Get("/orders/me/{order_number}", h.getMyOrder)
		})
	}
	return r
}
