import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';

const PayrollManagement = () => {
  const { user } = useAuth();
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    staff_id: '',
    payroll_period_start: '',
    payroll_period_end: '',
    gross_salary: '',
    deductions: '0',
    net_salary: '',
    bonus: '0',
    allowances: '0',
    tax_deductions: '0',
    other_deductions: '0',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPayrollRecords();
    fetchStaffMembers();

    // Set up real-time socket connection for payroll updates
    const socket = getSocket();
    if (socket) {
      const handlePayrollCreated = () => {
        fetchPayrollRecords();
      };

      const handlePayrollUpdated = () => {
        fetchPayrollRecords();
      };

      const handlePayrollDeleted = () => {
        fetchPayrollRecords();
      };

      socket.on('payroll_created', handlePayrollCreated);
      socket.on('payroll_updated', handlePayrollUpdated);
      socket.on('payroll_deleted', handlePayrollDeleted);

      return () => {
        socket.off('payroll_created', handlePayrollCreated);
        socket.off('payroll_updated', handlePayrollUpdated);
        socket.off('payroll_deleted', handlePayrollDeleted);
      };
    }
  }, []);

  const fetchPayrollRecords = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payroll');
      setPayrollRecords(response.data.records || []);
    } catch (error) {
      console.error('Error fetching payroll records:', error);
      setError('Failed to load payroll records');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const response = await api.get('/staff');
      setStaffMembers(response.data.staff || []);
    } catch (error) {
      console.error('Error fetching staff members:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate net salary if gross salary or deductions change
      if (name === 'gross_salary' || name === 'deductions' || name === 'tax_deductions' || name === 'other_deductions') {
        const gross = parseFloat(updated.gross_salary) || 0;
        const deductions = parseFloat(updated.deductions) || 0;
        const taxDeductions = parseFloat(updated.tax_deductions) || 0;
        const otherDeductions = parseFloat(updated.other_deductions) || 0;
        const bonus = parseFloat(updated.bonus) || 0;
        const allowances = parseFloat(updated.allowances) || 0;
        
        const totalDeductions = deductions + taxDeductions + otherDeductions;
        const netSalary = gross + bonus + allowances - totalDeductions;
        updated.net_salary = netSalary > 0 ? netSalary.toFixed(2) : '0';
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Determine if we're using staff_id or user_id
      const selectedStaff = staffMembers.find(s => (s.id && s.id.toString() === formData.staff_id) || (s.user_id && s.user_id.toString() === formData.staff_id));
      const payload = {
        // If staff has no id (dept head/admin without staff record), use user_id instead
        ...(selectedStaff && !selectedStaff.id && selectedStaff.user_id ? { 
          user_id: selectedStaff.user_id, 
          staff_id: null 
        } : {
          staff_id: selectedStaff?.id || formData.staff_id
        }),
        payroll_period_start: formData.payroll_period_start,
        payroll_period_end: formData.payroll_period_end,
        gross_salary: parseFloat(formData.gross_salary),
        deductions: parseFloat(formData.deductions) || 0,
        net_salary: parseFloat(formData.net_salary),
        bonus: parseFloat(formData.bonus) || 0,
        allowances: parseFloat(formData.allowances) || 0,
        tax_deductions: parseFloat(formData.tax_deductions) || 0,
        other_deductions: parseFloat(formData.other_deductions) || 0,
        notes: formData.notes || ''
      };

      if (editingRecord) {
        await api.put(`/payroll/${editingRecord.id}`, payload);
        setSuccess('Payroll record updated successfully');
      } else {
        await api.post('/payroll', payload);
        setSuccess('Payroll record created successfully');
      }

      setShowForm(false);
      setEditingRecord(null);
      setFormData({
        staff_id: '',
        payroll_period_start: '',
        payroll_period_end: '',
        gross_salary: '',
        deductions: '0',
        net_salary: '',
        bonus: '0',
        allowances: '0',
        tax_deductions: '0',
        other_deductions: '0',
        notes: ''
      });
      
      // Refresh payroll records
      await fetchPayrollRecords();
      
      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit(editingRecord ? 'payroll_updated' : 'payroll_created');
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save payroll record');
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      staff_id: record.staff_id.toString(),
      payroll_period_start: record.payroll_period_start,
      payroll_period_end: record.payroll_period_end,
      gross_salary: record.gross_salary.toString(),
      deductions: (record.deductions || 0).toString(),
      net_salary: record.net_salary.toString(),
      bonus: (record.bonus || 0).toString(),
      allowances: (record.allowances || 0).toString(),
      tax_deductions: (record.tax_deductions || 0).toString(),
      other_deductions: (record.other_deductions || 0).toString(),
      notes: record.notes || ''
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormData({
      staff_id: '',
      payroll_period_start: '',
      payroll_period_end: '',
      gross_salary: '',
      deductions: '0',
      net_salary: '',
      bonus: '0',
      allowances: '0',
      tax_deductions: '0',
      other_deductions: '0',
      notes: ''
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Draft': 'bg-secondary',
      'Submitted': 'bg-warning',
      'Admin_Approved': 'bg-success',
      'Admin_Rejected': 'bg-danger',
      'Processed': 'bg-info',
      'Paid': 'bg-primary'
    };
    return badges[status] || 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="container-fluid">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h2 className="mb-0">Payroll Management</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            <i className="bi bi-plus-circle me-2"></i>Add Payroll Record
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">{editingRecord ? 'Edit' : 'Add'} Payroll Record</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Staff Member *</label>
                  <select
                    className="form-select"
                    name="staff_id"
                    value={formData.staff_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select staff member...</option>
                    {staffMembers.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} - {staff.staff_id} ({staff.position})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Period Start *</label>
                  <input
                    type="date"
                    className="form-control"
                    name="payroll_period_start"
                    value={formData.payroll_period_start}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Period End *</label>
                  <input
                    type="date"
                    className="form-control"
                    name="payroll_period_end"
                    value={formData.payroll_period_end}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label">Gross Salary *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="gross_salary"
                    value={formData.gross_salary}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Bonus</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="bonus"
                    value={formData.bonus}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Allowances</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="allowances"
                    value={formData.allowances}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Net Salary *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="net_salary"
                    value={formData.net_salary}
                    onChange={handleInputChange}
                    required
                    readOnly
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label">Deductions</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="deductions"
                    value={formData.deductions}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Tax Deductions</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="tax_deductions"
                    value={formData.tax_deductions}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Other Deductions</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="other_deductions"
                    value={formData.other_deductions}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                />
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  {editingRecord ? 'Update' : 'Submit'} Payroll
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Payroll Records</h5>
        </div>
        <div className="card-body">
          {payrollRecords.length === 0 ? (
            <p className="text-muted text-center py-4">No payroll records found</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Period</th>
                    <th>Gross Salary</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map(record => (
                    <tr key={record.id}>
                      <td>
                        <div>
                          <strong>{record.staff_name}</strong>
                          <br />
                          <small className="text-muted">{record.staff_id} - {record.position}</small>
                        </div>
                      </td>
                      <td>
                        {new Date(record.payroll_period_start).toLocaleDateString()} - {new Date(record.payroll_period_end).toLocaleDateString()}
                      </td>
                      <td>${parseFloat(record.gross_salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>${parseFloat(record.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(record.status)}`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {(record.status === 'Draft' || record.status === 'Submitted') && (
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => handleEdit(record)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
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
    </div>
  );
};

export default PayrollManagement;

