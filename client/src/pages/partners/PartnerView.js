import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';

const PartnerView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartner();
  }, [id]);

  const fetchPartner = async () => {
    try {
      const response = await api.get(`/partners/${id}`);
      setPartner(response.data.partner);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load partner details');
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
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/partners')}>
          Back to Partners
        </button>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="alert alert-warning">
        Partner not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/partners')}>
          Back to Partners
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/partners')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Partner Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              {partner.profile_image && partner.profile_image.trim() !== '' ? (
                <img 
                  src={partner.profile_image.startsWith('http') ? partner.profile_image : `http://localhost:3002${partner.profile_image}`}
                  alt={partner.company_name} 
                  className="img-fluid rounded-circle mb-3"
                  style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '150px', height: '150px' }}>
                  <i className="bi bi-building" style={{ fontSize: '4rem', color: 'white' }}></i>
                </div>
              )}
              <h4>{partner.company_name}</h4>
              {partner.name && <p className="text-muted">{partner.name}</p>}
              {partner.email && <p className="text-muted small">{partner.email}</p>}
              <span className={`badge bg-${partner.status === 'Active' ? 'success' : 'secondary'} fs-6`}>
                {partner.status}
              </span>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Partner Information</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Partner ID:</strong>
                  <p>{partner.partner_id}</p>
                </div>
                <div className="col-md-6">
                  <strong>Partnership Type:</strong>
                  <p><span className="badge bg-info">{partner.partnership_type}</span></p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Contact Person:</strong>
                  <p>{partner.contact_person || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Status:</strong>
                  <p>
                    <span className={`badge bg-${partner.status === 'Active' ? 'success' : 'secondary'}`}>
                      {partner.status}
                    </span>
                  </p>
                </div>
              </div>

              {partner.notes && (
                <div className="mb-3">
                  <strong>Notes:</strong>
                  <p>{partner.notes}</p>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(partner.created_at).toLocaleDateString()}</p>
                </div>
                <div className="col-md-6">
                  <strong>Last Updated:</strong>
                  <p>{partner.updated_at ? new Date(partner.updated_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerView;

