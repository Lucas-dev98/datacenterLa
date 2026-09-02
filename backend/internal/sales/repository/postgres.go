package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/datacenterla/platform/internal/sales/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

// --- Customers ---

func (r *Postgres) CreateCustomer(ctx context.Context, in domain.CreateCustomerInput) (*domain.Customer, error) {
	customerType := strings.ToLower(strings.TrimSpace(in.Type))
	if customerType == "" {
		customerType = "b2b"
	}
	var c domain.Customer
	err := r.pool.QueryRow(ctx, `
		INSERT INTO customers (type, name, email, phone, document_id, residency, nationality, document_type, credit_limit_usd, payment_terms_days)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, type, name, email, phone, document_id, residency, nationality, document_type, document_scan_path,
		          credit_limit_usd, payment_terms_days, is_active, created_at
	`, customerType, strings.TrimSpace(in.Name), in.Email, in.Phone, in.DocumentID,
		in.Residency, in.Nationality, in.DocumentType, in.CreditLimitUSD, in.PaymentTermsDays,
	).Scan(&c.ID, &c.Type, &c.Name, &c.Email, &c.Phone, &c.DocumentID,
		&c.Residency, &c.Nationality, &c.DocumentType, &c.DocumentScanPath,
		&c.CreditLimitUSD, &c.PaymentTermsDays, &c.IsActive, &c.CreatedAt)
	if isUniqueViolation(err) {
		return nil, domain.ErrInvalidInput
	}
	c.HasDocumentScan = c.DocumentScanPath != nil && strings.TrimSpace(*c.DocumentScanPath) != ""
	return &c, err
}

func (r *Postgres) GetCustomerByEmail(ctx context.Context, email string) (*domain.Customer, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, domain.ErrNotFound
	}
	return scanCustomer(r.pool.QueryRow(ctx, customerSelect+` WHERE LOWER(COALESCE(email,'')) = $1 LIMIT 1`, email))
}

func (r *Postgres) GetCustomer(ctx context.Context, id uuid.UUID) (*domain.Customer, error) {
	return scanCustomer(r.pool.QueryRow(ctx, customerSelect+" WHERE id = $1", id))
}

func (r *Postgres) ListCustomers(ctx context.Context, activeOnly bool, limit, offset int) ([]domain.Customer, int, error) {
	where := ""
	if activeOnly {
		where = " WHERE is_active = true"
	}
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers`+where).Scan(&total); err != nil {
		return nil, 0, err
	}
	if offset < 0 {
		offset = 0
	}
	q := customerSelect + where + " ORDER BY name"
	args := []any{}
	if limit > 0 {
		if limit > 100 {
			limit = 100
		}
		q += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
		args = append(args, limit, offset)
	}
	var rows pgx.Rows
	var err error
	if len(args) > 0 {
		rows, err = r.pool.Query(ctx, q, args...)
	} else {
		rows, err = r.pool.Query(ctx, q)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanCustomers(rows)
	return items, total, err
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func appendOrderSearchArgs(query string, args *[]any) (likeIdx, digitsIdx, digitLikeIdx, unitCodeIdx int) {
	like := "%" + query + "%"
	digits := digitsOnly(query)
	digitLike := "%" + digits + "%"
	unitCode := strings.ToUpper(strings.TrimSpace(query))
	*args = append(*args, like, digits, digitLike, unitCode)
	n := len(*args)
	return n - 3, n - 2, n - 1, n
}

func orderSearchWhere(orderAlias, customerAlias string, likeIdx, digitsIdx, digitLikeIdx, unitCodeIdx int) string {
	return fmt.Sprintf(`(
		%sorder_number ILIKE $%d
		OR %sname ILIKE $%d
		OR COALESCE(%sbuyer_name,'') ILIKE $%d
		OR COALESCE(%sdocument_id,'') ILIKE $%d
		OR COALESCE(%sbuyer_document_id,'') ILIKE $%d
		OR ($%d <> '' AND regexp_replace(COALESCE(%sdocument_id,''), '[^0-9A-Za-z]', '', 'g') ILIKE $%d)
		OR ($%d <> '' AND regexp_replace(COALESCE(%sbuyer_document_id,''), '[^0-9A-Za-z]', '', 'g') ILIKE $%d)
		OR EXISTS (
			SELECT 1 FROM inventory_units u
			WHERE u.order_id = %sid
			  AND (u.public_code ILIKE $%d OR ($%d <> '' AND u.public_code = $%d))
		)
	)`,
		orderAlias, likeIdx, customerAlias, likeIdx,
		orderAlias, likeIdx,
		customerAlias, likeIdx,
		orderAlias, likeIdx,
		digitsIdx, customerAlias, digitLikeIdx,
		digitsIdx, orderAlias, digitLikeIdx,
		orderAlias, likeIdx, unitCodeIdx, unitCodeIdx,
	)
}

func shiftSQLPlaceholders(sql string, offset int) string {
	if offset == 0 {
		return sql
	}
	re := regexp.MustCompile(`\$(\d+)`)
	return re.ReplaceAllStringFunc(sql, func(m string) string {
		n, _ := strconv.Atoi(m[1:])
		return fmt.Sprintf("$%d", n+offset)
	})
}

func (r *Postgres) SearchCustomers(ctx context.Context, query string, limit, offset int) ([]domain.Customer, int, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []domain.Customer{}, 0, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}
	like := "%" + query + "%"
	digits := digitsOnly(query)
	digitLike := "%" + digits + "%"
	searchWhere := `
		WHERE is_active = true
		  AND (
		    name ILIKE $1
		    OR COALESCE(document_id,'') ILIKE $1
		    OR COALESCE(phone,'') ILIKE $1
		    OR ($2 <> '' AND regexp_replace(COALESCE(document_id,''), '[^0-9A-Za-z]', '', 'g') ILIKE $3)
		  )`
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers`+searchWhere, like, digits, digitLike).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.pool.Query(ctx, customerSelect+searchWhere+`
		ORDER BY
		  CASE
		    WHEN $2 <> '' AND regexp_replace(COALESCE(document_id,''), '[^0-9A-Za-z]', '', 'g') = $2 THEN 0
		    WHEN COALESCE(document_id,'') ILIKE $4 THEN 1
		    ELSE 2
		  END,
		  name
		LIMIT $5 OFFSET $6
	`, like, digits, digitLike, query+"%", limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanCustomers(rows)
	return items, total, err
}

