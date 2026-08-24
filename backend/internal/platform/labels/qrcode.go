package labels

import (
	"bytes"
	"fmt"
	"image"
	"image/color"

	qrcode "github.com/skip2/go-qrcode"
)

const DefaultPNGSize = 256

// GeneratePNG renders the QR payload as a PNG bitmap.
func GeneratePNG(content string, size int) ([]byte, error) {
	if size <= 0 {
		size = DefaultPNGSize
	}
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return nil, err
	}
	return qr.PNG(size)
}

// GenerateSVG renders the QR payload as a compact SVG (one rect per module).
func GenerateSVG(content string) ([]byte, error) {
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return nil, err
	}
	// Negative size = pixels per module; -1 yields one pixel per QR module.
	img := qr.Image(-1)
	modules := img.Bounds().Dx()
	return encodeSVG(img, modules), nil
}

func encodeSVG(img image.Image, modules int) []byte {
	var b bytes.Buffer
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">`, modules, modules, modules, modules)
	fmt.Fprintf(&b, `<rect width="%d" height="%d" fill="#ffffff"/>`, modules, modules)
	for y := 0; y < modules; y++ {
		for x := 0; x < modules; x++ {
			if isDark(img.At(x, y)) {
				fmt.Fprintf(&b, `<rect x="%d" y="%d" width="1" height="1" fill="#000000"/>`, x, y)
			}
		}
	}
	b.WriteString(`</svg>`)
	return b.Bytes()
}

func isDark(c color.Color) bool {
	r, g, bl, _ := c.RGBA()
	return r < 0x8000 && g < 0x8000 && bl < 0x8000
}
