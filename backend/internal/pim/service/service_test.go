package service

import (
	"strings"
	"testing"

	"github.com/datacenterla/platform/internal/pim/domain"
	"github.com/datacenterla/platform/internal/platform/labels"
)

func TestProductDescriptionFormat(t *testing.T) {
	cap := "32 GB"
	freq := "3200 MHz"
	ecc := true
	brand := "Samsung"
	attrs := []domain.ProductAttributeValue{
		{DataType: "text", ValueText: &cap},
		{DataType: "text", ValueText: &freq},
		{DataType: "boolean", ValueBoolean: &ecc},
	}
	values := attributeValues(attrs)
	desc := labels.FormatCadastroDescription("Memória", values, &brand)
	if !strings.Contains(desc, "MEM") || !strings.Contains(desc, "32 GB") || !strings.Contains(desc, "SAMSUNG") {
		t.Fatalf("unexpected: %s", desc)
	}
}

func TestValidateAttributeValue_TextRequired(t *testing.T) {
	def := domain.CategoryAttribute{Code: "capacidade", DataType: "text", IsRequired: true}
	err := validateAttributeValue(def, domain.AttributeValueInput{})
	if err == nil {
		t.Fatal("expected error")
	}
}
