package feed

import (
	"strings"
	"testing"

	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
)

func TestRenderFeedXML(t *testing.T) {
	brand := "Samsung"
	xml, err := Render(domain.FeedConfig{
		StoreName: "Data Center LA",
		StoreURL:  "https://datacenterla.com",
	}, []domain.FeedItem{{
		SKUCode:         "000001",
		Title:           "MEMORIA DDR4 32GB",
		Description:     "MEMORIA DDR4 32GB ECC",
		TitleES:         "MEMORIA DDR4 32GB",
		DescriptionES:   "MEMORIA DDR4 32GB ECC",
		Brand:           &brand,
		PriceB2CUSD:     199.99,
		PriceWithIVAUSD: 219.99,
		StockAvailable:  5,
		ProductURL:      "https://datacenterla.com/produto/000001",
		BuyURL:          "https://datacenterla.com/comprar/000001",
		TipoVenda:       "loja+internet",
	}})
	if err != nil {
		t.Fatal(err)
	}
	text := string(xml)
	for _, want := range []string{"<rss", "<codigo>000001</codigo>", "199.99 USD", "219.99 USD", "<estoque>5</estoque>"} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in:\n%s", want, text)
		}
	}
}
