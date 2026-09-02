-- Warehouse and demo staff (deterministic UUIDs). Password: Admin@12345678
INSERT INTO warehouses (id, code, name) VALUES
	('11111111-1111-1111-1111-111111111001', 'DEP01', 'Depósito Principal — Ciudad del Este')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active) VALUES
	(
		'00000000-0000-0000-0000-000000000001',
		'admin@datacenterla.local',
		'$2a$10$9Vlbw/RmTykHa4LcAWfmwuYqt4q3jEeBJsBFjJrVJ6GJbfi/Qw3na',
		'Lucas Bastos',
		true,
		true
	)
ON CONFLICT (email) DO UPDATE SET
	password_hash = EXCLUDED.password_hash,
	full_name = EXCLUDED.full_name,
	is_active = true;

INSERT INTO user_roles (user_id, role_id) VALUES
	('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active) VALUES
	(
		'00000000-0000-0000-0000-000000000002',
		'shop.system@datacenterla.local',
		'$2a$10$9Vlbw/RmTykHa4LcAWfmwuYqt4q3jEeBJsBFjJrVJ6GJbfi/Qw3na',
		'Loja e-commerce',
		true,
		true
	)
ON CONFLICT (id) DO UPDATE SET
	email = EXCLUDED.email,
	full_name = EXCLUDED.full_name,
	is_active = true;

INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active) VALUES
	(
		'00000000-0000-0000-0000-000000000010',
		'ana.benitez@datacenterla.local',
		'$2a$10$9Vlbw/RmTykHa4LcAWfmwuYqt4q3jEeBJsBFjJrVJ6GJbfi/Qw3na',
		'Ana Benítez',
		true,
		true
	),
	(
		'00000000-0000-0000-0000-000000000011',
		'rodrigo.ferreira@datacenterla.local',
		'$2a$10$9Vlbw/RmTykHa4LcAWfmwuYqt4q3jEeBJsBFjJrVJ6GJbfi/Qw3na',
		'Rodrigo Ferreira',
		true,
		true
	)
ON CONFLICT (id) DO UPDATE SET
	email = EXCLUDED.email,
	password_hash = EXCLUDED.password_hash,
	full_name = EXCLUDED.full_name,
	is_active = true;

INSERT INTO user_roles (user_id, role_id) VALUES
	('00000000-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'),
	('00000000-0000-0000-0000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4')
ON CONFLICT DO NOTHING;
