package labels

import (
	"fmt"
	"strings"
)

type AttributeValue struct {
	DataType      string
	ValueText     *string
	ValueNumber   *float64
	ValueBoolean  *bool
}

func FormatAttributeValue(a AttributeValue) string {
	switch a.DataType {
	case "number":
		if a.ValueNumber != nil {
			return fmt.Sprintf("%g", *a.ValueNumber)
		}
	case "boolean":
		if a.ValueBoolean != nil {
			if *a.ValueBoolean {
				return "Sim"
			}
			return "Não"
		}
	default:
		if a.ValueText != nil {
			return strings.TrimSpace(*a.ValueText)
		}
	}
	return ""
}

func AttributeValuesFromParts(parts []AttributeValue) []string {
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := FormatAttributeValue(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}
