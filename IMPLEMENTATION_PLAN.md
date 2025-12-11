# Prinstine Group Management System - Implementation Plan

## Overview
This document outlines the comprehensive implementation plan for all requested features and improvements.

## Phase 1: Staff Management Enhancements ✅ IN PROGRESS

### 1.1 Enhanced Staff Form
- [x] Create database migration for new staff fields
- [ ] Add date of birth field
- [ ] Add place of birth field
- [ ] Add comprehensive employment details:
  - Nationality
  - Gender
  - Marital status
  - National ID
  - Tax ID
  - Bank details (name, account number, branch)
  - Next of kin information
  - Qualifications
  - Previous employment
  - References
  - Notes
- [ ] Update backend route to handle new fields
- [ ] Update frontend form with all new fields
- [ ] Add password creation by admin during staff creation

### 1.2 Staff Login & Dashboard
- [x] Enable Staff role login (updated auth.js)
- [x] Update login redirect for Staff role
- [ ] Create Staff Dashboard component
- [ ] Add Staff Dashboard route
- [ ] Create Staff sidebar navigation
- [ ] Implement staff-specific features

### 1.3 Staff Progress Reports
- [ ] Enable staff to submit progress reports
- [ ] Enable staff to view all progress reports
- [ ] Add progress report submission form for staff
- [ ] Add progress report viewing/list for staff

### 1.4 Client Specific Report Template for Staff
- [ ] Integrate client specific report template for all staff
- [ ] Marketing staff reports → Marketing Manager approval workflow
- [ ] Marketing Manager can view, edit, approve/reject
- [ ] Admin sees approved reports and does final approval
- [ ] Staff can view, edit, print, export (PDF/Excel) their reports

### 1.5 Combined Dashboard for Department Heads who are Staff
- [ ] Detect if Department Head is also Staff
- [ ] Create combined dashboard view
- [ ] Merge department and staff features in sidebar

## Phase 2: Report Export & Print Functionality

### 2.1 Universal Export/Print
- [ ] Add print functionality to all reports
- [ ] Add PDF export to all reports
- [ ] Add Excel export to all reports
- [ ] Implement for all user roles (Admin, DepartmentHead, Staff)

### 2.2 File Attachments for Reports
- [ ] Add file attachment support to Marketing Manager general report
- [ ] Add file attachment support to all reporting templates
- [ ] Update database schema for report attachments
- [ ] Update report forms to include file upload

## Phase 3: Communication Enhancements

### 3.1 File Attachments in Communications
- [ ] Add file attachment component to communications
- [ ] Support attachments in staff-to-staff communications
- [ ] Support attachments in department communications
- [ ] Support attachments in admin communications
- [ ] Enable view, print, export (PDF/Excel/Word) for attachments
- [ ] Allow file attachments when replying to notifications

## Phase 4: Finance Department Features

### 4.1 Payroll Processing & Management
- [ ] Create payroll table in database
- [ ] Add payroll management to Finance dashboard
- [ ] Add payroll sidebar menu item
- [ ] Implement payroll processing workflow
- [ ] Add admin approval for payroll
- [ ] Staff automatically added to payroll when created
- [ ] Comprehensive payroll management system

### 4.2 Student Payment Integration
- [ ] Add student payment tracking to Finance dashboard
- [ ] Add student payment sidebar menu
- [ ] Display student details and payment information
- [ ] Show: amount paid, course, balance
- [ ] Add payment button for students
- [ ] Update amount paid and balance on payment
- [ ] Admin view, print, export student payment details

## Phase 5: Academy Management

### 5.1 Course Management
- [ ] Add course fees field to course form
- [ ] Implement admin approval for course creation
- [ ] Update course creation workflow

### 5.2 Instructor Management
- [ ] Implement admin approval for instructor addition
- [ ] Update instructor creation workflow

### 5.3 Student Enrollment
- [ ] Add course selection to student form
- [ ] Support multiple course enrollment
- [ ] Link student info to Finance for payment tracking

### 5.4 Academy Access Control
- [ ] Grant access to Academy Head (Francess)
- [ ] Grant access to Jamesetta Sieh (jsieh@prinstinegroup.org)
- [ ] Prepare for Constantine addition
- [ ] Implement role-based access for academy features

### 5.5 Combined Academy Head Dashboard
- [ ] Academy Head is also Staff - create combined dashboard
- [ ] Merge academy and staff features

## Phase 6: User Profile Features

### 6.1 Change Password
- [ ] Add change password form to user profile
- [ ] Implement password change API endpoint
- [ ] Add password validation
- [ ] Add to all user profiles (Admin, DepartmentHead, Staff)

## Phase 7: Future Additions

### 7.1 Assistant Finance Officer
- [ ] Prepare for Assistant Finance Officer role
- [ ] Create reporting template structure
- [ ] Implement when details are provided

## Database Migrations Required

1. ✅ `007_staff_enhancements.sql` - Staff table enhancements
2. ⏳ `008_payroll_management.sql` - Payroll table
3. ⏳ `009_student_payments.sql` - Student payment tracking
4. ⏳ `010_report_attachments.sql` - Report attachment enhancements
5. ⏳ `011_communication_attachments.sql` - Communication attachment enhancements
6. ⏳ `012_course_fees_approval.sql` - Course fees and approval workflow

## Implementation Priority

**High Priority (Start Immediately):**
1. Staff form enhancements with DOB, place of birth
2. Staff login enablement
3. Staff dashboard creation
4. Password creation by admin

**Medium Priority:**
1. Staff progress reports
2. Client specific report template for staff
3. Report export/print functionality
4. File attachments for reports

**Lower Priority (Can be done incrementally):**
1. Payroll management
2. Academy enhancements
3. Communication attachments
4. Change password feature

## Notes

- All features should maintain backward compatibility
- Test thoroughly after each phase
- Update documentation as features are added
- Ensure proper error handling and validation
- Maintain security best practices

