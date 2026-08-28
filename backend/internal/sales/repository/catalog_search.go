package repository

import (
	"fmt"
	"sort"
	"strings"
	"unicode"
)

const catalogFoldFrom = "áàâãäéèêëíìîïóòôõöúùûüçñ"
const catalogFoldTo = "aaaaaeeeeiiiiooooouuuucn"

func catalogFoldedSQL(expr string) string {
	return "translate(lower(" + expr + "), '" + catalogFoldFrom + "', '" + catalogFoldTo + "')"
}

func catalogCompactSQL(expr string) string {
	return "regexp_replace(" + catalogFoldedSQL(expr) + ", '[^a-z0-9]+', '', 'g')"
}

func catalogFold(s string) string {
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

func catalogCompact(s string) string {
	s = catalogFold(s)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func catalogPadSKU(s string) string {
	if s == "" || !catalogAllDigits(s) || len(s) >= 6 {
		return s
	}
	return strings.Repeat("0", 6-len(s)) + s
}

func catalogAllDigits(s string) bool {
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

var catalogStopwords = map[string]bool{
	"a": true, "as": true, "o": true, "os": true, "e": true,
	"de": true, "da": true, "do": true, "das": true, "dos": true,
	"of": true, "the": true, "para": true, "com": true,
	"sku": true, "modelo": true, "model": true, "item": true,
	"enterprise": true, "profissional": true, "hardware": true,
}

var catalogTokenAliases = map[string][]string{
	"cpu":         {"processador", "procesador", "xeon", "epyc"},
	"processador": {"cpu", "xeon", "epyc", "procesador"},
	"procesador":  {"cpu", "processador", "xeon", "epyc"},
	"processor":   {"processador", "xeon", "epyc", "cpu"},
	"ram":         {"memoria", "rdimm", "dimm", "ecc"},
	"memoria":     {"ram", "rdimm", "dimm", "ecc"},
	"rdimm":       {"ram", "memoria", "ecc", "dimm"},
	"nic":         {"rede", "gbe", "ethernet", "x710", "i350", "connectx"},
	"rede":        {"nic", "gbe", "ethernet", "x710", "i350", "connectx"},
	"network":     {"nic", "rede", "ethernet", "gbe"},
	"ethernet":    {"rede", "gbe", "nic"},
	"xeon":        {"processador", "cpu"},
	"epyc":        {"processador", "cpu"},
	"nvme":        {"ssd"},
	"switch":      {"catalyst", "arista", "juniper"},
	"storage":     {"storage", "nas", "san", "jbod", "exos"},
	"storages":    {"storage", "nas", "san", "jbod", "exos"},
	"servidor":    {"server", "poweredge", "proliant", "thinksystem"},
	"servidores":  {"server", "poweredge", "proliant", "thinksystem"},
	"server":      {"servidor", "poweredge", "proliant", "thinksystem"},
	"ssd":         {"nvme", "u2", "m2"},
	"gpu":         {"vga", "rtx", "quadro", "nvidia"},
	"video":       {"gpu", "rtx", "nvidia"},
	"grafica":     {"gpu", "rtx", "nvidia"},
	"hd":          {"hdd", "exos"},
	"disco":       {"hdd", "ssd", "exos"},
}

func catalogTokens(q string) []string {
	folded := catalogFold(q)
	parts := strings.FieldsFunc(folded, func(r rune) bool {
		return unicode.IsSpace(r) || r == ',' || r == ';' || r == '/' || r == '-' || r == '_'
	})
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.Trim(p, "-_.+")
		if p == "" {
			continue
		}
		if catalogStopwords[p] && len(parts) > 1 {
			continue
		}
		if len(p) == 1 && !unicode.IsDigit(rune(p[0])) {
			continue
		}
		out = append(out, p)
	}
	if len(out) == 0 && folded != "" {
		return []string{strings.ReplaceAll(folded, " ", "")}
	}
	return out
}

var catalogNoisyPatterns = map[string]bool{
	"cpu": true,
	"ram": true,
}

func catalogHasDigit(s string) bool {
	for _, r := range s {
		if unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

func catalogPatternsForToken(token string, all []string) []string {
	seen := map[string]bool{}
	add := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" || seen[v] || catalogNoisyPatterns[v] {
			return
		}
		seen[v] = true
	}
	add(token)
	if c := catalogCompact(token); c != token {
		add(c)
	}
	if padded := catalogPadSKU(token); padded != token {
		add(padded)
	}
	for _, a := range catalogTokenAliases[token] {
		add(a)
	}
	set := map[string]bool{}
	for _, t := range all {
		set[t] = true
	}
	if token == "placa" && set["rede"] {
		add("nic")
	}
	out := make([]string, 0, len(seen))
	for v := range seen {
		out = append(out, v)
	}
	sort.Strings(out)
	return out
}

func catalogTextExprs() []string {
	return []string{
		"s.name",
		"btrim(s.code::text)",
		"COALESCE(s.description, '')",
		"COALESCE(p.name, '')",
		"COALESCE(p.brand, '')",
		"COALESCE(p.manufacturer, '')",
		"COALESCE(c.name, '')",
		"COALESCE(c.code, '')",
		"COALESCE(parent.name, '')",
		"COALESCE(parent.code, '')",
	}
}

func catalogSpacedSQL(expr string) string {
	return "(' ' || regexp_replace(" + catalogFoldedSQL(expr) + ", '[^a-z0-9]+', ' ', 'g') || ' ')"
}

func catalogLikeAny(transform func(string) string, exprs []string, paramIdx int) string {
	parts := make([]string, 0, len(exprs))
	for _, expr := range exprs {
		parts = append(parts, fmt.Sprintf("%s LIKE $%d", transform(expr), paramIdx))
	}
	return "(" + strings.Join(parts, " OR ") + ")"
}

func catalogSearchSQL(search string, args []any, n int) (string, []any, int) {
	tokens := catalogTokens(search)
	if len(tokens) == 0 {
		return "", args, n
	}
	var conds []string
	for _, token := range tokens {
		var ors []string
		for _, p := range catalogPatternsForToken(token, tokens) {
			if catalogHasDigit(p) {
				ors = append(ors, catalogLikeAny(catalogSpacedSQL, catalogTextExprs(), n))
				args = append(args, "% "+p+" %")
				n++
				compact := catalogCompact(p)
				if len(compact) >= 5 {
					ors = append(ors, catalogLikeAny(catalogCompactSQL, []string{
						"s.name", "btrim(s.code::text)", "COALESCE(p.name, '')", "COALESCE(p.brand, '')",
					}, n))
					args = append(args, "%"+compact+"%")
					n++
				}
				if catalogAllDigits(p) {
					ors = append(ors, fmt.Sprintf("(btrim(s.code::text) LIKE $%d OR %s LIKE $%d)", n, catalogFoldedSQL("btrim(s.code::text)"), n))
					args = append(args, "%"+p+"%")
					n++
				}
				continue
			}
			ors = append(ors, catalogLikeAny(catalogFoldedSQL, catalogTextExprs(), n))
			args = append(args, "%"+p+"%")
			n++
		}
		if len(ors) == 0 {
			continue
		}
		conds = append(conds, "("+strings.Join(ors, " OR ")+")")
	}
	if len(conds) == 0 {
		return "", args, n
	}
	return " AND " + strings.Join(conds, " AND "), args, n
}
