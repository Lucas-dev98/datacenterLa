package db

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"os"
	"os/exec"
)

//go:embed seeds/wipe.sql
var wipeSQL []byte

//go:embed seeds/demo_foundation.sql
var foundationSQL []byte

//go:embed seeds/demo_categories.sql
var categoriesSQL []byte

//go:embed seeds/demo_transactional.sql
var transactionalSQL []byte

//go:embed seeds/demo_settings.sql
var settingsSQL []byte

//go:embed seeds/demo_sequences.sql
var sequencesSQL []byte

// ApplyDemoSeeds loads the SQL demo dataset (catalog ~99 SKUs + transactional samples).
func ApplyDemoSeeds(ctx context.Context, databaseURL string) error {
	steps := []struct {
		name string
		sql  []byte
	}{
		{"wipe", wipeSQL},
		{"foundation", foundationSQL},
		{"categories", categoriesSQL},
		{"transactional", transactionalSQL},
		{"sequences", sequencesSQL},
		{"settings", settingsSQL},
	}
	for _, step := range steps {
		if err := execPSQL(ctx, databaseURL, step.sql); err != nil {
			return fmt.Errorf("demo seed %s: %w", step.name, err)
		}
	}
	return nil
}

func execPSQL(ctx context.Context, databaseURL string, sql []byte) error {
	psql, err := exec.LookPath("psql")
	if err != nil {
		return fmt.Errorf("psql not found (install postgresql-client): %w", err)
	}
	cmd := exec.CommandContext(ctx, psql, databaseURL, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-")
	cmd.Stdin = bytes.NewReader(sql)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	return nil
}
