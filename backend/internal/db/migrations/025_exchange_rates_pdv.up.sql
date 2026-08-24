-- Cotações diárias para PDV (moedas aceitas no comércio paraguaio)

INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
VALUES
    ('USD', 'PYG', 7500, CURRENT_DATE),
    ('USD', 'BRL', 5.85, CURRENT_DATE),
    ('USD', 'ARS', 1200, CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, effective_date) DO UPDATE SET
    rate = EXCLUDED.rate,
    created_at = now();
