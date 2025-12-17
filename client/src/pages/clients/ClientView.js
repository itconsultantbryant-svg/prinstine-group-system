import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { getSocket } from '../../config/socket';
import { useAuth } from '../../hooks/useAuth';
import { normalizeUrl } from '../../utils/apiUrl';

const ClientView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClient();
  }, [id]);

  // Set up real-time socket connection for client updates
  useEffect(() => {
    if (!user || !client) return;

    const socket = getSocket();
    if (!socket) return;

    const handleClientUpdated = (updatedClient) => {
      // Only update if this is the client we're viewing
      if (updatedClient.id === parseInt(id) || updatedClient.client_id === client.client_id) {
        console.log('Client updated event received in ClientView:', updatedClient);
        // Refresh client data
        fetchClient();
      }
    };

    const handleClientDeleted = (deletedClient) => {
      // If the client being viewed was deleted, navigate back
      if (deletedClient.id === parseInt(id) || deletedClient.client_id === client.client_id) {
        console.log('Client deleted event received in ClientView');
        setError('This client has been deleted');
        setTimeout(() => navigate('/clients'), 2000);
      }
    };

    socket.on('client_updated', handleClientUpdated);
    socket.on('client_deleted', handleClientDeleted);

    return () => {
      socket.off('client_updated', handleClientUpdated);
      socket.off('client_deleted', handleClientDeleted);
    };
  }, [user, client, id, navigate]);

  const fetchClient = async () => {
    try {
      const response = await api.get(`/clients/${id}`);
      setClient(response.data.client);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/clients')}>
          Back to Clients
        </button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="alert alert-warning">
        Client not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/clients')}>
          Back to Clients
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/clients')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Client Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              {client.profile_image && client.profile_image.trim() !== '' ? (
                <img 
                  src={client.profile_image.startsWith('http') ? client.profile_image : normalizeUrl(client.profile_image)}
                  alt={client.name} 
                  className="img-fluid rounded-circle mb-3"
                  style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="bg-secondary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '150px', height: '150px' }}>
                  <i className="bi bi-person" style={{ fontSize: '4rem', color: 'white' }}></i>
                </div>
              )}
              <h4>{client.name}</h4>
              <p className="text-muted">{client.email}</p>
              <span className={`badge bg-${client.status === 'Active' ? 'success' : 'secondary'} fs-6`}>
                {client.status}
              </span>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Client Information</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Client ID:</strong>
                  <p>{client.client_id}</p>
                </div>
                <div className="col-md-6">
                  <strong>Phone:</strong>
                  <p>{client.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Company Name:</strong>
                  <p>{client.company_name || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Services Availed:</strong>
                  <p>
                    {client.services_availed ? (
                      JSON.parse(client.services_availed).map((service, idx) => (
                        <span key={idx} className="badge bg-info me-1">{service}</span>
                      ))
                    ) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Services Fees:</strong>
                  <p>${client.services_fees ? parseFloat(client.services_fees).toLocaleString() : (client.loan_amount ? parseFloat(client.loan_amount).toLocaleString() : '0.00')}</p>
                </div>
                <div className="col-md-6">
                  <strong>Payment Term:</strong>
                  <p>{client.payment_term || (client.loan_interest_rate ? `${client.loan_interest_rate}% (Legacy)` : 'N/A')}</p>
                </div>
              </div>

              {/* Show loan fields only if they exist (for backward compatibility) */}
              {(client.loan_amount || client.loan_interest_rate) && !client.services_fees && !client.payment_term && (
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Loan Amount (Legacy):</strong>
                    <p>${client.loan_amount ? parseFloat(client.loan_amount).toLocaleString() : '0.00'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Loan Interest Rate (Legacy):</strong>
                    <p>{client.loan_interest_rate ? `${client.loan_interest_rate}%` : 'N/A'}</p>
                  </div>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Total Consultations:</strong>
                  <p>{client.total_consultations || 0}</p>
                </div>
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(client.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientView;

