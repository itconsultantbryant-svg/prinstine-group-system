import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { normalizeUrl } from '../../utils/apiUrl';
import PartnerForm from './PartnerForm';

const PartnerManagement = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const response = await api.get('/partners');
      setPartners(response.data.partners);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPartner(null);
    setShowForm(true);
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this partner?')) {
      try {
        await api.delete(`/partners/${id}`);
        fetchPartners();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting partner');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPartner(null);
    fetchPartners();
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
          <h1 className="h3 mb-0">Partner Management</h1>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Add Partner
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
                  <th>Partner ID</th>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No partners found. Click "Add Partner" to create one.
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id}>
                      <td>
                        {partner.profile_image && partner.profile_image.trim() !== '' ? (
                          <img
                            src={partner.profile_image.startsWith('http') ? partner.profile_image : normalizeUrl(partner.profile_image)}
                            alt={partner.company_name}
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
                            <i className="bi bi-building text-white"></i>
                          </div>
                        )}
                      </td>
                      <td>{partner.partner_id}</td>
                      <td>{partner.company_name}</td>
                      <td>{partner.contact_person || 'N/A'}</td>
                      <td>
                        <span className="badge bg-info">{partner.partnership_type}</span>
                      </td>
                      <td>
                        <span className={`badge bg-${
                          partner.status === 'Active' ? 'success' : 'secondary'
                        }`}>
                          {partner.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/partners/view/${partner.id}`} className="btn btn-sm btn-outline-info me-2">
                          <i className="bi bi-eye me-1"></i>View
                        </Link>
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(partner)}>
                          <i className="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(partner.id)}>
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
        <PartnerForm
          partner={editingPartner}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default PartnerManagement;

