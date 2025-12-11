-- Migration: 011_academy_enhancements.sql
-- Add course fees, admin approval, and payment tracking to academy system

-- Note: This migration assumes courses, instructors, and students tables exist
-- If they don't exist, they should be created by the initial schema migration first

-- Add course fees and approval fields to courses table
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll handle errors in application code
-- For now, we'll add them and the application will catch duplicate column errors

-- Create student_payments table for payment tracking
CREATE TABLE IF NOT EXISTS student_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, -- The user_id of the student
    course_id INTEGER NOT NULL,
    course_fee REAL NOT NULL,
    amount_paid REAL DEFAULT 0,
    balance REAL NOT NULL,
    payment_date DATE,
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Create student_course_enrollments table for better enrollment tracking
CREATE TABLE IF NOT EXISTS student_course_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Enrolled' CHECK(status IN ('Enrolled', 'Completed', 'Dropped', 'Suspended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_payments_student_id ON student_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_course_id ON student_payments(course_id);
CREATE INDEX IF NOT EXISTS idx_student_course_enrollments_student_id ON student_course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_course_enrollments_course_id ON student_course_enrollments(course_id);
