-- Migration: 008_staff_client_reports.sql
-- Create table for staff client-specific reports with approval workflow

CREATE TABLE IF NOT EXISTS staff_client_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    staff_name TEXT NOT NULL,
    staff_email TEXT NOT NULL,
    department_id INTEGER,
    department_name TEXT,
    client_id INTEGER,
    client_name TEXT NOT NULL,
    report_title TEXT NOT NULL,
    report_content TEXT NOT NULL, -- JSON string containing full report data
    attachments TEXT, -- JSON array of file URLs
    status TEXT DEFAULT 'Draft' CHECK(status IN ('Draft', 'Submitted', 'Marketing_Manager_Approved', 'Marketing_Manager_Rejected', 'Admin_Approved', 'Admin_Rejected', 'Final_Approved')),
    marketing_manager_id INTEGER,
    marketing_manager_name TEXT,
    marketing_manager_notes TEXT,
    marketing_manager_reviewed_at DATETIME,
    admin_id INTEGER,
    admin_name TEXT,
    admin_notes TEXT,
    admin_reviewed_at DATETIME,
    submitted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (marketing_manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_staff_id ON staff_client_reports(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_department_id ON staff_client_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_status ON staff_client_reports(status);
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_marketing_manager_id ON staff_client_reports(marketing_manager_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_admin_id ON staff_client_reports(admin_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_reports_created_at ON staff_client_reports(created_at);

