package labels

import (
	"bytes"
	"fmt"

	"github.com/go-pdf/fpdf"
)

type BatchKind string

const (
	BatchCadastro BatchKind = "cadastro"
	BatchUnit     BatchKind = "unit"
)

type BatchItem struct {
	Kind        BatchKind
	Cadastro    *CadastroLabel
	Unit        *UnitLabel
	PrintOpts   PrintOptions
}

type BatchRequest struct {
	Format BatchFormat
	Items  []BatchItem
}

type BatchFormat string

const (
	BatchFormatPDF  BatchFormat = "pdf"
	BatchFormatHTML BatchFormat = "html"
)

// GenerateBatchPDF renders multiple labels as a multi-page PDF (one label per page).
func GenerateBatchPDF(items []BatchItem) ([]byte, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("empty batch")
	}
	var buf bytes.Buffer
	var pdf *fpdf.Fpdf
	for i, item := range items {
		in := renderInputFromBatchItem(item)
		pagePDF, err := newLabelPDF(in)
		if err != nil {
			return nil, err
		}
		if i == 0 {
			pdf = pagePDF
			continue
		}
		// Append pages from second PDF by re-rendering on shared doc
		pdf.AddPageFormat("P", fpdf.SizeType{Wd: in.PrintOptions.WidthMM, Ht: in.PrintOptions.HeightMM})
		if err := drawLabelPage(pdf, in); err != nil {
			return nil, err
		}
	}
	if pdf == nil {
		return nil, fmt.Errorf("batch failed")
	}
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// GenerateBatchHTML concatenates standalone HTML documents separated by page breaks.
func GenerateBatchHTML(items []BatchItem) ([]byte, error) {
	if len(items) == 0 {
		return nil, fmt.Errorf("empty batch")
	}
	var out bytes.Buffer
	for i, item := range items {
		in := renderInputFromBatchItem(item)
		html, err := GenerateHTML(in)
		if err != nil {
			return nil, err
		}
		if i > 0 {
			out.WriteString(`<div style="page-break-before:always"></div>`)
		}
		out.Write(html)
	}
	return out.Bytes(), nil
}

func renderInputFromBatchItem(item BatchItem) RenderInput {
	opts := item.PrintOpts
	if opts.WidthMM == 0 {
		if item.Kind == BatchUnit {
			opts = DefaultPrintOptions(KindUnit)
		} else {
			opts = DefaultPrintOptions(KindCadastro)
		}
	}
	switch item.Kind {
	case BatchUnit:
		if item.Unit != nil {
			return RenderInputFromUnit(*item.Unit, opts)
		}
	default:
		if item.Cadastro != nil {
			return RenderInputFromCadastro(*item.Cadastro, opts)
		}
	}
	return RenderInput{PrintOptions: opts}
}

func newLabelPDF(in RenderInput) (*fpdf.Fpdf, error) {
	opts := in.PrintOptions
	pdf := fpdf.NewCustom(&fpdf.InitType{
		UnitStr: "mm",
		Size:    fpdf.SizeType{Wd: opts.WidthMM, Ht: opts.HeightMM},
	})
	pdf.SetMargins(printMarginMM, printMarginMM, printMarginMM)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()
	if err := drawLabelPage(pdf, in); err != nil {
		return nil, err
	}
	return pdf, nil
}

func drawLabelPage(pdf *fpdf.Fpdf, in RenderInput) error {
	png, err := GeneratePNG(in.QRContent, 128)
	if err != nil {
		return err
	}
	return renderPDFContent(pdf, in, png)
}
