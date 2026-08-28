package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

func dataDir() string {
	if v := strings.TrimSpace(os.Getenv("DATA_DIR")); v != "" {
		return v
	}
	return "data"
}

func CustomerDocDir() string {
	return filepath.Join(dataDir(), "customer-docs")
}

func OrderShipPhotoDir() string {
	return filepath.Join(dataDir(), "order-ship-photos")
}

func UnitIntakePhotoDir() string {
	return filepath.Join(dataDir(), "unit-intake-photos")
}

func IntakeBatchPhotoDir() string {
	return filepath.Join(dataDir(), "intake-batch-photos")
}

func RMATestPhotoDir() string {
	return filepath.Join(dataDir(), "rma-test-photos")
}

func SaveCustomerDocument(customerID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(CustomerDocDir(), 0o755); err != nil {
		return "", fmt.Errorf("create doc dir: %w", err)
	}
	rel := filepath.Join("customer-docs", customerID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write document: %w", err)
	}
	return rel, nil
}

func SaveOrderShipPhoto(orderID, orderItemID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(OrderShipPhotoDir(), 0o755); err != nil {
		return "", fmt.Errorf("create ship photo dir: %w", err)
	}
	rel := filepath.Join("order-ship-photos", orderID.String(), orderItemID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", fmt.Errorf("create order photo dir: %w", err)
	}
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write ship photo: %w", err)
	}
	return rel, nil
}

func SaveUnitIntakePhoto(unitID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(UnitIntakePhotoDir(), 0o755); err != nil {
		return "", fmt.Errorf("create intake photo dir: %w", err)
	}
	rel := filepath.Join("unit-intake-photos", unitID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write intake photo: %w", err)
	}
	return rel, nil
}

func SaveIntakeBatchPhoto(batchID, photoID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(IntakeBatchPhotoDir(), 0o755); err != nil {
		return "", fmt.Errorf("create batch photo dir: %w", err)
	}
	rel := filepath.Join("intake-batch-photos", batchID.String(), photoID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", fmt.Errorf("create batch photo dir: %w", err)
	}
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write batch photo: %w", err)
	}
	return rel, nil
}

func SaveCustomerReturnPhoto(returnID, photoID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(CustomerReturnPhotoDir(), 0o755); err != nil {
		return "", fmt.Errorf("create return photo dir: %w", err)
	}
	rel := filepath.Join("customer-return-photos", returnID.String(), photoID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", fmt.Errorf("create return photo dir: %w", err)
	}
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write return photo: %w", err)
	}
	return rel, nil
}

func CustomerReturnPhotoDir() string {
	return filepath.Join(dataDir(), "customer-return-photos")
}

func SaveRMATestPhoto(caseID, photoID uuid.UUID, ext string, body []byte) (string, error) {
	ext = normalizeImageExt(ext)
	if err := os.MkdirAll(RMATestPhotoDir(), 0o755); err != nil {
		return "", fmt.Errorf("create rma photo dir: %w", err)
	}
	rel := filepath.Join("rma-test-photos", caseID.String(), photoID.String()+"."+ext)
	abs := filepath.Join(dataDir(), rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", fmt.Errorf("create rma photo dir: %w", err)
	}
	if err := os.WriteFile(abs, body, 0o644); err != nil {
		return "", fmt.Errorf("write rma test photo: %w", err)
	}
	return rel, nil
}

func normalizeImageExt(ext string) string {
	ext = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(ext), "."))
	if ext == "jpeg" {
		ext = "jpg"
	}
	if ext != "jpg" && ext != "png" && ext != "webp" {
		ext = "jpg"
	}
	return ext
}

func ReadDataFile(rel string) ([]byte, error) {
	rel = filepath.Clean(rel)
	if rel == "." || strings.Contains(rel, "..") {
		return nil, fmt.Errorf("invalid path")
	}
	return os.ReadFile(filepath.Join(dataDir(), rel))
}
