import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const RequisitionForm = ({ requisition, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [targetType, setTargetType] = useState(''); // 'user' or 'role'
  
  const [formData, setFormData] = useState({
    requisition_date: new Date().toISOString().split('T')[0],
    request_type: '',
    materials: '',
    cost: '',
    quantity: '',
    purpose: '',
    period_from: '',
    period_to: '',
    leave_purpose: '',
    target_user_id: '',
    target_role: ''
  });

  const [file, setFile] = useState(null);

  const requestTypes = [
    { value: 'office_supplies', label: 'Office Supplies' },
    { value: 'work_support', label: 'Work Support' },
    { value: 'sick_leave', label: 'Sick Leave' },
    { value: 'temporary_leave', label: 'Temporary Leave' },
    { value: 'vacation', label: 'Vacation' },
    { value: 'annual_leave', label: 'Annual Leave' }
  ];

  const roles = ['Admin', 'Staff', 'DepartmentHead', 'Instructor', 'Student', 'Client', 'Partner'];

  useEffect(() => {
    fetchUsers();
    if (requisition) {
      setFormData({
        requisition_date: requisition.requisition_date ? requisition.requisition_date.split('T')[0] : new Date().toISOString().split('T')[0],
        request_type: requisition.request_type || '',
        materials: requisition.materials || '',
        cost: requisition.cost || '',
        quantity: requisition.quantity || '',
        purpose: requisition.purpose || '',
        period_from: requisition.period_from ? requisition.period_from.split('T')[0] : '',
        period_to: requisition.period_to ? requisition.period_to.split('T')[0] : '',
        leave_purpose: requisition.leave_purpose || '',
        target_user_id: requisition.target_user_id || '',
        target_role: requisition.target_role || ''
      });
      setSelectedUserId(requisition.target_user_id || '');
      setSelectedRole(requisition.target_role || '');
      setTargetType(requisition.target_user_id ? 'user' : (requisition.target_role ? 'role' : ''));
    }
  }, [requisition]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.requisition_date || !formData.request_type) {
      setError('Date and request type are required');
      return;
    }

    // Validate based on request type
    if (formData.request_type === 'office_supplies') {
      if (!formData.materials || !formData.cost || !formData.quantity) {
        setError('Materials, cost, and quantity are required for office supplies');
        return;
      }
    } else if (formData.request_type === 'work_support') {
      if (!formData.purpose) {
        setError('Purpose is required for work support');
        return;
      }
    } else if (['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(formData.request_type)) {
      if (!formData.period_from || !formData.period_to || !formData.leave_purpose) {
        setError('Period (from/to) and purpose are required for leave requests');
        return;
      }
    }

    // Target user/role is optional - system will route based on request type
    // But we still need to ensure at least one is selected if the form requires it
    // For now, we'll make it optional as per requirements

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('requisition_date', formData.requisition_date);
      submitData.append('request_type', formData.request_type);
      
      if (formData.request_type === 'office_supplies') {
        submitData.append('materials', formData.materials);
        submitData.append('cost', formData.cost);
        submitData.append('quantity', formData.quantity);
      } else if (formData.request_type === 'work_support') {
        submitData.append('purpose', formData.purpose);
      } else if (['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(formData.request_type)) {
        submitData.append('period_from', formData.period_from);
        submitData.append('period_to', formData.period_to);
        submitData.append('leave_purpose', formData.leave_purpose);
      }
      
      if (selectedUserId) {
        submitData.append('target_user_id', selectedUserId);
      }
      if (selectedRole) {
        submitData.append('target_role', selectedRole);
      }
      
      if (file) {
        submitData.append('document', file);
      }

      if (requisition) {
        await api.put(`/requisitions/${requisition.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Requisition updated successfully');
      } else {
        await api.post('/requisitions', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Requisition submitted successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving requisition:', error);
      setError(error.response?.data?.error || 'Failed to save requisition');
    } finally {
      setLoading(false);
    }
  };

  const isLeaveRequest = ['sick_leave', 'temporary_leave', 'vacation', 'annual_leave'].includes(formData.request_type);

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{requisition ? 'Edit Requisition' : 'Create Requisition'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Date <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    className="form-control"
                    name="requisition_date"
                    value={formData.requisition_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Request Type <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    name="request_type"
                    value={formData.request_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Request Type</option>
                    {requestTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Office Supplies Fields */}
              {formData.request_type === 'office_supplies' && (
                <>
                  <div className="mb-3">
                    <label className="form-label">Materials <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      name="materials"
                      value={formData.materials}
                      onChange={handleChange}
                      placeholder="Enter materials needed"
                      required
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Cost <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        className="form-control"
                        name="cost"
                        value={formData.cost}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Quantity <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        className="form-control"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleChange}
                        placeholder="0"
                        min="1"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Work Support Fields */}
              {formData.request_type === 'work_support' && (
                <div className="mb-3">
                  <label className="form-label">Purpose of Support <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Enter purpose of work support needed"
                    required
                  ></textarea>
                </div>
              )}

              {/* Leave Fields */}
              {isLeaveRequest && (
                <>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Period From <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        name="period_from"
                        value={formData.period_from}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Period To <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        className="form-control"
                        name="period_to"
                        value={formData.period_to}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Purpose <span className="text-danger">*</span></label>
                    <textarea
                      className="form-control"
                      name="leave_purpose"
                      value={formData.leave_purpose}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Enter purpose for leave"
                      required
                    ></textarea>
                  </div>
                </>
              )}

              {/* Target Selection */}
              <div className="mb-3">
                <label className="form-label">Direct Request To</label>
                <div className="btn-group w-100 mb-3" role="group">
                  <input
                    type="radio"
                    className="btn-check"
                    name="targetType"
                    id="target-user"
                    autoComplete="off"
                    checked={targetType === 'user'}
                    onChange={() => {
                      setTargetType('user');
                      setSelectedRole('');
                    }}
                  />
                  <label className="btn btn-outline-primary" htmlFor="target-user">
                    By User
                  </label>
                  <input
                    type="radio"
                    className="btn-check"
                    name="targetType"
                    id="target-role"
                    autoComplete="off"
                    checked={targetType === 'role'}
                    onChange={() => {
                      setTargetType('role');
                      setSelectedUserId('');
                    }}
                  />
                  <label className="btn btn-outline-primary" htmlFor="target-role">
                    By Role
                  </label>
                </div>
                {targetType === 'user' && (
                  <select
                    className="form-select"
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                    }}
                  >
                    <option value="">Select User</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.username || u.email} ({u.email}) - {u.role}
                      </option>
                    ))}
                  </select>
                )}
                {targetType === 'role' && (
                  <select
                    className="form-select"
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                    }}
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                )}
                {!targetType && (
                  <div className="alert alert-info">
                    <small>Please select "By User" or "By Role" to direct this request (optional)</small>
                  </div>
                )}
              </div>

              {/* Document Upload */}
              <div className="mb-3">
                <label className="form-label">Attach Document (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                />
                <small className="text-muted">Allowed: PDF, Word, Excel, PowerPoint, Text, Images (Max 50MB)</small>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : (requisition ? 'Update' : 'Submit')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RequisitionForm;

