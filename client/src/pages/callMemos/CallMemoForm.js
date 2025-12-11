import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const CallMemoForm = ({ callMemo, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    participants: '',
    subject: '',
    call_date: new Date().toISOString().split('T')[0],
    discussion: '',
    service_needed: '',
    service_other: '',
    department_needed: '',
    next_visitation_date: ''
  });

  useEffect(() => {
    fetchClients();
    fetchDepartments();
    if (callMemo) {
      setFormData({
        client_id: callMemo.client_id || '',
        client_name: callMemo.client_name || '',
        participants: callMemo.participants || '',
        subject: callMemo.subject || '',
        call_date: callMemo.call_date ? callMemo.call_date.split('T')[0] : new Date().toISOString().split('T')[0],
        discussion: callMemo.discussion || '',
        service_needed: callMemo.service_needed || '',
        service_other: callMemo.service_other || '',
        department_needed: callMemo.department_needed || '',
        next_visitation_date: callMemo.next_visitation_date ? callMemo.next_visitation_date.split('T')[0] : ''
      });
    }
  }, [callMemo]);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      const clientsList = response.data.clients || [];
      setClients(clientsList);
      console.log('Fetched clients:', clientsList.length);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If client is selected from dropdown, set client_name
    if (name === 'client_id') {
      const selectedClient = clients.find(c => c.id === parseInt(value));
      if (selectedClient) {
        // Client name is in the users table (u.name), fallback to company_name or client_id
        const clientName = selectedClient.name || selectedClient.company_name || selectedClient.client_id || 'Unknown Client';
        setFormData(prev => ({ ...prev, client_name: clientName }));
      }
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      alert('Please enter a client name');
      return;
    }

    try {
      // Generate a temporary email if not provided
      const tempEmail = `${newClientName.toLowerCase().replace(/\s+/g, '.')}@client.prinstinegroup.org`;
      
      const response = await api.post('/clients', {
        name: newClientName,
        email: tempEmail,
        phone: '',
        status: 'Active'
      });
      
      setFormData(prev => ({ 
        ...prev, 
        client_id: response.data.client.id,
        client_name: newClientName
      }));
      setShowAddClient(false);
      setNewClientName('');
      fetchClients();
      alert('Client added successfully');
    } catch (error) {
      console.error('Error adding client:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to add client';
      alert(errorMsg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.client_name || !formData.participants || !formData.subject || 
        !formData.call_date || !formData.discussion || !formData.service_needed) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.service_needed === 'Others' && !formData.service_other) {
      setError('Please specify the service when selecting "Others"');
      return;
    }

    setLoading(true);

    try {
      if (callMemo) {
        await api.put(`/call-memos/${callMemo.id}`, formData);
        alert('Call memo updated successfully');
      } else {
        await api.post('/call-memos', formData);
        alert('Call memo created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving call memo:', error);
      setError(error.response?.data?.error || 'Failed to save call memo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{callMemo ? 'Edit Call Memo' : 'Create Call Memo'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="mb-3">
                <label className="form-label">Client Name <span className="text-danger">*</span></label>
                <div className="input-group">
                  <select
                    className="form-select"
                    name="client_id"
                    value={formData.client_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => {
                      const displayName = client.name || client.company_name || client.client_id || 'Unknown Client';
                      return (
                        <option key={client.id} value={client.id}>{displayName}</option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowAddClient(!showAddClient)}
                  >
                    <i className="bi bi-plus-circle me-1"></i>Add Client
                  </button>
                </div>
                {showAddClient && (
                  <div className="mt-2">
                    <div className="input-group mb-2">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter client name"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddClient();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAddClient}
                      >
                        <i className="bi bi-plus-circle me-1"></i>Add Client
                      </button>
                    </div>
                    <small className="text-muted">
                      A temporary email will be generated automatically. You can update it later in the client management section.
                    </small>
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Participants <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  name="participants"
                  value={formData.participants}
                  onChange={handleChange}
                  placeholder="Enter participants names"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Subject <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Enter call subject"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className="form-control"
                  name="call_date"
                  value={formData.call_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Discussion <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  name="discussion"
                  value={formData.discussion}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Enter discussion details"
                  required
                ></textarea>
              </div>

              <div className="mb-3">
                <label className="form-label">Service Needed <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  name="service_needed"
                  value={formData.service_needed}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Service</option>
                  <option value="Consultancy">Consultancy</option>
                  <option value="Training (Academy)">Training (Academy)</option>
                  <option value="Web Development">Web Development</option>
                  <option value="System Development">System Development</option>
                  <option value="Audit">Audit</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              {formData.service_needed === 'Others' && (
                <div className="mb-3">
                  <label className="form-label">Specify Service <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    name="service_other"
                    value={formData.service_other}
                    onChange={handleChange}
                    placeholder="Enter service name"
                    required
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Department Needed for Support</label>
                <select
                  className="form-select"
                  name="department_needed"
                  value={formData.department_needed}
                  onChange={handleChange}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">Next Visitation Date (if any)</label>
                <input
                  type="date"
                  className="form-control"
                  name="next_visitation_date"
                  value={formData.next_visitation_date}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (callMemo ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CallMemoForm;

