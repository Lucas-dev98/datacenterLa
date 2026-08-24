package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/auth/domain"
	"github.com/datacenterla/platform/internal/auth/jwt"
	"github.com/datacenterla/platform/internal/auth/repository"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo        *repository.Postgres
	jwt         *jwt.Manager
	issuer      string
	mfaRequired bool
}

func New(repo *repository.Postgres, jwtMgr *jwt.Manager, issuer string, mfaRequired bool) *Service {
	return &Service{repo: repo, jwt: jwtMgr, issuer: issuer, mfaRequired: mfaRequired}
}

func (s *Service) JWT() *jwt.Manager {
	return s.jwt
}

func (s *Service) Login(ctx context.Context, in domain.LoginInput) (*domain.TokenPair, error) {
	email := strings.TrimSpace(strings.ToLower(in.Email))
	if email == "" || in.Password == "" {
		return nil, domain.ErrInvalidInput
	}
	user, hash, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, domain.ErrInvalidCreds
	}
	if !user.IsActive {
		return nil, domain.ErrForbidden
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)); err != nil {
		return nil, domain.ErrInvalidCreds
	}
	if user.MFAEnabled {
		if in.MFACode == "" {
			return &domain.TokenPair{MFARequired: true}, domain.ErrMFARequired
		}
		secret, err := s.repo.GetMFASecret(ctx, user.ID)
		if err != nil || !totp.Validate(in.MFACode, secret) {
			return nil, domain.ErrInvalidMFACode
		}
	}
	return s.issueTokens(ctx, user)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	userID, expiresAt, err := s.repo.FindRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	if time.Now().UTC().After(expiresAt) {
		return nil, domain.ErrUnauthorized
	}
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	_ = s.repo.RevokeRefreshToken(ctx, refreshToken)
	return s.issueTokens(ctx, user)
}

func (s *Service) Me(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

func (s *Service) SetupMFA(ctx context.Context, userID uuid.UUID) (*domain.MFASetup, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      s.issuer,
		AccountName: user.Email,
	})
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetMFASecret(ctx, userID, key.Secret(), false); err != nil {
		return nil, err
	}
	return &domain.MFASetup{Secret: key.Secret(), URL: key.URL()}, nil
}

func (s *Service) EnableMFA(ctx context.Context, userID uuid.UUID, code string) error {
	secret, err := s.repo.GetMFASecret(ctx, userID)
	if err != nil {
		return err
	}
	if !totp.Validate(code, secret) {
		return domain.ErrInvalidMFACode
	}
	return s.repo.SetMFASecret(ctx, userID, secret, true)
}

func (s *Service) CreateUser(ctx context.Context, in domain.CreateUserInput) (*domain.User, error) {
	if len(in.Password) < 12 {
		return nil, fmt.Errorf("%w: password min 12 chars", domain.ErrInvalidInput)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateUser(ctx, strings.ToLower(strings.TrimSpace(in.Email)), string(hash), strings.TrimSpace(in.FullName), in.RoleIDs)
}

func (s *Service) ListUsers(ctx context.Context, limit int) ([]domain.User, error) {
	return s.repo.ListUsers(ctx, limit)
}

func (s *Service) ListRoles(ctx context.Context) ([]domain.Role, error) {
	return s.repo.ListRoles(ctx)
}

func (s *Service) UpdateUser(ctx context.Context, id uuid.UUID, in domain.UpdateUserInput) (*domain.User, error) {
	if in.Password != nil && len(*in.Password) < 12 {
		return nil, fmt.Errorf("%w: password min 12 chars", domain.ErrInvalidInput)
	}
	if in.RoleIDs != nil && len(in.RoleIDs) == 0 {
		return nil, fmt.Errorf("%w: at least one role required", domain.ErrInvalidInput)
	}
	_, err := s.repo.UpdateUser(ctx, id, in.FullName, in.IsActive, in.RoleIDs)
	if err != nil {
		return nil, err
	}
	if in.Password != nil {
		hash, err := bcrypt.GenerateFromPassword([]byte(*in.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		if err := s.repo.SetUserPassword(ctx, id, string(hash)); err != nil {
			return nil, err
		}
	}
	return s.repo.GetUserByID(ctx, id)
}

func (s *Service) issueTokens(ctx context.Context, user *domain.User) (*domain.TokenPair, error) {
	access, expiresIn, err := s.jwt.IssueAccess(user.ID, user.Email, user.Permissions)
	if err != nil {
		return nil, err
	}
	refresh, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().UTC().Add(s.jwt.RefreshTTL())
	if err := s.repo.SaveRefreshToken(ctx, user.ID, refresh, expiresAt); err != nil {
		return nil, err
	}
	_ = s.repo.UpdateLastLogin(ctx, user.ID)
	return &domain.TokenPair{
		AccessToken:      access,
		RefreshToken:     refresh,
		ExpiresIn:        expiresIn,
		MFASetupRequired: s.mfaRequired && !user.MFAEnabled,
	}, nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}
