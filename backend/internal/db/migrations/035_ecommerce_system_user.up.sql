-- Synthetic user used by the public shop checkout and payment webhooks.
-- payments.recorded_by references users(id); without this row, confirm fails with SQLSTATE 23503.

INSERT INTO users (id, email, password_hash, full_name, is_active, email_verified)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'shop.system@datacenterla.local',
    '$2b$10$8mlLF7NofZuA6wrpr0MfEOYhWCHjJWuqOURrtusYwt0hKfm5g7fd2',
    'Loja e-commerce',
    true,
    true
)
ON CONFLICT (id) DO NOTHING;
