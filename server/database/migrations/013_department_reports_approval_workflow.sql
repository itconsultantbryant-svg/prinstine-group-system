-- Migration: 013_department_reports_approval_workflow.sql
-- Add department head approval workflow and support for Staff (Assistant Finance Officer) to submit Finance reports

-- Add columns for department head approval workflow
ALTER TABLE department_reports ADD COLUMN dept_head_reviewed_by INTEGER;
ALTER TABLE department_reports ADD COLUMN dept_head_reviewed_at DATETIME;
ALTER TABLE department_reports ADD COLUMN dept_head_status TEXT; -- 'Pending', 'DepartmentHead_Approved', 'DepartmentHead_Rejected'
ALTER TABLE department_reports ADD COLUMN dept_head_notes TEXT;

-- Update status to support two-level approval
-- Status values: 'Pending', 'DepartmentHead_Approved', 'DepartmentHead_Rejected', 'Admin_Approved', 'Admin_Rejected', 'Final_Approved'
-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we'll handle validation in application code

-- Add index for department head review
CREATE INDEX IF NOT EXISTS idx_department_reports_dept_head_review ON department_reports(dept_head_reviewed_by) WHERE dept_head_reviewed_by IS NOT NULL;

