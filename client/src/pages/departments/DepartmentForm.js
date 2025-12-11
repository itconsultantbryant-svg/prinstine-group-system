import React, { useState, useEffect } from 'react';
import api from '../../config/api';

const DepartmentForm = ({ department, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head_name: '',
    head_email: '',
    head_phone: '',
    head_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        description: department.description || '',
        head_name: department.head_name || '',
        head_email: department.head_email || '',
        head_phone: department.head_phone || '',
        head_password: '' // Don't populate password for security
      });
    }
  }, [department]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (department) {
        await api.put(`/departments/${department.id}`, formData);
      } else {
        const response = await api.post('/departments', formData);
        console.log('Department created:', response.data);
      }
      onClose();
    } catch (err) {
      console.error('Department save error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to save department';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {department ? 'Edit Department' : 'Add Department'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              <div className="mb-3">
                <label className="form-label">Department Name *</label>
                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <hr className="my-4" />
              <h6 className="mb-3">Department Head Information</h6>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Head Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="head_name"
                    value={formData.head_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Head Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    name="head_email"
                    value={formData.head_email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Head Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    name="head_phone"
                    value={formData.head_phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    {department ? 'New Password (leave blank to keep current)' : 'Head Password *'}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    name="head_password"
                    value={formData.head_password}
                    onChange={handleChange}
                    required={!department}
                    minLength={6}
                    placeholder={department ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
                  />
                  {department && (
                    <small className="text-muted">Leave blank to keep the current password</small>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : department ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DepartmentForm;

