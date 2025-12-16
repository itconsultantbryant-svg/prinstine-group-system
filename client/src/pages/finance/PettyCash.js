import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';

const PettyCash = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [custodians, setCustodians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [summary, setSummary] = useState({ total_deposited: 0, total_withdrawn: 0, closing_balance: 0 });
  const [canDelete, setCanDelete] = useState(false);
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().slice(0, 16),
    petty_cash_custodian_id: '',
    amount_deposit: '',
    amount_withdrawal: '',
    description: '',
    charged_to: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTransactions();
    fetchCustodians();
    checkDeletePermission();
    
    const socket = getSocket();
    if (socket) {
      socket.on('petty_cash_created', handlePettyCashCreated);
      socket.on('petty_cash_updated', handlePettyCashUpdated);
      socket.on('petty_cash_deleted', handlePettyCashDeleted);
      
      return () => {
        socket.off('petty_cash_created', handlePettyCashCreated);
        socket.off('petty_cash_updated', handlePettyCashUpdated);
        socket.off('petty_cash_deleted', handlePettyCashDeleted);
      };
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, fromDate, toDate]);

  const checkDeletePermission = async () => {
    // Only Assistant Finance Officer and Finance Department Head can delete
    if (user?.role === 'Admin') {
      setCanDelete(false);
      return;
    }
    
    try {
      // Check if user is Finance Department Head
      if (user?.role === 'DepartmentHead') {
        const response = await api.get('/departments');
        const userEmailLower = user.email.toLowerCase().trim();
        const financeDept = response.data.departments.find(d => 
          (d.manager_id === user.id || 
           (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)) &&
          d.name && d.name.toLowerCase().includes('finance')
        );
        setCanDelete(!!financeDept);
        return;
      }

      // Check if user is Assistant Finance Officer (Staff in Finance)
      if (user?.role === 'Staff') {
        const response = await api.get('/staff');
        const staffList = response.data.staff || [];
        const myStaff = staffList.find(s => s.user_id === user.id);
        if (myStaff && myStaff.department && myStaff.department.toLowerCase().includes('finance')) {
          setCanDelete(true);
          return;
        }
      }

      setCanDelete(false);
    } catch (error) {
      console.error('Error checking delete permission:', error);
      setCanDelete(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      
      const response = await api.get('/finance/petty-cash', { params });
      setTransactions(response.data.transactions || []);
      setSummary(response.data.summary || {});
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load petty cash entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustodians = async () => {
    try {
      const response = await api.get('/finance/petty-cash/custodians');
      setCustodians(response.data.custodians || []);
    } catch (error) {
      console.error('Error fetching custodians:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];
    
    if (fromDate) {
      filtered = filtered.filter(t => 
        new Date(t.transaction_date) >= new Date(fromDate)
      );
    }
    if (toDate) {
      filtered = filtered.filter(t => 
        new Date(t.transaction_date) <= new Date(toDate + 'T23:59:59')
      );
    }
    
    setFilteredTransactions(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.petty_cash_custodian_id) {
      setError('Please select a custodian');
      return;
    }

    if (!formData.amount_deposit && !formData.amount_withdrawal) {
      setError('Please enter either deposit or withdrawal amount');
      return;
    }

    if (formData.amount_deposit && formData.amount_withdrawal) {
      setError('Cannot have both deposit and withdrawal in the same transaction');
      return;
    }

    try {
      if (editingTransaction) {
        await api.put(`/finance/petty-cash/${editingTransaction.id}`, formData);
        setSuccess('Petty cash entry updated successfully');
      } else {
        await api.post('/finance/petty-cash', formData);
        setSuccess('Petty cash entry created successfully');
      }
      
      setShowForm(false);
      setEditingTransaction(null);
      setFormData({
        transaction_date: new Date().toISOString().slice(0, 16),
        petty_cash_custodian_id: '',
        amount_deposit: '',
        amount_withdrawal: '',
        description: '',
        charged_to: ''
      });
      fetchTransactions();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save petty cash entry');
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      transaction_date: transaction.transaction_date ? new Date(transaction.transaction_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      petty_cash_custodian_id: transaction.custodian_id || '',
      amount_deposit: transaction.amount_deposited || '',
      amount_withdrawal: transaction.amount_withdrawn || '',
      description: transaction.description || '',
      charged_to: transaction.charged_to || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this petty cash entry?')) {
      return;
    }

    try {
      await api.delete(`/finance/petty-cash/${id}`);
      setSuccess('Petty cash entry deleted successfully');
      fetchTransactions();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete petty cash entry');
    }
  };

  const handlePettyCashCreated = (data) => {
    fetchTransactions();
  };

  const handlePettyCashUpdated = (data) => {
    fetchTransactions();
  };

  const handlePettyCashDeleted = (data) => {
    fetchTransactions();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (loading) {
    return <div className="container mt-4"><div className="text-center">Loading...</div></div>;
  }

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Petty Cash Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setEditingTransaction(null);
            setFormData({
              transaction_date: new Date().toISOString().slice(0, 16),
              petty_cash_custodian_id: '',
              amount_deposit: '',
              amount_withdrawal: '',
              description: '',
              charged_to: ''
            });
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>Add Petty Cash Entry
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Date Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter Reports</h5>
          <div className="row">
            <div className="col-md-4">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-control"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  fetchTransactions();
                }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-control"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  fetchTransactions();
                }}
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  fetchTransactions();
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Total Deposited</h6>
              <h4 className="text-success">{formatCurrency(summary.total_deposited)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Total Withdrawn</h6>
              <h4 className="text-danger">{formatCurrency(summary.total_withdrawn)}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">Net Balance</h6>
              <h4 className="text-primary">{formatCurrency(summary.closing_balance)}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Petty Cash Entries</h5>
        </div>
        <div className="card-body">
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-muted">No petty cash entries found</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Custodian</th>
                    <th>Amount Deposit</th>
                    <th>Amount Withdrawal</th>
                    <th>Balance</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.transaction_date)}</td>
                      <td>{transaction.custodian_name || 'N/A'}</td>
                      <td className="text-success">
                        {transaction.amount_deposited > 0 ? formatCurrency(transaction.amount_deposited) : '-'}
                      </td>
                      <td className="text-danger">
                        {transaction.amount_withdrawn > 0 ? formatCurrency(transaction.amount_withdrawn) : '-'}
                      </td>
                      <td className="fw-bold">{formatCurrency(transaction.balance)}</td>
                      <td>{transaction.description || '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleEdit(transaction)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {canDelete && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <i className="bi bi-trash"></i>
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingTransaction ? 'Edit Petty Cash Entry' : 'Create Petty Cash Entry'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setShowForm(false);
                    setEditingTransaction(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Date and Time *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Petty Cash Custodian *</label>
                    <select
                      className="form-select"
                      value={formData.petty_cash_custodian_id}
                      onChange={(e) => setFormData({ ...formData, petty_cash_custodian_id: e.target.value })}
                      required
                    >
                      <option value="">Select custodian...</option>
                      {custodians.map((custodian) => (
                        <option key={custodian.id} value={custodian.id}>
                          {custodian.name} ({custodian.role_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Amount Deposit</label>
                      <input
                        type="number"
                        className="form-control"
                        step="0.01"
                        min="0"
                        value={formData.amount_deposit}
                        onChange={(e) => setFormData({ ...formData, amount_deposit: e.target.value, amount_withdrawal: '' })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Amount Withdrawal</label>
                      <input
                        type="number"
                        className="form-control"
                        step="0.01"
                        min="0"
                        value={formData.amount_withdrawal}
                        onChange={(e) => setFormData({ ...formData, amount_withdrawal: e.target.value, amount_deposit: '' })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Charged To</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.charged_to}
                      onChange={(e) => setFormData({ ...formData, charged_to: e.target.value })}
                      placeholder="Optional expense category"
                    />
                  </div>

                  <div className="d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-secondary me-2"
                      onClick={() => {
                        setShowForm(false);
                        setEditingTransaction(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingTransaction ? 'Update' : 'Create'}
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

export default PettyCash;

