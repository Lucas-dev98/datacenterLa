package notify

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
)

type OrderEvent struct {
	Type         string
	OrderNumber  string
	Email        string
	CustomerName string
	Status       string
	TotalUSD     float64
}

func SendOrderEvent(ctx context.Context, ev OrderEvent) {
	if strings.TrimSpace(ev.Email) == "" {
		return
	}
	subject, body := formatOrderEvent(ev)
	log.Printf("[notify] order event type=%s order=%s to=%s", ev.Type, ev.OrderNumber, ev.Email)
	if err := sendEmail(ev.Email, subject, body); err != nil {
		log.Printf("[notify] e-mail error: %v", err)
	}
}

func formatOrderEvent(ev OrderEvent) (string, string) {
	switch ev.Type {
	case "order_paid":
		return fmt.Sprintf("Pedido %s confirmado — Data Center LA", ev.OrderNumber),
			fmt.Sprintf("Olá %s,\n\nRecebemos o pagamento do pedido %s (USD %.2f).\nStatus: %s\n\nEquipe Data Center LA\n",
				ev.CustomerName, ev.OrderNumber, ev.TotalUSD, ev.Status)
	case "order_shipped":
		return fmt.Sprintf("Pedido %s expedido — Data Center LA", ev.OrderNumber),
			fmt.Sprintf("Olá %s,\n\nSeu pedido %s foi expedido.\nTotal: USD %.2f\n\nEquipe Data Center LA\n",
				ev.CustomerName, ev.OrderNumber, ev.TotalUSD)
	default:
		return fmt.Sprintf("Atualização pedido %s", ev.OrderNumber),
			fmt.Sprintf("Pedido %s — status: %s\n", ev.OrderNumber, ev.Status)
	}
}

func SendLoginCode(email, code string) {
	subject := "Seu código de acesso — Data Center LA"
	body := fmt.Sprintf(
		"Olá,\n\nSeu código para acessar seus pedidos: %s\n\nVálido por 10 minutos.\n\nEquipe Data Center LA\n",
		code,
	)
	log.Printf("[notify] shop login code to=%s", email)
	if err := sendEmail(email, subject, body); err != nil {
		log.Printf("[notify] e-mail error sending login code to %s: %v", email, err)
		if os.Getenv("EMAIL_LOG_CODE") == "true" {
			log.Printf("[shop-auth] código (fallback dev): %s", code)
		}
		return
	}
	log.Printf("[notify] login code e-mail sent to %s", email)
}

func PublicStatusLabel(status string) string {
	switch status {
	case "draft":
		return "Rascunho"
	case "confirmed":
		return "Confirmado — aguardando pagamento"
	case "paid":
		return "Pago — preparando envio"
	case "picking":
		return "Em separação"
	case "shipped":
		return "Expedido"
	case "delivered":
		return "Entregue"
	case "cancelled":
		return "Cancelado"
	default:
		return status
	}
}
