import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';

const Appraisals = () => {
  const { user } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [summary, setSummary] = useState([]);
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'my-history', 'summary' (admin only)
  const [editingAppraisal, setEditingAppraisal] = useState(null);
  const [formData, setFormData] = useState({
    staff_id: '',
    department_id: '',
    department_name: '',
    appraised_by_user_id: '',
    appraised_by_name: '',
    grade_level_appraise: '',
    grade_level_management: '',
    comment_appraise: '',
    comment_management: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAppraisals();
    fetchStaff();
    fetchDepartments();
    
    const socket = getSocket();
    if (socket) {
      socket.on('appraisal_created', handleAppraisalCreated);
      socket.on('appraisal_updated', handleAppraisalUpdated);
      socket.on('appraisal_deleted', handleAppraisalDeleted);
      socket.on('appraisal_received', handleAppraisalReceived);
      
      return () => {
        socket.off('appraisal_created', handleAppraisalCreated);
        socket.off('appraisal_updated', handleAppraisalUpdated);
        socket.off('appraisal_deleted', handleAppraisalDeleted);
        socket.off('appraisal_received', handleAppraisalReceived);
      };
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'summary' && user?.role === 'Admin') {
      fetchSummary();
    } else if (activeTab === 'my-history') {
      fetchMyHistory();
    } else {
      fetchAppraisals();
    }
  }, [activeTab]);

  const fetchAppraisals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appraisals');
      setAppraisals(response.data.appraisals || []);
    } catch (error) {
      console.error('Error fetching appraisals:', error);
      setError('Failed to load appraisals');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appraisals/my-history');
      setAppraisals(response.data.appraisals || []);
    } catch (error) {
      console.error('Error fetching my history:', error);
      setError('Failed to load appraisal history');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appraisals/summary');
      setSummary(response.data.summaries || []);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setError('Failed to load appraisal summary');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/appraisals/staff');
      setStaff(response.data.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
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

  const fetchDepartmentStaff = async (departmentId) => {
    try {
      const response = await api.get(`/appraisals/departments/${departmentId}/staff`);
      setDepartmentStaff(response.data);
    } catch (error) {
      console.error('Error fetching department staff:', error);
      setDepartmentStaff({ department_head: null, staff: [] });
    }
  };

  const handleDepartmentChange = (e) => {
    const deptId = e.target.value;
    const dept = departments.find(d => d.id === parseInt(deptId));
    setSelectedDepartment(dept);
    setFormData({ ...formData, department_id: deptId, department_name: dept?.name || '' });
    if (deptId) {
      fetchDepartmentStaff(deptId);
    } else {
      setDepartmentStaff({ department_head: null, staff: [] });
    }
    setFormData(prev => ({ ...prev, appraised_by_user_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.staff_id || !formData.appraised_by_user_id || 
        !formData.grade_level_appraise || !formData.grade_level_management) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      // Get appraised by user details
      const appraisedByUser = [...staff, ...(departmentStaff.staff || []), departmentStaff.department_head].find(
        u => u && (u.user_id === parseInt(formData.appraised_by_user_id) || u.id === parseInt(formData.appraised_by_user_id))
      );

      const payload = {
        ...formData,
        appraised_by_user_id: parseInt(formData.appraised_by_user_id),
        appraised_by_name: appraisedByUser?.name || user.name,
        grade_level_appraise: parseInt(formData.grade_level_appraise),
        grade_level_management: parseInt(formData.grade_level_management)
      };

      if (editingAppraisal) {
        await api.put(`/appraisals/${editingAppraisal.id}`, payload);
        setSuccess('Appraisal updated successfully');
      } else {
        await api.post('/appraisals', payload);
        setSuccess('Appraisal created successfully');
      }

      setShowForm(false);
      setEditingAppraisal(null);
      resetForm();
      fetchAppraisals();
      if (activeTab === 'my-history') fetchMyHistory();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save appraisal');
    }
  };

  const handleEdit = (appraisal) => {
    setEditingAppraisal(appraisal);
    setFormData({
      staff_id: appraisal.staff_id,
      department_id: appraisal.department_id || '',
      department_name: appraisal.department_name || '',
      appraised_by_user_id: appraisal.appraised_by_user_id,
      appraised_by_name: appraisal.appraised_by_name || '',
      grade_level_appraise: appraisal.grade_level_appraise.toString(),
      grade_level_management: appraisal.grade_level_management.toString(),
      comment_appraise: appraisal.comment_appraise || '',
      comment_management: appraisal.comment_management || ''
    });
    if (appraisal.department_id) {
      fetchDepartmentStaff(appraisal.department_id);
    }
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appraisal?')) {
      return;
    }

    try {
      await api.delete(`/appraisals/${id}`);
      setSuccess('Appraisal deleted successfully');
      fetchAppraisals();
      if (activeTab === 'my-history') fetchMyHistory();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete appraisal');
    }
  };

  const resetForm = () => {
    setFormData({
      staff_id: '',
      department_id: '',
      department_name: '',
      appraised_by_user_id: '',
      appraised_by_name: '',
      grade_level_appraise: '',
      grade_level_management: '',
      comment_appraise: '',
      comment_management: ''
    });
    setSelectedDepartment(null);
    setDepartmentStaff({ department_head: null, staff: [] });
  };

  const handleAppraisalCreated = () => {
    fetchAppraisals();
    if (activeTab === 'my-history') fetchMyHistory();
  };

  const handleAppraisalUpdated = () => {
    fetchAppraisals();
    if (activeTab === 'my-history') fetchMyHistory();
    if (activeTab === 'summary') fetchSummary();
  };

  const handleAppraisalDeleted = () => {
    fetchAppraisals();
    if (activeTab === 'my-history') fetchMyHistory();
    if (activeTab === 'summary') fetchSummary();
  };

  const handleAppraisalReceived = () => {
    fetchAppraisals();
    if (activeTab === 'my-history') fetchMyHistory();
  };

  const getGradeLevelLabel = (level) => {
    const labels = { 1: 'Excellent', 2: 'Good', 3: 'Needs Improvement' };
    return labels[level] || level;
  };

  const getGradeLevelClass = (level) => {
    const classes = { 1: 'success', 2: 'warning', 3: 'danger' };
    return classes[level] || 'secondary';
  };

  if (loading && appraisals.length === 0) {
    return <div className="container mt-4"><div className="text-center">Loading...</div></div>;
  }

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Appraisal Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingAppraisal(null);
            resetForm();
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>Add Appraisal
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Appraisals
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'my-history' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-history')}
          >
            My History
          </button>
        </li>
        {user?.role === 'Admin' && (
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              Grade Level Summary
            </button>
          </li>
        )}
      </ul>

      {/* Content based on active tab */}
      {activeTab === 'summary' ? (
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">Grade Level Summary (Admin Only)</h5>
          </div>
          <div className="card-body">
            {summary.length === 0 ? (
              <p className="text-center text-muted">No appraisal summaries available</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Total Appraisals</th>
                      <th>Avg. Grade (Appraise)</th>
                      <th>Avg. Grade (Management)</th>
                      <th>Overall Grade Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.user_id}>
                        <td>{s.user_name}</td>
                        <td>{s.user_email}</td>
                        <td>{s.user_role}</td>
                        <td>{s.total_appraisals}</td>
                        <td>
                          <span className={`badge bg-${getGradeLevelClass(Math.round(s.average_grade_appraise))}`}>
                            {s.average_grade_appraise.toFixed(2)} - {getGradeLevelLabel(Math.round(s.average_grade_appraise))}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${getGradeLevelClass(Math.round(s.average_grade_management))}`}>
                            {s.average_grade_management.toFixed(2)} - {getGradeLevelLabel(Math.round(s.average_grade_management))}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${getGradeLevelClass(Math.round(s.overall_grade_level))}`}>
                            {s.overall_grade_level.toFixed(2)} - {getGradeLevelLabel(Math.round(s.overall_grade_level))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">
              {activeTab === 'my-history' ? 'My Appraisal History (Given & Received)' : 'All Appraisals'}
            </h5>
          </div>
          <div className="card-body">
            {appraisals.length === 0 ? (
              <p className="text-center text-muted">No appraisals found</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Department</th>
                      <th>Appraised By</th>
                      <th>Grade (Appraise)</th>
                      <th>Grade (Management)</th>
                      <th>Comment (Appraise)</th>
                      <th>Comment (Management)</th>
                      <th>Date</th>
                      {activeTab === 'my-history' && <th>Type</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appraisals.map((appraisal) => (
                      <tr key={appraisal.id}>
                        <td>{appraisal.staff_full_name || appraisal.staff_name}</td>
                        <td>{appraisal.department_name}</td>
                        <td>{appraisal.appraised_by_full_name || appraisal.appraised_by_name}</td>
                        <td>
                          <span className={`badge bg-${getGradeLevelClass(appraisal.grade_level_appraise)}`}>
                            {appraisal.grade_level_appraise} - {getGradeLevelLabel(appraisal.grade_level_appraise)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${getGradeLevelClass(appraisal.grade_level_management)}`}>
                            {appraisal.grade_level_management} - {getGradeLevelLabel(appraisal.grade_level_management)}
                          </span>
                        </td>
                        <td>{appraisal.comment_appraise || '-'}</td>
                        <td>{appraisal.comment_management || '-'}</td>
                        <td>{new Date(appraisal.created_at).toLocaleDateString()}</td>
                        {activeTab === 'my-history' && (
                          <td>
                            <span className={`badge bg-${appraisal.appraisal_type === 'received' ? 'info' : 'primary'}`}>
                              {appraisal.appraisal_type === 'received' ? 'Received' : 'Given'}
                            </span>
                          </td>
                        )}
                        <td>
                          {(appraisal.appraised_by_user_id === user.id || user.role === 'Admin') && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-primary me-2"
                                onClick={() => handleEdit(appraisal)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(appraisal.id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingAppraisal ? 'Edit Appraisal' : 'Add Appraisal'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingAppraisal(null);
                    resetForm();
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Staff Name *</label>
                    <select
                      className="form-select"
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                      required
                    >
                      <option value="">Select staff...</option>
                      {staff.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} ({s.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Department Appraisal Going To *</label>
                    <select
                      className="form-select"
                      value={formData.department_id}
                      onChange={handleDepartmentChange}
                      required
                    >
                      <option value="">Select department...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Department Head Name or Staff Within Department *</label>
                    <select
                      className="form-select"
                      value={formData.appraised_by_user_id}
                      onChange={(e) => {
                        const selected = [...(departmentStaff.staff || []), departmentStaff.department_head].find(
                          u => u && (u.user_id === parseInt(e.target.value) || u.id === parseInt(e.target.value))
                        );
                        setFormData({ 
                          ...formData, 
                          appraised_by_user_id: e.target.value,
                          appraised_by_name: selected?.name || ''
                        });
                      }}
                      required
                      disabled={!formData.department_id}
                    >
                      <option value="">Select department head or staff...</option>
                      {departmentStaff.department_head && (
                        <option value={departmentStaff.department_head.user_id || departmentStaff.department_head.id}>
                          {departmentStaff.department_head.name} (Department Head)
                        </option>
                      )}
                      {departmentStaff.staff && departmentStaff.staff.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} (Staff)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Grade Level (Appraise) *</label>
                      <select
                        className="form-select"
                        value={formData.grade_level_appraise}
                        onChange={(e) => setFormData({ ...formData, grade_level_appraise: e.target.value })}
                        required
                      >
                        <option value="">Select grade...</option>
                        <option value="1">1 - Excellent</option>
                        <option value="2">2 - Good</option>
                        <option value="3">3 - Needs Improvement</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Grade Level (Management) *</label>
                      <select
                        className="form-select"
                        value={formData.grade_level_management}
                        onChange={(e) => setFormData({ ...formData, grade_level_management: e.target.value })}
                        required
                      >
                        <option value="">Select grade...</option>
                        <option value="1">1 - Excellent</option>
                        <option value="2">2 - Good</option>
                        <option value="3">3 - Needs Improvement</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Comment for Appraise</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.comment_appraise}
                      onChange={(e) => setFormData({ ...formData, comment_appraise: e.target.value })}
                      placeholder="Enter comment for appraise..."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Comment for Management</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.comment_management}
                      onChange={(e) => setFormData({ ...formData, comment_management: e.target.value })}
                      placeholder="Enter comment for management..."
                    />
                  </div>

                  <div className="d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-secondary me-2"
                      onClick={() => {
                        setShowForm(false);
                        setEditingAppraisal(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingAppraisal ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appraisals;

