-- Sync sequences after pg_dump COPY (wipe resets them to 1).
SELECT setval('inventory_unit_code_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(public_code FROM 4)::INT) FROM inventory_units WHERE public_code ~ '^AAA[0-9]+$'), 0),
	1
), true);

SELECT setval('sku_code_seq', GREATEST(
	COALESCE((SELECT MAX(code::INT) FROM skus WHERE code ~ '^[0-9]+$'), 0),
	1
), true);

SELECT setval('order_number_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(order_number FROM 5)::INT) FROM orders WHERE order_number ~ '^PED-'), 0),
	1000
), true);

SELECT setval('quote_number_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(quote_number FROM 5)::INT) FROM quotes WHERE quote_number ~ '^COT-'), 0),
	1000
), true);

SELECT setval('purchase_order_number_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(po_number FROM 4)::INT) FROM purchase_orders WHERE po_number ~ '^PO-'), 0),
	1
), true);

SELECT setval('rma_case_number_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(case_number FROM 5)::INT) FROM rma_cases WHERE case_number ~ '^RMA-'), 0),
	1
), true);

SELECT setval('customer_return_number_seq', GREATEST(
	COALESCE((SELECT MAX(SUBSTRING(return_number FROM 5)::INT) FROM customer_returns WHERE return_number ~ '^DEV-'), 0),
	1
), true);
