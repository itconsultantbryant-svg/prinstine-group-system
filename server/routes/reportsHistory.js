const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');

/**
 * Get all reports that a user has submitted or approved
 * This includes:
 * - Reports submitted by the user
 * - Reports approved/reviewed by the user (as Department Head, Marketing Manager, Admin, etc.)
 * - Reports from all report types: department, staff_client, progress, petty_cash, assets
 */
router.get('/my-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const allReports = [];

    // 1. Department Reports - submitted by user or reviewed/approved by user
    try {
      const deptReports = await db.all(
        `SELECT dr.*, d.name as department_name,
                u1.name as submitted_by_name,
                u2.name as reviewed_by_name,
                u3.name as dept_head_reviewed_by_name
         FROM department_reports dr
         JOIN departments d ON dr.department_id = d.id
         JOIN users u1 ON dr.submitted_by = u1.id
         LEFT JOIN users u2 ON dr.reviewed_by = u2.id
         LEFT JOIN users u3 ON dr.dept_head_reviewed_by = u3.id
         WHERE dr.submitted_by = ? 
            OR dr.reviewed_by = ?
            OR dr.dept_head_reviewed_by = ?`,
        [userId, userId, userId]
      );
      
      deptReports.forEach(r => {
        allReports.push({
          ...r,
          reportType: 'department',
          reportTypeLabel: 'Department Report',
          title: r.title,
          created_at: r.created_at
        });
      });
    } catch (error) {
      console.error('Error fetching department reports:', error);
    }

    // 2. Staff Client Reports - submitted by user or approved by user (as Marketing Manager or Admin)
    try {
      const staffReports = await db.all(
        `SELECT scr.*, 
                u.name as staff_name, u.email as staff_email,
                d.name as department_name
         FROM staff_client_reports scr
         LEFT JOIN users u ON scr.staff_id = u.id
         LEFT JOIN departments d ON scr.department_id = d.id
         WHERE scr.staff_id = ?
            OR scr.marketing_manager_id = ?
            OR scr.admin_id = ?`,
        [userId, userId, userId]
      );
      
      staffReports.forEach(r => {
        allReports.push({
          ...r,
          reportType: 'staff_client',
          reportTypeLabel: 'Staff Client Report',
          title: r.report_title,
          created_at: r.created_at || r.submitted_at
        });
      });
    } catch (error) {
      console.error('Error fetching staff client reports:', error);
    }

    // 3. Progress Reports - created by user
    try {
      const progressReports = await db.all(
        `SELECT pr.*, d.name as department_full_name
         FROM progress_reports pr
         LEFT JOIN departments d ON pr.department_id = d.id
         WHERE pr.created_by = ?`,
        [userId]
      );
      
      progressReports.forEach(r => {
        allReports.push({
          ...r,
          reportType: 'progress',
          reportTypeLabel: 'Progress Report',
          title: r.name,
          department_name: r.department_name || r.department_full_name,
          created_at: r.created_at
        });
      });
    } catch (error) {
      console.error('Error fetching progress reports:', error);
    }

    // 4. Petty Cash Ledgers - created by user or approved by user
    try {
      const pettyCashReports = await db.all(
        `SELECT pcl.*,
                cust.name as custodian_name,
                approver.name as approved_by_name,
                creator.name as created_by_name
         FROM petty_cash_ledgers pcl
         LEFT JOIN staff cust_staff ON pcl.petty_cash_custodian_id = cust_staff.id
         LEFT JOIN users cust ON cust_staff.user_id = cust.id
         LEFT JOIN users approver ON pcl.approved_by_id = approver.id
         LEFT JOIN users creator ON pcl.created_by = creator.id
         WHERE pcl.created_by = ?
            OR pcl.approved_by_id = ?
            OR pcl.dept_head_approved_by = ?
            OR pcl.admin_approved_by = ?`,
        [userId, userId, userId, userId]
      );
      
      pettyCashReports.forEach(r => {
        allReports.push({
          ...r,
          reportType: 'petty_cash',
          reportTypeLabel: 'Petty Cash Ledger',
          title: `Petty Cash Ledger - ${r.month}/${r.year}`,
          department_name: 'Finance',
          created_at: r.created_at
        });
      });
    } catch (error) {
      console.error('Error fetching petty cash ledgers:', error);
    }

    // 5. Assets - added by user or approved by user
    try {
      const assetReports = await db.all(
        `SELECT a.*,
                resp.name as responsible_person_name,
                creator.name as added_by_name,
                approver.name as approved_by_name
         FROM assets a
         LEFT JOIN staff resp_staff ON a.responsible_person_id = resp_staff.id
         LEFT JOIN users resp ON resp_staff.user_id = resp.id
         LEFT JOIN users creator ON a.added_by = creator.id
         LEFT JOIN users approver ON a.approved_by_id = approver.id
         WHERE a.added_by = ?
            OR a.approved_by_id = ?
            OR a.dept_head_approved_by = ?
            OR a.admin_approved_by = ?`,
        [userId, userId, userId, userId]
      );
      
      assetReports.forEach(r => {
        allReports.push({
          ...r,
          reportType: 'asset',
          reportTypeLabel: 'Asset Registry',
          title: `${r.asset_name} - ${r.asset_id}`,
          department_name: 'Finance',
          created_at: r.created_at
        });
      });
    } catch (error) {
      console.error('Error fetching assets:', error);
    }

    res.json({ reports: allReports });
  } catch (error) {
    console.error('Get reports history error:', error);
    res.status(500).json({ error: 'Failed to fetch reports history' });
  }
});

module.exports = router;

