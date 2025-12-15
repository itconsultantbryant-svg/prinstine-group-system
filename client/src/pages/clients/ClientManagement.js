import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import ClientForm from './ClientForm';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';

const ClientManagement = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchClients();
    
    // Set up real-time socket connection for new clients and updates
    if (user) {
      const socket = getSocket();
      if (socket) {
        const handleClientCreated = async (newClient) => {
          console.log('Client created event received:', newClient);
          // Refresh the clients list to get the full client data
          setTimeout(() => {
            fetchClients();
          }, 300);
        };

        const handleClientUpdated = async (updatedClient) => {
          console.log('Client updated event received:', updatedClient);
          // Refresh the clients list to get the updated client data
          setTimeout(() => {
            fetchClients();
          }, 300);
        };

        socket.on('client_created', handleClientCreated);
        socket.on('client_updated', handleClientUpdated);

        return () => {
          socket.off('client_created', handleClientCreated);
          socket.off('client_updated', handleClientUpdated);
        };
      }
    }
  }, [user]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      console.log('Clients API response:', response.data);
      if (response.data && response.data.clients) {
        setClients(response.data.clients);
      } else {
        console.warn('Unexpected response format:', response.data);
        setClients([]);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      console.error('Error details:', error.response?.data || error.message);
      setClients([]);
      alert('Failed to load clients. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleEdit = async (client) => {
    try {
      const response = await api.get(`/clients/${client.id}`);
      setEditingClient(response.data.client);
      setShowForm(true);
    } catch (error) {
      console.error('Error fetching client details:', error);
      setEditingClient(client);
      setShowForm(true);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await api.delete(`/clients/${id}`);
        fetchClients();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting client');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingClient(null);
    fetchClients();
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

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">Client Management</h1>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Add Client
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Client ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Category</th>
                  <th>Progress Status</th>
                  <th>Added By</th>
                  <th>Services</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center text-muted">
                      No clients found. Click "Add Client" to create one.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        {client.profile_image && client.profile_image.trim() !== '' ? (
                          <img
                            src={client.profile_image.startsWith('http') ? client.profile_image : `http://localhost:3002${client.profile_image}`}
                            alt={client.name}
                            className="rounded-circle"
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            className="bg-secondary rounded-circle d-flex align-items-center justify-content-center"
                            style={{
                              width: '40px',
                              height: '40px'
                            }}
                          >
                            <i className="bi bi-person text-white"></i>
                          </div>
                        )}
                      </td>
                      <td>{client.client_id}</td>
                      <td>{client.name || 'N/A'}</td>
                      <td>{client.email || 'N/A'}</td>
                      <td>{client.company_name || 'N/A'}</td>
                      <td>
                        {client.category ? (
                          <span className="badge bg-info">{client.category}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {client.progress_status ? (
                          <span className={`badge bg-${
                            client.progress_status === 'signed contract' ? 'success' :
                            client.progress_status === 'pipeline client' ? 'warning' : 'info'
                          }`}>
                            {client.progress_status}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {client.created_by_name ? (
                          <small>
                            <i className="bi bi-person me-1"></i>
                            {client.created_by_name}
                          </small>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {client.services_availed ? (
                          JSON.parse(client.services_availed).map((service, idx) => (
                            <span key={idx} className="badge bg-info me-1">{service}</span>
                          ))
                        ) : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge bg-${
                          client.status === 'Active' ? 'success' : 'secondary'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/clients/view/${client.id}`} className="btn btn-sm btn-outline-info me-2">
                          <i className="bi bi-eye me-1"></i>View
                        </Link>
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(client)}>
                          <i className="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(client.id)}>
                          <i className="bi bi-trash me-1"></i>Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ClientForm
          client={editingClient}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default ClientManagement;

