package labels

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

func renderPDF(in RenderInput, qrPNG []byte) ([]byte, error) {
	opts := in.PrintOptions
	pdf := fpdf.NewCustom(&fpdf.InitType{
		UnitStr: "mm",
		Size:    fpdf.SizeType{Wd: opts.WidthMM, Ht: opts.HeightMM},
	})
	pdf.SetMargins(printMarginMM, printMarginMM, printMarginMM)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()
	if err := renderPDFContent(pdf, in, qrPNG); err != nil {
		return nil, err
	}

	var out bytes.Buffer
	if err := pdf.Output(&out); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func renderPDFContent(pdf *fpdf.Fpdf, in RenderInput, qrPNG []byte) error {
	opts := in.PrintOptions
	contentW := opts.WidthMM - printMarginMM*2
	textH := opts.HeightMM - printMarginMM*2 - printQRSizeMM - 1

	pdf.SetFont("Helvetica", "", printFontDesc)
	y := printMarginMM

	if in.Kind == KindUnit {
		pdf.SetFont("Helvetica", "B", printFontUnit)
		pdf.SetXY(printMarginMM, y)
		pdf.CellFormat(contentW, 5, in.UnitCode, "", 1, "C", false, 0, "")
		y = pdf.GetY()
		textH -= 5
	}

	pdf.SetFont("Helvetica", "B", printFontDesc)
	pdf.SetXY(printMarginMM, y)
	descH := pdfMultiCellHeight(pdf, contentW, 3.2, strings.ToUpper(in.Description))
	if descH > textH-8 {
		descH = textH - 8
	}
	pdf.SetXY(printMarginMM, y)
	pdf.MultiCell(contentW, 3.2, strings.ToUpper(in.Description), "", "C", false)

	pdf.SetFont("Helvetica", "", 6)
	pdf.SetXY(printMarginMM, y+descH+0.4)
	pdf.CellFormat(contentW, 3, "SKU", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "B", printFontSKU)
	pdf.SetXY(printMarginMM, pdf.GetY()-0.3)
	pdf.CellFormat(contentW, 5, in.SKU, "", 1, "C", false, 0, "")

	qrX := (opts.WidthMM - printQRSizeMM) / 2
	qrY := opts.HeightMM - printMarginMM - printQRSizeMM
	reader := bytes.NewReader(qrPNG)
	imgName := fmt.Sprintf("qr-%d", time.Now().UnixNano())
	pdf.RegisterImageOptionsReader(imgName, fpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, reader)
	pdf.ImageOptions(imgName, qrX, qrY, printQRSizeMM, printQRSizeMM, false, fpdf.ImageOptions{}, 0, "")
	return nil
}

func pdfMultiCellHeight(pdf *fpdf.Fpdf, width, lineHeight float64, text string) float64 {
	lines := pdf.SplitText(text, width)
	if len(lines) == 0 {
		return lineHeight
	}
	return float64(len(lines)) * lineHeight
}
