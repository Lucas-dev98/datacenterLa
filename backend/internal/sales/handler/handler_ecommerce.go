package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	authdomain "github.com/datacenterla/platform/internal/auth/domain"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/platform/settings"
	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/datacenterla/platform/internal/sales/service"
	shopdomain "github.com/datacenterla/platform/internal/shopauth/domain"
	shopmiddleware "github.com/datacenterla/platform/internal/shopauth/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

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

func (h *Handler) storefront(w http.ResponseWriter, r *http.Request) {
	var wh uuid.UUID
	var err error
	if v := r.URL.Query().Get("warehouse_id"); v != "" {
		wh, err = uuid.Parse(v)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
	} else {
		var defs settings.PlatformDefaults
		if err := h.settings.GetJSON(r.Context(), settings.KeyPlatformDefaults, &defs); err != nil {
			defs = settings.DefaultPlatformDefaults()
		}
		wh, err = uuid.Parse(defs.WarehouseID)
		if err != nil {
			response.Error(w, domain.ErrInvalidInput)
			return
		}
	}
	page, err := h.svc.BuildStorefront(r.Context(), wh, h.settings)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, page)
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
