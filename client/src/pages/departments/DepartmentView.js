import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';

const DepartmentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartment();
  }, [id]);

  const fetchDepartment = async () => {
    try {
      const response = await api.get(`/departments/${id}`);
      setDepartment(response.data.department);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load department details');
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
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/departments')}>
          Back to Departments
        </button>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="alert alert-warning">
        Department not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/departments')}>
          Back to Departments
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/departments')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Department Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">{department.name}</h5>
            </div>
            <div className="card-body">
              <div className="mb-4">
                <strong>Description:</strong>
                <p className="mt-2">{department.description || 'No description provided'}</p>
              </div>

              <hr />

              <h6 className="mb-3">Department Head Information</h6>
              <div className="row mb-3">
                <div className="col-md-4">
                  <strong>Head Name:</strong>
                  <p className="mt-1">{department.head_name || 'N/A'}</p>
                </div>
                <div className="col-md-4">
                  <strong>Head Email:</strong>
                  <p className="mt-1">
                    {department.head_email ? (
                      <a href={`mailto:${department.head_email}`}>{department.head_email}</a>
                    ) : (
                      'N/A'
                    )}
                  </p>
                </div>
                <div className="col-md-4">
                  <strong>Head Phone:</strong>
                  <p className="mt-1">
                    {department.head_phone ? (
                      <a href={`tel:${department.head_phone}`}>{department.head_phone}</a>
                    ) : (
                      'N/A'
                    )}
                  </p>
                </div>
              </div>

              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Login Credentials:</strong> The department head can login using:
                <ul className="mb-0 mt-2">
                  <li>Email: <code>{department.head_email || 'N/A'}</code></li>
                  <li>Password: The password set during department creation</li>
                </ul>
              </div>

              <hr />

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p className="mt-1">{new Date(department.created_at).toLocaleDateString()}</p>
                </div>
                <div className="col-md-6">
                  <strong>Last Updated:</strong>
                  <p className="mt-1">{department.updated_at ? new Date(department.updated_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentView;

