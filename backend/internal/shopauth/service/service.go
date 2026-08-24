package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/platform/notify"
	"github.com/datacenterla/platform/internal/shopauth/domain"
	"github.com/datacenterla/platform/internal/shopauth/jwt"
	"github.com/datacenterla/platform/internal/shopauth/repository"
)

type Service struct {
	repo   *repository.Postgres
	jwt    *jwt.Manager
	secret string
}

func New(repo *repository.Postgres, jwtMgr *jwt.Manager, pepper string) *Service {
	return &Service{repo: repo, jwt: jwtMgr, secret: pepper}
}

type AuthTokens struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	Email       string `json:"email"`
}

func (s *Service) RequestCode(ctx context.Context, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return domain.ErrInvalidInput
	}
	hasOrders, err := s.repo.EmailHasShopOrders(ctx, email)
	if err != nil {
		return err
	}
	if !hasOrders {
		return nil
	}
	limits := shopAuthRateLimits()
	if limits.cooldown > 0 {
		lastAt, err := s.repo.LastCodeCreatedAt(ctx, email)
		if err != nil {
			return err
		}
		if lastAt != nil && time.Since(lastAt.UTC()) < limits.cooldown {
			return domain.ErrCooldown
		}
	}
	if limits.maxPerHour > 0 {
		since := time.Now().UTC().Add(-time.Hour)
		n, err := s.repo.CountRecentCodes(ctx, email, since)
		if err != nil {
			return err
		}
		if n >= limits.maxPerHour {
			return domain.ErrTooManyRequests
		}
	}
	code, err := generateCode()
	if err != nil {
		return err
	}
	expires := time.Now().UTC().Add(10 * time.Minute)
	if err := s.repo.InsertCode(ctx, email, hashCode(code, s.secret), expires); err != nil {
		return err
	}
	notify.SendLoginCode(email, code)
	return nil
}

func (s *Service) VerifyCode(ctx context.Context, email, code string) (*AuthTokens, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	code = strings.TrimSpace(code)
	if email == "" || len(code) != 6 {
		return nil, domain.ErrInvalidInput
	}
	ok, err := s.repo.ConsumeValidCode(ctx, email, hashCode(code, s.secret), time.Now().UTC())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrInvalidCode
	}
	token, exp, err := s.jwt.Issue(email)
	if err != nil {
		return nil, err
	}
	return &AuthTokens{AccessToken: token, ExpiresIn: exp, Email: email}, nil
}

func (s *Service) JWT() *jwt.Manager { return s.jwt }

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashCode(code, secret string) string {
	sum := sha256.Sum256([]byte(code + secret))
	return hex.EncodeToString(sum[:])
}

type shopRateLimits struct {
	maxPerHour int
	cooldown   time.Duration
}

func shopAuthRateLimits() shopRateLimits {
	limits := shopRateLimits{maxPerHour: 10, cooldown: 30 * time.Second}
	if v := strings.TrimSpace(os.Getenv("SHOP_AUTH_MAX_CODES_PER_HOUR")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limits.maxPerHour = n
		}
	}
	if v := strings.TrimSpace(os.Getenv("SHOP_AUTH_COOLDOWN_SECONDS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limits.cooldown = time.Duration(n) * time.Second
		}
	}
	return limits
}
