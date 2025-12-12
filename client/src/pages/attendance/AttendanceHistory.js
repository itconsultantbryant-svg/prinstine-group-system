import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { exportToPDF, exportToWord, printContent } from '../../utils/exportUtils';

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayStatus, setTodayStatus] = useState(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [earlyReason, setEarlyReason] = useState('');
  const [filter, setFilter] = useState({
    dateFrom: '',
    dateTo: '',
    status: ''
  });
  const [approvingId, setApprovingId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    fetchAttendance();
    fetchTodayStatus();
    // Refresh every minute
    const interval = setInterval(() => {
      fetchTodayStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get('/attendance');
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const response = await api.get('/attendance/today/status');
      setTodayStatus(response.data);
    } catch (error) {
      console.error('Error fetching today status:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      const now = new Date();
      const standardStartTime = new Date(now);
      standardStartTime.setHours(9, 0, 0, 0);
      const isLate = now > standardStartTime;
      
      // If late, require reason
      if (isLate && !lateReason) {
        alert('Please provide a reason for signing in late (after 9:00 AM)');
        return;
      }
      
      const response = await api.post('/attendance/sign-in', {
        late_reason: isLate ? lateReason : null
      });
      
      alert(response.data.message || 'Signed in successfully');
      setShowSignInModal(false);
      setLateReason('');
      fetchTodayStatus();
      fetchAttendance();
    } catch (error) {
      console.error('Error signing in:', error);
      alert(error.response?.data?.error || 'Failed to sign in');
    }
  };

  const handleSignOut = async () => {
    try {
      const now = new Date();
      const standardEndTime = new Date(now);
      standardEndTime.setHours(17, 0, 0, 0);
      const isEarly = now < standardEndTime;
      
      // If early, require reason
      if (isEarly && !earlyReason) {
        alert('Please provide a reason for signing out early (before 5:00 PM)');
        return;
      }
      
      const response = await api.post('/attendance/sign-out', {
        early_reason: isEarly ? earlyReason : null
      });
      
      alert(response.data.message || 'Signed out successfully');
      setShowSignOutModal(false);
      setEarlyReason('');
      fetchTodayStatus();
      fetchAttendance();
    } catch (error) {
      console.error('Error signing out:', error);
      alert(error.response?.data?.error || 'Failed to sign out');
    }
  };

  const handleApprove = async (attendanceId, status) => {
    if (!approvalNotes && status === 'Rejected') {
      alert('Please provide notes for rejection');
      return;
    }

    try {
      await api.put(`/attendance/${attendanceId}/approve`, {
        status,
        admin_notes: approvalNotes || null
      });
      alert(`Attendance ${status.toLowerCase()} successfully`);
      setApprovingId(null);
      setApprovalNotes('');
      fetchAttendance();
    } catch (error) {
      console.error('Error approving attendance:', error);
      alert(error.response?.data?.error || 'Failed to approve attendance');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': { color: 'warning', text: 'Pending' },
      'Approved': { color: 'success', text: 'Approved' },
      'Rejected': { color: 'danger', text: 'Rejected' }
    };
    return badges[status] || { color: 'secondary', text: status };
  };

  const formatAttendanceForExport = (attendanceRecord) => {
    return `
Attendance Record
==================

Date: ${new Date(attendanceRecord.attendance_date).toLocaleDateString()}
User: ${attendanceRecord.user_name || 'N/A'}
Sign In: ${attendanceRecord.sign_in_time ? new Date(attendanceRecord.sign_in_time).toLocaleString() : 'Not signed in'}
Sign Out: ${attendanceRecord.sign_out_time ? new Date(attendanceRecord.sign_out_time).toLocaleString() : 'Not signed out'}
${attendanceRecord.sign_in_late ? `Late Sign-In Reason: ${attendanceRecord.sign_in_late_reason || 'N/A'}` : ''}
${attendanceRecord.sign_out_early ? `Early Sign-Out Reason: ${attendanceRecord.sign_out_early_reason || 'N/A'}` : ''}
Status: ${attendanceRecord.status}
${attendanceRecord.approved_by ? `Approved by: ${attendanceRecord.approver_name || 'N/A'}` : ''}
${attendanceRecord.admin_notes ? `Admin Notes: ${attendanceRecord.admin_notes}` : ''}
    `.trim();
  };

  const filteredAttendance = attendance.filter(record => {
    if (filter.dateFrom && new Date(record.attendance_date) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(record.attendance_date) > new Date(filter.dateTo)) return false;
    if (filter.status && record.status !== filter.status) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h2>Attendance History</h2>
        </div>
      </div>

      {/* Today's Status Card */}
      {todayStatus && (
        <div className="card mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">
              <i className="bi bi-calendar-check me-2"></i>Today's Attendance
            </h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <p>
                  <strong>Sign In:</strong>{' '}
                  {todayStatus.attendance?.sign_in_time 
                    ? new Date(todayStatus.attendance.sign_in_time).toLocaleString()
                    : 'Not signed in'}
                  {todayStatus.attendance?.sign_in_late && (
                    <span className="badge bg-warning ms-2">LATE</span>
                  )}
                </p>
                {todayStatus.attendance?.sign_in_late_reason && (
                  <p className="text-muted">
                    <small>Reason: {todayStatus.attendance.sign_in_late_reason}</small>
                  </p>
                )}
              </div>
              <div className="col-md-6">
                <p>
                  <strong>Sign Out:</strong>{' '}
                  {todayStatus.attendance?.sign_out_time 
                    ? new Date(todayStatus.attendance.sign_out_time).toLocaleString()
                    : 'Not signed out'}
                  {todayStatus.attendance?.sign_out_early && (
                    <span className="badge bg-warning ms-2">EARLY</span>
                  )}
                </p>
                {todayStatus.attendance?.sign_out_early_reason && (
                  <p className="text-muted">
                    <small>Reason: {todayStatus.attendance.sign_out_early_reason}</small>
                  </p>
                )}
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-12">
                {todayStatus.canSignIn && (
                  <button
                    className="btn btn-success me-2"
                    onClick={() => setShowSignInModal(true)}
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>Sign In
                  </button>
                )}
                {todayStatus.canSignOut && (
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowSignOutModal(true)}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                  </button>
                )}
                {!todayStatus.canSignIn && !todayStatus.canSignOut && (
                  <span className="badge bg-info">Attendance completed for today</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                placeholder="From Date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <input
                type="date"
                className="form-control"
                placeholder="To Date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilter({ dateFrom: '', dateTo: '', status: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="card">
        <div className="card-body">
          {filteredAttendance.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-calendar-x text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No attendance records found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    {user.role === 'Admin' && <th>User</th>}
                    <th>Sign In</th>
                    <th>Sign Out</th>
                    <th>Status</th>
                    {user.role === 'Admin' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((record) => {
                    const statusBadge = getStatusBadge(record.status);
                    return (
                      <tr key={record.id}>
                        <td>{new Date(record.attendance_date).toLocaleDateString()}</td>
                        {user.role === 'Admin' && (
                          <td>{record.user_name || 'N/A'}</td>
                        )}
                        <td>
                          {record.sign_in_time 
                            ? new Date(record.sign_in_time).toLocaleTimeString()
                            : 'N/A'}
                          {record.sign_in_late && (
                            <>
                              <br />
                              <small className="text-warning">Late</small>
                              {record.sign_in_late_reason && (
                                <>
                                  <br />
                                  <small className="text-muted">{record.sign_in_late_reason}</small>
                                </>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {record.sign_out_time 
                            ? new Date(record.sign_out_time).toLocaleTimeString()
                            : 'N/A'}
                          {record.sign_out_early && (
                            <>
                              <br />
                              <small className="text-warning">Early</small>
                              {record.sign_out_early_reason && (
                                <>
                                  <br />
                                  <small className="text-muted">{record.sign_out_early_reason}</small>
                                </>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          <span className={`badge bg-${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </td>
                        {user.role === 'Admin' && (
                          <td>
                            {record.status === 'Pending' && (
                              <div className="btn-group" role="group">
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => {
                                    setApprovingId(record.id);
                                    setApprovalNotes('');
                                  }}
                                  title="Approve"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => {
                                    setApprovingId(record.id);
                                    setApprovalNotes('');
                                  }}
                                  title="Reject"
                                >
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              </div>
                            )}
                            {record.status !== 'Pending' && (
                              <small className="text-muted">
                                {record.approver_name || 'N/A'}
                              </small>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sign In</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setShowSignInModal(false);
                  setLateReason('');
                }}></button>
              </div>
              <div className="modal-body">
                <p>Current time: {new Date().toLocaleString()}</p>
                <div className="mb-3">
                  <label className="form-label">Late Reason (if applicable)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    placeholder="Please provide a reason if you are signing in late..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowSignInModal(false);
                  setLateReason('');
                }}>Cancel</button>
                <button type="button" className="btn btn-success" onClick={handleSignIn}>
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Modal */}
      {showSignOutModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sign Out</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setShowSignOutModal(false);
                  setEarlyReason('');
                }}></button>
              </div>
              <div className="modal-body">
                <p>Current time: {new Date().toLocaleString()}</p>
                <div className="mb-3">
                  <label className="form-label">Early Sign-Out Reason (if applicable)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={earlyReason}
                    onChange={(e) => setEarlyReason(e.target.value)}
                    placeholder="Please provide a reason if you are signing out early..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowSignOutModal(false);
                  setEarlyReason('');
                }}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvingId && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve/Reject Attendance</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setApprovingId(null);
                  setApprovalNotes('');
                }}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Notes (required for rejection)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Enter approval notes..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setApprovingId(null);
                  setApprovalNotes('');
                }}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-danger me-2"
                  onClick={() => handleApprove(approvingId, 'Rejected')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleApprove(approvingId, 'Approved')}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;

