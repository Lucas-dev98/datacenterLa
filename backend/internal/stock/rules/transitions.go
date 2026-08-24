package rules

import "github.com/datacenterla/platform/internal/stock/domain"

var allowedTransitions = map[domain.UnitStatus]map[domain.UnitStatus]bool{
	domain.StatusReceived: {
		domain.StatusInspecting: true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusInspecting: {
		domain.StatusIdentified: true,
		domain.StatusBlocked:    true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusIdentified: {
		domain.StatusAvailable:  true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusAvailable: {
		domain.StatusReserved:   true,
		domain.StatusBlocked:    true,
		domain.StatusInTransit:  true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusReserved: {
		domain.StatusPicking:    true,
		domain.StatusAvailable:  true, // release
		domain.StatusWrittenOff: true,
	},
	domain.StatusPicking: {
		domain.StatusSold:       true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusSold: {
		domain.StatusReturned:   true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusReturned: {
		domain.StatusInspecting: true,
		domain.StatusAvailable:  true,
		domain.StatusDamaged:    true,
		domain.StatusRMA:        true,
		domain.StatusWarranty:   true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusBlocked: {
		domain.StatusAvailable:  true,
		domain.StatusDamaged:    true,
		domain.StatusRMA:        true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusInTransit: {
		domain.StatusAvailable:  true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusDamaged: {
		domain.StatusWrittenOff: true,
		domain.StatusRMA:        true,
	},
	domain.StatusRMA: {
		domain.StatusAvailable:  true,
		domain.StatusDamaged:    true,
		domain.StatusWarranty:   true,
		domain.StatusWrittenOff: true,
	},
	domain.StatusWarranty: {
		domain.StatusAvailable:  true,
		domain.StatusDamaged:    true,
		domain.StatusWrittenOff: true,
	},
}

func CanTransition(from, to domain.UnitStatus) bool {
	targets, ok := allowedTransitions[from]
	if !ok {
		return false
	}
	return targets[to]
}

func ValidateTransition(from, to domain.UnitStatus) error {
	if from == to {
		return nil
	}
	if !CanTransition(from, to) {
		return domain.NewRuleViolation("INVALID_TRANSITION",
			"transition from "+string(from)+" to "+string(to)+" is not allowed")
	}
	return nil
}

// CountsAsPhysical reports whether the status contributes to physical stock balance.
func CountsAsPhysical(status domain.UnitStatus) bool {
	switch status {
	case domain.StatusAvailable, domain.StatusReserved, domain.StatusPicking:
		return true
	default:
		return false
	}
}
