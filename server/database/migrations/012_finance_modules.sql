-- Migration: 012_finance_modules.sql
-- Add Petty Cash Ledger and Asset Registry modules

-- ==========================================
-- PETTY CASH LEDGER TABLES
-- ==========================================

-- Petty Cash Ledgers (one per month/year)
CREATE TABLE IF NOT EXISTS petty_cash_ledgers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT DEFAULT 'PRINSTINE GROUP OF COMPANIES',
    month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    starting_balance REAL NOT NULL DEFAULT 0,
    petty_cash_custodian_id INTEGER NOT NULL, -- Staff member
    approved_by_id INTEGER, -- Finance Manager / CFO
    approval_status TEXT DEFAULT 'Draft' CHECK(approval_status IN ('Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Locked')),
    physical_cash_count REAL,
    variance_amount REAL DEFAULT 0,
    variance_explanation TEXT,
    counted_by_id INTEGER,
    witnessed_by_id INTEGER,
    signed_by_custodian TEXT, -- Digital signature or name/position
    signed_by_manager TEXT, -- Digital signature or name/position
    date_signed DATETIME,
    locked INTEGER DEFAULT 0, -- 1 = read-only after approval
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (petty_cash_custodian_id) REFERENCES staff(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (counted_by_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (witnessed_by_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(year, month) -- One ledger per month/year
);

-- Petty Cash Transactions (rows in the ledger)
CREATE TABLE IF NOT EXISTS petty_cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL,
    transaction_date DATE NOT NULL,
    petty_cash_slip_no TEXT NOT NULL, -- Auto-generated (e.g., PC-2025-12-001)
    description TEXT NOT NULL,
    amount_deposited REAL DEFAULT 0,
    amount_withdrawn REAL DEFAULT 0,
    balance REAL NOT NULL, -- Running balance
    charged_to TEXT, -- Expense category / account code
    received_by_type TEXT CHECK(received_by_type IN ('Staff', 'Other')),
    received_by_staff_id INTEGER, -- If Staff
    received_by_name TEXT, -- If Other (free text)
    approved_by_id INTEGER, -- Transaction approver
    attachment_path TEXT, -- File path for receipt/voucher
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ledger_id) REFERENCES petty_cash_ledgers(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Petty Cash Replenishment Requests
CREATE TABLE IF NOT EXISTS petty_cash_replenishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER NOT NULL,
    amount_requested REAL NOT NULL,
    justification TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Deposited')),
    requested_by INTEGER NOT NULL,
    approved_by_id INTEGER,
    approval_date DATETIME,
    deposit_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ledger_id) REFERENCES petty_cash_ledgers(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- ASSET REGISTRY TABLES
-- ==========================================

-- Main Asset Register
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT UNIQUE NOT NULL, -- Auto-generated (e.g., A001-DK-01)
    asset_description TEXT NOT NULL,
    asset_category TEXT NOT NULL, -- e.g., Furniture & Fixtures, Office Equipment
    department TEXT NOT NULL, -- e.g., Prinstine Group, Academy, Microfinance
    location TEXT NOT NULL, -- e.g., HQ – Monrovia
    date_acquired DATE NOT NULL,
    supplier TEXT,
    purchase_price_usd REAL NOT NULL,
    purchase_price_lrd REAL,
    exchange_rate REAL, -- If LRD price provided
    asset_condition TEXT DEFAULT 'Good' CHECK(asset_condition IN ('Excellent', 'Good', 'Fair', 'Poor')),
    serial_number TEXT,
    warranty_expiry_date DATE,
    expected_useful_life_years INTEGER NOT NULL DEFAULT 10,
    depreciation_rate_annual REAL DEFAULT 0.05, -- 5% straight-line
    depreciation_expense_per_annum REAL, -- Auto-calculated (Purchase * rate)
    depreciation_per_month REAL, -- Auto-calculated (Annual / 12)
    responsible_person_id INTEGER NOT NULL, -- Staff member
    remarks TEXT,
    attachment_path TEXT, -- Invoice/Photo
    added_by INTEGER NOT NULL,
    reviewed_by_id INTEGER,
    approved_by_id INTEGER,
    approval_status TEXT DEFAULT 'Draft' CHECK(approval_status IN ('Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Locked')),
    audit_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsible_person_id) REFERENCES staff(id) ON DELETE RESTRICT,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Asset Depreciation Tracking (accumulated depreciation per year)
CREATE TABLE IF NOT EXISTS asset_depreciations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    depreciation_year INTEGER NOT NULL, -- Year number (1, 2, 3, etc.)
    depreciation_amount REAL NOT NULL, -- Depreciation for this year
    accumulated_depreciation REAL NOT NULL, -- Cumulative up to this year
    book_value_at_year_end REAL NOT NULL, -- Purchase - Accumulated
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    UNIQUE(asset_id, depreciation_year)
);

-- Monthly Acquisition Sheets (auto-generated views based on date_acquired)
-- This is a virtual table or we can use a materialized view approach
-- For simplicity, we'll add a field to assets to track which monthly sheet it belongs to
-- Monthly sheets are calculated dynamically based on date_acquired

-- Expenses Sheet (for minor assets/expenses that are expensed, not capitalized)
CREATE TABLE IF NOT EXISTS asset_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., Office Supplies, Extension Cord
    amount REAL NOT NULL,
    department TEXT,
    location TEXT,
    responsible_person_id INTEGER,
    supplier TEXT,
    attachment_path TEXT,
    added_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (responsible_person_id) REFERENCES staff(id) ON DELETE SET NULL,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Petty Cash Indexes
CREATE INDEX IF NOT EXISTS idx_petty_cash_ledgers_year_month ON petty_cash_ledgers(year, month);
CREATE INDEX IF NOT EXISTS idx_petty_cash_ledgers_custodian ON petty_cash_ledgers(petty_cash_custodian_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_ledger ON petty_cash_transactions(ledger_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_date ON petty_cash_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_slip_no ON petty_cash_transactions(petty_cash_slip_no);

-- Asset Registry Indexes
CREATE INDEX IF NOT EXISTS idx_assets_asset_id ON assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
CREATE INDEX IF NOT EXISTS idx_assets_date_acquired ON assets(date_acquired);
CREATE INDEX IF NOT EXISTS idx_assets_responsible_person ON assets(responsible_person_id);
CREATE INDEX IF NOT EXISTS idx_asset_depreciations_asset ON asset_depreciations(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_expenses_date ON asset_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_asset_expenses_category ON asset_expenses(category);

