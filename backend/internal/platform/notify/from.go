package notify

import "os"

func emailFrom(fallback string) string {
	for _, key := range []string{"RESEND_FROM", "EMAIL_FROM", "SMTP_FROM"} {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return fallback
}
