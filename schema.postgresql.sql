-- Sklad.io PostgreSQL schema generated from tested SQLAlchemy models


CREATE TABLE categories (
	id SERIAL NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	description VARCHAR(500), 
	PRIMARY KEY (id), 
	UNIQUE (name)
)

;

CREATE TABLE revoked_tokens (
	jti VARCHAR(64) NOT NULL, 
	expires INTEGER NOT NULL, 
	PRIMARY KEY (jti)
)

;

CREATE TABLE suppliers (
	id SERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	contact_phone VARCHAR(50), 
	email VARCHAR(254), 
	PRIMARY KEY (id), 
	UNIQUE (name)
)

;

CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR(254) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	active BOOLEAN NOT NULL, 
	failures INTEGER NOT NULL, 
	locked_until INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (role IN ('Admin','Storekeeper','Manager')), 
	UNIQUE (email)
)

;

CREATE TABLE audit (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	action VARCHAR(100) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
)

;

CREATE TABLE products (
	id SERIAL NOT NULL, 
	sku VARCHAR(100) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	category_id INTEGER NOT NULL, 
	supplier_id INTEGER, 
	price NUMERIC(10, 2) NOT NULL, 
	stock_quantity INTEGER NOT NULL, 
	min_stock_level INTEGER NOT NULL, 
	image_url VARCHAR(2000), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (price >= 0), 
	CHECK (stock_quantity >= 0), 
	CHECK (min_stock_level >= 0), 
	UNIQUE (sku), 
	FOREIGN KEY(category_id) REFERENCES categories (id) ON DELETE RESTRICT, 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_products_category_id ON products (category_id);

CREATE TABLE transactions (
	id SERIAL NOT NULL, 
	product_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	type VARCHAR(3) NOT NULL, 
	quantity INTEGER NOT NULL, 
	transaction_date TIMESTAMP WITH TIME ZONE NOT NULL, 
	notes VARCHAR(1000) NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (type IN ('IN','OUT')), 
	CHECK (quantity > 0), 
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT
)

;
CREATE INDEX ix_transactions_transaction_date ON transactions (transaction_date);
