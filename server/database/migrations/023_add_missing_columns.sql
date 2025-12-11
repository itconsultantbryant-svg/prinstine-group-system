-- Migration: 023_add_missing_columns.sql
-- Add missing columns to existing tables

-- Add category and progress_status to clients table
ALTER TABLE clients ADD COLUMN category TEXT;
ALTER TABLE clients ADD COLUMN progress_status TEXT;
ALTER TABLE clients ADD COLUMN created_by INTEGER;

-- Add foreign key for created_by if it doesn't exist
-- Note: SQLite doesn't support adding foreign keys to existing columns,
-- but we can ensure the column exists for application-level integrity

