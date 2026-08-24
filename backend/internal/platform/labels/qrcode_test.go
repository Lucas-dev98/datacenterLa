package labels

import (
	"bytes"
	"strings"
	"testing"
)

func TestGeneratePNG(t *testing.T) {
	png, err := GeneratePNG(`{"type":"sku","code":"000042"}`, 128)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(png, []byte{0x89, 0x50, 0x4e, 0x47}) {
		t.Fatalf("expected PNG header, got %x", png[:4])
	}
}

func TestGenerateSVG(t *testing.T) {
	svg, err := GenerateSVG(`{"type":"unit","code":"AAA0001","sku":"000042"}`)
	if err != nil {
		t.Fatal(err)
	}
	text := string(svg)
	if !strings.Contains(text, "<svg") || !strings.Contains(text, `fill="#000000"`) {
		t.Fatalf("unexpected svg: %s", text[:min(120, len(text))])
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
