import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const MeetingForm = ({ meeting, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    purpose: '',
    meeting_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    meeting_type: 'online',
    meeting_link: '',
    meeting_location: '',
    notes: ''
  });

  const roles = ['Admin', 'Staff', 'DepartmentHead', 'Instructor', 'Student', 'Client', 'Partner'];

  useEffect(() => {
    fetchUsers();
    if (meeting) {
      setFormData({
        title: meeting.title || '',
        purpose: meeting.purpose || '',
        meeting_date: meeting.meeting_date ? meeting.meeting_date.split('T')[0] : new Date().toISOString().split('T')[0],
        start_time: meeting.start_time || '09:00',
        end_time: meeting.end_time || '10:00',
        meeting_type: meeting.meeting_type || 'online',
        meeting_link: meeting.meeting_link || '',
        meeting_location: meeting.meeting_location || '',
        notes: meeting.notes || ''
      });
      if (meeting.attendees) {
        setSelectedUserIds(meeting.attendees.map(a => a.user_id));
      }
    }
  }, [meeting]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      // Try staff endpoint as fallback
      try {
        const staffResponse = await api.get('/staff');
        const staffList = staffResponse.data.staff || [];
        setUsers(staffList.map(s => ({ id: s.user_id, name: s.name, email: s.email, role: 'Staff' })));
      } catch (staffError) {
        console.error('Error fetching staff:', staffError);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUserToggle = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRoleToggle = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.title || !formData.purpose || !formData.meeting_date || 
        !formData.start_time || !formData.end_time || !formData.meeting_type) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.meeting_type === 'online' && !formData.meeting_link) {
      setError('Meeting link is required for online meetings');
      return;
    }

    if (formData.meeting_type === 'in-person' && !formData.meeting_location) {
      setError('Meeting location is required for in-person meetings');
      return;
    }

    if (selectedUserIds.length === 0 && selectedRoles.length === 0) {
      setError('Please select at least one attendee or role');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        attendee_user_ids: selectedUserIds,
        attendee_roles: selectedRoles
      };

      if (meeting) {
        await api.put(`/meetings/${meeting.id}`, submitData);
        alert('Meeting updated successfully');
      } else {
        await api.post('/meetings', submitData);
        alert('Meeting created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving meeting:', error);
      setError(error.response?.data?.error || 'Failed to save meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{meeting ? 'Edit Meeting' : 'Create Meeting'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Title <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Enter meeting title"
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Date <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    className="form-control"
                    name="meeting_date"
                    value={formData.meeting_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Purpose <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Enter meeting purpose"
                  required
                ></textarea>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Start Time <span className="text-danger">*</span></label>
                  <input
                    type="time"
                    className="form-control"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">End Time <span className="text-danger">*</span></label>
                  <input
                    type="time"
                    className="form-control"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Type <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  name="meeting_type"
                  value={formData.meeting_type}
                  onChange={handleChange}
                  required
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-Person</option>
                </select>
              </div>

              {formData.meeting_type === 'online' && (
                <div className="mb-3">
                  <label className="form-label">Meeting Link <span className="text-danger">*</span></label>
                  <input
                    type="url"
                    className="form-control"
                    name="meeting_link"
                    value={formData.meeting_link}
                    onChange={handleChange}
                    placeholder="https://meet.google.com/..."
                    required={formData.meeting_type === 'online'}
                  />
                </div>
              )}

              {formData.meeting_type === 'in-person' && (
                <div className="mb-3">
                  <label className="form-label">Meeting Location <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="meeting_location"
                    value={formData.meeting_location}
                    onChange={handleChange}
                    placeholder="Enter meeting location"
                    required={formData.meeting_type === 'in-person'}
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Select Attendees</label>
                <div className="card">
                  <div className="card-header">
                    <ul className="nav nav-tabs card-header-tabs" role="tablist">
                      <li className="nav-item">
                        <button className="nav-link active" data-bs-toggle="tab" data-bs-target="#users-tab" type="button">
                          By User ({selectedUserIds.length})
                        </button>
                      </li>
                      <li className="nav-item">
                        <button className="nav-link" data-bs-toggle="tab" data-bs-target="#roles-tab" type="button">
                          By Role ({selectedRoles.length})
                        </button>
                      </li>
                    </ul>
                  </div>
                  <div className="card-body">
                    <div className="tab-content">
                      <div className="tab-pane fade show active" id="users-tab">
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {users.map(u => (
                            <div key={u.id} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={selectedUserIds.includes(u.id)}
                                onChange={() => handleUserToggle(u.id)}
                              />
                              <label className="form-check-label">
                                {u.name} ({u.email}) - {u.role}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="tab-pane fade" id="roles-tab">
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {roles.map(role => (
                            <div key={role} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={selectedRoles.includes(role)}
                                onChange={() => handleRoleToggle(role)}
                              />
                              <label className="form-check-label">{role}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Additional notes (optional)"
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (meeting ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MeetingForm;

