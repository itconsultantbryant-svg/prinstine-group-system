import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const ProposalForm = ({ proposal, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [file, setFile] = useState(null);
  
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    proposal_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchClients();
    if (proposal) {
      setFormData({
        client_id: proposal.client_id || '',
        client_name: proposal.client_name || '',
        proposal_date: proposal.proposal_date ? proposal.proposal_date.split('T')[0] : new Date().toISOString().split('T')[0]
      });
    }
  }, [proposal]);

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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
    if (!formData.client_name || !formData.proposal_date) {
      setError('Please fill in all required fields');
      return;
    }

    if (!file && !proposal) {
      setError('Please upload a proposal document');
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('client_id', formData.client_id || '');
      submitData.append('client_name', formData.client_name);
      submitData.append('proposal_date', formData.proposal_date);
      if (file) {
        submitData.append('document', file);
      }

      if (proposal) {
        await api.put(`/proposals/${proposal.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Proposal updated successfully');
      } else {
        await api.post('/proposals', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Proposal created successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving proposal:', error);
      setError(error.response?.data?.error || 'Failed to save proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{proposal ? 'Edit Proposal' : 'Create Proposal'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="mb-3">
                <label className="form-label">For (Client) <span className="text-danger">*</span></label>
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
                <label className="form-label">Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className="form-control"
                  name="proposal_date"
                  value={formData.proposal_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Upload Document <span className="text-danger">*</span></label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                  required={!proposal}
                />
                <small className="text-muted">Allowed formats: PDF, Word, Excel, Text (Max 50MB)</small>
                {proposal && proposal.document_name && (
                  <div className="mt-2">
                    <small>Current document: {proposal.document_name}</small>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (proposal ? 'Update' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProposalForm;

