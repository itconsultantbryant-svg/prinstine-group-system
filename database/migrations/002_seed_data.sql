-- Seed initial data for Prinstine Management System

-- Insert default admin user (password: Admin@123)
-- Password hash for 'Admin@123' using bcrypt
-- Using admin@prinstinegroup.org as the admin email
INSERT OR IGNORE INTO users (id, email, username, password_hash, role, name, is_active, email_verified) 
VALUES (1, 'admin@prinstinegroup.org', 'admin', '$2b$10$BakIGqdrzCUK6t9pQxFMBuvEkaQ4vJNMtos.PgjX8KLATZYPhs7dq', 'Admin', 'System Administrator', 1, 1);

-- Insert default permissions for roles
INSERT OR IGNORE INTO permissions (role, module, action, granted) VALUES
-- Admin - Full access
('Admin', 'dashboard', 'view', 1),
('Admin', 'dashboard', 'create', 1),
('Admin', 'dashboard', 'edit', 1),
('Admin', 'dashboard', 'delete', 1),
('Admin', 'staff', 'view', 1),
('Admin', 'staff', 'create', 1),
('Admin', 'staff', 'edit', 1),
('Admin', 'staff', 'delete', 1),
('Admin', 'staff', 'approve', 1),
('Admin', 'clients', 'view', 1),
('Admin', 'clients', 'create', 1),
('Admin', 'clients', 'edit', 1),
('Admin', 'clients', 'delete', 1),
('Admin', 'partners', 'view', 1),
('Admin', 'partners', 'create', 1),
('Admin', 'partners', 'edit', 1),
('Admin', 'partners', 'delete', 1),
('Admin', 'academy', 'view', 1),
('Admin', 'academy', 'create', 1),
('Admin', 'academy', 'edit', 1),
('Admin', 'academy', 'delete', 1),
('Admin', 'reports', 'view', 1),
('Admin', 'reports', 'create', 1),
('Admin', 'reports', 'edit', 1),
('Admin', 'reports', 'delete', 1),
('Admin', 'reports', 'approve', 1),
('Admin', 'marketing', 'view', 1),
('Admin', 'marketing', 'create', 1),
('Admin', 'marketing', 'edit', 1),
('Admin', 'marketing', 'delete', 1),
('Admin', 'certificates', 'view', 1),
('Admin', 'certificates', 'create', 1),
('Admin', 'certificates', 'verify', 1),
-- Staff permissions
('Staff', 'dashboard', 'view', 1),
('Staff', 'clients', 'view', 1),
('Staff', 'clients', 'create', 1),
('Staff', 'clients', 'edit', 1),
('Staff', 'reports', 'view', 1),
('Staff', 'reports', 'create', 1),
('Staff', 'reports', 'edit', 1),
-- Instructor permissions
('Instructor', 'dashboard', 'view', 1),
('Instructor', 'academy', 'view', 1),
('Instructor', 'academy', 'create', 1),
('Instructor', 'academy', 'edit', 1),
('Instructor', 'students', 'view', 1),
('Instructor', 'students', 'edit', 1),
-- Student permissions
('Student', 'dashboard', 'view', 1),
('Student', 'academy', 'view', 1),
('Student', 'certificates', 'view', 1),
-- Client permissions
('Client', 'dashboard', 'view', 1),
('Client', 'clients', 'view', 1),
-- Partner permissions
('Partner', 'dashboard', 'view', 1),
('Partner', 'partners', 'view', 1);

