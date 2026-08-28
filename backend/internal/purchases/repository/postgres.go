package repository

import (
	"context"
	"errors"
	"time"

	"github.com/datacenterla/platform/internal/purchases/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

func (r *Postgres) ListSuppliers(ctx context.Context, limit int) ([]domain.Supplier, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, name, legal_name, email, phone, document_id, country, kind::text, holding_code,
		       status::text, notes, created_at, updated_at
		FROM suppliers ORDER BY name LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Supplier
	for rows.Next() {
		var s domain.Supplier
		if err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.LegalName, &s.Email, &s.Phone, &s.DocumentID,
			&s.Country, &s.Kind, &s.HoldingCode, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Postgres) GetSupplier(ctx context.Context, id uuid.UUID) (*domain.Supplier, error) {
	var s domain.Supplier
	err := r.pool.QueryRow(ctx, `
		SELECT id, code, name, legal_name, email, phone, document_id, country, kind::text, holding_code,
		       status::text, notes, created_at, updated_at
		FROM suppliers WHERE id = $1
	`, id).Scan(&s.ID, &s.Code, &s.Name, &s.LegalName, &s.Email, &s.Phone, &s.DocumentID,
		&s.Country, &s.Kind, &s.HoldingCode, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Postgres) CreateSupplier(ctx context.Context, in domain.CreateSupplierInput) (*domain.Supplier, error) {
	kind := in.Kind
	if kind == "" {
		kind = "external"
	}
	var s domain.Supplier
	err := r.pool.QueryRow(ctx, `
		INSERT INTO suppliers (code, name, legal_name, email, phone, document_id, country, kind, holding_code, notes)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7,''), 'PY'), $8::supplier_kind, $9, $10)
		RETURNING id, code, name, legal_name, email, phone, document_id, country, kind::text, holding_code,
		          status::text, notes, created_at, updated_at
	`, in.Code, in.Name, in.LegalName, in.Email, in.Phone, in.DocumentID, in.Country, kind, in.HoldingCode, in.Notes).Scan(
		&s.ID, &s.Code, &s.Name, &s.LegalName, &s.Email, &s.Phone, &s.DocumentID,
		&s.Country, &s.Kind, &s.HoldingCode, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Postgres) UpdateSupplier(ctx context.Context, id uuid.UUID, in domain.UpdateSupplierInput) (*domain.Supplier, error) {
	kind := in.Kind
	if kind == "" {
		kind = "external"
	}
	var s domain.Supplier
	err := r.pool.QueryRow(ctx, `
		UPDATE suppliers SET
			name = $2, legal_name = $3, email = $4, phone = $5, document_id = $6,
			country = COALESCE(NULLIF($7,''), country), kind = $8::supplier_kind,
			holding_code = $9, notes = $10, updated_at = now()
		WHERE id = $1
		RETURNING id, code, name, legal_name, email, phone, document_id, country, kind::text, holding_code,
		          status::text, notes, created_at, updated_at
	`, id, in.Name, in.LegalName, in.Email, in.Phone, in.DocumentID, in.Country, kind, in.HoldingCode, in.Notes).Scan(
		&s.ID, &s.Code, &s.Name, &s.LegalName, &s.Email, &s.Phone, &s.DocumentID,
		&s.Country, &s.Kind, &s.HoldingCode, &s.Status, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Postgres) CreatePurchaseOrder(ctx context.Context, in domain.CreatePOInput, createdBy uuid.UUID) (*domain.PurchaseOrder, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var po domain.PurchaseOrder
	err = tx.QueryRow(ctx, `
		INSERT INTO purchase_orders (
			po_number, supplier_id, warehouse_id, import_origin, origin_country_code,
			intercompany_invoice_ref, customs_declaration_ref, incoterms,
			freight_usd, duties_usd, expected_at, notes, created_by
		)
		VALUES (
			generate_po_number(), $1, $2, COALESCE(NULLIF($3,''), 'local')::import_origin, NULLIF($4,''),
			$5, $6, $7, $8, $9, $10::date, $11, $12
		)
		RETURNING id, po_number, supplier_id, warehouse_id, status::text, import_origin::text,
		          origin_country_code, intercompany_invoice_ref, customs_declaration_ref, incoterms,
		          freight_usd, duties_usd, expected_at, notes, created_by,
		          ordered_at, received_at, created_at, updated_at
	`, in.SupplierID, in.WarehouseID, in.ImportOrigin, countryCodeParam(in.ImportOrigin, in.OriginCountryCode),
		in.IntercompanyInvoiceRef, in.CustomsDeclarationRef, in.Incoterms,
		in.FreightUSD, in.DutiesUSD, in.ExpectedAt, in.Notes, createdBy).Scan(
		&po.ID, &po.PONumber, &po.SupplierID, &po.WarehouseID, &po.Status, &po.ImportOrigin,
		&po.OriginCountryCode, &po.IntercompanyInvoiceRef, &po.CustomsDeclarationRef, &po.Incoterms,
		&po.FreightUSD, &po.DutiesUSD, &po.ExpectedAt, &po.Notes, &po.CreatedBy,
		&po.OrderedAt, &po.ReceivedAt, &po.CreatedAt, &po.UpdatedAt)
	if err != nil {
		return nil, err
	}
	for _, item := range in.Items {
		_, err = tx.Exec(ctx, `
			INSERT INTO purchase_order_items (purchase_order_id, sku_id, quantity_ordered, unit_cost_usd)
			VALUES ($1, $2, $3, $4)
		`, po.ID, item.SKUID, item.Quantity, item.UnitCostUSD)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetPurchaseOrder(ctx, po.ID)
}

func (r *Postgres) GetPurchaseOrder(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error) {
	var po domain.PurchaseOrder
	err := r.pool.QueryRow(ctx, `
		SELECT p.id, p.po_number, p.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name), s.kind::text, p.warehouse_id, p.status::text,
		       p.import_origin::text, p.origin_country_code, p.intercompany_invoice_ref, p.customs_declaration_ref, p.incoterms,
		       p.freight_usd, p.duties_usd, p.expected_at, p.notes, p.created_by,
		       p.ordered_at, p.received_at, p.created_at, p.updated_at
		FROM purchase_orders p
		JOIN suppliers s ON s.id = p.supplier_id
		WHERE p.id = $1
	`, id).Scan(&po.ID, &po.PONumber, &po.SupplierID, &po.SupplierName, &po.SupplierKind, &po.WarehouseID, &po.Status,
		&po.ImportOrigin, &po.OriginCountryCode, &po.IntercompanyInvoiceRef, &po.CustomsDeclarationRef, &po.Incoterms,
		&po.FreightUSD, &po.DutiesUSD, &po.ExpectedAt, &po.Notes, &po.CreatedBy,
		&po.OrderedAt, &po.ReceivedAt, &po.CreatedAt, &po.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	po.Items, err = r.listPOItems(ctx, id)
	if err != nil {
		return nil, err
	}
	enrichLandedCost(&po)
	po.Payable, _ = r.GetPayableForPO(ctx, id)
	return &po, nil
}

func countryCodeParam(origin string, code *string) any {
	if origin != "other" || code == nil || *code == "" {
		return nil
	}
	return *code
}

func enrichLandedCost(po *domain.PurchaseOrder) {
	var itemsTotal float64
	for _, item := range po.Items {
		itemsTotal += float64(item.QuantityOrdered) * item.UnitCostUSD
	}
	extra := po.FreightUSD + po.DutiesUSD
	po.LandedCostUSD = itemsTotal + extra
	for i := range po.Items {
		item := &po.Items[i]
		lineTotal := float64(item.QuantityOrdered) * item.UnitCostUSD
		if itemsTotal > 0 && item.QuantityOrdered > 0 {
			item.UnitLandedCostUSD = item.UnitCostUSD + extra*(lineTotal/itemsTotal)/float64(item.QuantityOrdered)
		} else {
			item.UnitLandedCostUSD = item.UnitCostUSD
		}
	}
}

func (r *Postgres) GetPayableForPO(ctx context.Context, poID uuid.UUID) (*domain.POPayableSummary, error) {
	var p domain.POPayableSummary
	err := r.pool.QueryRow(ctx, `
		SELECT id, status::text, amount_usd, amount_paid_usd
		FROM accounts_payable WHERE purchase_order_id = $1 LIMIT 1
	`, poID).Scan(&p.ID, &p.Status, &p.AmountUSD, &p.AmountPaidUSD)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func scanPORow(rows pgx.Rows) (domain.PurchaseOrder, error) {
	var po domain.PurchaseOrder
	err := rows.Scan(&po.ID, &po.PONumber, &po.SupplierID, &po.SupplierName, &po.SupplierKind, &po.WarehouseID, &po.Status,
		&po.ImportOrigin, &po.OriginCountryCode, &po.IntercompanyInvoiceRef, &po.CustomsDeclarationRef, &po.Incoterms,
		&po.FreightUSD, &po.DutiesUSD, &po.ExpectedAt, &po.Notes, &po.CreatedBy,
		&po.OrderedAt, &po.ReceivedAt, &po.CreatedAt, &po.UpdatedAt)
	return po, err
}

const poListSelect = `
	SELECT p.id, p.po_number, p.supplier_id, COALESCE(NULLIF(s.legal_name, ''), s.name), s.kind::text, p.warehouse_id, p.status::text,
	       p.import_origin::text, p.origin_country_code, p.intercompany_invoice_ref, p.customs_declaration_ref, p.incoterms,
	       p.freight_usd, p.duties_usd, p.expected_at, p.notes, p.created_by,
	       p.ordered_at, p.received_at, p.created_at, p.updated_at
	FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id
`

func (r *Postgres) ListPurchaseOrders(ctx context.Context, status string, limit int) ([]domain.PurchaseOrder, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows pgx.Rows
	var err error
	if status != "" {
		rows, err = r.pool.Query(ctx, poListSelect+`
			WHERE p.status = $1::purchase_order_status
			ORDER BY p.created_at DESC LIMIT $2
		`, status, limit)
	} else {
		rows, err = r.pool.Query(ctx, poListSelect+`
			ORDER BY p.created_at DESC LIMIT $1
		`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PurchaseOrder
	for rows.Next() {
		po, err := scanPORow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, po)
	}
	return out, rows.Err()
}

func (r *Postgres) listPOItems(ctx context.Context, poID uuid.UUID) ([]domain.PurchaseOrderItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT i.id, i.purchase_order_id, i.sku_id, s.code, i.quantity_ordered, i.quantity_received, i.unit_cost_usd
		FROM purchase_order_items i JOIN skus s ON s.id = i.sku_id
		WHERE i.purchase_order_id = $1 ORDER BY s.code
	`, poID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PurchaseOrderItem
	for rows.Next() {
		var item domain.PurchaseOrderItem
		if err := rows.Scan(&item.ID, &item.PurchaseOrderID, &item.SKUID, &item.SKUCode,
			&item.QuantityOrdered, &item.QuantityReceived, &item.UnitCostUSD); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) SubmitPurchaseOrder(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE purchase_orders SET status = 'ordered', ordered_at = now(), updated_at = now()
		WHERE id = $1 AND status = 'draft'
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidState
	}
	return nil
}

func (r *Postgres) CancelPurchaseOrder(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE purchase_orders SET status = 'cancelled', updated_at = now()
		WHERE id = $1 AND status IN ('draft', 'ordered')
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidState
	}
	return nil
}

func (r *Postgres) IncrementReceived(ctx context.Context, poID, skuID uuid.UUID, qty int) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE purchase_order_items SET quantity_received = quantity_received + $3
		WHERE purchase_order_id = $1 AND sku_id = $2
		  AND quantity_received + $3 <= quantity_ordered
	`, poID, skuID, qty)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidInput
	}
	return nil
}

func (r *Postgres) RefreshPOStatus(ctx context.Context, poID uuid.UUID) error {
	var total, received int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(quantity_ordered),0), COALESCE(SUM(quantity_received),0)
		FROM purchase_order_items WHERE purchase_order_id = $1
	`, poID).Scan(&total, &received)
	if err != nil {
		return err
	}
	status := "partial"
	if received >= total && total > 0 {
		status = "received"
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE purchase_orders SET status = $2::purchase_order_status,
			received_at = CASE WHEN $2::text = 'received' THEN now() ELSE received_at END,
			updated_at = now()
		WHERE id = $1 AND status IN ('ordered', 'partial', 'received')
	`, poID, status)
	return err
}

func (r *Postgres) CreatePayableForPO(ctx context.Context, poID uuid.UUID, supplierID uuid.UUID, amount float64, importOrigin string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO accounts_payable (supplier_id, purchase_order_id, description, amount_usd, due_date)
		VALUES ($1, $2,
			CASE $4
				WHEN 'china' THEN 'Exportação CN → DCL PY — ' || (SELECT po_number FROM purchase_orders WHERE id = $2)
				WHEN 'usa' THEN 'Exportação US → DCL PY — ' || (SELECT po_number FROM purchase_orders WHERE id = $2)
				WHEN 'other' THEN 'Exportação → DCL PY — ' || (SELECT po_number FROM purchase_orders WHERE id = $2)
				ELSE 'Compra ' || (SELECT po_number FROM purchase_orders WHERE id = $2)
			END,
			$3, CURRENT_DATE + 30)
	`, supplierID, poID, amount, importOrigin)
	return err
}

func (r *Postgres) POItemCost(ctx context.Context, poID, skuID uuid.UUID) (float64, error) {
	var cost float64
	err := r.pool.QueryRow(ctx, `
		SELECT unit_cost_usd FROM purchase_order_items WHERE purchase_order_id = $1 AND sku_id = $2
	`, poID, skuID).Scan(&cost)
	return cost, err
}

func (r *Postgres) GetPOForReceive(ctx context.Context, id uuid.UUID) (*domain.PurchaseOrder, error) {
	po, err := r.GetPurchaseOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	if po.Status != "ordered" && po.Status != "partial" {
		return nil, domain.ErrInvalidState
	}
	return po, nil
}

func (r *Postgres) Now() time.Time {
	return time.Now().UTC()
}
