package rules

import (
	"testing"

	"github.com/datacenterla/platform/internal/stock/domain"
)

func TestCanTransition_ReceiveFlow(t *testing.T) {
	flow := []domain.UnitStatus{
		domain.StatusReceived,
		domain.StatusInspecting,
		domain.StatusIdentified,
		domain.StatusAvailable,
		domain.StatusReserved,
		domain.StatusPicking,
		domain.StatusSold,
	}
	for i := 0; i < len(flow)-1; i++ {
		if !CanTransition(flow[i], flow[i+1]) {
			t.Fatalf("expected %s -> %s", flow[i], flow[i+1])
		}
	}
}

func TestValidateTransition_Invalid(t *testing.T) {
	err := ValidateTransition(domain.StatusSold, domain.StatusAvailable)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestCountsAsPhysical(t *testing.T) {
	if !CountsAsPhysical(domain.StatusAvailable) {
		t.Fatal("available should count")
	}
	if CountsAsPhysical(domain.StatusSold) {
		t.Fatal("sold should not count")
	}
}
