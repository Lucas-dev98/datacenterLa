package main

import (
	"log"
	"os"
	"strings"

	"github.com/datacenterla/platform/internal/platform/notify"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	to := strings.TrimSpace(os.Getenv("EMAIL_TEST_TO"))
	if to == "" {
		to = "l.o.bastos@live.com"
	}

	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" {
		log.Fatal("Defina RESEND_API_KEY no backend/.env")
	}

	notify.SendLoginCode(to, "123456")
	log.Printf("E-mail de teste enviado para %s (verifique a caixa de entrada)", to)
}
