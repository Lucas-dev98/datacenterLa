package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"
)

func sendViaMicrosoftGraph(to, subject, body string) error {
	clientID := strings.TrimSpace(os.Getenv("MICROSOFT_CLIENT_ID"))
	refreshToken := strings.TrimSpace(os.Getenv("MICROSOFT_REFRESH_TOKEN"))
	if clientID == "" || refreshToken == "" {
		return fmt.Errorf("microsoft graph not configured")
	}

	tenant := strings.TrimSpace(os.Getenv("MICROSOFT_TENANT_ID"))
	if tenant == "" {
		tenant = "consumers"
	}

	cfg := &oauth2.Config{
		ClientID: clientID,
		Endpoint: microsoft.AzureADEndpoint(tenant),
		Scopes:   []string{"https://graph.microsoft.com/Mail.Send", "offline_access"},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tok, err := cfg.TokenSource(ctx, &oauth2.Token{RefreshToken: refreshToken}).Token()
	if err != nil {
		return fmt.Errorf("microsoft token refresh: %w", err)
	}

	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = strings.TrimSpace(os.Getenv("SMTP_USER"))
	}

	payload := map[string]any{
		"message": map[string]any{
			"subject": subject,
			"body": map[string]any{
				"contentType": "Text",
				"content":     body,
			},
			"toRecipients": []map[string]any{
				{"emailAddress": map[string]string{"address": to}},
			},
		},
		"saveToSentItems": true,
	}
	if from != "" {
		payload["message"].(map[string]any)["from"] = map[string]any{
			"emailAddress": map[string]string{"address": from},
		}
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://graph.microsoft.com/v1.0/me/sendMail", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("microsoft graph sendMail %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	return nil
}
