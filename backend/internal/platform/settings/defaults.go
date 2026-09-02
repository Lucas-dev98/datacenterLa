package settings

// StorefrontConfig drives the shop homepage (SKU codes + CMS blocks).
type StorefrontConfig struct {
	FeaturedCodes []string          `json:"featured_codes"`
	PartCodes     StorefrontParts   `json:"part_codes"`
	Content       StorefrontContent `json:"content"`
}

type StorefrontParts struct {
	CPU string `json:"cpu"`
	RAM string `json:"ram"`
	SSD string `json:"ssd"`
}

type StorefrontContent struct {
	Trust   []StorefrontTrustItem   `json:"trust"`
	Pillars []StorefrontTextItem    `json:"pillars"`
	Steps   []StorefrontTextItem    `json:"steps"`
	FAQs    []StorefrontFAQItem     `json:"faqs"`
}

type StorefrontTrustItem struct {
	Icon  string `json:"icon"`
	Title string `json:"title"`
}

type StorefrontTextItem struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type StorefrontFAQItem struct {
	Q string `json:"q"`
	A string `json:"a"`
}

// PlatformDefaults are operational IDs used by admin and shop.
type PlatformDefaults struct {
	WarehouseID string `json:"warehouse_id"`
	LocationID  string `json:"location_id"`
	CategoryID  string `json:"category_id"`
}

const (
	KeyStorefront       = "storefront"
	KeyPlatformDefaults = "platform_defaults"
)

// DefaultStorefrontConfig matches the original shop hardcoded content.
func DefaultStorefrontConfig() StorefrontConfig {
	return StorefrontConfig{
		FeaturedCodes: []string{
			"000078", "000077", "000079", "000082", "000085",
			"000006", "000001", "000076", "000021",
		},
		PartCodes: StorefrontParts{
			CPU: "000076",
			RAM: "000032",
			SSD: "000006",
		},
		Content: StorefrontContent{
			Trust: []StorefrontTrustItem{
				{Icon: "bolt", Title: "Resposta rápida"},
				{Icon: "globe", Title: "Envios para toda a LATAM"},
				{Icon: "box", Title: "+10.000 produtos disponíveis"},
				{Icon: "shield", Title: "Garantia em todos os produtos"},
				{Icon: "headset", Title: "Suporte técnico especializado"},
				{Icon: "refresh", Title: "Equipamentos novos e refurbished"},
			},
			Pillars: []StorefrontTextItem{
				{Title: "Sourcing global", Text: "Obtemos equipamentos difíceis de encontrar, novos ou refurbished, nos maiores mercados tecnológicos."},
				{Title: "Preços competitivos", Text: "Negociamos direto com distribuidores e atacadistas para oferecer o melhor custo."},
				{Title: "Garantia real", Text: "Todos os equipamentos passam por revisão técnica e contam com garantia."},
				{Title: "Entrega internacional", Text: "Enviamos do Paraguai para toda a América Latina com rapidez e segurança."},
				{Title: "Atendimento técnico", Text: "Assessoria para escolher o servidor, storage ou switch ideal para o seu projeto."},
				{Title: "Inventário amplo", Text: "+10.000 SKUs disponíveis sob pedido."},
			},
			Steps: []StorefrontTextItem{
				{Title: "Passo 1 — Você solicita a cotação", Text: "Envie o modelo, marca ou o requisito técnico do servidor, storage ou switch."},
				{Title: "Passo 2 — Localizamos o produto", Text: "Buscamos na nossa rede global de fornecedores para garantir disponibilidade e o melhor preço."},
				{Title: "Passo 3 — Enviamos a proposta", Text: "Você recebe uma proposta clara com especificações, preço, prazos e condições."},
				{Title: "Passo 4 — Envio internacional", Text: "Despachamos do Paraguai com embalagem segura e documentação completa."},
				{Title: "Passo 5 — Garantia e suporte", Text: "Todos os equipamentos incluem garantia e acompanhamento pós-venda."},
			},
			FAQs: []StorefrontFAQItem{
				{Q: "Trabalham com equipamentos novos e recondicionados?", A: "Sim. Oferecemos equipamentos novos, usados e refurbished, sempre verificados e com garantia."},
				{Q: "Fazem envios internacionais?", A: "Sim. Enviamos do Paraguai para toda a América Latina."},
				{Q: "Posso solicitar um produto específico que não aparece no site?", A: "Sim. Fazemos sourcing global para encontrar modelos específicos conforme a sua necessidade."},
				{Q: "Os produtos têm garantia?", A: "Todos os equipamentos têm garantia e revisão técnica antes do despacho."},
				{Q: "Atendem empresas, datacenters e MSPs?", A: "Sim. Trabalhamos com integradores, MSPs, datacenters e empresas de todos os portes."},
			},
		},
	}
}

func DefaultPlatformDefaults() PlatformDefaults {
	return PlatformDefaults{
		WarehouseID: "11111111-1111-1111-1111-111111111001",
		LocationID:  "22222222-2222-2222-2222-222222222001",
		CategoryID:  "55555555-5555-5555-5555-555555555001",
	}
}
