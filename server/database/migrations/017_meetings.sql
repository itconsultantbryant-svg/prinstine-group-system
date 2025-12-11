-- Migration: 017_meetings.sql
-- Create meetings system with attendees, responses, and attendance tracking

CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    purpose TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    meeting_type TEXT NOT NULL CHECK(meeting_type IN ('online', 'in-person')),
    meeting_link TEXT,
    meeting_location TEXT,
    created_by INTEGER NOT NULL,
    created_by_name TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    user_email TEXT,
    invited_by INTEGER,
    response_status TEXT DEFAULT 'pending' CHECK(response_status IN ('pending', 'accepted', 'declined', 'maybe')),
    responded_at DATETIME,
    attendance_status TEXT DEFAULT 'absent' CHECK(attendance_status IN ('present', 'absent', 'late', 'excused')),
    attendance_marked_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting_attendance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    marked_by INTEGER NOT NULL,
    attendance_status TEXT NOT NULL CHECK(attendance_status IN ('present', 'absent', 'late', 'excused')),
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON meeting_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_response_status ON meeting_attendees(response_status);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_log_meeting_id ON meeting_attendance_log(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_log_user_id ON meeting_attendance_log(user_id);

