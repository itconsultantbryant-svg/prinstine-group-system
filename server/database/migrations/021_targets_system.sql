-- Migration: 021_targets_system.sql
-- Create tables for target management system

-- Add amount field to progress_reports table
ALTER TABLE progress_reports ADD COLUMN amount REAL DEFAULT 0;

-- Targets table - stores target amounts set by admin for employees
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_amount REAL NOT NULL DEFAULT 0,
    category TEXT CHECK(category IN ('Employee', 'Client for Consultancy', 'Client for Audit', 'Student', 'Others')),
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Completed', 'Extended', 'Cancelled')),
    period_start DATE NOT NULL,
    period_end DATE,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Target progress table - tracks progress towards targets
CREATE TABLE IF NOT EXISTS target_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    progress_report_id INTEGER,
    amount REAL NOT NULL DEFAULT 0,
    category TEXT,
    status TEXT,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (progress_report_id) REFERENCES progress_reports(id) ON DELETE SET NULL
);

-- Fund sharing table - tracks fund sharing between employees
CREATE TABLE IF NOT EXISTS fund_sharing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    progress_report_id INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Reversed', 'Cancelled')),
    reversed_by INTEGER,
    reversed_at DATETIME,
    reversal_reason TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (progress_report_id) REFERENCES progress_reports(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_targets_user_id ON targets(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);
CREATE INDEX IF NOT EXISTS idx_targets_period ON targets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_target_progress_target_id ON target_progress(target_id);
CREATE INDEX IF NOT EXISTS idx_target_progress_user_id ON target_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_target_progress_date ON target_progress(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fund_sharing_from_user ON fund_sharing(from_user_id);
CREATE INDEX IF NOT EXISTS idx_fund_sharing_to_user ON fund_sharing(to_user_id);
CREATE INDEX IF NOT EXISTS idx_fund_sharing_status ON fund_sharing(status);
CREATE INDEX IF NOT EXISTS idx_progress_reports_amount ON progress_reports(amount);

