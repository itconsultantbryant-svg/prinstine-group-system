-- Migration: 022_add_department_head_fields.sql
-- Add head_name, head_email, and head_phone columns to departments table

-- Add head_name column if it doesn't exist
ALTER TABLE departments ADD COLUMN head_name TEXT;

-- Add head_email column if it doesn't exist
ALTER TABLE departments ADD COLUMN head_email TEXT;

-- Add head_phone column if it doesn't exist
ALTER TABLE departments ADD COLUMN head_phone TEXT;

