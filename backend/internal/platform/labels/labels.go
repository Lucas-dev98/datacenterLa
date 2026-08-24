package labels

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type CadastroLabel struct {
	Description        string   `json:"description"`
	SKU                string   `json:"sku"`
	QRContent          string   `json:"qr_content"`
	QRImagePNGBase64   string   `json:"qr_image_png_base64,omitempty"`
	Lines              []string `json:"lines"`
}

type UnitLabel struct {
	UnitCode           string   `json:"unit_code"`
	Description        string   `json:"description"`
	SKU                string   `json:"sku"`
	QRContent          string   `json:"qr_content"`
	QRImagePNGBase64   string   `json:"qr_image_png_base64,omitempty"`
	Lines              []string `json:"lines"`
}

// FormatCadastroDescription gera texto no padrão da etiqueta:
// MEMORIA DDR4 32GB 3200MHZ ECC RDIMM SAMSUNG
func FormatCadastroDescription(categoryName string, attributeValues []string, brand *string) string {
	parts := make([]string, 0, len(attributeValues)+2)
	if cat := strings.TrimSpace(categoryName); cat != "" {
		parts = append(parts, strings.ToUpper(cat))
	}
	for _, v := range attributeValues {
		if v = strings.TrimSpace(v); v != "" {
			parts = append(parts, strings.ToUpper(v))
		}
	}
	if brand != nil {
		if b := strings.TrimSpace(*brand); b != "" {
			parts = append(parts, strings.ToUpper(b))
		}
	}
	return strings.Join(parts, " ")
}

func BuildCadastroLabel(description, sku string) CadastroLabel {
	sku = normalizeSKU(sku)
	qr, _ := json.Marshal(map[string]string{"type": "sku", "code": sku})
	lines := []string{description, "SKU: " + sku}
	return CadastroLabel{
		Description: description,
		SKU:         sku,
		QRContent:   string(qr),
		Lines:       lines,
	}
}

func BuildUnitLabel(unitCode, description, sku string) UnitLabel {
	sku = normalizeSKU(sku)
	unitCode = strings.ToUpper(strings.TrimSpace(unitCode))
	qr, _ := json.Marshal(map[string]string{
		"type": "unit",
		"code": unitCode,
		"sku":  sku,
	})
	lines := []string{unitCode, description, "SKU: " + sku}
	return UnitLabel{
		UnitCode:    unitCode,
		Description: description,
		SKU:         sku,
		QRContent:   string(qr),
		Lines:       lines,
	}
}

func normalizeSKU(code string) string {
	code = strings.TrimSpace(code)
	if n, err := strconv.Atoi(code); err == nil {
		return fmt.Sprintf("%06d", n)
	}
	if len(code) >= 6 {
		return code
	}
	return strings.Repeat("0", 6-len(code)) + code
}
