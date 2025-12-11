-- Migration: 016_proposals.sql
-- Create proposals table with approval workflow

CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT NOT NULL,
    proposal_date DATE NOT NULL,
    document_path TEXT,
    document_name TEXT,
    status TEXT DEFAULT 'Pending_Marketing' CHECK(status IN ('Pending_Marketing', 'Marketing_Approved', 'Marketing_Rejected', 'Pending_Admin', 'Approved', 'Rejected')),
    marketing_reviewed_by INTEGER,
    marketing_reviewed_at DATETIME,
    marketing_notes TEXT,
    admin_reviewed_by INTEGER,
    admin_reviewed_at DATETIME,
    admin_notes TEXT,
    created_by INTEGER NOT NULL,
    created_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (marketing_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_date ON proposals(proposal_date);

