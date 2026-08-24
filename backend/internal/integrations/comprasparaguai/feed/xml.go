package feed

import (
	"encoding/xml"
	"fmt"
	"html"
	"strings"

	"github.com/datacenterla/platform/internal/integrations/comprasparaguai/domain"
)

type rss struct {
	XMLName xml.Name `xml:"rss"`
	Version string   `xml:"version,attr"`
	Channel channel  `xml:"channel"`
}

type channel struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	Items       []item `xml:"item"`
}

type item struct {
	Title                    string `xml:"title"`
	Description              string `xml:"description"`
	TitleES                  string `xml:"title_es"`
	DescriptionES            string `xml:"description_es"`
	Codigo                   string `xml:"codigo"`
	Preco                    string `xml:"preco"`
	PriceIVA                 string `xml:"price_iva"`
	Estoque                  int    `xml:"estoque"`
	Link                     string `xml:"link"`
	LinkImagem               string `xml:"link_imagem"`
	Disponibilidade          string `xml:"disponibilidade"`
	LinkComprar              string `xml:"link_comprar,omitempty"`
	Marca                    string `xml:"marca,omitempty"`
	TipoVenda                string `xml:"tipo_venda,omitempty"`
}

func Render(cfg domain.FeedConfig, items []domain.FeedItem) ([]byte, error) {
	ch := channel{
		Title:       cfg.StoreName,
		Link:        cfg.StoreURL,
		Description: "Feed de produtos Data Center LA para Compras Paraguai",
		Items:       make([]item, 0, len(items)),
	}
	for _, it := range items {
		avail := "fora de estoque"
		if it.StockAvailable > 0 {
			avail = "em estoque"
		}
		marca := ""
		if it.Brand != nil {
			marca = strings.TrimSpace(*it.Brand)
		}
		ch.Items = append(ch.Items, item{
			Title:           escapeText(it.Title),
			Description:     escapeText(it.Description),
			TitleES:         escapeText(it.TitleES),
			DescriptionES:   escapeText(it.DescriptionES),
			Codigo:          it.SKUCode,
			Preco:           formatUSD(it.PriceB2CUSD),
			PriceIVA:        formatUSD(it.PriceWithIVAUSD),
			Estoque:         it.StockAvailable,
			Link:            it.ProductURL,
			LinkImagem:      it.ImageURL,
			Disponibilidade: avail,
			LinkComprar:     it.BuyURL,
			Marca:           escapeText(marca),
			TipoVenda:       it.TipoVenda,
		})
	}
	doc := rss{Version: "2.0", Channel: ch}
	out, err := xml.MarshalIndent(doc, "", "\t")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), out...), nil
}

func formatUSD(v float64) string {
	return fmt.Sprintf("%.2f USD", v)
}

func escapeText(s string) string {
	return html.UnescapeString(html.EscapeString(strings.TrimSpace(s)))
}
