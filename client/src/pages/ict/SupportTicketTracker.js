import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { handleViewDocument, handleDownloadDocument, handlePrintDocument } from '../../utils/documentUtils';

const SupportTicketTracker = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    category: 'all',
    search: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0
  });

  const [formData, setFormData] = useState({
    category: 'Software',
    priority: 'Medium',
    subject: '',
    description: '',
    root_cause: '',
    client_impact: false,
    client_impact_description: '',
    student_impact: false,
    student_impact_description: '',
    assigned_to: '',
    attachments: []
  });

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [filters]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/support-tickets?${params.toString()}`);
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/support-tickets/stats/summary');
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/support-tickets', formData);
      alert('Ticket created successfully!');
      setShowForm(false);
      resetForm();
      fetchTickets();
      fetchStats();
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert(error.response?.data?.error || 'Failed to create ticket');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'Software',
      priority: 'Medium',
      subject: '',
      description: '',
      root_cause: '',
      client_impact: false,
      client_impact_description: '',
      student_impact: false,
      student_impact_description: '',
      assigned_to: '',
      attachments: []
    });
  };

  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, response.data.url]
      }));
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await api.put(`/support-tickets/${ticketId}`, { status: newStatus });
      fetchTickets();
      fetchStats();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket status');
    }
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      'Low': 'secondary',
      'Medium': 'warning',
      'High': 'danger',
      'Critical': 'danger'
    };
    return badges[priority] || 'secondary';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'New': 'primary',
      'In Progress': 'warning',
      'Resolved': 'success',
      'Closed': 'secondary'
    };
    return badges[status] || 'secondary';
  };

  const formatResolutionTime = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading && tickets.length === 0) {
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
        <div className="col-12">
          <h1 className="h3 mb-0">Support Ticket & Incident Tracker</h1>
          <p className="text-muted">Manage and track ICT support tickets and incidents</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-primary">{stats.total}</h5>
              <p className="card-text text-muted mb-0 small">Total</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-info">{stats.new}</h5>
              <p className="card-text text-muted mb-0 small">New</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-warning">{stats.inProgress}</h5>
              <p className="card-text text-muted mb-0 small">In Progress</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-success">{stats.resolved}</h5>
              <p className="card-text text-muted mb-0 small">Resolved</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-danger">{stats.critical}</h5>
              <p className="card-text text-muted mb-0 small">Critical</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title text-danger">{stats.high}</h5>
              <p className="card-text text-muted mb-0 small">High</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row align-items-end">
            <div className="col-md-2">
              <label className="form-label">Status</label>
              <select
                className="form-select form-select-sm"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Priority</label>
              <select
                className="form-select form-select-sm"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              >
                <option value="all">All</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Category</label>
              <select
                className="form-select form-select-sm"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="all">All</option>
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
                <option value="Access">Access</option>
                <option value="Network">Network</option>
                <option value="Website">Website</option>
                <option value="LMS">LMS</option>
                <option value="Security">Security</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search tickets..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-primary w-100"
                onClick={() => setShowForm(true)}
              >
                <i className="bi bi-plus-circle me-2"></i>Create New Ticket
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Tickets ({tickets.length})</h5>
        </div>
        <div className="card-body">
          {tickets.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-ticket-perforated" style={{ fontSize: '3rem', color: '#ccc' }}></i>
              <p className="text-muted mt-3">No tickets found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Date Reported</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Resolution Time</th>
                    <th>SLA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicket(ticket)}>
                      <td><strong>{ticket.ticket_id}</strong></td>
                      <td>{new Date(ticket.date_reported).toLocaleDateString()}</td>
                      <td>{ticket.category}</td>
                      <td>
                        <span className={`badge bg-${getPriorityBadge(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>{ticket.subject}</td>
                      <td>
                        <span className={`badge bg-${getStatusBadge(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>{ticket.assigned_to_name || 'Unassigned'}</td>
                      <td>{formatResolutionTime(ticket.resolution_time)}</td>
                      <td>
                        {ticket.sla_compliance ? (
                          <span className="badge bg-success">Compliant</span>
                        ) : (
                          <span className="badge bg-danger">Non-Compliant</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Form Modal */}
      {showForm && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-ticket-perforated me-2"></i>Create New Support Ticket
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowForm(false); resetForm(); }}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Category *</label>
                      <select
                        className="form-select"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        <option value="Hardware">Hardware</option>
                        <option value="Software">Software</option>
                        <option value="Access">Access</option>
                        <option value="Network">Network</option>
                        <option value="Website">Website</option>
                        <option value="LMS">LMS</option>
                        <option value="Security">Security</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Priority *</label>
                      <select
                        className="form-select"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        required
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Subject *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Brief description of the issue"
                        required
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Description *</label>
                      <textarea
                        className="form-control"
                        rows="5"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed description of the issue..."
                        required
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Root Cause</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={formData.root_cause}
                        onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                        placeholder="If known, describe the root cause..."
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={formData.client_impact}
                          onChange={(e) => setFormData({ ...formData, client_impact: e.target.checked })}
                          id="clientImpact"
                        />
                        <label className="form-check-label" htmlFor="clientImpact">
                          Client Impact
                        </label>
                      </div>
                      {formData.client_impact && (
                        <textarea
                          className="form-control mt-2"
                          rows="2"
                          value={formData.client_impact_description}
                          onChange={(e) => setFormData({ ...formData, client_impact_description: e.target.value })}
                          placeholder="Describe client impact..."
                        />
                      )}
                    </div>
                    <div className="col-md-6 mb-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={formData.student_impact}
                          onChange={(e) => setFormData({ ...formData, student_impact: e.target.checked })}
                          id="studentImpact"
                        />
                        <label className="form-check-label" htmlFor="studentImpact">
                          Student Impact
                        </label>
                      </div>
                      {formData.student_impact && (
                        <textarea
                          className="form-control mt-2"
                          rows="2"
                          value={formData.student_impact_description}
                          onChange={(e) => setFormData({ ...formData, student_impact_description: e.target.value })}
                          placeholder="Describe student impact..."
                        />
                      )}
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Attachments</label>
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.log"
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file);
                          });
                        }}
                      />
                      <small className="text-muted">Screenshots, logs, etc.</small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-check-circle me-2"></i>Create Ticket
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-ticket-perforated me-2"></i>Ticket Details: {selectedTicket.ticket_id}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedTicket(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Date Reported:</strong>
                    <p>{new Date(selectedTicket.date_reported).toLocaleString()}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Reported By:</strong>
                    <p>{selectedTicket.reported_by_name || selectedTicket.reported_by_email || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Category:</strong>
                    <p>{selectedTicket.category}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Priority:</strong>
                    <p>
                      <span className={`badge bg-${getPriorityBadge(selectedTicket.priority)}`}>
                        {selectedTicket.priority}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <strong>Status:</strong>
                    <p>
                      <span className={`badge bg-${getStatusBadge(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <strong>Assigned To:</strong>
                    <p>{selectedTicket.assigned_to_name || 'Unassigned'}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <strong>Subject:</strong>
                  <p>{selectedTicket.subject}</p>
                </div>

                <div className="mb-3">
                  <strong>Description:</strong>
                  <div className="border p-3 bg-light">
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                      {selectedTicket.description}
                    </pre>
                  </div>
                </div>

                {selectedTicket.root_cause && (
                  <div className="mb-3">
                    <strong>Root Cause:</strong>
                    <p>{selectedTicket.root_cause}</p>
                  </div>
                )}

                {(selectedTicket.client_impact || selectedTicket.student_impact) && (
                  <div className="mb-3">
                    <strong>Impact:</strong>
                    {selectedTicket.client_impact && (
                      <div className="alert alert-warning mb-2">
                        <strong>Client Impact:</strong> {selectedTicket.client_impact_description || 'Yes'}
                      </div>
                    )}
                    {selectedTicket.student_impact && (
                      <div className="alert alert-warning mb-2">
                        <strong>Student Impact:</strong> {selectedTicket.student_impact_description || 'Yes'}
                      </div>
                    )}
                  </div>
                )}

                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Resolution Time:</strong>
                    <p>{formatResolutionTime(selectedTicket.resolution_time)}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>SLA Compliance:</strong>
                    <p>
                      {selectedTicket.sla_compliance ? (
                        <span className="badge bg-success">Compliant</span>
                      ) : (
                        <span className="badge bg-danger">Non-Compliant</span>
                      )}
                    </p>
                  </div>
                </div>

                {selectedTicket.attachments && (
                  <div className="mb-3">
                    <strong>Attachments:</strong>
                    <div className="mt-2">
                      {JSON.parse(selectedTicket.attachments || '[]').map((url, idx) => (
                        <div key={idx} className="d-flex align-items-center mb-2">
                          <i className="bi bi-paperclip me-2"></i>
                          <span className="me-2">Attachment {idx + 1}</span>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-info"
                              onClick={() => handleViewDocument(url)}
                              title="View"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleDownloadDocument(url, `attachment_${idx + 1}`)}
                              title="Download"
                            >
                              <i className="bi bi-download"></i>
                            </button>
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => handlePrintDocument(url)}
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
              <div className="modal-footer">
                {selectedTicket.status !== 'Closed' && (
                  <div className="btn-group me-2">
                    {selectedTicket.status === 'New' && (
                      <button
                        className="btn btn-warning"
                        onClick={() => updateTicketStatus(selectedTicket.id, 'In Progress')}
                      >
                        <i className="bi bi-play-circle me-2"></i>Start Progress
                      </button>
                    )}
                    {selectedTicket.status === 'In Progress' && (
                      <button
                        className="btn btn-success"
                        onClick={() => updateTicketStatus(selectedTicket.id, 'Resolved')}
                      >
                        <i className="bi bi-check-circle me-2"></i>Mark Resolved
                      </button>
                    )}
                    {selectedTicket.status === 'Resolved' && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => updateTicketStatus(selectedTicket.id, 'Closed')}
                      >
                        <i className="bi bi-x-circle me-2"></i>Close Ticket
                      </button>
                    )}
                  </div>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketTracker;

