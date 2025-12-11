-- Staff table enhancements for comprehensive employment details
-- Migration 007: Add date of birth, place of birth, and other employment fields

-- Add new columns to staff table
ALTER TABLE staff ADD COLUMN date_of_birth DATE;
ALTER TABLE staff ADD COLUMN place_of_birth TEXT;
ALTER TABLE staff ADD COLUMN nationality TEXT;
ALTER TABLE staff ADD COLUMN gender TEXT CHECK(gender IN ('Male', 'Female', 'Other', 'Prefer not to say'));
ALTER TABLE staff ADD COLUMN marital_status TEXT CHECK(marital_status IN ('Single', 'Married', 'Divorced', 'Widowed'));
ALTER TABLE staff ADD COLUMN national_id TEXT;
ALTER TABLE staff ADD COLUMN tax_id TEXT;
ALTER TABLE staff ADD COLUMN bank_name TEXT;
ALTER TABLE staff ADD COLUMN bank_account_number TEXT;
ALTER TABLE staff ADD COLUMN bank_branch TEXT;
ALTER TABLE staff ADD COLUMN next_of_kin_name TEXT;
ALTER TABLE staff ADD COLUMN next_of_kin_relationship TEXT;
ALTER TABLE staff ADD COLUMN next_of_kin_phone TEXT;
ALTER TABLE staff ADD COLUMN next_of_kin_address TEXT;
ALTER TABLE staff ADD COLUMN qualifications TEXT; -- JSON array of qualifications
ALTER TABLE staff ADD COLUMN previous_employment TEXT; -- JSON array of previous employment
ALTER TABLE staff ADD COLUMN [references] TEXT; -- JSON array of references (escaped because 'references' is a reserved keyword)
ALTER TABLE staff ADD COLUMN notes TEXT; -- Additional notes

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_employment_type ON staff(employment_type);

