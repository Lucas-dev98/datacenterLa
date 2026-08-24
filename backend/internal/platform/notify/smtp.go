package notify

import (
	"encoding/base64"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strings"
)

type loginAuth struct {
	username, password string
}

func (a *loginAuth) Start(*smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}
	switch loginPrompt(fromServer) {
	case "username":
		return []byte(a.username), nil
	case "password":
		return []byte(a.password), nil
	default:
		return nil, fmt.Errorf("unexpected SMTP LOGIN challenge: %q", fromServer)
	}
}

func loginPrompt(fromServer []byte) string {
	prompt := strings.ToLower(strings.TrimSpace(string(fromServer)))
	if strings.Contains(prompt, "username") {
		return "username"
	}
	if strings.Contains(prompt, "password") {
		return "password"
	}
	if decoded, err := base64.StdEncoding.DecodeString(string(fromServer)); err == nil {
		prompt = strings.ToLower(strings.TrimSpace(string(decoded)))
		if strings.Contains(prompt, "username") {
			return "username"
		}
		if strings.Contains(prompt, "password") {
			return "password"
		}
	}
	return ""
}

func smtpAuth(host, user, pass string) smtp.Auth {
	if user == "" && pass == "" {
		return nil
	}
	authType := strings.ToLower(strings.TrimSpace(os.Getenv("SMTP_AUTH")))
	if authType == "" {
		h := strings.ToLower(host)
		if strings.Contains(h, "outlook") || strings.Contains(h, "office365") || strings.Contains(h, "live.com") {
			authType = "login"
		} else {
			authType = "plain"
		}
	}
	switch authType {
	case "login":
		return &loginAuth{username: user, password: pass}
	default:
		return smtp.PlainAuth("", user, pass, host)
	}
}

func sendSMTP(to, subject, body string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	if host == "" {
		return fmt.Errorf("SMTP_HOST not configured")
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if from == "" {
		from = "noreply@datacenterla.local"
	}

	addr := net.JoinHostPort(host, port)
	msg := buildPlainTextEmail(from, to, subject, body)

	user := strings.TrimSpace(os.Getenv("SMTP_USER"))
	pass := os.Getenv("SMTP_PASSWORD")
	return smtp.SendMail(addr, smtpAuth(host, user, pass), from, []string{to}, msg)
}

func buildPlainTextEmail(from, to, subject, body string) []byte {
	var b strings.Builder
	b.WriteString("From: ")
	b.WriteString(from)
	b.WriteString("\r\nTo: ")
	b.WriteString(to)
	b.WriteString("\r\nSubject: ")
	b.WriteString(subject)
	b.WriteString("\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n")
	b.WriteString(body)
	return []byte(b.String())
}
