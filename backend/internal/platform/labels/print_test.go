package labels

import (
	"bytes"
	"strings"
	"testing"
)

func TestGenerateCadastroHTML(t *testing.T) {
	in := RenderInputFromCadastro(CadastroLabel{
		Description: "MEMORIA DDR4 32 GB",
		SKU:         "000042",
		QRContent:   `{"type":"sku","code":"000042"}`,
	}, DefaultPrintOptions(KindCadastro))

	html, err := GenerateHTML(in)
	if err != nil {
		t.Fatal(err)
	}
	text := string(html)
	if !strings.Contains(text, "MEMORIA DDR4 32 GB") || !strings.Contains(text, "SKU: 000042") {
		t.Fatalf("missing label text: %s", text[:min(200, len(text))])
	}
	if !strings.Contains(text, "data:image/png;base64,") {
		t.Fatal("missing embedded qr")
	}
}

func TestGenerateUnitPDF(t *testing.T) {
	in := RenderInputFromUnit(UnitLabel{
		UnitCode:    "AAA0001",
		Description: "MEMORIA DDR4 32 GB",
		SKU:         "000042",
		QRContent:   `{"type":"unit","code":"AAA0001","sku":"000042"}`,
	}, DefaultPrintOptions(KindUnit))

	pdf, err := GeneratePDF(in)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF")) {
		t.Fatalf("expected PDF header, got %x", pdf[:4])
	}
}

func TestParsePrintOptions(t *testing.T) {
	opts := ParsePrintOptions(KindCadastro, "50", "30")
	if opts.WidthMM != 50 || opts.HeightMM != 30 {
		t.Fatalf("unexpected: %+v", opts)
	}
	opts = ParsePrintOptions(KindCadastro, "999", "abc")
	def := DefaultPrintOptions(KindCadastro)
	if opts.WidthMM != def.WidthMM || opts.HeightMM != def.HeightMM {
		t.Fatalf("invalid values should keep defaults: %+v", opts)
	}
}
