import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import MeetingForm from './MeetingForm';
import { exportToPDF, exportToWord, printContent } from '../../utils/exportUtils';

const MeetingHistory = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [viewingMeeting, setViewingMeeting] = useState(null);
  const [filter, setFilter] = useState({
    status: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchMeetings();
    // Check for expired meetings every minute
    const interval = setInterval(() => {
      checkExpiredMeetings();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/meetings');
      const meetingsList = response.data.meetings || [];
      
      // Update status for expired meetings
      const now = new Date();
      for (const meeting of meetingsList) {
        const meetingDateTime = new Date(`${meeting.meeting_date} ${meeting.end_time}`);
        if (meetingDateTime < now && meeting.status === 'scheduled') {
          // Update status in database
          try {
            await api.put(`/meetings/${meeting.id}`, {
              ...meeting,
              status: 'completed'
            });
          } catch (error) {
            console.error('Error updating meeting status:', error);
          }
        }
      }
      
      setMeetings(meetingsList);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkExpiredMeetings = async () => {
    const now = new Date();
    const expiredMeetings = meetings.filter(meeting => {
      const meetingDateTime = new Date(`${meeting.meeting_date} ${meeting.end_time}`);
      return meetingDateTime < now && meeting.status === 'scheduled';
    });
    
    if (expiredMeetings.length > 0) {
      fetchMeetings(); // Refresh to get updated statuses
    }
  };

  const handleAdd = () => {
    setEditingMeeting(null);
    setShowForm(true);
  };

  const handleEdit = (meeting) => {
    setEditingMeeting(meeting);
    setShowForm(true);
  };

  const handleView = async (meetingId) => {
    try {
      const response = await api.get(`/meetings/${meetingId}`);
      setViewingMeeting(response.data.meeting);
    } catch (error) {
      console.error('Error fetching meeting:', error);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) {
      return;
    }

    try {
      await api.delete(`/meetings/${meetingId}`);
      fetchMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const handleRespond = async (meetingId, response) => {
    try {
      await api.put(`/meetings/${meetingId}/respond`, {
        response_status: response
      });
      alert(`Meeting ${response} successfully`);
      fetchMeetings();
    } catch (error) {
      console.error('Error responding to meeting:', error);
      alert('Failed to record response');
    }
  };

  const handleMarkAttendance = async (meetingId, userId, status) => {
    try {
      await api.post(`/meetings/${meetingId}/attendance`, {
        user_id: userId,
        attendance_status: status
      });
      alert('Attendance marked successfully');
      fetchMeetings();
      if (viewingMeeting && viewingMeeting.id === meetingId) {
        handleView(meetingId);
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert(error.response?.data?.error || 'Failed to mark attendance');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMeeting(null);
    fetchMeetings();
  };

  const getStatusBadge = (status, meeting) => {
    // Check if meeting has ended
    if (status === 'scheduled') {
      const now = new Date();
      const meetingDateTime = new Date(`${meeting.meeting_date} ${meeting.end_time}`);
      if (meetingDateTime < now) {
        return { color: 'secondary', text: 'Ended' };
      }
    }
    
    const badges = {
      'scheduled': { color: 'primary', text: 'Scheduled' },
      'in-progress': { color: 'info', text: 'In Progress' },
      'completed': { color: 'success', text: 'Completed' },
      'cancelled': { color: 'danger', text: 'Cancelled' }
    };
    return badges[status] || { color: 'secondary', text: status };
  };

  const formatMeetingForExport = (meeting) => {
    return `
Meeting Details
===============

Title: ${meeting.title}
Purpose: ${meeting.purpose}
Date: ${meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : 'N/A'}
Time: ${meeting.start_time} - ${meeting.end_time}
Type: ${meeting.meeting_type === 'online' ? 'Online' : 'In-Person'}
${meeting.meeting_type === 'online' ? `Meeting Link: ${meeting.meeting_link || 'N/A'}` : `Location: ${meeting.meeting_location || 'N/A'}`}
Status: ${meeting.status}
Created by: ${meeting.created_by_name || 'N/A'}

Attendees:
${meeting.attendees && meeting.attendees.length > 0 
  ? meeting.attendees.map(a => `- ${a.user_name || 'N/A'} (${a.response_status})`).join('\n')
  : 'No attendees'}

${meeting.notes ? `Notes:\n${meeting.notes}` : ''}
    `.trim();
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (filter.status && meeting.status !== filter.status) {
      // Also check if expired
      if (filter.status === 'completed') {
        const now = new Date();
        const meetingDateTime = new Date(`${meeting.meeting_date} ${meeting.end_time}`);
        if (meetingDateTime >= now || meeting.status !== 'completed') return false;
      } else {
        return false;
      }
    }
    if (filter.type && meeting.meeting_type !== filter.type) return false;
    if (filter.dateFrom && new Date(meeting.meeting_date) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(meeting.meeting_date) > new Date(filter.dateTo)) return false;
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
          <h2>Meeting History</h2>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Create Meeting
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="online">Online</option>
                <option value="in-person">In-Person</option>
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="From Date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="To Date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilter({ status: '', type: '', dateFrom: '', dateTo: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Meetings Table */}
      <div className="card">
        <div className="card-body">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-calendar-event text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No meetings found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Attendees</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeetings.map((meeting) => {
                    const statusBadge = getStatusBadge(meeting.status, meeting);
                    const isAttendee = meeting.attendees?.some(a => a.user_id === user.id);
                    const myResponse = meeting.attendees?.find(a => a.user_id === user.id)?.response_status;
                    
                    return (
                      <tr key={meeting.id}>
                        <td>
                          <strong>{meeting.title}</strong>
                          <br />
                          <small className="text-muted">{meeting.purpose}</small>
                        </td>
                        <td>
                          {new Date(meeting.meeting_date).toLocaleDateString()}
                          <br />
                          <small className="text-muted">{meeting.start_time} - {meeting.end_time}</small>
                        </td>
                        <td>
                          <span className={`badge bg-${meeting.meeting_type === 'online' ? 'info' : 'primary'}`}>
                            {meeting.meeting_type === 'online' ? 'Online' : 'In-Person'}
                          </span>
                        </td>
                        <td>
                          {meeting.attendee_count || 0} invited
                          <br />
                          <small className="text-muted">{meeting.accepted_count || 0} accepted</small>
                        </td>
                        <td>
                          <span className={`badge bg-${statusBadge.color}`}>
                            {statusBadge.text}
                          </span>
                        </td>
                        <td>{meeting.created_by_name || 'N/A'}</td>
                        <td>
                          <div className="btn-group" role="group">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleView(meeting.id)}
                              title="View"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            {isAttendee && myResponse === 'pending' && (
                              <>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleRespond(meeting.id, 'accepted')}
                                  title="Accept"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleRespond(meeting.id, 'declined')}
                                  title="Decline"
                                >
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              </>
                            )}
                            {(meeting.created_by === user.id || user.role === 'Admin') && (
                              <>
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => handleEdit(meeting)}
                                  title="Edit"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDelete(meeting.id)}
                                  title="Delete"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Meeting Modal */}
      {viewingMeeting && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Meeting Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewingMeeting(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Title:</strong> {viewingMeeting.title}
                  </div>
                  <div className="col-md-6">
                    <strong>Date:</strong> {new Date(viewingMeeting.meeting_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Time:</strong> {viewingMeeting.start_time} - {viewingMeeting.end_time}
                  </div>
                  <div className="col-md-6">
                    <strong>Type:</strong> 
                    <span className={`badge bg-${viewingMeeting.meeting_type === 'online' ? 'info' : 'primary'} ms-2`}>
                      {viewingMeeting.meeting_type === 'online' ? 'Online' : 'In-Person'}
                    </span>
                  </div>
                </div>
                {viewingMeeting.meeting_type === 'online' && viewingMeeting.meeting_link && (
                  <div className="mb-3">
                    <strong>Meeting Link:</strong>
                    <a href={viewingMeeting.meeting_link} target="_blank" rel="noopener noreferrer" className="ms-2">
                      {viewingMeeting.meeting_link} <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  </div>
                )}
                {viewingMeeting.meeting_type === 'in-person' && viewingMeeting.meeting_location && (
                  <div className="mb-3">
                    <strong>Location:</strong> {viewingMeeting.meeting_location}
                  </div>
                )}
                <div className="mb-3">
                  <strong>Purpose:</strong>
                  <div className="mt-2 p-3 bg-light rounded">
                    {viewingMeeting.purpose}
                  </div>
                </div>
                {viewingMeeting.notes && (
                  <div className="mb-3">
                    <strong>Notes:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingMeeting.notes}
                    </div>
                  </div>
                )}
                <div className="mb-3">
                  <strong>Attendees ({viewingMeeting.attendees?.length || 0}):</strong>
                  <div className="table-responsive mt-2">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Response</th>
                          <th>Attendance</th>
                          {(viewingMeeting.created_by === user.id || user.role === 'Admin') && (
                            <th>Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {viewingMeeting.attendees?.map(attendee => (
                          <tr key={attendee.id}>
                            <td>{attendee.user_name || 'N/A'}</td>
                            <td>
                              <span className={`badge bg-${
                                attendee.response_status === 'accepted' ? 'success' :
                                attendee.response_status === 'declined' ? 'danger' :
                                attendee.response_status === 'maybe' ? 'warning' : 'secondary'
                              }`}>
                                {attendee.response_status || 'Pending'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge bg-${
                                attendee.attendance_status === 'present' ? 'success' :
                                attendee.attendance_status === 'late' ? 'warning' :
                                attendee.attendance_status === 'excused' ? 'info' : 'secondary'
                              }`}>
                                {attendee.attendance_status || 'Not Marked'}
                              </span>
                            </td>
                            {(viewingMeeting.created_by === user.id || user.role === 'Admin') && (
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => handleMarkAttendance(viewingMeeting.id, attendee.user_id, 'present')}
                                    title="Mark Present"
                                  >
                                    <i className="bi bi-check"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-warning"
                                    onClick={() => handleMarkAttendance(viewingMeeting.id, attendee.user_id, 'late')}
                                    title="Mark Late"
                                  >
                                    <i className="bi bi-clock"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-secondary"
                                    onClick={() => handleMarkAttendance(viewingMeeting.id, attendee.user_id, 'absent')}
                                    title="Mark Absent"
                                  >
                                    <i className="bi bi-x"></i>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {viewingMeeting.attendance_log && viewingMeeting.attendance_log.length > 0 && (
                  <div className="mb-3">
                    <strong>Attendance Log:</strong>
                    <div className="table-responsive mt-2">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Status</th>
                            <th>Marked By</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingMeeting.attendance_log.map(log => (
                            <tr key={log.id}>
                              <td>{log.user_name || 'N/A'}</td>
                              <td>
                                <span className={`badge bg-${
                                  log.attendance_status === 'present' ? 'success' :
                                  log.attendance_status === 'late' ? 'warning' :
                                  log.attendance_status === 'excused' ? 'info' : 'secondary'
                                }`}>
                                  {log.attendance_status}
                                </span>
                              </td>
                              <td>{log.marked_by_name || 'N/A'}</td>
                              <td>{new Date(log.marked_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => printContent(viewingMeeting.title, formatMeetingForExport(viewingMeeting))}
                >
                  <i className="bi bi-printer me-1"></i>Print
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => exportToPDF(viewingMeeting.title, formatMeetingForExport(viewingMeeting))}
                >
                  <i className="bi bi-file-pdf me-1"></i>Export PDF
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => exportToWord(viewingMeeting.title, formatMeetingForExport(viewingMeeting))}
                >
                  <i className="bi bi-file-word me-1"></i>Export Word
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewingMeeting(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <MeetingForm
          meeting={editingMeeting}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default MeetingHistory;

