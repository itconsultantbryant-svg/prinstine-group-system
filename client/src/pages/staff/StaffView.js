import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { normalizeUrl } from '../../utils/apiUrl';

const StaffView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStaff();
  }, [id]);

  const fetchStaff = async () => {
    try {
      const response = await api.get(`/staff/${id}`);
      setStaff(response.data.staff);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load staff details');
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
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/staff')}>
          Back to Staff
        </button>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="alert alert-warning">
        Staff member not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/staff')}>
          Back to Staff
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/staff')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Staff Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              {staff.profile_image && staff.profile_image.trim() !== '' ? (
                <img 
                  src={staff.profile_image.startsWith('http') ? staff.profile_image : normalizeUrl(staff.profile_image)}
                  alt={staff.name} 
                  className="img-fluid rounded-circle mb-3"
                  style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '150px', height: '150px' }}>
                  <i className="bi bi-person" style={{ fontSize: '4rem', color: 'white' }}></i>
                </div>
              )}
              <h4>{staff.name}</h4>
              <p className="text-muted">{staff.email}</p>
              <span className={`badge bg-${
                staff.employment_type === 'Full-time' ? 'primary' :
                staff.employment_type === 'Part-time' ? 'warning' : 'success'
              } fs-6`}>
                {staff.employment_type}
              </span>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Staff Information</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Staff ID:</strong>
                  <p>{staff.staff_id}</p>
                </div>
                <div className="col-md-6">
                  <strong>Phone:</strong>
                  <p>{staff.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Position:</strong>
                  <p>{staff.position || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Department:</strong>
                  <p>{staff.department || 'N/A'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Employment Date:</strong>
                  <p>{staff.employment_date ? new Date(staff.employment_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Base Salary:</strong>
                  <p>${staff.base_salary ? parseFloat(staff.base_salary).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              {staff.address && (
                <div className="mb-3">
                  <strong>Address:</strong>
                  <p>{staff.address}</p>
                </div>
              )}

              {(staff.emergency_contact_name || staff.emergency_contact_phone) && (
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Emergency Contact:</strong>
                    <p>{staff.emergency_contact_name || 'N/A'}</p>
                  </div>
                  <div className="col-md-6">
                    <strong>Emergency Phone:</strong>
                    <p>{staff.emergency_contact_phone || 'N/A'}</p>
                  </div>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(staff.created_at).toLocaleDateString()}</p>
                </div>
                <div className="col-md-6">
                  <strong>Status:</strong>
                  <p>
                    <span className={`badge bg-${staff.is_active ? 'success' : 'danger'}`}>
                      {staff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffView;

