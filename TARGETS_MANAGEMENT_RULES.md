# Targets Management System - Authorization Rules and Instructions

## Overview
The Targets Management System allows tracking of financial targets for staff members, with automatic aggregation for admin users. All operations support real-time updates via WebSocket.

## Authorization Rules

### Admin Users
- **View**: Can view ALL targets including:
  - All staff targets
  - All department head targets
  - Admin aggregated targets (auto-calculated from all staff targets)
- **Create**: Can create targets for any user (Staff, DepartmentHead)
- **Edit**: Can edit any target (amount, period, status, category, notes)
- **Delete**: Can delete any target
- **Extend**: Can extend any active target
- **Share Funds**: Can share funds (same as other users)
- **Reverse Sharing**: Can reverse any fund sharing transaction
- **View Progress**: Can view progress for any target
- **View History**: Can view all fund sharing history

### Department Head Users
- **View**: Can view their own targets only (not admin targets)
- **Create**: Cannot create targets (Admin only)
- **Edit**: Cannot edit targets (Admin only)
- **Delete**: Cannot delete targets (Admin only)
- **Extend**: Cannot extend targets (Admin only)
- **Share Funds**: Can share funds from their own active target
- **Reverse Sharing**: Cannot reverse sharing (Admin only)
- **View Progress**: Can view progress for their own targets
- **View History**: Can view fund sharing history (their own transactions)

### Staff Users
- **View**: Can view their own targets only (not admin targets)
- **Create**: Cannot create targets (Admin only)
- **Edit**: Cannot edit targets (Admin only)
- **Delete**: Cannot delete targets (Admin only)
- **Extend**: Cannot extend targets (Admin only)
- **Share Funds**: Can share funds from their own active target
- **Reverse Sharing**: Cannot reverse sharing (Admin only)
- **View Progress**: Can view progress for their own targets
- **View History**: Can view fund sharing history (their own transactions)

## Business Rules

### Target Creation
1. Only Admin can create targets
2. Each user can have only ONE active target at a time
3. When a staff target is created, an admin aggregated target is automatically created/updated
4. Admin aggregated targets sum all staff targets for the same period
5. Target amount must be >= 0
6. Period start date is required
7. Period end date is optional

### Target Updates
1. Only Admin can update targets
2. Admin can update: target_amount, category, period_start, period_end, status, notes
3. When a target is updated, admin aggregated targets are recalculated
4. Status can be: Active, Completed, Extended, Cancelled

### Target Deletion
1. Only Admin can delete targets
2. Deleting a target also deletes associated target_progress records
3. If a staff target is deleted, the admin aggregated target is recalculated
4. Cannot delete admin aggregated targets directly (they are auto-managed)

### Fund Sharing
1. Any authenticated user with an active target can share funds
2. Can only share from achieved target amount (net amount - already shared)
3. Cannot share with yourself
4. Recipient must exist in the system
5. Amount must be > 0
6. Sharing reduces sender's available amount and increases recipient's shared_in
7. All fund sharing is tracked in real-time

### Target Progress
1. Progress is automatically updated when progress reports are created with amounts
2. Progress is calculated from target_progress table
3. Net amount = total_progress + shared_in - shared_out
4. Progress percentage = (net_amount / target_amount) * 100
5. Remaining amount = target_amount - net_amount

### Admin Aggregated Targets
1. Automatically created when first staff target is created for a period
2. Automatically updated when:
   - Staff target is created
   - Staff target is updated
   - Staff target is deleted
3. Aggregates:
   - Total target amount (sum of all staff targets)
   - Total progress (sum of all staff progress)
   - Total shared_in (sum of all staff shared_in)
   - Total shared_out (sum of all staff shared_out)
   - Net amount (calculated from aggregated values)
4. Only visible to Admin users
5. Cannot be manually edited (auto-managed)

## Real-Time Updates

All operations emit WebSocket events for real-time updates:
- `target_created` - When a target is created
- `target_updated` - When a target is updated
- `target_deleted` - When a target is deleted
- `fund_shared` - When funds are shared
- `fund_reversed` - When fund sharing is reversed
- `target_progress_updated` - When target progress changes

## Database Compatibility

The system supports both SQLite and PostgreSQL:
- Table existence checks before queries
- Dynamic column checks
- Safe subqueries that handle missing tables
- Proper parameter binding for both databases

## Error Handling

All endpoints include:
- Input validation
- Authorization checks
- Database error handling
- User-friendly error messages
- Audit logging for all operations