func (r *Postgres) SetCustomerDocumentScan(ctx context.Context, id uuid.UUID, path string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE customers SET document_scan_path = $2, updated_at = now() WHERE id = $1`, id, path)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetOrderBuyer(ctx context.Context, orderID uuid.UUID, c *domain.Customer) error {
	if c == nil {
		return nil
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE orders SET
			buyer_name = $2,
			buyer_residency = $3,
			buyer_nationality = $4,
			buyer_document_type = $5,
			buyer_document_id = $6,
			updated_at = now()
		WHERE id = $1
	`, orderID, c.Name, c.Residency, c.Nationality, c.DocumentType, c.DocumentID)
	return err
}

func (r *Postgres) SetOrderBuyerSnapshot(ctx context.Context, orderID uuid.UUID, snap *domain.OrderBuyer) error {
	if snap == nil {
		return nil
	}
	name := ""
	if snap.Name != nil {
		name = *snap.Name
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE orders SET
			buyer_name = NULLIF($2, ''),
			buyer_residency = $3,
			buyer_nationality = $4,
			buyer_document_type = $5,
			buyer_document_id = $6,
			updated_at = now()
		WHERE id = $1
	`, orderID, name, snap.Residency, snap.Nationality, snap.DocumentType, snap.DocumentID)
	return err
}

// --- Quotes ---

func (r *Postgres) CreateQuote(ctx context.Context, in domain.CreateQuoteInput) (*domain.Quote, error) {
	channel := strings.ToLower(strings.TrimSpace(in.Channel))
	if channel == "" {
		channel = "erp"
	}
	var q domain.Quote
	err := r.pool.QueryRow(ctx, `
		INSERT INTO quotes (quote_number, customer_id, seller_id, channel, discount_pct, notes)
		VALUES (generate_quote_number(), $1, $2, $3, $4, $5)
		RETURNING id, quote_number, customer_id, seller_id, status, channel, valid_until,
		          discount_pct, notes, created_at
	`, in.CustomerID, in.SellerID, channel, in.DiscountPct, in.Notes,
	).Scan(&q.ID, &q.QuoteNumber, &q.CustomerID, &q.SellerID, &q.Status, &q.Channel,
		&q.ValidUntil, &q.DiscountPct, &q.Notes, &q.CreatedAt)
	return &q, err
}

func (r *Postgres) GetQuote(ctx context.Context, id uuid.UUID) (*domain.Quote, error) {
	q, err := scanQuote(r.pool.QueryRow(ctx, quoteSelect+" WHERE id = $1", id))
	if err != nil {
		return nil, err
	}
	items, err := r.listQuoteItems(ctx, id)
	if err != nil {
		return nil, err
	}
	q.Items = items
	q.TotalUSD = quoteTotal(items, q.DiscountPct)
	return q, nil
}

func (r *Postgres) ListQuotes(ctx context.Context, limit, offset int, status string) ([]domain.QuoteListItem, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	where := ""
	countArgs := []any{}
	listArgs := []any{limit, offset}
	if status != "" {
		where = " WHERE q.status = $1"
		countArgs = append(countArgs, status)
		listArgs = append(listArgs, status)
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM quotes q`+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	statusFilter := ""
	if status != "" {
		if len(listArgs) == 3 {
			statusFilter = " WHERE q.status = $3"
		}
	}

	q := `
		SELECT q.id, q.quote_number, q.customer_id, c.name, q.status, q.channel,
		       COALESCE(SUM(qi.line_total_usd), 0) * (1 - q.discount_pct / 100.0) AS total_usd,
		       q.created_at
		FROM quotes q
		JOIN customers c ON c.id = q.customer_id
		LEFT JOIN quote_items qi ON qi.quote_id = q.id
	` + statusFilter + `
		GROUP BY q.id, q.quote_number, q.customer_id, c.name, q.status, q.channel, q.discount_pct, q.created_at
		ORDER BY q.created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.QuoteListItem
	for rows.Next() {
		var item domain.QuoteListItem
		if err := rows.Scan(&item.ID, &item.QuoteNumber, &item.CustomerID, &item.CustomerName,
			&item.Status, &item.Channel, &item.TotalUSD, &item.CreatedAt); err != nil {
			return nil, 0, err
		}
		item.TotalUSD = roundUSD(item.TotalUSD)
		out = append(out, item)
	}
	return out, total, rows.Err()
}

func (r *Postgres) AddQuoteItems(ctx context.Context, quoteID uuid.UUID, items []domain.QuoteItem) error {
	if len(items) == 0 {
		return nil
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		_, err := tx.Exec(ctx, `
			INSERT INTO quote_items (quote_id, sku_id, quantity, unit_price_usd, discount_pct, line_total_usd)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, quoteID, item.SKUID, item.Quantity, item.UnitPriceUSD, item.DiscountPct, item.LineTotalUSD)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Postgres) UpdateQuoteStatus(ctx context.Context, id uuid.UUID, status string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE quotes SET status = $2::quote_status, updated_at = now(),
			sent_at = CASE WHEN $2::text = 'sent' THEN now() ELSE sent_at END
		WHERE id = $1
	`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetQuoteValidUntil(ctx context.Context, id uuid.UUID, until time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE quotes SET valid_until = $2, updated_at = now() WHERE id = $1
	`, id, until)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) MarkQuoteConverted(ctx context.Context, quoteID, orderID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE quotes SET status = 'converted', converted_order_id = $2, updated_at = now()
		WHERE id = $1
	`, quoteID, orderID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// --- Orders ---

func (r *Postgres) CreateOrder(ctx context.Context, in domain.CreateOrderInput) (*domain.Order, error) {
	channel := strings.ToLower(strings.TrimSpace(in.Channel))
	if channel == "" {
		channel = "erp"
	}
	var o domain.Order
	err := r.pool.QueryRow(ctx, `
		INSERT INTO orders (order_number, customer_id, quote_id, seller_id, channel, warehouse_id, discount_pct)
		VALUES (generate_order_number(), $1, $2, $3, $4, $5, $6)
		RETURNING id, order_number, customer_id, quote_id, seller_id, channel, status, warehouse_id,
		          discount_pct, subtotal_usd, total_usd, confirmed_at, paid_at, created_at
	`, in.CustomerID, in.QuoteID, in.SellerID, channel, in.WarehouseID, in.DiscountPct,
	).Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.QuoteID, &o.SellerID, &o.Channel, &o.Status,
		&o.WarehouseID, &o.DiscountPct, &o.SubtotalUSD, &o.TotalUSD, &o.ConfirmedAt, &o.PaidAt, &o.CreatedAt)
	return &o, err
}

func (r *Postgres) GetOrder(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	o, err := scanOrder(r.pool.QueryRow(ctx, orderSelect+" WHERE id = $1", id))
	if err != nil {
		return nil, err
	}
	items, err := r.listOrderItems(ctx, id)
	if err != nil {
		return nil, err
	}
	o.Items = items
	if o.Status == "shipped" || o.Status == "delivered" {
		photos, err := r.listOrderShipPhotos(ctx, id)
		if err != nil {
			return nil, err
		}
		o.ShipPhotos = photos
	}
	return o, nil
}

func (r *Postgres) ListOrders(ctx context.Context, limit, offset int, status, channel, query string) ([]domain.OrderListItem, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	query = strings.TrimSpace(query)

	var conditions []string
	var filterArgs []any
	var searchLikeIdx, searchUnitIdx int
	if status != "" {
		filterArgs = append(filterArgs, status)
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", len(filterArgs)))
	}
	if channel != "" {
		filterArgs = append(filterArgs, channel)
		conditions = append(conditions, fmt.Sprintf("o.channel = $%d::sales_channel", len(filterArgs)))
	}
	if query != "" {
		var digitsIdx, digitLikeIdx int
		searchLikeIdx, digitsIdx, digitLikeIdx, searchUnitIdx = appendOrderSearchArgs(query, &filterArgs)
		conditions = append(conditions, orderSearchWhere("o.", "c.", searchLikeIdx, digitsIdx, digitLikeIdx, searchUnitIdx))
	}
	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id`+where, filterArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listArgs := append([]any{limit, offset}, filterArgs...)
	const filterOffset = 2
	filterSQL := ""
	if len(conditions) > 0 {
		filterSQL = " WHERE " + shiftSQLPlaceholders(strings.Join(conditions, " AND "), filterOffset)
	}

	unitMatchSelect := "NULL::text, NULL::uuid"
	if query != "" {
		likeIdx := filterOffset + searchLikeIdx
		unitCodeIdx := filterOffset + searchUnitIdx
		unitMatchSelect = fmt.Sprintf(`(
			SELECT u.public_code FROM inventory_units u
			WHERE u.order_id = o.id
			  AND (u.public_code ILIKE $%d OR ($%d <> '' AND u.public_code = $%d))
			LIMIT 1
		), (
			SELECT u.order_item_id FROM inventory_units u
			WHERE u.order_id = o.id
			  AND (u.public_code ILIKE $%d OR ($%d <> '' AND u.public_code = $%d))
			LIMIT 1
		)`, likeIdx, unitCodeIdx, unitCodeIdx, likeIdx, unitCodeIdx, unitCodeIdx)
	}

	q := fmt.Sprintf(`
		SELECT o.id, o.order_number, o.customer_id, c.name, o.status, o.channel, o.total_usd, o.quote_id, o.created_at,
		       %s
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
	`, unitMatchSelect) + filterSQL + `
		ORDER BY o.created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.OrderListItem
	for rows.Next() {
		var item domain.OrderListItem
		var matchedUnit *string
		var matchedItemID *uuid.UUID
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerID, &item.CustomerName,
			&item.Status, &item.Channel, &item.TotalUSD, &item.QuoteID, &item.CreatedAt,
			&matchedUnit, &matchedItemID); err != nil {
			return nil, 0, err
		}
		item.MatchedUnitCode = matchedUnit
		item.MatchedOrderItemID = matchedItemID
		out = append(out, item)
	}
	return out, total, rows.Err()
}

func (r *Postgres) AddOrderItems(ctx context.Context, orderID uuid.UUID, items []domain.OrderItem) error {
	if len(items) == 0 {
		return nil
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		var id uuid.UUID
		err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, sku_id, quantity, unit_price_usd, discount_pct, line_total_usd)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, orderID, item.SKUID, item.Quantity, item.UnitPriceUSD, item.DiscountPct, item.LineTotalUSD,
		).Scan(&id)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Postgres) UpdateOrderStatus(ctx context.Context, id uuid.UUID, status string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET status = $2, updated_at = now() WHERE id = $1
	`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetOrderTotals(ctx context.Context, id uuid.UUID, subtotal, total float64) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET subtotal_usd = $2, total_usd = $3, updated_at = now() WHERE id = $1
	`, id, subtotal, total)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetOrderConfirmed(ctx context.Context, id uuid.UUID, at time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET confirmed_at = $2, updated_at = now() WHERE id = $1
	`, id, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetOrderPaid(ctx context.Context, id uuid.UUID, at time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET paid_at = $2, updated_at = now() WHERE id = $1
	`, id, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SetOrderShipped(ctx context.Context, id uuid.UUID, at time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET shipped_at = $2, updated_at = now() WHERE id = $1
	`, id, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) ListUnpaidEcommerceOrderIDs(ctx context.Context, customerID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id FROM orders
		WHERE customer_id = $1
		  AND channel = 'ecommerce'
		  AND status IN ('draft', 'confirmed')
		ORDER BY created_at
	`, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *Postgres) SetOrderCancelled(ctx context.Context, id uuid.UUID, at time.Time) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE orders SET status = 'cancelled', cancelled_at = $2, updated_at = now() WHERE id = $1
	`, id, at)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) CancelReceivable(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE accounts_receivable
		SET status = 'cancelled', updated_at = now()
		WHERE id = $1 AND status IN ('open', 'partial')
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// --- Payments ---

func (r *Postgres) InsertPayment(ctx context.Context, orderID uuid.UUID, in domain.PaymentInput, recordedBy *uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO payments (order_id, amount_usd, method, reference, recorded_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, orderID, in.AmountUSD, in.Method, in.Reference, recordedBy).Scan(&id)
	return id, err
}

func (r *Postgres) CompletePayment(ctx context.Context, paymentID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE payments SET status = 'completed', completed_at = now() WHERE id = $1
	`, paymentID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) SumCompletedPayments(ctx context.Context, orderID uuid.UUID) (float64, error) {
	var total float64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_usd), 0) FROM payments
		WHERE order_id = $1 AND status = 'completed'
	`, orderID).Scan(&total)
	return total, err
}

