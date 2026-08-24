package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"
)

func main() {
	_ = godotenv.Load()

	clientID := strings.TrimSpace(os.Getenv("MICROSOFT_CLIENT_ID"))
	if clientID == "" {
		log.Fatal("Defina MICROSOFT_CLIENT_ID no .env (App Registration no Azure Portal)")
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

	ctx := context.Background()
	device, err := cfg.DeviceAuth(ctx)
	if err != nil {
		log.Fatalf("device auth: %v", err)
	}

	fmt.Println("Autorize o envio de e-mail pela sua conta Microsoft:")
	fmt.Println(device.VerificationURI)
	fmt.Println("Código:", device.UserCode)
	fmt.Println("Aguardando autorização…")

	token, err := cfg.DeviceAccessToken(ctx, device)
	if err != nil {
		log.Fatalf("token: %v", err)
	}

	fmt.Println("\nAdicione ao backend/.env:")
	fmt.Printf("MICROSOFT_REFRESH_TOKEN=%s\n", token.RefreshToken)
	if token.AccessToken != "" {
		fmt.Println("\nToken obtido com sucesso. Reinicie a API com: make run")
	}
}
