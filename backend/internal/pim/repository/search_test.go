package repository

import "testing"

func TestFoldSearch(t *testing.T) {
	if got := foldSearch("Memória"); got != "memoria" {
		t.Fatalf("got %q", got)
	}
	if got := foldSearch("  SSD  "); got != "ssd" {
		t.Fatalf("got %q", got)
	}
}

func TestSearchWordsSkipsShortStopwords(t *testing.T) {
	got := searchWords("placa de rede")
	if len(got) != 2 || got[0] != "placa" || got[1] != "rede" {
		t.Fatalf("got %#v", got)
	}
	got = searchWords("1")
	if len(got) != 1 || got[0] != "1" {
		t.Fatalf("got %#v", got)
	}
}

func TestIsAllDigits(t *testing.T) {
	if !isAllDigits("000001") || isAllDigits("AAA0001") || isAllDigits("") {
		t.Fatal("digit check failed")
	}
}
