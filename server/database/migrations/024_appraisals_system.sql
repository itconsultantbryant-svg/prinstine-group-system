-- Migration: 024_appraisals_system.sql
-- Create appraisals system for all users

-- Appraisals table
CREATE TABLE IF NOT EXISTS appraisals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL, -- Staff being appraised
    staff_name TEXT NOT NULL,
    department_id INTEGER,
    department_name TEXT NOT NULL,
    appraised_by_user_id INTEGER, -- User adding the appraisal (can be department head or staff in department)
    appraised_by_name TEXT NOT NULL,
    appraised_by_role TEXT, -- 'DepartmentHead' or 'Staff'
    grade_level_appraise INTEGER NOT NULL CHECK(grade_level_appraise IN (1, 2, 3)), -- Grade level for appraise
    grade_level_management INTEGER NOT NULL CHECK(grade_level_management IN (1, 2, 3)), -- Grade level for management
    comment_appraise TEXT,
    comment_management TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (appraised_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- User appraisal summary table (calculated grade levels per user)
CREATE TABLE IF NOT EXISTS user_appraisal_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_appraisals INTEGER DEFAULT 0,
    average_grade_appraise REAL DEFAULT 0,
    average_grade_management REAL DEFAULT 0,
    overall_grade_level REAL DEFAULT 0, -- Combined average
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appraisals_staff_id ON appraisals(staff_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_appraised_by ON appraisals(appraised_by_user_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_department ON appraisals(department_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_created_at ON appraisals(created_at);
CREATE INDEX IF NOT EXISTS idx_user_appraisal_summary_user_id ON user_appraisal_summary(user_id);

