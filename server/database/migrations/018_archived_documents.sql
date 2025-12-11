-- Migration: 018_archived_documents.sql
-- Create archived documents system for tracking all user documents

CREATE TABLE IF NOT EXISTS archived_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    source_type TEXT, -- 'manual', 'report', 'proposal', 'call_memo', 'meeting', etc.
    source_id INTEGER, -- ID of the source (report_id, proposal_id, etc.)
    description TEXT,
    uploaded_by INTEGER NOT NULL,
    uploaded_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_archived_documents_user_id ON archived_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_source_type ON archived_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_archived_documents_source_id ON archived_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_archived_documents_uploaded_by ON archived_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_archived_documents_created_at ON archived_documents(created_at);

