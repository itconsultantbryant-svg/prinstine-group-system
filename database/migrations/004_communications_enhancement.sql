-- Communications Enhancement Migration
-- Adds support for attachments, replies, and acknowledgments to notifications

-- Add new columns to notifications table
ALTER TABLE notifications ADD COLUMN sender_id INTEGER;
ALTER TABLE notifications ADD COLUMN parent_id INTEGER; -- For replies
ALTER TABLE notifications ADD COLUMN attachments TEXT; -- JSON array of file paths
ALTER TABLE notifications ADD COLUMN is_acknowledged INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN acknowledged_at DATETIME;

-- Add foreign keys
-- Note: SQLite doesn't support adding foreign keys to existing tables easily
-- We'll handle referential integrity in application code

-- Create index for parent_id (replies)
CREATE INDEX IF NOT EXISTS idx_notifications_parent_id ON notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_acknowledged ON notifications(is_acknowledged);

