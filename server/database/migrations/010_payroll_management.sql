-- Migration: 010_payroll_management.sql
-- Create payroll management tables

-- Payroll records table
CREATE TABLE IF NOT EXISTS payroll_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, -- The user_id of the staff member
    payroll_period_start DATE NOT NULL,
    payroll_period_end DATE NOT NULL,
    gross_salary REAL NOT NULL,
    deductions REAL DEFAULT 0,
    net_salary REAL NOT NULL,
    bonus REAL DEFAULT 0,
    allowances REAL DEFAULT 0,
    tax_deductions REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Submitted', 'Admin_Approved', 'Admin_Rejected', 'Processed', 'Paid')),
    submitted_by INTEGER, -- Finance department head user_id
    submitted_at DATETIME,
    approved_by INTEGER, -- Admin user_id
    approved_at DATETIME,
    admin_notes TEXT,
    processed_at DATETIME,
    payment_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_records_staff_id ON payroll_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_user_id ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(payroll_period_start, payroll_period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_records_submitted_by ON payroll_records(submitted_by);
CREATE INDEX IF NOT EXISTS idx_payroll_records_approved_by ON payroll_records(approved_by);

