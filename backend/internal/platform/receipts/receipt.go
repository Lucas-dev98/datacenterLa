package receipts

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"strings"
	"time"
)

//go:embed templates/*.html
var templateFS embed.FS

type Line struct {
	SKUCode      string
	Description  string
	Quantity     int
	UnitPriceUSD float64
	LineTotalUSD float64
}

type Payment struct {
	Method    string
	AmountUSD float64
	Reference string
}

type TotalsFX struct {
	PYG float64
	BRL float64
	ARS float64
}

type Receipt struct {
	StoreName    string
	StoreCity    string
	OrderNumber  string
	IssuedAt     time.Time
	Channel      string
	Status       string
	CustomerName string
	Residency    string
	Nationality  string
	DocumentType string
	DocumentID   string
	BuyerKindLabel string
	SellerName   string
	Items        []Line
	SubtotalUSD  float64
	SubtotalNetUSD float64
	IVAAmountUSD float64
	ShowIVA      bool
	DiscountPct  float64
	TotalUSD     float64
	FX           TotalsFX
	Payments     []Payment
	HasDocument  bool
}

func (r Receipt) ResidencyLabel() string {
	switch r.Residency {
	case "paraguayan":
		return "Paraguaio"
	case "foreigner":
		return "Estrangeiro"
	default:
		return "Consumidor final"
	}
}

func (r Receipt) DocumentTypeLabel() string {
	switch r.DocumentType {
	case "ci_py":
		return "C.I."
	case "ruc_pf", "ruc_pj", "ruc":
		return "RUC"
	case "cpf":
		return "CPF"
	case "rg":
		return "RG"
	case "passport":
		return "Passaporte"
	case "dni":
		return "DNI"
	case "other":
		return "Documento"
	default:
		return ""
	}
}

func (r Receipt) PaymentLabel(method string) string {
	switch strings.ToLower(method) {
	case "cash":
		return "Dinheiro"
	case "card":
		return "Cartão"
	case "pix":
		return "PIX"
	case "transfer":
		return "Transferência"
	default:
		return method
	}
}

func (r Receipt) IssuedAtLocal() string {
	loc, err := time.LoadLocation("America/Asuncion")
	if err != nil {
		loc = time.FixedZone("PYT", -3*3600)
	}
	return r.IssuedAt.In(loc).Format("02/01/2006 15:04")
}

func RenderHTML(r Receipt) ([]byte, error) {
	if r.StoreName == "" {
		r.StoreName = "Data Center LA"
	}
	if r.StoreCity == "" {
		r.StoreCity = "Ciudad del Este — Paraguay"
	}
	funcMap := template.FuncMap{
		"usd": func(v float64) string { return fmt.Sprintf("%.2f", v) },
		"pyg": func(v float64) string { return formatInt(v) },
		"brl": func(v float64) string { return fmt.Sprintf("%.2f", v) },
		"pay": r.PaymentLabel,
	}
	tmpl, err := template.New("receipt.html").Funcs(funcMap).ParseFS(templateFS, "templates/receipt.html")
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, r); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func formatInt(v float64) string {
	n := int64(v + 0.5)
	s := fmt.Sprintf("%d", n)
	neg := false
	if strings.HasPrefix(s, "-") {
		neg = true
		s = s[1:]
	}
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteRune('.')
		}
		b.WriteRune(c)
	}
	if neg {
		return "-" + b.String()
	}
	return b.String()
}
