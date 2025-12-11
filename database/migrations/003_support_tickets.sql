-- Support Tickets & Incident Tracker Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    date_reported DATETIME DEFAULT CURRENT_TIMESTAMP,
    reported_by INTEGER,
    reported_by_name TEXT,
    reported_by_email TEXT,
    category TEXT NOT NULL CHECK(category IN ('Hardware', 'Software', 'Access', 'Network', 'Website', 'LMS', 'Security', 'Other')),
    priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New', 'In Progress', 'Resolved', 'Closed')),
    assigned_to INTEGER,
    assigned_to_name TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    client_impact INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
    client_impact_description TEXT,
    student_impact INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
    student_impact_description TEXT,
    resolution_time INTEGER, -- in minutes
    sla_compliance INTEGER DEFAULT 1, -- 0 = No, 1 = Yes
    attachments TEXT, -- JSON array of file paths
    resolved_at DATETIME,
    closed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id ON support_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_date_reported ON support_tickets(date_reported);

