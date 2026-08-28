package repository

import (
	"strings"
	"unicode"
)

const searchFoldMapFrom = "áàâãäéèêëíìîïóòôõöúùûüçñ"
const searchFoldMapTo = "aaaaaeeeeiiiiooooouuuucn"

func foldedSQL(expr string) string {
	return "translate(lower(" + expr + "), '" + searchFoldMapFrom + "', '" + searchFoldMapTo + "')"
}

func foldSearch(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case 'á', 'à', 'â', 'ã', 'ä':
			b.WriteByte('a')
		case 'é', 'è', 'ê', 'ë':
			b.WriteByte('e')
		case 'í', 'ì', 'î', 'ï':
			b.WriteByte('i')
		case 'ó', 'ò', 'ô', 'õ', 'ö':
			b.WriteByte('o')
		case 'ú', 'ù', 'û', 'ü':
			b.WriteByte('u')
		case 'ç':
			b.WriteByte('c')
		case 'ñ':
			b.WriteByte('n')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

var searchStopwords = map[string]bool{
	"a": true, "as": true, "o": true, "os": true, "e": true,
	"de": true, "da": true, "do": true, "das": true, "dos": true,
	"of": true, "the": true,
}

func searchWords(q string) []string {
	folded := foldSearch(q)
	parts := strings.Fields(folded)
	if len(parts) == 0 {
		if folded == "" {
			return nil
		}
		return []string{folded}
	}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if searchStopwords[p] && len(parts) > 1 {
			continue
		}
		out = append(out, p)
	}
	if len(out) == 0 {
		return parts
	}
	return out
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}
