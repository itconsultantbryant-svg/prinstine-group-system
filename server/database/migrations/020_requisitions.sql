-- Migration: 020_requisitions.sql
-- Create requisitions system with approval workflow

CREATE TABLE IF NOT EXISTS requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    department_id INTEGER,
    department_name TEXT,
    requisition_date DATE NOT NULL,
    request_type TEXT NOT NULL CHECK(request_type IN ('office_supplies', 'work_support', 'sick_leave', 'temporary_leave', 'vacation', 'annual_leave')),
    
    -- Office supplies fields
    materials TEXT,
    cost DECIMAL(10, 2),
    quantity INTEGER,
    
    -- Work support fields
    purpose TEXT,
    
    -- Leave fields
    period_from DATE,
    period_to DATE,
    leave_purpose TEXT,
    
    -- Common fields
    document_path TEXT,
    document_name TEXT,
    target_user_id INTEGER,
    target_role TEXT,
    status TEXT DEFAULT 'Pending_DeptHead' CHECK(status IN ('Pending_DeptHead', 'DeptHead_Approved', 'DeptHead_Rejected', 'Pending_Admin', 'Admin_Approved', 'Admin_Rejected')),
    dept_head_reviewed_by INTEGER,
    dept_head_reviewed_at DATETIME,
    dept_head_notes TEXT,
    admin_reviewed_by INTEGER,
    admin_reviewed_at DATETIME,
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (dept_head_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_requisitions_user_id ON requisitions(user_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_department_id ON requisitions(department_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_request_type ON requisitions(request_type);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_requisition_date ON requisitions(requisition_date);

