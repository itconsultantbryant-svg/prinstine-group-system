-- Migration: 014_finance_approval_workflow.sql
-- Add two-stage approval workflow for Petty Cash Ledgers and Assets
-- Assistant Finance Officer → Finance Department Head → Admin

-- ==========================================
-- UPDATE PETTY CASH LEDGERS TABLE
-- ==========================================

-- Add new approval workflow fields
ALTER TABLE petty_cash_ledgers ADD COLUMN dept_head_approved_by INTEGER;
ALTER TABLE petty_cash_ledgers ADD COLUMN dept_head_approved_at DATETIME;
ALTER TABLE petty_cash_ledgers ADD COLUMN admin_approved_by INTEGER;
ALTER TABLE petty_cash_ledgers ADD COLUMN admin_approved_at DATETIME;
ALTER TABLE petty_cash_ledgers ADD COLUMN dept_head_status TEXT DEFAULT NULL;
ALTER TABLE petty_cash_ledgers ADD COLUMN admin_status TEXT DEFAULT NULL;

-- Update approval_status to support new workflow statuses
-- Status values: 'Pending_DeptHead', 'Approved_DeptHead', 'Pending_Admin', 'Approved', 'Rejected', 'Draft'
-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we'll handle this in application logic

-- Add foreign keys for new approval fields
-- Note: SQLite doesn't support adding foreign keys to existing tables, so we'll rely on application-level integrity

-- ==========================================
-- UPDATE ASSETS TABLE
-- ==========================================

-- Add new approval workflow fields
ALTER TABLE assets ADD COLUMN dept_head_approved_by INTEGER;
ALTER TABLE assets ADD COLUMN dept_head_approved_at DATETIME;
ALTER TABLE assets ADD COLUMN admin_approved_by INTEGER;
ALTER TABLE assets ADD COLUMN admin_approved_at DATETIME;
ALTER TABLE assets ADD COLUMN dept_head_status TEXT DEFAULT NULL;
ALTER TABLE assets ADD COLUMN admin_status TEXT DEFAULT NULL;

-- Update approval_status to support new workflow statuses
-- Status values: 'Pending_DeptHead', 'Approved_DeptHead', 'Pending_Admin', 'Approved', 'Rejected', 'Draft'

-- ==========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_petty_cash_ledgers_approval_status ON petty_cash_ledgers(approval_status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_ledgers_dept_head_status ON petty_cash_ledgers(dept_head_status);
CREATE INDEX IF NOT EXISTS idx_assets_approval_status ON assets(approval_status);
CREATE INDEX IF NOT EXISTS idx_assets_dept_head_status ON assets(dept_head_status);

