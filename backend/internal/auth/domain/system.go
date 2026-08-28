package domain

import "github.com/google/uuid"

// SystemUserID is the synthetic actor for ecommerce checkout, payment webhooks
// and background jobs. It cannot log in (unusable password, no roles).
var SystemUserID = uuid.MustParse("00000000-0000-0000-0000-000000000002")
