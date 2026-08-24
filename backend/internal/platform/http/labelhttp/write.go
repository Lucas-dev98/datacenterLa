package labelhttp

import (
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"

	"github.com/datacenterla/platform/internal/platform/http/response"
	"github.com/datacenterla/platform/internal/platform/labels"
)

func WriteCadastroLabel(w http.ResponseWriter, r *http.Request, label labels.CadastroLabel) {
	opts := labels.ParsePrintOptions(labels.KindCadastro, r.URL.Query().Get("width_mm"), r.URL.Query().Get("height_mm"))
	input := labels.RenderInputFromCadastro(label, opts)
	writeFormatted(w, r, input, label.QRContent, label)
}

func WriteUnitLabel(w http.ResponseWriter, r *http.Request, label labels.UnitLabel) {
	opts := labels.ParsePrintOptions(labels.KindUnit, r.URL.Query().Get("width_mm"), r.URL.Query().Get("height_mm"))
	input := labels.RenderInputFromUnit(label, opts)
	writeFormatted(w, r, input, label.QRContent, label)
}

func writeFormatted(w http.ResponseWriter, r *http.Request, input labels.RenderInput, qrContent string, jsonPayload any) {
	switch strings.ToLower(r.URL.Query().Get("format")) {
	case "png":
		writePNG(w, r, qrContent)
	case "svg":
		writeSVG(w, qrContent)
	case "html":
		writeHTML(w, input)
	case "pdf":
		writePDF(w, input)
	default:
		response.JSON(w, http.StatusOK, jsonPayload)
	}
}

// PNGBase64 generates a base64 PNG for embedding in JSON (?include_qr=true).
func PNGBase64(qrContent string, size int) (string, error) {
	png, err := labels.GeneratePNG(qrContent, size)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(png), nil
}

func writePNG(w http.ResponseWriter, r *http.Request, qrContent string) {
	size := parseSize(r.URL.Query().Get("size"), labels.DefaultPNGSize)
	png, err := labels.GeneratePNG(qrContent, size)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(png)
}

func writeSVG(w http.ResponseWriter, qrContent string) {
	svg, err := labels.GenerateSVG(qrContent)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(svg)
}

func writeHTML(w http.ResponseWriter, input labels.RenderInput) {
	html, err := labels.GenerateHTML(input)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(html)
}

func writePDF(w http.ResponseWriter, input labels.RenderInput) {
	pdf, err := labels.GeneratePDF(input)
	if err != nil {
		response.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}

func parseSize(raw string, def int) int {
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 64 || n > 1024 {
		return def
	}
	return n
}
