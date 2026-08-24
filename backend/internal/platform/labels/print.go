package labels

import (
	"strconv"
	"strings"
)

type LabelKind int

const (
	KindCadastro LabelKind = iota
	KindUnit
)

type PrintOptions struct {
	WidthMM  float64
	HeightMM float64
}

func DefaultPrintOptions(kind LabelKind) PrintOptions {
	switch kind {
	case KindUnit:
		return PrintOptions{WidthMM: 58, HeightMM: 45}
	default:
		return PrintOptions{WidthMM: 58, HeightMM: 35}
	}
}

// ParsePrintOptions reads ?width_mm= and ?height_mm= with thermal-printer defaults.
func ParsePrintOptions(kind LabelKind, widthRaw, heightRaw string) PrintOptions {
	opts := DefaultPrintOptions(kind)
	if v, ok := parseMillimeters(widthRaw); ok {
		opts.WidthMM = v
	}
	if v, ok := parseMillimeters(heightRaw); ok {
		opts.HeightMM = v
	}
	return opts
}

func parseMillimeters(raw string) (float64, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v < 20 || v > 120 {
		return 0, false
	}
	return v, true
}

type RenderInput struct {
	Kind         LabelKind
	PrintOptions PrintOptions
	UnitCode     string
	Description  string
	SKU          string
	QRContent    string
}

func RenderInputFromCadastro(label CadastroLabel, opts PrintOptions) RenderInput {
	return RenderInput{
		Kind:         KindCadastro,
		PrintOptions: opts,
		Description:  label.Description,
		SKU:          label.SKU,
		QRContent:    label.QRContent,
	}
}

func RenderInputFromUnit(label UnitLabel, opts PrintOptions) RenderInput {
	return RenderInput{
		Kind:         KindUnit,
		PrintOptions: opts,
		UnitCode:     label.UnitCode,
		Description:  label.Description,
		SKU:          label.SKU,
		QRContent:    label.QRContent,
	}
}

const (
	printMarginMM   = 2.0
	printQRSizeMM   = 18.0
	printFontDesc   = 7.0
	printFontSKU    = 8.0
	printFontUnit   = 11.0
)
