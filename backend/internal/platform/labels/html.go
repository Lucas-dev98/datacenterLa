package labels

import (
	"bytes"
	"embed"
	"encoding/base64"
	"html/template"
)

//go:embed templates/*.html
var templateFS embed.FS

type htmlTemplateData struct {
	WidthMM        float64
	HeightMM       float64
	UnitCode       string
	Description    string
	SKU            string
	QRImageBase64  string
}

func GenerateHTML(in RenderInput) ([]byte, error) {
	png, err := GeneratePNG(in.QRContent, 128)
	if err != nil {
		return nil, err
	}
	data := htmlTemplateData{
		WidthMM:       in.PrintOptions.WidthMM,
		HeightMM:      in.PrintOptions.HeightMM,
		UnitCode:      in.UnitCode,
		Description:   in.Description,
		SKU:           in.SKU,
		QRImageBase64: base64.StdEncoding.EncodeToString(png),
	}
	name := "cadastro.html"
	if in.Kind == KindUnit {
		name = "unit.html"
	}
	tmpl, err := template.ParseFS(templateFS, "templates/"+name)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func GeneratePDF(in RenderInput) ([]byte, error) {
	png, err := GeneratePNG(in.QRContent, 128)
	if err != nil {
		return nil, err
	}
	return renderPDF(in, png)
}
