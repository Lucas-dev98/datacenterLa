package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Postgres) ListLeads(ctx context.Context, limit int) ([]domain.Lead, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, email, phone, company, source, status::text, notes, owner_id, customer_id, created_at, updated_at
		FROM crm_leads ORDER BY created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Lead
	for rows.Next() {
		var l domain.Lead
		if err := rows.Scan(&l.ID, &l.Name, &l.Email, &l.Phone, &l.Company, &l.Source,
			&l.Status, &l.Notes, &l.OwnerID, &l.CustomerID, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Postgres) CreateLead(ctx context.Context, in domain.CreateLeadInput) (*domain.Lead, error) {
	var l domain.Lead
	err := r.pool.QueryRow(ctx, `
		INSERT INTO crm_leads (name, email, phone, company, source, notes, owner_id)
		VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5,''), 'web'), $6, $7)
		RETURNING id, name, email, phone, company, source, status::text, notes, owner_id, customer_id, created_at, updated_at
	`, in.Name, in.Email, in.Phone, in.Company, in.Source, in.Notes, in.OwnerID).Scan(
		&l.ID, &l.Name, &l.Email, &l.Phone, &l.Company, &l.Source, &l.Status,
		&l.Notes, &l.OwnerID, &l.CustomerID, &l.CreatedAt, &l.UpdatedAt)
	return &l, err
}

func (r *Postgres) UpdateLeadStatus(ctx context.Context, id uuid.UUID, status string) (*domain.Lead, error) {
	var l domain.Lead
	err := r.pool.QueryRow(ctx, `
		UPDATE crm_leads SET status = $2::lead_status, updated_at = now() WHERE id = $1
		RETURNING id, name, email, phone, company, source, status::text, notes, owner_id, customer_id, created_at, updated_at
	`, id, status).Scan(&l.ID, &l.Name, &l.Email, &l.Phone, &l.Company, &l.Source, &l.Status,
		&l.Notes, &l.OwnerID, &l.CustomerID, &l.CreatedAt, &l.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &l, err
}

func (r *Postgres) ListPayables(ctx context.Context, limit int) ([]domain.Payable, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT ap.id, ap.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name, ''),
		       ap.purchase_order_id, COALESCE(po.po_number, ''), ap.description,
		       ap.amount_usd, ap.amount_paid_usd, ap.due_date, ap.status::text, ap.created_at
		FROM accounts_payable ap
		LEFT JOIN suppliers s ON s.id = ap.supplier_id
		LEFT JOIN purchase_orders po ON po.id = ap.purchase_order_id
		ORDER BY ap.due_date NULLS LAST, ap.created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Payable
	for rows.Next() {
		var p domain.Payable
		if err := rows.Scan(&p.ID, &p.SupplierID, &p.SupplierName, &p.PurchaseOrderID, &p.PONumber,
			&p.Description, &p.AmountUSD, &p.AmountPaidUSD, &p.DueDate, &p.Status, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) PayPayable(ctx context.Context, id uuid.UUID, amount float64) (*domain.Payable, error) {
	var p domain.Payable
	err := r.pool.QueryRow(ctx, `
		UPDATE accounts_payable SET
			amount_paid_usd = amount_paid_usd + $2,
			status = CASE WHEN amount_paid_usd + $2 >= amount_usd THEN 'paid'::payable_status ELSE 'partial'::payable_status END,
			updated_at = now()
		WHERE id = $1 AND status IN ('open', 'partial')
		RETURNING id, supplier_id, purchase_order_id, description, amount_usd, amount_paid_usd, due_date, status::text, created_at
	`, id, amount).Scan(&p.ID, &p.SupplierID, &p.PurchaseOrderID, &p.Description,
		&p.AmountUSD, &p.AmountPaidUSD, &p.DueDate, &p.Status, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrInvalidState
	}
	return &p, err
}

func (r *Postgres) GetEcommerceProduct(ctx context.Context, skuID, warehouseID uuid.UUID) (*domain.CatalogProduct, error) {
	var p domain.CatalogProduct
	err := r.pool.QueryRow(ctx, `
		SELECT s.id, s.code, s.name, s.description, p.category_id, c.name, s.image_url, COALESCE(b.qty_available, 0)
		FROM skus s
		JOIN products p ON p.id = s.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN stock_balances b ON b.sku_id = s.id AND b.warehouse_id = $2
		WHERE s.id = $1 AND s.publish_ecommerce = true AND s.is_active = true
	`, skuID, warehouseID).Scan(&p.SKUID, &p.SKUCode, &p.Name, &p.Description, &p.CategoryID, &p.CategoryName, &p.ImageURL, &p.Available)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &p, err
}

func (r *Postgres) InsertOutboxEvent(ctx context.Context, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)`, eventType, data)
	return err
}
