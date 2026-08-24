package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	pimdomain "github.com/datacenterla/platform/internal/pim/domain"
	pimservice "github.com/datacenterla/platform/internal/pim/service"
	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/platform/labels"
	stockservice "github.com/datacenterla/platform/internal/stock/service"
)

type BatchHandler struct {
	pim   *pimservice.Service
	stock *stockservice.Service
}

func NewBatch(pim *pimservice.Service, stock *stockservice.Service) *BatchHandler {
	return &BatchHandler{pim: pim, stock: stock}
}

type batchRequest struct {
	Format string `json:"format"`
	Items  []struct {
		Type string `json:"type"`
		Code string `json:"code"`
	} `json:"items"`
	WidthMM  *float64 `json:"width_mm"`
	HeightMM *float64 `json:"height_mm"`
}

func (h *BatchHandler) Batch(w http.ResponseWriter, r *http.Request) {
	var req batchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Items) == 0 {
		response.Error(w, pimdomain.ErrInvalidInput)
		return
	}
	format := labels.BatchFormatPDF
	if strings.ToLower(req.Format) == "html" {
		format = labels.BatchFormatHTML
	}
	batchItems := make([]labels.BatchItem, 0, len(req.Items))
	for _, it := range req.Items {
		switch strings.ToLower(it.Type) {
		case "cadastro", "sku":
			lbl, err := h.pim.GetCadastroLabel(r.Context(), it.Code)
			if err != nil {
				response.Error(w, err)
				return
			}
			opts := labels.DefaultPrintOptions(labels.KindCadastro)
			if req.WidthMM != nil {
				opts.WidthMM = *req.WidthMM
			}
			if req.HeightMM != nil {
				opts.HeightMM = *req.HeightMM
			}
			batchItems = append(batchItems, labels.BatchItem{Kind: labels.BatchCadastro, Cadastro: lbl, PrintOpts: opts})
		case "unit":
			lbl, err := h.stock.GetUnitLabel(r.Context(), it.Code)
			if err != nil {
				response.Error(w, err)
				return
			}
			opts := labels.DefaultPrintOptions(labels.KindUnit)
			if req.WidthMM != nil {
				opts.WidthMM = *req.WidthMM
			}
			if req.HeightMM != nil {
				opts.HeightMM = *req.HeightMM
			}
			batchItems = append(batchItems, labels.BatchItem{Kind: labels.BatchUnit, Unit: lbl, PrintOpts: opts})
		default:
			response.Error(w, pimdomain.ErrInvalidInput)
			return
		}
	}
	switch format {
	case labels.BatchFormatHTML:
		html, err := labels.GenerateBatchHTML(batchItems)
		if err != nil {
			response.Error(w, err)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(html)
	default:
		pdf, err := labels.GenerateBatchPDF(batchItems)
		if err != nil {
			response.Error(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/pdf")
		_, _ = w.Write(pdf)
	}
}
