package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/datacenterla/platform/internal/pim/domain"
	"github.com/datacenterla/platform/internal/pim/service"
	authmiddleware "github.com/datacenterla/platform/internal/auth/middleware"
	"github.com/datacenterla/platform/internal/platform/http/labelhttp"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	read := authmiddleware.RequirePermission
	w := read("pim.products.write")
	rd := read("pim.products.read")

	r.Route("/categories", func(r chi.Router) {
		r.With(rd).Get("/", h.listCategories)
		r.With(w).Post("/", h.createCategory)
		r.With(rd).Get("/{id}", h.getCategory)
		r.With(w).Put("/{id}", h.updateCategory)
		r.With(w).Delete("/{id}", h.deactivateCategory)
		r.With(rd).Get("/{id}/attributes", h.listCategoryAttributes)
		r.With(w).Post("/{id}/attributes", h.createCategoryAttribute)
	})

	r.Route("/products", func(r chi.Router) {
		r.With(rd).Get("/", h.listProducts)
		r.With(w).Post("/", h.createProduct)
		r.With(rd).Get("/{id}", h.getProduct)
		r.With(w).Put("/{id}", h.updateProduct)
		r.With(w).Delete("/{id}", h.deactivateProduct)
	})

	r.With(w).Post("/cadastros", h.createCadastro)

	r.Route("/skus", func(r chi.Router) {
		r.With(rd).Get("/", h.listSKUs)
		r.With(w).Post("/", h.createSKU)
		r.With(rd).Get("/code/{code}/label", h.getSKULabel)
		r.With(rd).Get("/code/{code}", h.getSKUByCode)
		r.With(rd).Get("/{id}", h.getSKU)
		r.With(w).Put("/{id}", h.updateSKU)
		r.With(w).Post("/{id}/image", h.uploadSKUImage)
		r.With(w).Delete("/{id}", h.deactivateSKU)
	})

	return r
}

func (h *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") == "true"
	items, err := h.svc.ListCategories(r.Context(), activeOnly)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCategoryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.CreateCategory(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (h *Handler) getCategory(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.GetCategory(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpdateCategoryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	c, err := h.svc.UpdateCategory(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) deactivateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.DeactivateCategory(r.Context(), id); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listCategoryAttributes(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	items, err := h.svc.ListCategoryAttributes(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createCategoryAttribute(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.CreateCategoryAttributeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	a, err := h.svc.CreateCategoryAttribute(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, a)
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	f := listFilter(r)
	result, err := h.svc.ListProducts(r.Context(), f)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, result)
}

func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateProductInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.CreateProduct(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, p)
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.GetProduct(r.Context(), id, true)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpdateProductInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	p, err := h.svc.UpdateProduct(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) deactivateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.DeactivateProduct(r.Context(), id); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listSKUs(w http.ResponseWriter, r *http.Request) {
	f := listFilter(r)
	result, err := h.svc.ListSKUs(r.Context(), f)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, result)
}

func (h *Handler) createSKU(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateSKUInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.CreateSKU(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, s)
}

func (h *Handler) getSKU(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.GetSKU(r.Context(), id)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) createCadastro(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateCadastroInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	result, err := h.svc.CreateCadastro(r.Context(), in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, result)
}

func (h *Handler) getSKULabel(w http.ResponseWriter, r *http.Request) {
	label, err := h.svc.GetCadastroLabel(r.Context(), chi.URLParam(r, "code"))
	if err != nil {
		response.Error(w, err)
		return
	}
	if r.URL.Query().Get("include_qr") == "true" {
		b64, err := labelhttp.PNGBase64(label.QRContent, 0)
		if err != nil {
			response.Error(w, err)
			return
		}
		label.QRImagePNGBase64 = b64
	}
	labelhttp.WriteCadastroLabel(w, r, *label)
}

func (h *Handler) getSKUByCode(w http.ResponseWriter, r *http.Request) {
	s, err := h.svc.GetSKUByCode(r.Context(), chi.URLParam(r, "code"))
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) updateSKU(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	var in domain.UpdateSKUInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	s, err := h.svc.UpdateSKU(r.Context(), id, in)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) uploadSKUImage(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	file, hdr, err := r.FormFile("image")
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
		switch hdr.Header.Get("Content-Type") {
		case "image/png":
			ext = "png"
		case "image/webp":
			ext = "webp"
		default:
			ext = "jpg"
		}
	}
	s, err := h.svc.UploadSKUImage(r.Context(), id, ext, body)
	if err != nil {
		response.Error(w, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

func (h *Handler) deactivateSKU(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, domain.ErrInvalidInput)
		return
	}
	if err := h.svc.DeactivateSKU(r.Context(), id); err != nil {
		response.Error(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func listFilter(r *http.Request) domain.ListFilter {
	q := r.URL.Query()
	f := domain.ListFilter{
		Query:      q.Get("q"),
		ActiveOnly: q.Get("active_only") == "true",
		Limit:      parseIntDefault(q.Get("limit"), 50),
		Offset:     parseIntDefault(q.Get("offset"), 0),
	}
	if v := q.Get("category_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			f.CategoryID = &id
		}
	}
	if v := q.Get("product_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			f.ProductID = &id
		}
	}
	return f
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
