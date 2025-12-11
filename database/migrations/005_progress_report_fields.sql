-- Migration: Add progress report fields to clients table
-- Adds category, progress_status, and created_by fields

-- Add category field (student, client for consultancy, client for audit, others)
ALTER TABLE clients ADD COLUMN category TEXT CHECK(category IN ('student', 'client for consultancy', 'client for audit', 'others'));

-- Add progress_status field (signed contract, pipeline client, submit)
ALTER TABLE clients ADD COLUMN progress_status TEXT CHECK(progress_status IN ('signed contract', 'pipeline client', 'submit'));

-- Add created_by field to track who added the client
ALTER TABLE clients ADD COLUMN created_by INTEGER;
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_category ON clients(category);
CREATE INDEX IF NOT EXISTS idx_clients_progress_status ON clients(progress_status);

