-- Migration: Create progress_reports table
-- This table stores progress reports submitted by department heads
-- All department heads and admin can view all progress reports

CREATE TABLE IF NOT EXISTS progress_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Student', 'Client for Consultancy', 'Client for Audit', 'Others')),
    status TEXT NOT NULL CHECK(status IN ('Signed Contract', 'Pipeline Client', 'Submitted')),
    department_id INTEGER,
    department_name TEXT,
    created_by INTEGER NOT NULL,
    created_by_name TEXT NOT NULL,
    created_by_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_progress_reports_created_by ON progress_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_progress_reports_department_id ON progress_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_progress_reports_date ON progress_reports(date);
CREATE INDEX IF NOT EXISTS idx_progress_reports_category ON progress_reports(category);
CREATE INDEX IF NOT EXISTS idx_progress_reports_status ON progress_reports(status);

