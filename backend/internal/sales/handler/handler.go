package handler

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	paydomain "github.com/datacenterla/platform/internal/payments/domain"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/datacenterla/platform/internal/sales/service"
	shopdomain "github.com/datacenterla/platform/internal/shopauth/domain"
	shopmiddleware "github.com/datacenterla/platform/internal/shopauth/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	svc      *service.Service
	pay      PaymentIntentCreator
	shopAuth func(http.Handler) http.Handler
}

type PaymentIntentCreator interface {
	CreateIntent(ctx context.Context, orderID uuid.UUID, provider string) (*paydomain.PaymentIntent, error)
}

func New(svc *service.Service, pay PaymentIntentCreator, shopAuth func(http.Handler) http.Handler) *Handler {
	return &Handler{svc: svc, pay: pay, shopAuth: shopAuth}
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

func (h *Handler) listCustomers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	var items []domain.Customer
	var err error
	if q != "" {
		items, err = h.svc.SearchCustomers(r.Context(), q)
	} else {
		items, err = h.svc.ListCustomers(r.Context(), r.URL.Query().Get("active_only") == "true")
	}
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createCustomer(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCustomerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreateCustomer(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) getCustomer(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetCustomer(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) searchPOSCustomers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	items, err := h.svc.SearchCustomers(r.Context(), q)
	if err != nil {
		response.Error(w, err)
		return
	}
	if items == nil {
		items = []domain.Customer{}
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createPOSCustomer(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCustomerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreatePOSCustomer(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) uploadCustomerDocument(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	defer file.Close()
	body, err := io.ReadAll(io.LimitReader(file, 8<<20))
	if err != nil || len(body) == 0 {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
	if ext == "" {
		ct := hdr.Header.Get("Content-Type")
		switch ct {
		case "image/png":
			ext = "png"
		case "image/webp":
			ext = "webp"
		default:
			ext = "jpg"
		}
	}
	c, err := h.svc.SaveCustomerDocument(r.Context(), id, ext, body)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) orderReceipt(w http.ResponseWriter, r *http.Request) {
	h.writeReceipt(w, r, chi.URLParam(r, "id"))
}

func (h *Handler) posOrderReceipt(w http.ResponseWriter, r *http.Request) {
	h.writeReceipt(w, r, chi.URLParam(r, "order_id"))
}

func (h *Handler) writeReceipt(w http.ResponseWriter, r *http.Request, rawID string) {
	id, err := uuid.Parse(rawID)
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	html, err := h.svc.ReceiptHTML(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(html)
}

func (h *Handler) listQuotes(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListQuotes(r.Context(), limit, offset, status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) createQuote(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateQuoteInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	in.SellerID = uuid.MustParse(uc.UserID)
	q, err := h.svc.CreateQuote(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, q)
}

func (h *Handler) getQuote(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	q, err := h.svc.GetQuote(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, q)
}

func (h *Handler) sendQuote(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	q, err := h.svc.SendQuote(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, q)
}

func (h *Handler) convertQuote(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		WarehouseID uuid.UUID `json:"warehouse_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.WarehouseID == uuid.Nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.ConvertQuoteToOrder(r.Context(), id, body.WarehouseID, nil)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	status := r.URL.Query().Get("status")
	channel := r.URL.Query().Get("channel")
	search := r.URL.Query().Get("q")
	items, total, err := h.svc.ListOrders(r.Context(), limit, offset, status, channel, search)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if ok {
		sid := uuid.MustParse(uc.UserID)
		in.SellerID = &sid
	}
	o, err := h.svc.CreateOrder(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) confirmOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	o, err := h.svc.ConfirmOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) confirmCredit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	o, err := h.svc.ConfirmCreditOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) recordPayment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.PaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	o, err := h.svc.RecordPayment(r.Context(), id, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) shipOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(16 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}

	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}

	photos := make(map[uuid.UUID]domain.ShipPhotoUpload)
	for _, item := range o.Items {
		key := "photo_" + item.ID.String()
		file, hdr, err := r.FormFile(key)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		body, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(body) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
		if ext == "" {
			switch hdr.Header.Get("Content-Type") {
			case "image/png":
				ext = "png"
			case "image/webp":
				ext = "webp"
			default:
				ext = "jpg"
			}
		}
		photos[item.ID] = domain.ShipPhotoUpload{Body: body, Ext: ext}
	}

	shipped, err := h.svc.ShipOrderWithPhotos(r.Context(), id, photos, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, shipped)
}

func (h *Handler) orderShipPhotoFile(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetOrderShipPhotoFile(r.Context(), orderID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) cancelOrder(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}
	o, err := h.svc.GetOrder(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	hasCancel := uc.Permissions["sales.orders.cancel"]
	hasWrite := uc.Permissions["sales.orders.write"]
	hasConfirm := uc.Permissions["sales.orders.confirm"]
	switch o.Status {
	case "draft":
		if !hasCancel && !hasWrite {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	case "confirmed":
		if !hasCancel {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	case "paid":
		if !hasCancel || !hasConfirm {
			response.Error(w, authdomain.ErrForbidden)
			return
		}
	default:
		response.Error(w, domain.ErrInvalidState)
		return
	}
	cancelled, err := h.svc.CancelOrder(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, cancelled)
}

func (h *Handler) catalog(w http.ResponseWriter, r *http.Request) {
	wh, err := uuid.Parse(r.URL.Query().Get("warehouse_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var categoryID *uuid.UUID
	if v := r.URL.Query().Get("category_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		categoryID = &id
	}
	search := r.URL.Query().Get("q")
	var skuCodes []string
	if v := strings.TrimSpace(r.URL.Query().Get("sku_codes")); v != "" {
		for _, part := range strings.Split(v, ",") {
			if code := strings.TrimSpace(part); code != "" {
				skuCodes = append(skuCodes, code)
			}
		}
	}
	items, err := h.svc.ListCatalog(r.Context(), wh, categoryID, search, skuCodes)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListEcommerceCategories(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listMyOrders(w http.ResponseWriter, r *http.Request) {
	sc, ok := shopmiddleware.ShopFromContext(r.Context())
	if !ok {
		response.Error(w, shopdomain.ErrUnauthorized)
		return
	}
	items, err := h.svc.ListOrdersPublic(r.Context(), sc.Email)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getMyOrder(w http.ResponseWriter, r *http.Request) {
	sc, ok := shopmiddleware.ShopFromContext(r.Context())
	if !ok {
		response.Error(w, shopdomain.ErrUnauthorized)
		return
	}
	orderNumber := strings.TrimSpace(chi.URLParam(r, "order_number"))
	if orderNumber == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.LookupOrderPublic(r.Context(), sc.Email, orderNumber)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) getCart(w http.ResponseWriter, r *http.Request) {
	sid := r.URL.Query().Get("session_id")
	if sid == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetCart(r.Context(), sid)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) addToCart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SessionID   string    `json:"session_id"`
		SKUID       uuid.UUID `json:"sku_id"`
		WarehouseID uuid.UUID `json:"warehouse_id"`
		Quantity    int       `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.AddToCart(r.Context(), body.SessionID, body.SKUID, body.WarehouseID, body.Quantity)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) updateCartItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SessionID   string    `json:"session_id"`
		SKUID       uuid.UUID `json:"sku_id"`
		WarehouseID uuid.UUID `json:"warehouse_id"`
		Quantity    int       `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.UpdateCartItem(r.Context(), body.SessionID, body.SKUID, body.WarehouseID, body.Quantity)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) checkout(w http.ResponseWriter, r *http.Request) {
	var in service.CheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	in.CreatedBy = authdomain.SystemUserID
	o, err := h.svc.CheckoutWithoutPayment(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	if h.pay == nil {
		response.JSON(w, http.StatusCreated, o)
		return
	}
	pi, err := h.pay.CreateIntent(r.Context(), o.ID, "")
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"order": o, "payment_intent": pi})
}

func (h *Handler) listReceivables(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListReceivables(r.Context(), limit, offset, status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDashboard(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func (h *Handler) recordReceivablePayment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.PaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	item, err := h.svc.RecordReceivablePayment(r.Context(), id, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *Handler) listRMAs(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListRMAs(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("q"), 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getRMAWarrantyDays(w http.ResponseWriter, r *http.Request) {
	days, err := h.svc.GetRMAWarrantyDays(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"warranty_days": days})
}

func (h *Handler) checkRMAWarranty(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	days, expires, within, err := h.svc.CheckOrderWarranty(r.Context(), orderID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"warranty_days":       days,
		"warranty_expires_at": expires,
		"within_warranty":     within,
	})
}

func (h *Handler) checkRMAEligibility(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	orderItemID, err := uuid.Parse(r.URL.Query().Get("order_item_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	count, err := h.svc.CountSoldUnitsForOrderItem(r.Context(), orderID, orderItemID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"eligible_units": count,
		"eligible":       count > 0,
	})
}

func (h *Handler) createRMA(w http.ResponseWriter, r *http.Request) {
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}

	payloadRaw := strings.TrimSpace(r.FormValue("payload"))
	if payloadRaw == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		OrderID         uuid.UUID                   `json:"order_id"`
		Reason          string                      `json:"reason"`
		TestNotes       string                      `json:"test_notes"`
		DefectConfirmed bool                        `json:"defect_confirmed"`
		Notes           *string                     `json:"notes"`
		Items           []domain.CreateRMAItemInput `json:"items"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}

	var photos []domain.RMATestPhotoUpload
	for i := 0; i < 5; i++ {
		key := "test_photo_" + strconv.Itoa(i)
		file, hdr, err := r.FormFile(key)
		if err != nil {
			continue
		}
		fileBody, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(fileBody) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
		if ext == "" {
			switch hdr.Header.Get("Content-Type") {
			case "image/png":
				ext = "png"
			case "image/webp":
				ext = "webp"
			default:
				ext = "jpg"
			}
		}
		photos = append(photos, domain.RMATestPhotoUpload{Body: fileBody, Ext: ext})
	}

	c, err := h.svc.CreateRMA(r.Context(), domain.CreateRMAInput{
		OrderID:         body.OrderID,
		Reason:          body.Reason,
		TestNotes:       body.TestNotes,
		DefectConfirmed: body.DefectConfirmed,
		Notes:           body.Notes,
		RequestedBy:     uuid.MustParse(uc.UserID),
		Items:           body.Items,
		TestPhotos:      photos,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) rmaTestPhotoFile(w http.ResponseWriter, r *http.Request) {
	caseID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetRMATestPhotoFile(r.Context(), caseID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) getRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetRMA(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) approveRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	c, err := h.svc.ApproveRMA(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) receiveRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	c, err := h.svc.ReceiveRMA(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) resolveRMA(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Resolution string `json:"resolution"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	uc, _ := authmiddleware.UserFromContext(r.Context())
	c, err := h.svc.ResolveRMA(r.Context(), id, body.Resolution, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) listCustomerReturns(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListCustomerReturns(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("q"), 50)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getReturnWindowDays(w http.ResponseWriter, r *http.Request) {
	days, err := h.svc.GetReturnWindowDays(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"return_window_days": days})
}

func (h *Handler) checkReturnWindow(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	days, expires, within, err := h.svc.CheckOrderReturnWindow(r.Context(), orderID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"return_window_days":   days,
		"return_expires_at":    expires,
		"within_return_window": within,
	})
}

func (h *Handler) checkReturnEligibility(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(r.URL.Query().Get("order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	orderItemID, err := uuid.Parse(r.URL.Query().Get("order_item_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	count, err := h.svc.CountSoldUnitsForOrderItem(r.Context(), orderID, orderItemID)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"eligible_units": count,
		"eligible":       count > 0,
	})
}

func (h *Handler) createCustomerReturn(w http.ResponseWriter, r *http.Request) {
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, authdomain.ErrUnauthorized)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	payloadRaw := strings.TrimSpace(r.FormValue("payload"))
	if payloadRaw == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		OrderID        uuid.UUID                      `json:"order_id"`
		Reason         string                         `json:"reason"`
		ConditionNotes *string                        `json:"condition_notes"`
		Notes          *string                        `json:"notes"`
		Items          []domain.CreateReturnItemInput `json:"items"`
	}
	if err := json.Unmarshal([]byte(payloadRaw), &body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var photos []domain.ReturnPhotoUpload
	for i := 0; i < 5; i++ {
		key := "photo_" + strconv.Itoa(i)
		file, hdr, err := r.FormFile(key)
		if err != nil {
			continue
		}
		fileBody, err := io.ReadAll(io.LimitReader(file, 8<<20))
		file.Close()
		if err != nil || len(fileBody) == 0 {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		ext := strings.TrimPrefix(filepath.Ext(hdr.Filename), ".")
		if ext == "" {
			ext = "jpg"
		}
		photos = append(photos, domain.ReturnPhotoUpload{Body: fileBody, Ext: ext})
	}
	ret, err := h.svc.CreateCustomerReturn(r.Context(), domain.CreateCustomerReturnInput{
		OrderID:        body.OrderID,
		Reason:         body.Reason,
		ConditionNotes: body.ConditionNotes,
		Notes:          body.Notes,
		RequestedBy:    uuid.MustParse(uc.UserID),
		Items:          body.Items,
		Photos:         photos,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, ret)
}

func (h *Handler) getCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	ret, err := h.svc.GetCustomerReturn(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) customerReturnPhotoFile(w http.ResponseWriter, r *http.Request) {
	returnID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	photoID, err := uuid.Parse(chi.URLParam(r, "photo_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	body, contentType, err := h.svc.GetCustomerReturnPhotoFile(r.Context(), returnID, photoID)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(body)
}

func (h *Handler) approveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ApproveCustomerReturn(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) receiveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ReceiveCustomerReturn(r.Context(), id, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) resolveCustomerReturn(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Resolution string `json:"resolution"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	uc, _ := authmiddleware.UserFromContext(r.Context())
	ret, err := h.svc.ResolveCustomerReturn(r.Context(), id, body.Resolution, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, ret)
}

func (h *Handler) catalogProduct(w http.ResponseWriter, r *http.Request) {
	skuID, err := uuid.Parse(chi.URLParam(r, "sku_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	wh, err := uuid.Parse(r.URL.Query().Get("warehouse_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.GetCatalogProduct(r.Context(), skuID, wh)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) listLeads(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListLeads(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listWebsiteQuoteRequests(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListWebsiteLeads(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}

func (h *Handler) updateWebsiteQuoteStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.UpdateLeadStatus(r.Context(), id, body.Status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, l)
}

func strPtr(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func (h *Handler) publicQuote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Phone   string `json:"phone"`
		Company string `json:"company"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	name := strings.TrimSpace(body.Name)
	email := strings.TrimSpace(body.Email)
	phone := strings.TrimSpace(body.Phone)
	if name == "" || (email == "" && phone == "") {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	notes := strings.TrimSpace(body.Message)
	if notes != "" {
		notes = "Cotação pelo site:\n" + notes
	} else {
		notes = "Cotação pelo site"
	}
	_, err := h.svc.CreateLead(r.Context(), domain.CreateLeadInput{
		Name:    name,
		Email:   strPtr(email),
		Phone:   strPtr(phone),
		Company: strPtr(body.Company),
		Source:  "website",
		Notes:   &notes,
	})
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"ok": true})
}

func (h *Handler) createLead(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateLeadInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.CreateLead(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, l)
}

func (h *Handler) updateLeadStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	l, err := h.svc.UpdateLeadStatus(r.Context(), id, body.Status)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, l)
}

func (h *Handler) listPayables(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListPayables(r.Context(), 100)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) financeSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.svc.GetFinanceSummary(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, summary)
}

func (h *Handler) analyticsDashboard(w http.ResponseWriter, r *http.Request) {
	filter := domain.AnalyticsFilter{
		Channel: strings.TrimSpace(r.URL.Query().Get("channel")),
		Metric:  strings.TrimSpace(r.URL.Query().Get("metric")),
		Limit:   200,
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			filter.Limit = n
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("from")); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		filter.From = t
	}
	if v := strings.TrimSpace(r.URL.Query().Get("to")); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
		filter.To = t
	}
	data, err := h.svc.GetAnalyticsDashboard(r.Context(), filter)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func (h *Handler) listOrderMargins(w http.ResponseWriter, r *http.Request) {
	limit := 30
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	items, err := h.svc.ListOrderMargins(r.Context(), limit)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) exportOrderMargins(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListOrderMargins(r.Context(), 500)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="margens-pedidos.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"pedido", "cliente", "canal", "receita_usd", "custo_usd", "margem_usd", "margem_pct", "status"})
	for _, m := range items {
		_ = cw.Write([]string{
			m.OrderNumber,
			m.CustomerName,
			m.Channel,
			strconv.FormatFloat(m.RevenueUSD, 'f', 2, 64),
			strconv.FormatFloat(m.COGSUSD, 'f', 2, 64),
			strconv.FormatFloat(m.MarginUSD, 'f', 2, 64),
			strconv.FormatFloat(m.MarginPct, 'f', 1, 64),
			m.Status,
		})
	}
	cw.Flush()
}

func (h *Handler) payPayable(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var body struct {
		AmountUSD float64 `json:"amount_usd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.AmountUSD <= 0 {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.PayPayable(r.Context(), id, body.AmountUSD)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) getWalkInCustomer(w http.ResponseWriter, r *http.Request) {
	c, err := h.svc.GetWalkInCustomer(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) getPOSExchangeRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.svc.GetPOSExchangeRates(r.Context())
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, rates)
}

func (h *Handler) posCheckout(w http.ResponseWriter, r *http.Request) {
	var in domain.POSCheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSCheckout(r.Context(), in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, o)
}

func (h *Handler) posPixInit(w http.ResponseWriter, r *http.Request) {
	var in domain.POSPixInitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	out, err := h.svc.POSPixInit(r.Context(), in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, out)
}

func (h *Handler) posPixConfirm(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.POSPixConfirmInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSPixConfirm(r.Context(), orderID, in, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}

func (h *Handler) posPixCancel(w http.ResponseWriter, r *http.Request) {
	orderID, err := uuid.Parse(chi.URLParam(r, "order_id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	uc, ok := authmiddleware.UserFromContext(r.Context())
	if !ok {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	o, err := h.svc.POSPixCancel(r.Context(), orderID, uuid.MustParse(uc.UserID))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, o)
}