func (r *Postgres) ListPaymentsByOrderID(ctx context.Context, orderID uuid.UUID) ([]domain.PaymentRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, amount_usd, method, reference, status
		FROM payments
		WHERE order_id = $1
		ORDER BY created_at
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PaymentRecord
	for rows.Next() {
		var p domain.PaymentRecord
		if err := rows.Scan(&p.ID, &p.AmountUSD, &p.Method, &p.Reference, &p.Status); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) GetSellerName(ctx context.Context, userID uuid.UUID) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1`, userID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return name, err
}

// --- Receivables ---

func (r *Postgres) CreateReceivable(ctx context.Context, orderID, customerID uuid.UUID, amount float64, dueDate string) (*domain.Receivable, error) {
	var rcv domain.Receivable
	err := r.pool.QueryRow(ctx, `
		INSERT INTO accounts_receivable (order_id, customer_id, amount_usd, due_date)
		VALUES ($1, $2, $3, $4::date)
		RETURNING id, order_id, customer_id, amount_usd, paid_usd, due_date::text, status
	`, orderID, customerID, amount, dueDate,
	).Scan(&rcv.ID, &rcv.OrderID, &rcv.CustomerID, &rcv.AmountUSD, &rcv.PaidUSD, &rcv.DueDate, &rcv.Status)
	return &rcv, err
}

func (r *Postgres) UpdateReceivablePaid(ctx context.Context, id uuid.UUID, paidUSD float64, status string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE accounts_receivable SET paid_usd = $2, status = $3, updated_at = now() WHERE id = $1
	`, id, paidUSD, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) GetReceivable(ctx context.Context, id uuid.UUID) (*domain.ReceivableListItem, error) {
	var item domain.ReceivableListItem
	err := r.pool.QueryRow(ctx, `
		SELECT r.id, r.order_id, r.customer_id, r.amount_usd, r.paid_usd, r.due_date::text, r.status,
		       c.name, o.order_number
		FROM accounts_receivable r
		JOIN customers c ON c.id = r.customer_id
		JOIN orders o ON o.id = r.order_id
		WHERE r.id = $1
	`, id).Scan(&item.ID, &item.OrderID, &item.CustomerID, &item.AmountUSD, &item.PaidUSD,
		&item.DueDate, &item.Status, &item.CustomerName, &item.OrderNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &item, err
}

func (r *Postgres) GetReceivableByOrderID(ctx context.Context, orderID uuid.UUID) (*domain.Receivable, error) {
	var rcv domain.Receivable
	err := r.pool.QueryRow(ctx, `
		SELECT id, order_id, customer_id, amount_usd, paid_usd, due_date::text, status
		FROM accounts_receivable
		WHERE order_id = $1 AND status IN ('open', 'partial')
		ORDER BY created_at DESC LIMIT 1
	`, orderID).Scan(&rcv.ID, &rcv.OrderID, &rcv.CustomerID, &rcv.AmountUSD, &rcv.PaidUSD, &rcv.DueDate, &rcv.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &rcv, err
}

func (r *Postgres) ApplyReceivablePayment(ctx context.Context, id uuid.UUID, amountUSD float64) (*domain.Receivable, error) {
	var rcv domain.Receivable
	err := r.pool.QueryRow(ctx, `
		UPDATE accounts_receivable
		SET paid_usd = paid_usd + $2,
		    status = CASE
		        WHEN paid_usd + $2 >= amount_usd THEN 'paid'::receivable_status
		        WHEN paid_usd + $2 > 0 THEN 'partial'::receivable_status
		        ELSE status
		    END,
		    updated_at = now()
		WHERE id = $1 AND status IN ('open', 'partial')
		RETURNING id, order_id, customer_id, amount_usd, paid_usd, due_date::text, status
	`, id, amountUSD).Scan(&rcv.ID, &rcv.OrderID, &rcv.CustomerID, &rcv.AmountUSD, &rcv.PaidUSD, &rcv.DueDate, &rcv.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &rcv, err
}

func (r *Postgres) ListReceivables(ctx context.Context, limit, offset int, status string) ([]domain.ReceivableListItem, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	where := ""
	countArgs := []any{}
	listArgs := []any{limit, offset}
	if status != "" {
		where = " WHERE r.status = $1"
		countArgs = append(countArgs, status)
		listArgs = append(listArgs, status)
	}

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM accounts_receivable r`+where, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	statusFilter := ""
	if status != "" {
		statusFilter = " WHERE r.status = $3"
	}

	q := `
		SELECT r.id, r.order_id, r.customer_id, r.amount_usd, r.paid_usd, r.due_date::text, r.status,
		       c.name, o.order_number
		FROM accounts_receivable r
		JOIN customers c ON c.id = r.customer_id
		JOIN orders o ON o.id = r.order_id
	` + statusFilter + `
		ORDER BY r.due_date ASC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.ReceivableListItem
	for rows.Next() {
		var item domain.ReceivableListItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.CustomerID, &item.AmountUSD, &item.PaidUSD,
			&item.DueDate, &item.Status, &item.CustomerName, &item.OrderNumber); err != nil {
			return nil, 0, err
		}
		out = append(out, item)
	}
	return out, total, rows.Err()
}

func (r *Postgres) GetDashboardStats(ctx context.Context) (*domain.DashboardStats, error) {
	var s domain.DashboardStats
	err := r.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM orders WHERE status = 'draft'),
			(SELECT COUNT(*) FROM orders WHERE status IN ('confirmed', 'paid', 'picking')),
			(SELECT COUNT(*) FROM quotes WHERE status IN ('sent', 'viewed', 'negotiating', 'approved')),
			(SELECT COUNT(*) FROM accounts_receivable WHERE status IN ('open', 'partial')),
			(SELECT COALESCE(SUM(amount_usd - paid_usd), 0) FROM accounts_receivable WHERE status IN ('open', 'partial')),
			(SELECT COUNT(*)::int FROM (
				SELECT s.id
				FROM skus s
				LEFT JOIN stock_balances b ON b.sku_id = s.id
				WHERE s.is_active = true
				GROUP BY s.id
				HAVING COALESCE(SUM(b.qty_available), 0) <= 2
			) low_stock),
			(SELECT COUNT(*) FROM skus WHERE is_active = true),
			(SELECT COALESCE(SUM(o.total_usd), 0) FROM orders o
			 WHERE o.status IN ('shipped', 'delivered')
			   AND o.shipped_at >= date_trunc('month', CURRENT_TIMESTAMP)
			   AND o.shipped_at < date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month'),
			(SELECT COUNT(*) FROM orders o
			 WHERE o.status IN ('shipped', 'delivered')
			   AND o.shipped_at >= date_trunc('month', CURRENT_TIMESTAMP)
			   AND o.shipped_at < date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month')
	`).Scan(&s.OrdersDraft, &s.OrdersPendingShip, &s.QuotesOpen,
		&s.ReceivablesOpen, &s.ReceivablesOutstandingUSD, &s.SkusLowStock, &s.ActiveSKUs,
		&s.SalesMonthUSD, &s.SalesMonthOrders)
	if err != nil {
		return nil, err
	}
	s.ReceivablesOutstandingUSD = roundUSD(s.ReceivablesOutstandingUSD)
	s.SalesMonthUSD = roundUSD(s.SalesMonthUSD)
	return &s, nil
}

func (r *Postgres) ListPendingOrders(ctx context.Context, limit int) ([]domain.PendingOrderSummary, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := r.pool.Query(ctx, `
		SELECT o.id, o.order_number, c.name, o.status, o.total_usd, o.created_at
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE o.status IN ('confirmed', 'paid', 'picking')
		ORDER BY
			CASE o.status WHEN 'picking' THEN 1 WHEN 'paid' THEN 2 WHEN 'confirmed' THEN 3 END,
			o.created_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PendingOrderSummary
	for rows.Next() {
		var item domain.PendingOrderSummary
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.Status, &item.TotalUSD, &item.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Postgres) ListLowStockSKUs(ctx context.Context, threshold, limit int) ([]domain.LowStockSKU, error) {
	if threshold <= 0 {
		threshold = 2
	}
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.pool.Query(ctx, `
		SELECT s.code, s.name, COALESCE(SUM(b.qty_available), 0)::INT
		FROM skus s
		LEFT JOIN stock_balances b ON b.sku_id = s.id
		WHERE s.is_active = true
		GROUP BY s.id, s.code, s.name
		HAVING COALESCE(SUM(b.qty_available), 0) <= $1
		ORDER BY COALESCE(SUM(b.qty_available), 0) ASC, s.code
		LIMIT $2
	`, threshold, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.LowStockSKU
	for rows.Next() {
		var item domain.LowStockSKU
		if err := rows.Scan(&item.SKUCode, &item.Name, &item.QtyAvailable); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

// --- Cart ---

func (r *Postgres) GetOrCreateCart(ctx context.Context, sessionID string) (*domain.Cart, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, domain.ErrInvalidInput
	}
	expires := time.Now().UTC().Add(24 * time.Hour)
	var c domain.Cart
	err := r.pool.QueryRow(ctx, `
		INSERT INTO ecommerce_carts (session_id, expires_at)
		VALUES ($1, $2)
		ON CONFLICT (session_id) DO UPDATE SET
			expires_at = GREATEST(ecommerce_carts.expires_at, EXCLUDED.expires_at),
			updated_at = now()
		RETURNING id, session_id, expires_at
	`, sessionID, expires).Scan(&c.ID, &c.SessionID, &c.ExpiresAt)
	return &c, err
}

func (r *Postgres) AddCartItem(ctx context.Context, cartID, skuID uuid.UUID, qty int) error {
	if qty <= 0 {
		return domain.ErrInvalidInput
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO ecommerce_cart_items (cart_id, sku_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (cart_id, sku_id) DO UPDATE SET quantity = ecommerce_cart_items.quantity + EXCLUDED.quantity
	`, cartID, skuID, qty)
	return err
}

func (r *Postgres) SetCartItemQuantity(ctx context.Context, cartID, skuID uuid.UUID, qty int) error {
	if qty < 0 {
		return domain.ErrInvalidInput
	}
	if qty == 0 {
		_, err := r.pool.Exec(ctx, `
			DELETE FROM ecommerce_cart_items WHERE cart_id = $1 AND sku_id = $2
		`, cartID, skuID)
		return err
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE ecommerce_cart_items SET quantity = $3 WHERE cart_id = $1 AND sku_id = $2
	`, cartID, skuID, qty)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		_, err = r.pool.Exec(ctx, `
			INSERT INTO ecommerce_cart_items (cart_id, sku_id, quantity) VALUES ($1, $2, $3)
		`, cartID, skuID, qty)
		return err
	}
	return nil
}

func (r *Postgres) GetCartWithItems(ctx context.Context, sessionID string) (*domain.Cart, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, domain.ErrInvalidInput
	}
	var c domain.Cart
	err := r.pool.QueryRow(ctx, `
		SELECT id, session_id, expires_at FROM ecommerce_carts WHERE session_id = $1
	`, sessionID).Scan(&c.ID, &c.SessionID, &c.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT ci.sku_id, s.code, s.name, ci.quantity
		FROM ecommerce_cart_items ci
		JOIN skus s ON s.id = ci.sku_id
		WHERE ci.cart_id = $1
		ORDER BY s.name
	`, c.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.CartItem
		if err := rows.Scan(&item.SKUID, &item.SKUCode, &item.Name, &item.Quantity); err != nil {
			return nil, err
		}
		c.Items = append(c.Items, item)
	}
	if c.Items == nil {
		c.Items = []domain.CartItem{}
	}
	return &c, rows.Err()
}

func (r *Postgres) ClearCart(ctx context.Context, cartID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM ecommerce_cart_items WHERE cart_id = $1`, cartID)
	return err
}

// --- Catalog ---

func (r *Postgres) ListEcommerceCatalog(ctx context.Context, warehouseID uuid.UUID, categoryID *uuid.UUID, search string, skuCodes []string) ([]domain.CatalogProduct, error) {
	q := `
		SELECT s.id, s.code, s.name, s.description, p.category_id, c.name, s.image_url,
		       COALESCE(b.qty_available, 0)
		FROM skus s
		JOIN products p ON p.id = s.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN categories parent ON parent.id = c.parent_id
		LEFT JOIN stock_balances b ON b.sku_id = s.id AND b.warehouse_id = $1
		WHERE s.publish_ecommerce = true AND s.is_active = true
	`
	args := []any{warehouseID}
	n := 2
	if categoryID != nil {
		q += fmt.Sprintf(` AND p.category_id = $%d`, n)
		args = append(args, *categoryID)
		n++
	}
	if len(skuCodes) > 0 {
		q += fmt.Sprintf(` AND s.code = ANY($%d)`, n)
		args = append(args, skuCodes)
		n++
	}
	if strings.TrimSpace(search) != "" {
		frag, nextArgs, nextN := catalogSearchSQL(search, args, n)
		q += frag
		args, n = nextArgs, nextN
		folded := catalogFold(search)
		compact := catalogCompact(search)
		padded := catalogPadSKU(strings.TrimSpace(search))
		args = append(args, strings.TrimSpace(search), padded, folded+"%", "%"+compact+"%")
		codeExact, codePad, namePrefix, compactContains := n, n+1, n+2, n+3
		q += fmt.Sprintf(` ORDER BY
			CASE
				WHEN btrim(s.code::text) IN ($%d, $%d) THEN 0
				WHEN %s LIKE $%d THEN 1
				WHEN %s LIKE $%d THEN 2
				ELSE 3
			END,
			s.name`, codeExact, codePad, catalogFoldedSQL("btrim(s.code::text)"), namePrefix, catalogCompactSQL("s.name"), compactContains)
	} else {
		q += ` ORDER BY s.name`
	}

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CatalogProduct
	for rows.Next() {
		var p domain.CatalogProduct
		if err := rows.Scan(&p.SKUID, &p.SKUCode, &p.Name, &p.Description, &p.CategoryID, &p.CategoryName, &p.ImageURL, &p.Available); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) ListEcommerceCategories(ctx context.Context) ([]domain.EcommerceCategory, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.code, c.name, c.parent_id
		FROM categories c
		LEFT JOIN categories p ON p.id = c.parent_id
		WHERE c.is_active = true
		ORDER BY COALESCE(p.name, c.name), c.parent_id NULLS FIRST, c.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.EcommerceCategory
	for rows.Next() {
		var c domain.EcommerceCategory
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.ParentID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Postgres) LookupOrderPublic(ctx context.Context, email, orderNumber string) (*domain.PublicOrderSummary, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	orderNumber = strings.TrimSpace(orderNumber)
	var o domain.PublicOrderSummary
	err := r.pool.QueryRow(ctx, `
		SELECT o.id, o.order_number, o.status::text, o.total_usd, o.created_at, c.name
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE o.order_number = $1 AND LOWER(COALESCE(c.email,'')) = $2
	`, orderNumber, email).Scan(&o.ID, &o.OrderNumber, &o.Status, &o.TotalUSD, &o.CreatedAt, &o.CustomerName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT COALESCE(s.code, ''), COALESCE(s.name, ''), oi.quantity, oi.unit_price_usd, oi.line_total_usd
		FROM order_items oi
		LEFT JOIN skus s ON s.id = oi.sku_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at
	`, o.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.PublicOrderItem
		if err := rows.Scan(&item.SKUCode, &item.SKUName, &item.Quantity, &item.UnitPriceUSD, &item.LineTotalUSD); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, item)
	}
	return &o, rows.Err()
}

func (r *Postgres) ListPublicOrdersByEmail(ctx context.Context, email string) ([]domain.PublicOrderSummary, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, domain.ErrInvalidInput
	}
	rows, err := r.pool.Query(ctx, `
		SELECT o.id, o.order_number, o.status::text, o.total_usd, o.created_at, c.name
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		WHERE LOWER(COALESCE(c.email,'')) = $1
		  AND o.channel = 'ecommerce'
		  AND o.status NOT IN ('draft', 'cancelled')
		ORDER BY o.created_at DESC
		LIMIT 20
	`, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PublicOrderSummary
	for rows.Next() {
		var o domain.PublicOrderSummary
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.Status, &o.TotalUSD, &o.CreatedAt, &o.CustomerName); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

const customerSelect = `
	SELECT id, type, name, email, phone, document_id, residency, nationality, document_type, document_scan_path,
	       credit_limit_usd, payment_terms_days, is_active, created_at
	FROM customers
`

const quoteSelect = `
	SELECT id, quote_number, customer_id, seller_id, status, channel, valid_until,
	       discount_pct, notes, created_at
	FROM quotes
`

const orderSelect = `
	SELECT id, order_number, customer_id, quote_id, seller_id, channel, status, warehouse_id,
	       discount_pct, subtotal_usd, total_usd, confirmed_at, paid_at, created_at,
	       buyer_name, buyer_residency, buyer_nationality, buyer_document_type, buyer_document_id
	FROM orders
`

func (r *Postgres) listQuoteItems(ctx context.Context, quoteID uuid.UUID) ([]domain.QuoteItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, sku_id, quantity, unit_price_usd, discount_pct, line_total_usd
		FROM quote_items WHERE quote_id = $1 ORDER BY created_at
	`, quoteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.QuoteItem
	for rows.Next() {
		var item domain.QuoteItem
		if err := rows.Scan(&item.ID, &item.SKUID, &item.Quantity, &item.UnitPriceUSD,
			&item.DiscountPct, &item.LineTotalUSD); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Postgres) listOrderItems(ctx context.Context, orderID uuid.UUID) ([]domain.OrderItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT oi.id, oi.sku_id, s.code, s.name, oi.quantity, oi.unit_price_usd, oi.discount_pct, oi.line_total_usd
		FROM order_items oi
		JOIN skus s ON s.id = oi.sku_id
		WHERE oi.order_id = $1 ORDER BY oi.created_at
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.OrderItem
	for rows.Next() {
		var item domain.OrderItem
		if err := rows.Scan(&item.ID, &item.SKUID, &item.SKUCode, &item.SKUName, &item.Quantity, &item.UnitPriceUSD,
			&item.DiscountPct, &item.LineTotalUSD); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Postgres) AddOrderShipPhoto(ctx context.Context, orderID, orderItemID, skuID uuid.UUID, path string, createdBy uuid.UUID) (*domain.OrderShipPhoto, error) {
	var p domain.OrderShipPhoto
	err := r.pool.QueryRow(ctx, `
		INSERT INTO order_ship_photos (order_id, order_item_id, sku_id, file_path, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, order_id, order_item_id, sku_id, file_path, created_at
	`, orderID, orderItemID, skuID, path, createdBy).Scan(
		&p.ID, &p.OrderID, &p.OrderItemID, &p.SKUID, &p.FilePath, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Postgres) listOrderShipPhotos(ctx context.Context, orderID uuid.UUID) ([]domain.OrderShipPhoto, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT osp.id, osp.order_id, osp.order_item_id, osp.sku_id, s.code, s.name, osp.file_path, osp.created_at
		FROM order_ship_photos osp
		JOIN skus s ON s.id = osp.sku_id
		WHERE osp.order_id = $1
		ORDER BY osp.created_at
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.OrderShipPhoto
	for rows.Next() {
		var p domain.OrderShipPhoto
		if err := rows.Scan(&p.ID, &p.OrderID, &p.OrderItemID, &p.SKUID, &p.SKUCode, &p.SKUName, &p.FilePath, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Postgres) GetOrderShipPhoto(ctx context.Context, orderID, photoID uuid.UUID) (*domain.OrderShipPhoto, error) {
	var p domain.OrderShipPhoto
	err := r.pool.QueryRow(ctx, `
		SELECT osp.id, osp.order_id, osp.order_item_id, osp.sku_id, s.code, s.name, osp.file_path, osp.created_at
		FROM order_ship_photos osp
		JOIN skus s ON s.id = osp.sku_id
		WHERE osp.order_id = $1 AND osp.id = $2
	`, orderID, photoID).Scan(
		&p.ID, &p.OrderID, &p.OrderItemID, &p.SKUID, &p.SKUCode, &p.SKUName, &p.FilePath, &p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

func quoteTotal(items []domain.QuoteItem, headerDiscountPct float64) float64 {
	var subtotal float64
	for _, item := range items {
		subtotal += item.LineTotalUSD
	}
	if headerDiscountPct <= 0 {
		return roundUSD(subtotal)
	}
	return roundUSD(subtotal * (1 - headerDiscountPct/100))
}

func roundUSD(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

func scanCustomer(row pgx.Row) (*domain.Customer, error) {
	var c domain.Customer
	err := row.Scan(&c.ID, &c.Type, &c.Name, &c.Email, &c.Phone, &c.DocumentID,
		&c.Residency, &c.Nationality, &c.DocumentType, &c.DocumentScanPath,
		&c.CreditLimitUSD, &c.PaymentTermsDays, &c.IsActive, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.HasDocumentScan = c.DocumentScanPath != nil && strings.TrimSpace(*c.DocumentScanPath) != ""
	return &c, nil
}

func scanCustomers(rows pgx.Rows) ([]domain.Customer, error) {
	var out []domain.Customer
	for rows.Next() {
		c, err := scanCustomer(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func scanQuote(row pgx.Row) (*domain.Quote, error) {
	var q domain.Quote
	err := row.Scan(&q.ID, &q.QuoteNumber, &q.CustomerID, &q.SellerID, &q.Status, &q.Channel,
		&q.ValidUntil, &q.DiscountPct, &q.Notes, &q.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &q, err
}

func scanOrder(row pgx.Row) (*domain.Order, error) {
	var o domain.Order
	err := row.Scan(&o.ID, &o.OrderNumber, &o.CustomerID, &o.QuoteID, &o.SellerID, &o.Channel, &o.Status,
		&o.WarehouseID, &o.DiscountPct, &o.SubtotalUSD, &o.TotalUSD, &o.ConfirmedAt, &o.PaidAt, &o.CreatedAt,
		&o.BuyerName, &o.BuyerResidency, &o.BuyerNationality, &o.BuyerDocumentType, &o.BuyerDocumentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &o, err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
