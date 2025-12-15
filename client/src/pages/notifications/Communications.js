import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { initSocket, getSocket } from '../../config/socket';
import { handleAttachmentAction } from '../../utils/documentUtils';

const Communications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSendForm, setShowSendForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFormData, setSendFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    sendMode: 'role', // 'role' or 'user'
    selectedRole: '',
    selectedUserIds: []
  });
  const [sendAttachments, setSendAttachments] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);

  useEffect(() => {
    fetchNotifications();
    if (user && (user.role === 'Admin' || user.role === 'DepartmentHead' || user.role === 'Staff')) {
      fetchAvailableUsers();
      fetchAvailableRoles();
    }
    
    // Set up real-time socket connection
    if (user?.id) {
      const socket = initSocket(user.id);
      
      socket.on('notification', (notification) => {
        // Add new notification to the list
        setNotifications(prev => [notification, ...prev]);
        // If viewing a thread and this is a reply, refresh thread
        if (selectedNotification && notification.parentId === selectedNotification.id) {
          fetchThread(selectedNotification.id);
        }
      });

      socket.on('notification_acknowledged', (data) => {
        // Update notification if it's in the current view
        setNotifications(prev => prev.map(n => 
          n.id === data.notificationId 
            ? { ...n, is_acknowledged: 1, acknowledged_at: data.acknowledgedAt }
            : n
        ));
      });

      return () => {
        socket.off('notification');
        socket.off('notification_acknowledged');
      };
    }
  }, [user, selectedNotification]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications?limit=100');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  const fetchThread = async (notificationId) => {
    try {
      const response = await api.get(`/notifications/${notificationId}/thread`);
      setThread(response.data.thread);
    } catch (error) {
      console.error('Error fetching thread:', error);
      setError('Failed to load thread');
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await api.get('/notifications/users');
      const usersData = response.data?.users || response.data || [];
      // Filter users based on role: DepartmentHead and Staff can see Admin, DepartmentHead, and Staff
      let filteredUsers = Array.isArray(usersData) ? usersData : [];
      if (user?.role === 'DepartmentHead' || user?.role === 'Staff') {
        filteredUsers = filteredUsers.filter(u => u.role === 'Admin' || u.role === 'DepartmentHead' || u.role === 'Staff');
      }
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const response = await api.get('/notifications/roles');
      const rolesData = response.data?.roles || response.data || [];
      setAvailableRoles(Array.isArray(rolesData) ? rolesData : []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleSendFileUpload = (files) => {
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files).map(file => ({
      file: file,
      filename: file.name,
      size: file.size
    }));
    
    setSendAttachments(prev => [...prev, ...newFiles]);
  };

  const removeSendAttachment = (index) => {
    setSendAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendSubmit = async (e) => {
    e.preventDefault();
    if (!sendFormData.title.trim() || !sendFormData.message.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (sendFormData.sendMode === 'role' && !sendFormData.selectedRole) {
      setError('Please select a role');
      return;
    }

    if (sendFormData.sendMode === 'user' && sendFormData.selectedUserIds.length === 0) {
      setError('Please select at least one user');
      return;
    }

    setSending(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('title', sendFormData.title);
      formData.append('message', sendFormData.message);
      formData.append('type', sendFormData.type);
      
      if (sendFormData.sendMode === 'role') {
        formData.append('role', sendFormData.selectedRole);
      } else {
        formData.append('userIds', JSON.stringify(sendFormData.selectedUserIds));
      }

      // Add attachments
      sendAttachments.forEach(att => {
        formData.append('attachments', att.file);
      });

      await api.post('/notifications/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSendFormData({
        title: '',
        message: '',
        type: 'info',
        sendMode: 'role',
        selectedRole: '',
        selectedUserIds: []
      });
      setSendAttachments([]);
      setShowSendForm(false);
      setSuccess('Communication sent successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchNotifications();
    } catch (error) {
      console.error('Error sending communication:', error);
      setError(error.response?.data?.error || 'Failed to send communication');
    } finally {
      setSending(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    setSelectedNotification(notification);
    await fetchThread(notification.id);
    
    // Mark as read if not already read
    if (!notification.is_read) {
      try {
        await api.put(`/notifications/${notification.id}/read`);
        setNotifications(prev => prev.map(n => 
          n.id === notification.id ? { ...n, is_read: 1 } : n
        ));
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };

  const handleAcknowledge = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/acknowledge`);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, is_acknowledged: 1, acknowledged_at: new Date().toISOString() }
          : n
      ));
      if (thread && thread.id === notificationId) {
        setThread(prev => ({ ...prev, is_acknowledged: 1, acknowledged_at: new Date().toISOString() }));
      }
      setSuccess('Communication acknowledged');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error acknowledging:', error);
      setError('Failed to acknowledge communication');
    }
  };

  const handleReplyFileUpload = (files) => {
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files).map(file => ({
      file: file,
      filename: file.name,
      size: file.size
    }));
    
    setReplyAttachments(prev => [...prev, ...newFiles]);
  };

  const removeReplyAttachment = (index) => {
    setReplyAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) {
      setError('Please enter a message');
      return;
    }

    setReplying(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('message', replyMessage);
      formData.append('type', 'info');
      
      // Add attachments
      replyAttachments.forEach(att => {
        formData.append('attachments', att.file);
      });

      await api.post(`/notifications/${selectedNotification.id}/reply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setReplyMessage('');
      setReplyAttachments([]);
      setSuccess('Reply sent successfully');
      setTimeout(() => setSuccess(''), 3000);
      
      // Refresh thread
      await fetchThread(selectedNotification.id);
      await fetchNotifications();
    } catch (error) {
      console.error('Error sending reply:', error);
      setError(error.response?.data?.error || 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'success': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'error': return 'bg-danger';
      default: return 'bg-info';
    }
  };

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <h1 className="h3 mb-0">Communications</h1>
            <p className="text-muted">View and reply to your communications</p>
          </div>
          {(user?.role === 'Admin' || user?.role === 'DepartmentHead') && (
            <button
              className="btn btn-primary"
              onClick={() => setShowSendForm(!showSendForm)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              {showSendForm ? 'Cancel' : 'Send New Communication'}
            </button>
          )}
        </div>
      </div>

      {/* Send New Communication Form */}
      {showSendForm && (user?.role === 'Admin' || user?.role === 'DepartmentHead' || user?.role === 'Staff') && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Send New Communication</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSendSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={sendFormData.title}
                    onChange={(e) => setSendFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={sendFormData.type}
                    onChange={(e) => setSendFormData(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Message *</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={sendFormData.message}
                  onChange={(e) => setSendFormData(prev => ({ ...prev, message: e.target.value }))}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Attachments (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  onChange={(e) => handleSendFileUpload(e.target.files)}
                  disabled={sending}
                />
                <small className="text-muted">
                  Allowed: Images, Documents, Archives. Max 10MB per file.
                </small>
                {sendAttachments.length > 0 && (
                  <div className="mt-2">
                    {sendAttachments.map((att, idx) => (
                      <div key={idx} className="badge bg-secondary me-2 mb-2 p-2">
                        <i className="bi bi-paperclip me-1"></i>
                        {att.filename} ({formatFileSize(att.size)})
                        <button
                          type="button"
                          className="btn-close btn-close-white ms-2"
                          onClick={() => removeSendAttachment(idx)}
                          style={{ fontSize: '0.7rem' }}
                        ></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Send To</label>
                <div className="btn-group w-100" role="group">
                  <input
                    type="radio"
                    className="btn-check"
                    name="sendMode"
                    id="sendModeRole"
                    value="role"
                    checked={sendFormData.sendMode === 'role'}
                    onChange={(e) => setSendFormData(prev => ({ ...prev, sendMode: e.target.value }))}
                  />
                  <label className="btn btn-outline-primary" htmlFor="sendModeRole">
                    By Role
                  </label>
                  
                  <input
                    type="radio"
                    className="btn-check"
                    name="sendMode"
                    id="sendModeUser"
                    value="user"
                    checked={sendFormData.sendMode === 'user'}
                    onChange={(e) => setSendFormData(prev => ({ ...prev, sendMode: e.target.value }))}
                  />
                  <label className="btn btn-outline-primary" htmlFor="sendModeUser">
                    Specific Users
                  </label>
                </div>
              </div>

              {sendFormData.sendMode === 'role' && (
                <div className="mb-3">
                  <label className="form-label">Select Role *</label>
                  <select
                    className="form-select"
                    value={sendFormData.selectedRole}
                    onChange={(e) => setSendFormData(prev => ({ ...prev, selectedRole: e.target.value }))}
                    required
                  >
                    <option value="">Select a role...</option>
                    {availableRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {user?.role === 'DepartmentHead' && (
                    <small className="text-muted d-block mt-1">
                      Department Heads can send to Admin and DepartmentHead roles
                    </small>
                  )}
                </div>
              )}

              {sendFormData.sendMode === 'user' && (
                <div className="mb-3">
                  <label className="form-label">Select Users *</label>
                  <select
                    className="form-select"
                    multiple
                    size="5"
                    value={sendFormData.selectedUserIds.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                      setSendFormData(prev => ({ ...prev, selectedUserIds: selected }));
                    }}
                    required
                  >
                    {availableUsers
                      .filter(u => user?.role === 'Admin' || (user?.role === 'DepartmentHead' && (u.role === 'Admin' || u.role === 'DepartmentHead')))
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) - {user.role}
                        </option>
                      ))}
                  </select>
                  <small className="text-muted d-block mt-1">
                    Hold Ctrl/Cmd to select multiple users
                  </small>
                </div>
              )}

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send me-2"></i>
                      Send Communication
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSendForm(false);
                    setSendFormData({
                      title: '',
                      message: '',
                      type: 'info',
                      sendMode: 'role',
                      selectedRole: '',
                      selectedUserIds: []
                    });
                    setSendAttachments([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      <div className="row">
        {/* Notifications List */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Inbox</h5>
            </div>
            <div className="card-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center p-4 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  No communications
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`list-group-item list-group-item-action ${
                        selectedNotification?.id === notification.id ? 'active' : ''
                      } ${!notification.is_read ? 'fw-bold' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-1">
                            <span className={`badge ${getTypeBadgeClass(notification.type)} me-2`}>
                              {notification.type}
                            </span>
                            {notification.sender_name && (
                              <small className="text-muted">From: {notification.sender_name}</small>
                            )}
                          </div>
                          <h6 className="mb-1">{notification.title}</h6>
                          <p className="mb-1 text-truncate" style={{ maxWidth: '200px' }}>
                            {notification.message}
                          </p>
                          <small className="text-muted">{formatDate(notification.created_at)}</small>
                          {notification.attachments && notification.attachments.length > 0 && (
                            <div className="mt-1">
                              <i className="bi bi-paperclip me-1"></i>
                              <small>{notification.attachments.length} attachment(s)</small>
                            </div>
                          )}
                        </div>
                        {!notification.is_read && (
                          <span className="badge bg-primary rounded-pill">New</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thread View */}
        <div className="col-md-8">
          {selectedNotification && thread ? (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">{thread.title}</h5>
                  {thread.sender_name && (
                    <small className="text-muted">From: {thread.sender_name} ({thread.sender_email})</small>
                  )}
                </div>
                <div>
                  {!thread.is_acknowledged && (
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => handleAcknowledge(thread.id)}
                    >
                      <i className="bi bi-check-circle me-1"></i>
                      Acknowledge
                    </button>
                  )}
                  {thread.is_acknowledged && (
                    <span className="badge bg-success">
                      <i className="bi bi-check-circle me-1"></i>
                      Acknowledged {formatDate(thread.acknowledged_at)}
                    </span>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {/* Original Message */}
                <div className="mb-4 pb-3 border-bottom">
                  <div className="d-flex justify-content-between mb-2">
                    <span className={`badge ${getTypeBadgeClass(thread.type)}`}>
                      {thread.type}
                    </span>
                    <small className="text-muted">{formatDate(thread.created_at)}</small>
                  </div>
                  <p className="mb-2">{thread.message}</p>
                  
                  {/* Attachments */}
                  {thread.attachments && thread.attachments.length > 0 && (
                    <div className="mt-3">
                      <strong>Attachments:</strong>
                      <div className="list-group mt-2">
                        {thread.attachments.map((att, idx) => (
                          <div key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                            <span
                              className="text-decoration-none flex-grow-1"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleAttachmentAction(att, 'view')}
                            >
                              <i className="bi bi-paperclip me-2"></i>
                              {att.filename} ({formatFileSize(att.size)})
                            </span>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-info btn-sm"
                                onClick={() => handleAttachmentAction(att, 'view')}
                                title="View"
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleAttachmentAction(att, 'download')}
                                title="Download"
                              >
                                <i className="bi bi-download"></i>
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleAttachmentAction(att, 'print')}
                                title="Print"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Replies */}
                {thread.replies && thread.replies.length > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-3">Replies ({thread.replies.length})</h6>
                    {thread.replies.map((reply) => (
                      <div key={reply.id} className="mb-3 pb-3 border-bottom">
                        <div className="d-flex justify-content-between mb-2">
                          <div>
                            <strong>{reply.sender_name || 'Unknown'}</strong>
                            <small className="text-muted ms-2">({reply.sender_email})</small>
                          </div>
                          <small className="text-muted">{formatDate(reply.created_at)}</small>
                        </div>
                        <p className="mb-2">{reply.message}</p>
                        
                        {/* Reply Attachments */}
                        {reply.attachments && reply.attachments.length > 0 && (
                          <div className="mt-2">
                            <strong>Attachments:</strong>
                            <div className="list-group mt-2">
                              {reply.attachments.map((att, idx) => (
                                <div key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                                  <span
                                    className="text-decoration-none flex-grow-1"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleAttachmentAction(att, 'view')}
                                  >
                                    <i className="bi bi-paperclip me-2"></i>
                                    {att.filename} ({formatFileSize(att.size)})
                                  </span>
                                  <div className="btn-group btn-group-sm">
                                    <button
                                className="btn btn-outline-info btn-sm"
                                onClick={() => handleAttachmentAction(att, 'view')}
                                      title="View"
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleAttachmentAction(att, 'download')}
                                title="Download"
                              >
                                <i className="bi bi-download"></i>
                              </button>
                                    <button
                                      className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleAttachmentAction(att, 'print')}
                                      title="Print"
                                    >
                                      <i className="bi bi-printer"></i>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                <div className="mt-4 pt-3 border-top">
                  <h6 className="mb-3">Reply</h6>
                  <form onSubmit={handleReplySubmit}>
                    <div className="mb-3">
                      <textarea
                        className="form-control"
                        rows="4"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        required
                      />
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Attachments (Optional)</label>
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        onChange={(e) => handleReplyFileUpload(e.target.files)}
                        disabled={uploading}
                      />
                      <small className="text-muted">
                        Allowed: Images, Documents, Archives. Max 10MB per file.
                      </small>
                      {replyAttachments.length > 0 && (
                        <div className="mt-2">
                          {replyAttachments.map((att, idx) => (
                            <div key={idx} className="badge bg-secondary me-2 mb-2 p-2">
                              <i className="bi bi-paperclip me-1"></i>
                              {att.filename}
                              <button
                                type="button"
                                className="btn-close btn-close-white ms-2"
                                onClick={() => removeReplyAttachment(idx)}
                                style={{ fontSize: '0.7rem' }}
                              ></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={replying || !replyMessage.trim()}
                    >
                      {replying ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send me-2"></i>
                          Send Reply
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center text-muted p-5">
                <i className="bi bi-chat-left-text fs-1 d-block mb-3"></i>
                <p>Select a communication to view details and reply</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Communications;

