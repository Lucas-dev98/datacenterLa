package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/datacenterla/platform/internal/pim/domain"
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

func (r *Postgres) InsertOutboxEvent(ctx context.Context, eventType string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)`, eventType, data)
	return err
}

// --- Categories ---

func (r *Postgres) CreateCategory(ctx context.Context, in domain.CreateCategoryInput) (*domain.Category, error) {
	var c domain.Category
	err := r.pool.QueryRow(ctx, `
		INSERT INTO categories (code, name, parent_id)
		VALUES ($1, $2, $3)
		RETURNING id, code, name, parent_id, is_active, created_at, updated_at
	`, strings.ToUpper(strings.TrimSpace(in.Code)), strings.TrimSpace(in.Name), in.ParentID,
	).Scan(&c.ID, &c.Code, &c.Name, &c.ParentID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if isUniqueViolation(err) {
		return nil, domain.ErrDuplicate
	}
	return &c, err
}

func (r *Postgres) GetCategory(ctx context.Context, id uuid.UUID) (*domain.Category, error) {
	return scanCategory(r.pool.QueryRow(ctx, categorySelect+" WHERE id = $1", id))
}

func (r *Postgres) ListCategories(ctx context.Context, activeOnly bool) ([]domain.Category, error) {
	q := categorySelect
	if activeOnly {
		q += " WHERE is_active = true"
	}
	q += " ORDER BY name"
	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCategories(rows)
}

func (r *Postgres) UpdateCategory(ctx context.Context, id uuid.UUID, in domain.UpdateCategoryInput) (*domain.Category, error) {
	var c domain.Category
	err := r.pool.QueryRow(ctx, `
		UPDATE categories SET
			name = COALESCE($2, name),
			parent_id = COALESCE($3, parent_id),
			is_active = COALESCE($4, is_active),
			updated_at = now()
		WHERE id = $1
		RETURNING id, code, name, parent_id, is_active, created_at, updated_at
	`, id, in.Name, in.ParentID, in.IsActive,
	).Scan(&c.ID, &c.Code, &c.Name, &c.ParentID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &c, err
}

func (r *Postgres) CreateCategoryAttribute(ctx context.Context, categoryID uuid.UUID, in domain.CreateCategoryAttributeInput) (*domain.CategoryAttribute, error) {
	var a domain.CategoryAttribute
	err := r.pool.QueryRow(ctx, `
		INSERT INTO category_attributes (category_id, code, name, data_type, is_required, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, category_id, code, name, data_type, is_required, sort_order, created_at
	`, categoryID, strings.ToLower(strings.TrimSpace(in.Code)), strings.TrimSpace(in.Name),
		in.DataType, in.IsRequired, in.SortOrder,
	).Scan(&a.ID, &a.CategoryID, &a.Code, &a.Name, &a.DataType, &a.IsRequired, &a.SortOrder, &a.CreatedAt)
	if isUniqueViolation(err) {
		return nil, domain.ErrDuplicate
	}
	return &a, err
}

func (r *Postgres) ListCategoryAttributes(ctx context.Context, categoryID uuid.UUID) ([]domain.CategoryAttribute, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, category_id, code, name, data_type, is_required, sort_order, created_at
		FROM category_attributes WHERE category_id = $1 ORDER BY sort_order, name
	`, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CategoryAttribute
	for rows.Next() {
		var a domain.CategoryAttribute
		if err := rows.Scan(&a.ID, &a.CategoryID, &a.Code, &a.Name, &a.DataType, &a.IsRequired, &a.SortOrder, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// --- Products ---

func (r *Postgres) CreateProduct(ctx context.Context, in domain.CreateProductInput) (*domain.Product, error) {
	var p domain.Product
	err := r.pool.QueryRow(ctx, `
		INSERT INTO products (name, category_id, description, brand, manufacturer, name_es, description_es, generated_description_es)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, category_id, description, generated_description,
		          name_es, description_es, generated_description_es,
		          brand, manufacturer, is_active, created_at, updated_at
	`, strings.TrimSpace(in.Name), in.CategoryID, in.Description, in.Brand, in.Manufacturer,
		in.NameES, in.DescriptionES, in.GeneratedDescriptionES,
	).Scan(&p.ID, &p.Name, &p.CategoryID, &p.Description, &p.GeneratedDescription,
		&p.NameES, &p.DescriptionES, &p.GeneratedDescriptionES,
		&p.Brand, &p.Manufacturer, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	return &p, err
}

func (r *Postgres) GetProduct(ctx context.Context, id uuid.UUID) (*domain.Product, error) {
	return scanProduct(r.pool.QueryRow(ctx, productSelect+" WHERE id = $1", id))
}

func (r *Postgres) ListProducts(ctx context.Context, f domain.ListFilter) ([]domain.Product, int, error) {
	where, args := productFilters(f)
	countQ := "SELECT COUNT(*) FROM products" + where
	var total int
	if err := r.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	q := productSelect + where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanProducts(rows)
	return items, total, err
}

func (r *Postgres) UpdateProduct(ctx context.Context, id uuid.UUID, in domain.UpdateProductInput, generated *string) (*domain.Product, error) {
	var p domain.Product
	err := r.pool.QueryRow(ctx, `
		UPDATE products SET
			name = COALESCE($2, name),
			category_id = COALESCE($3, category_id),
			description = COALESCE($4, description),
			brand = COALESCE($5, brand),
			manufacturer = COALESCE($6, manufacturer),
			is_active = COALESCE($7, is_active),
			generated_description = COALESCE($8, generated_description),
			name_es = COALESCE($9, name_es),
			description_es = COALESCE($10, description_es),
			generated_description_es = COALESCE($11, generated_description_es),
			updated_at = now()
		WHERE id = $1
		RETURNING id, name, category_id, description, generated_description,
		          name_es, description_es, generated_description_es,
		          brand, manufacturer, is_active, created_at, updated_at
	`, id, in.Name, in.CategoryID, in.Description, in.Brand, in.Manufacturer, in.IsActive, generated,
		in.NameES, in.DescriptionES, in.GeneratedDescriptionES,
	).Scan(&p.ID, &p.Name, &p.CategoryID, &p.Description, &p.GeneratedDescription,
		&p.NameES, &p.DescriptionES, &p.GeneratedDescriptionES,
		&p.Brand, &p.Manufacturer, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &p, err
}

func (r *Postgres) DeactivateProduct(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `UPDATE products SET is_active = false, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) UpsertProductAttributes(ctx context.Context, productID uuid.UUID, attrs []domain.AttributeValueInput) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, a := range attrs {
		_, err := tx.Exec(ctx, `
			INSERT INTO product_attribute_values (
				product_id, category_attribute_id, value_text, value_number, value_boolean
			) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (product_id, category_attribute_id) DO UPDATE SET
				value_text = EXCLUDED.value_text,
				value_number = EXCLUDED.value_number,
				value_boolean = EXCLUDED.value_boolean,
				updated_at = now()
		`, productID, a.CategoryAttributeID, a.ValueText, a.ValueNumber, a.ValueBoolean)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Postgres) ListProductAttributes(ctx context.Context, productID uuid.UUID) ([]domain.ProductAttributeValue, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT v.id, v.product_id, v.category_attribute_id, a.code, a.name, a.data_type,
		       v.value_text, v.value_number, v.value_boolean
		FROM product_attribute_values v
		JOIN category_attributes a ON a.id = v.category_attribute_id
		WHERE v.product_id = $1
		ORDER BY a.sort_order, a.name
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ProductAttributeValue
	for rows.Next() {
		var v domain.ProductAttributeValue
		if err := rows.Scan(&v.ID, &v.ProductID, &v.CategoryAttributeID, &v.AttributeCode, &v.AttributeName,
			&v.DataType, &v.ValueText, &v.ValueNumber, &v.ValueBoolean); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// --- SKUs ---

func (r *Postgres) CreateSKU(ctx context.Context, in domain.CreateSKUInput) (*domain.SKU, error) {
	var s domain.SKU
	err := r.pool.QueryRow(ctx, `
		INSERT INTO skus (product_id, code, name, description, publish_compras_paraguai, publish_ecommerce)
		VALUES ($1, generate_sku_code(), $2, $3, $4, $5)
		RETURNING id, product_id, code, name, description, is_active,
		          publish_compras_paraguai, publish_ecommerce, created_at, updated_at
	`, in.ProductID, strings.TrimSpace(in.Name),
		in.Description, in.PublishComprasParaguai, in.PublishEcommerce,
	).Scan(&s.ID, &s.ProductID, &s.Code, &s.Name, &s.Description, &s.IsActive,
		&s.PublishComprasParaguai, &s.PublishEcommerce, &s.CreatedAt, &s.UpdatedAt)
	if isUniqueViolation(err) {
		return nil, domain.ErrDuplicate
	}
	return &s, err
}

func (r *Postgres) GetSKU(ctx context.Context, id uuid.UUID) (*domain.SKU, error) {
	return scanSKU(r.pool.QueryRow(ctx, skuSelect+" WHERE s.id = $1", id))
}

func (r *Postgres) GetSKUByCode(ctx context.Context, code string) (*domain.SKU, error) {
	normalized := strings.TrimSpace(code)
	if len(normalized) < 6 {
		normalized = strings.Repeat("0", 6-len(normalized)) + normalized
	}
	return scanSKU(r.pool.QueryRow(ctx, skuSelect+" WHERE s.code = $1", normalized))
}

func (r *Postgres) ListSKUs(ctx context.Context, f domain.ListFilter) ([]domain.SKU, int, error) {
	where, args := skuFilters(f)
	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM skus s"+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	q := skuSelect + where + fmt.Sprintf(" ORDER BY s.created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanSKUs(rows)
	return items, total, err
}

func (r *Postgres) UpdateSKU(ctx context.Context, id uuid.UUID, in domain.UpdateSKUInput) (*domain.SKU, error) {
	var s domain.SKU
	err := r.pool.QueryRow(ctx, `
		UPDATE skus SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			is_active = COALESCE($4, is_active),
			publish_compras_paraguai = COALESCE($5, publish_compras_paraguai),
			publish_ecommerce = COALESCE($6, publish_ecommerce),
			image_url = COALESCE($7, image_url),
			updated_at = now()
		WHERE id = $1
		RETURNING id, product_id, code, name, description, is_active,
		          publish_compras_paraguai, publish_ecommerce, image_url, created_at, updated_at
	`, id, in.Name, in.Description, in.IsActive, in.PublishComprasParaguai, in.PublishEcommerce, in.ImageURL,
	).Scan(&s.ID, &s.ProductID, &s.Code, &s.Name, &s.Description, &s.IsActive,
		&s.PublishComprasParaguai, &s.PublishEcommerce, &s.ImageURL, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &s, err
}

func (r *Postgres) DeactivateSKU(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `UPDATE skus SET is_active = false, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Postgres) CountSKUInventory(ctx context.Context, skuID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM inventory_units
		WHERE sku_id = $1 AND status NOT IN ('sold', 'written_off')
	`, skuID).Scan(&n)
	return n, err
}

func (r *Postgres) ProductExists(ctx context.Context, id uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}

func (r *Postgres) CategoryExists(ctx context.Context, id uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}

const categorySelect = `SELECT id, code, name, parent_id, is_active, created_at, updated_at FROM categories`

const productSelect = `
	SELECT id, name, category_id, description, generated_description,
	       name_es, description_es, generated_description_es,
	       brand, manufacturer, is_active, created_at, updated_at FROM products
`

const skuSelect = `
	SELECT s.id, s.product_id, s.code, s.name, s.description, s.is_active,
	       s.publish_compras_paraguai, s.publish_ecommerce, s.image_url, s.created_at, s.updated_at
	FROM skus s
`

func productFilters(f domain.ListFilter) (string, []any) {
	var conds []string
	var args []any
	n := 1
	if f.CategoryID != nil {
		conds = append(conds, fmt.Sprintf("category_id = $%d", n))
		args = append(args, *f.CategoryID)
		n++
	}
	if f.ActiveOnly {
		conds = append(conds, "is_active = true")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		conds = append(conds, fmt.Sprintf("name ILIKE $%d", n))
		args = append(args, "%"+q+"%")
	}
	if len(conds) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

func skuFilters(f domain.ListFilter) (string, []any) {
	var conds []string
	var args []any
	n := 1
	if f.ProductID != nil {
		conds = append(conds, fmt.Sprintf("s.product_id = $%d", n))
		args = append(args, *f.ProductID)
		n++
	}
	if f.ActiveOnly {
		conds = append(conds, "s.is_active = true")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		conds = append(conds, fmt.Sprintf("(s.code ILIKE $%d OR s.name ILIKE $%d)", n, n))
		args = append(args, "%"+q+"%")
	}
	if len(conds) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

func scanCategory(row pgx.Row) (*domain.Category, error) {
	var c domain.Category
	err := row.Scan(&c.ID, &c.Code, &c.Name, &c.ParentID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &c, err
}

func scanCategories(rows pgx.Rows) ([]domain.Category, error) {
	var out []domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.ParentID, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func scanProduct(row pgx.Row) (*domain.Product, error) {
	var p domain.Product
	err := row.Scan(&p.ID, &p.Name, &p.CategoryID, &p.Description, &p.GeneratedDescription,
		&p.NameES, &p.DescriptionES, &p.GeneratedDescriptionES,
		&p.Brand, &p.Manufacturer, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &p, err
}

func scanProducts(rows pgx.Rows) ([]domain.Product, error) {
	var out []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.CategoryID, &p.Description, &p.GeneratedDescription,
			&p.NameES, &p.DescriptionES, &p.GeneratedDescriptionES,
			&p.Brand, &p.Manufacturer, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func scanSKU(row pgx.Row) (*domain.SKU, error) {
	var s domain.SKU
	err := row.Scan(&s.ID, &s.ProductID, &s.Code, &s.Name, &s.Description, &s.IsActive,
		&s.PublishComprasParaguai, &s.PublishEcommerce, &s.ImageURL, &s.CreatedAt, &s.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &s, err
}

func scanSKUs(rows pgx.Rows) ([]domain.SKU, error) {
	var out []domain.SKU
	for rows.Next() {
		var s domain.SKU
		if err := rows.Scan(&s.ID, &s.ProductID, &s.Code, &s.Name, &s.Description, &s.IsActive,
			&s.PublishComprasParaguai, &s.PublishEcommerce, &s.ImageURL, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
