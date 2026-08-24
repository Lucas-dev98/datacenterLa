package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	versions := parseMigrationVersions(entries)
	sort.Ints(versions)

	var current int64
	if err := pool.QueryRow(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current); err != nil {
		return fmt.Errorf("read migration version: %w", err)
	}

	for _, v := range versions {
		if int64(v) <= current {
			continue
		}
		fileName, err := migrationFile(entries, v)
		if err != nil {
			return err
		}
		body, err := migrationFS.ReadFile(fileName)
		if err != nil {
			return fmt.Errorf("read %s: %w", fileName, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("apply %s: %w", fileName, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, v); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("record migration %d: %w", v, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	return nil
}

func parseMigrationVersions(entries []fs.DirEntry) []int {
	var versions []int
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".up.sql") {
			continue
		}
		prefix := strings.SplitN(e.Name(), "_", 2)[0]
		v, err := strconv.Atoi(prefix)
		if err != nil {
			continue
		}
		versions = append(versions, v)
	}
	return versions
}

func migrationFile(entries []fs.DirEntry, version int) (string, error) {
	prefix := fmt.Sprintf("%03d_", version)
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ".up.sql") {
			return "migrations/" + name, nil
		}
	}
	return "", fmt.Errorf("migration file not found for version %d", version)
}
