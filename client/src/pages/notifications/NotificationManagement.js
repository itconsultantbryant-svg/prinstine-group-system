import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const NotificationManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    link: '',
    sendMode: 'specific', // 'specific', 'role', 'all'
    selectedUserIds: [],
    selectedRole: '',
    sendToAll: false
  });

  // Data
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchRoles();
    }
  }, [user]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      // Ensure we're using the correct API endpoint
      const endpoint = '/notifications/users';
      console.log('Fetching users from:', endpoint);
      console.log('API base URL:', api.defaults.baseURL);
      
      const response = await api.get(endpoint);
      // Handle different possible response structures
      const usersData = response.data?.users || response.data || [];
      const usersArray = Array.isArray(usersData) ? usersData : [];
      
      // Log for debugging (can be removed in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetched users:', usersArray.length, usersArray);
      }
      
      setUsers(usersArray);
      setFilteredUsers(usersArray);
    } catch (error) {
      console.error('Error fetching users:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request URL:', error.config?.url);
      console.error('Full error:', error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load users';
      setError(`Failed to load users: ${errorMessage}. Please check if the server is running and the API endpoint is correct.`);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const endpoint = '/notifications/roles';
      console.log('Fetching roles from:', endpoint);
      
      const response = await api.get(endpoint);
      // Handle different possible response structures
      const rolesData = response.data?.roles || response.data || [];
      const rolesArray = Array.isArray(rolesData) ? rolesData : [];
      
      // Log for debugging (can be removed in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetched roles:', rolesArray);
      }
      
      setRoles(rolesArray);
    } catch (error) {
      console.error('Error fetching roles:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request URL:', error.config?.url);
      setRoles([]);
    }
  };

  const filterUsers = () => {
    if (!users || users.length === 0) {
      setFilteredUsers([]);
      return;
    }

    let filtered = [...users];

    if (roleFilter) {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        (u.name && u.name.toLowerCase().includes(term)) || 
        (u.email && u.email.toLowerCase().includes(term))
      );
    }

    setFilteredUsers(filtered);
  };

  const handleUserToggle = (userId) => {
    setFormData(prev => {
      // Ensure consistent type comparison (convert to number for comparison)
      const userIdNum = Number(userId);
      const isSelected = prev.selectedUserIds.some(id => Number(id) === userIdNum);
      return {
        ...prev,
        selectedUserIds: isSelected
          ? prev.selectedUserIds.filter(id => Number(id) !== userIdNum)
          : [...prev.selectedUserIds, userIdNum]
      };
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filteredUsers
      .filter(u => u.id != null) // Only include users with valid IDs
      .map(u => Number(u.id)); // Ensure IDs are numbers
    setFormData(prev => ({
      ...prev,
      selectedUserIds: visibleIds
    }));
  };

  const deselectAll = () => {
    setFormData(prev => ({
      ...prev,
      selectedUserIds: []
    }));
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const uploadedFiles = [];
    
    try {
      // Files will be sent directly with the notification, just store them for now
      for (const file of Array.from(files)) {
        uploadedFiles.push({
          file: file,
          filename: file.name,
          size: file.size
        });
      }
      
      setAttachments(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error('File selection error:', error);
      setError('Failed to select files');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('message', formData.message);
      formDataToSend.append('type', formData.type);
      if (formData.link) {
        formDataToSend.append('link', formData.link);
      }

      if (formData.sendMode === 'all') {
        formDataToSend.append('sendToAll', 'true');
      } else if (formData.sendMode === 'role') {
        formDataToSend.append('role', formData.selectedRole);
      } else {
        // Send userIds as JSON string since FormData doesn't handle arrays well
        formDataToSend.append('userIds', JSON.stringify(formData.selectedUserIds));
      }

      // Add attachments
      attachments.forEach(att => {
        formDataToSend.append('attachments', att.file);
      });

      const response = await api.post('/notifications/send', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSuccess(response.data.message || 'Communication sent successfully!');
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'info',
        link: '',
        sendMode: 'specific',
        selectedUserIds: [],
        selectedRole: '',
        sendToAll: false
      });
      setAttachments([]);
      setSearchTerm('');
      setRoleFilter('');
    } catch (err) {
      console.error('Error sending notification:', err);
      setError(err.response?.data?.error || 'Failed to send communication');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12">
          <h1 className="h3 mb-0">Send Communication</h1>
          <p className="text-muted">
            {user?.role === 'Admin' 
              ? 'Send real-time communications to users (single, multiple, by role, or all users)'
              : 'Send real-time communications to other users in the system'}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError('')}
          ></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="bi bi-check-circle me-2"></i>
          {success}
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccess('')}
          ></button>
        </div>
      )}

      <div className="row">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Notification Details</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-bold">Title <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter notification title"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Message <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Enter notification message"
                    required
                  />
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Type</label>
                    <select
                      className="form-select"
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Link (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.link}
                      onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                      placeholder="e.g., /dashboard, /reports"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Attachments (Optional)</label>
                  <input
                    type="file"
                    className="form-control"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                    disabled={uploading}
                  />
                  <small className="text-muted">
                    Allowed: Images (JPEG, PNG, GIF), Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV), Archives (ZIP, RAR). Max 10MB per file.
                  </small>
                  {attachments.length > 0 && (
                    <div className="mt-2">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="badge bg-secondary me-2 mb-2 p-2">
                          <i className="bi bi-paperclip me-1"></i>
                          {att.filename}
                          <button
                            type="button"
                            className="btn-close btn-close-white ms-2"
                            onClick={() => removeAttachment(idx)}
                            style={{ fontSize: '0.7rem' }}
                          ></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-2">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Uploading files...
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label fw-bold">Send To</label>
                  <div className="btn-group w-100" role="group">
                    <input
                      type="radio"
                      className="btn-check"
                      name="sendMode"
                      id="mode-specific"
                      value="specific"
                      checked={formData.sendMode === 'specific'}
                      onChange={(e) => setFormData(prev => ({ ...prev, sendMode: e.target.value, selectedUserIds: [] }))}
                    />
                    <label className="btn btn-outline-primary" htmlFor="mode-specific">
                      <i className="bi bi-person me-1"></i>Specific Users
                    </label>

                    <input
                      type="radio"
                      className="btn-check"
                      name="sendMode"
                      id="mode-role"
                      value="role"
                      checked={formData.sendMode === 'role'}
                      onChange={(e) => setFormData(prev => ({ ...prev, sendMode: e.target.value, selectedUserIds: [] }))}
                    />
                    <label className="btn btn-outline-primary" htmlFor="mode-role">
                      <i className="bi bi-people me-1"></i>By Role
                    </label>

                    <input
                      type="radio"
                      className="btn-check"
                      name="sendMode"
                      id="mode-all"
                      value="all"
                      checked={formData.sendMode === 'all'}
                      onChange={(e) => setFormData(prev => ({ ...prev, sendMode: e.target.value, selectedUserIds: [] }))}
                    />
                    <label className="btn btn-outline-primary" htmlFor="mode-all">
                      <i className="bi bi-globe me-1"></i>All Users
                    </label>
                  </div>
                </div>

                {formData.sendMode === 'role' && user?.role === 'Admin' && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Select Role</label>
                    <select
                      className="form-select"
                      value={formData.selectedRole}
                      onChange={(e) => setFormData(prev => ({ ...prev, selectedRole: e.target.value }))}
                      required
                    >
                      <option value="">Select a role...</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.sendMode === 'all' && user?.role === 'Admin' && (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    This communication will be sent to all active users in the system.
                  </div>
                )}

                {formData.sendMode === 'role' && user?.role !== 'Admin' && (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Role-based sending is only available to administrators.
                  </div>
                )}

                {formData.sendMode === 'all' && user?.role !== 'Admin' && (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Sending to all users is only available to administrators.
                  </div>
                )}

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={loading || uploading || !formData.title || !formData.message || 
                      (formData.sendMode === 'specific' && formData.selectedUserIds.length === 0) ||
                      (formData.sendMode === 'role' && (!formData.selectedRole || user?.role !== 'Admin')) ||
                      (formData.sendMode === 'all' && user?.role !== 'Admin')}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send me-2"></i>
                        Send Notification
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {formData.sendMode === 'specific' && (
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Select Users</h5>
                <div>
                  <button
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={selectAllVisible}
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={deselectAll}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <select
                    className="form-select form-select-sm"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="small text-muted mb-2">
                  {formData.selectedUserIds.length} user(s) selected
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {loadingUsers ? (
                    <div className="text-center text-muted py-3">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Loading users...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center text-muted py-3">
                      {users.length === 0 
                        ? 'No users available' 
                        : 'No users match your filters'}
                    </div>
                  ) : (
                    filteredUsers
                      .filter(user => user.id != null) // Only display users with valid IDs
                      .map(user => {
                        const userId = Number(user.id);
                        const isSelected = formData.selectedUserIds.some(id => Number(id) === userId);
                        return (
                          <div key={user.id} className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`user-${user.id}`}
                              checked={isSelected}
                              onChange={() => handleUserToggle(user.id)}
                            />
                            <label className="form-check-label" htmlFor={`user-${user.id}`}>
                              <div>
                                <strong>{user.name || 'No Name'}</strong>
                                <br />
                                <small className="text-muted">{user.email || 'No email'}</small>
                                <br />
                                <span className="badge bg-secondary">{user.role || 'No role'}</span>
                              </div>
                            </label>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManagement;

