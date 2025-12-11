-- Migration: 015_call_memos.sql
-- Create call_memos table for tracking client call memos

CREATE TABLE IF NOT EXISTS call_memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    participants TEXT NOT NULL,
    subject TEXT NOT NULL,
    call_date DATE NOT NULL,
    discussion TEXT NOT NULL,
    service_needed TEXT NOT NULL CHECK(service_needed IN ('Consultancy', 'Training (Academy)', 'Web Development', 'System Development', 'Audit', 'Others')),
    service_other TEXT,
    department_needed TEXT,
    next_visitation_date DATE,
    created_by INTEGER NOT NULL,
    created_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_memos_client_id ON call_memos(client_id);
CREATE INDEX IF NOT EXISTS idx_call_memos_created_by ON call_memos(created_by);
CREATE INDEX IF NOT EXISTS idx_call_memos_call_date ON call_memos(call_date);
CREATE INDEX IF NOT EXISTS idx_call_memos_service_needed ON call_memos(service_needed);

