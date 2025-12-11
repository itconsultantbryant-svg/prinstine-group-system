-- Migration: 009_add_attachments_to_reports.sql
-- Add attachments column to department_reports table

-- Add attachments column to department_reports if it doesn't exist
ALTER TABLE department_reports ADD COLUMN attachments TEXT; -- JSON array of file URLs

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_department_reports_attachments ON department_reports(attachments) WHERE attachments IS NOT NULL;

