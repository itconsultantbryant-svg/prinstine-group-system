-- Add cohorts table for Academy module
CREATE TABLE IF NOT EXISTS cohorts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    start_date DATE,
    end_date DATE,
    period TEXT, -- e.g., "Q1 2024", "Fall 2024", "2024-2025"
    description TEXT,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Completed', 'Cancelled')),
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add cohort_id to students table
ALTER TABLE students ADD COLUMN cohort_id INTEGER;
ALTER TABLE students ADD COLUMN period TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON students(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_period ON students(period);
CREATE INDEX IF NOT EXISTS idx_cohorts_code ON cohorts(code);
CREATE INDEX IF NOT EXISTS idx_cohorts_status ON cohorts(status);

