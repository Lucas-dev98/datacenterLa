package notify

import (
	"fmt"
	"os"
	"strings"
)

func sendEmail(to, subject, body string) error {
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != "" {
		return sendViaResend(to, subject, body)
	}
	if strings.TrimSpace(os.Getenv("MICROSOFT_CLIENT_ID")) != "" &&
		strings.TrimSpace(os.Getenv("MICROSOFT_REFRESH_TOKEN")) != "" {
		return sendViaMicrosoftGraph(to, subject, body)
	}
	if strings.TrimSpace(os.Getenv("SMTP_HOST")) != "" {
		return sendSMTP(to, subject, body)
	}
	return fmt.Errorf("nenhum provedor de e-mail configurado — defina RESEND_API_KEY no .env")
}
