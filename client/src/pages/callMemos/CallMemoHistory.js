import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import CallMemoForm from './CallMemoForm';
import { exportToPDF, exportToExcel, exportToWord, printContent } from '../../utils/exportUtils';

const CallMemoHistory = () => {
  const { user } = useAuth();
  const [callMemos, setCallMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMemo, setEditingMemo] = useState(null);
  const [viewingMemo, setViewingMemo] = useState(null);
  const [filter, setFilter] = useState({
    client: '',
    service: '',
    department: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchCallMemos();
  }, []);

  const fetchCallMemos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/call-memos');
      setCallMemos(response.data.callMemos || []);
    } catch (error) {
      console.error('Error fetching call memos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMemo(null);
    setShowForm(true);
  };

  const handleEdit = (memo) => {
    setEditingMemo(memo);
    setShowForm(true);
  };

  const handleView = async (memoId) => {
    try {
      const response = await api.get(`/call-memos/${memoId}`);
      setViewingMemo(response.data.callMemo);
    } catch (error) {
      console.error('Error fetching call memo:', error);
    }
  };

  const handleDelete = async (memoId) => {
    if (!window.confirm('Are you sure you want to delete this call memo?')) {
      return;
    }

    try {
      await api.delete(`/call-memos/${memoId}`);
      fetchCallMemos();
    } catch (error) {
      console.error('Error deleting call memo:', error);
      alert('Failed to delete call memo');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMemo(null);
    fetchCallMemos();
  };

  const formatCallMemoForExport = (memo) => {
    return `
Call Memo Details
=================

Client: ${memo.client_name || 'N/A'}
Participants: ${memo.participants || 'N/A'}
Subject: ${memo.subject || 'N/A'}
Date: ${memo.call_date ? new Date(memo.call_date).toLocaleDateString() : 'N/A'}
Service Needed: ${memo.service_needed}${memo.service_other ? ` (${memo.service_other})` : ''}
Department Needed: ${memo.department_needed || 'N/A'}
Next Visitation Date: ${memo.next_visitation_date ? new Date(memo.next_visitation_date).toLocaleDateString() : 'N/A'}

Discussion:
${memo.discussion || 'N/A'}

Created by: ${memo.created_by_name || 'N/A'}
Created at: ${memo.created_at ? new Date(memo.created_at).toLocaleString() : 'N/A'}
    `.trim();
  };

  const filteredMemos = callMemos.filter(memo => {
    if (filter.client && !memo.client_name?.toLowerCase().includes(filter.client.toLowerCase())) return false;
    if (filter.service && memo.service_needed !== filter.service) return false;
    if (filter.department && memo.department_needed !== filter.department) return false;
    if (filter.dateFrom && new Date(memo.call_date) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(memo.call_date) > new Date(filter.dateTo)) return false;
    return true;
  });

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
          <h2>Call Memo History</h2>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Create Call Memo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Filter by client"
                value={filter.client}
                onChange={(e) => setFilter({ ...filter, client: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={filter.service}
                onChange={(e) => setFilter({ ...filter, service: e.target.value })}
              >
                <option value="">All Services</option>
                <option value="Consultancy">Consultancy</option>
                <option value="Training (Academy)">Training (Academy)</option>
                <option value="Web Development">Web Development</option>
                <option value="System Development">System Development</option>
                <option value="Audit">Audit</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="From Date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control"
                placeholder="To Date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilter({ client: '', service: '', department: '', dateFrom: '', dateTo: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call Memos Table */}
      <div className="card">
        <div className="card-body">
          {filteredMemos.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-file-text text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No call memos found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Subject</th>
                    <th>Participants</th>
                    <th>Service</th>
                    <th>Department</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMemos.map((memo) => (
                    <tr key={memo.id}>
                      <td>{new Date(memo.call_date).toLocaleDateString()}</td>
                      <td>{memo.client_name || 'N/A'}</td>
                      <td>{memo.subject}</td>
                      <td>{memo.participants}</td>
                      <td>
                        {memo.service_needed}
                        {memo.service_other && <small className="text-muted"> ({memo.service_other})</small>}
                      </td>
                      <td>{memo.department_needed || '-'}</td>
                      <td>{memo.created_by_name || 'N/A'}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleView(memo.id)}
                            title="View"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          {(memo.created_by === user.id || user.role === 'Admin') && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-warning"
                                onClick={() => handleEdit(memo)}
                                title="Edit"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(memo.id)}
                                title="Delete"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => printContent(memo.subject, formatCallMemoForExport(memo))}
                            title="Print"
                          >
                            <i className="bi bi-printer"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => exportToPDF(memo.subject, formatCallMemoForExport(memo))}
                            title="Export PDF"
                          >
                            <i className="bi bi-file-pdf"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewingMemo && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Call Memo Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewingMemo(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Client:</strong> {viewingMemo.client_name || 'N/A'}
                  </div>
                  <div className="col-md-6">
                    <strong>Date:</strong> {new Date(viewingMemo.call_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Subject:</strong> {viewingMemo.subject}
                  </div>
                  <div className="col-md-6">
                    <strong>Participants:</strong> {viewingMemo.participants}
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Service Needed:</strong> {viewingMemo.service_needed}
                    {viewingMemo.service_other && <span> ({viewingMemo.service_other})</span>}
                  </div>
                  <div className="col-md-6">
                    <strong>Department Needed:</strong> {viewingMemo.department_needed || 'N/A'}
                  </div>
                </div>
                {viewingMemo.next_visitation_date && (
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <strong>Next Visitation Date:</strong> {new Date(viewingMemo.next_visitation_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
                <div className="mb-3">
                  <strong>Discussion:</strong>
                  <div className="mt-2 p-3 bg-light rounded">
                    {viewingMemo.discussion}
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6">
                    <strong>Created By:</strong> {viewingMemo.created_by_name || 'N/A'}
                  </div>
                  <div className="col-md-6">
                    <strong>Created At:</strong> {new Date(viewingMemo.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => printContent(viewingMemo.subject, formatCallMemoForExport(viewingMemo))}
                >
                  <i className="bi bi-printer me-1"></i>Print
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => exportToPDF(viewingMemo.subject, formatCallMemoForExport(viewingMemo))}
                >
                  <i className="bi bi-file-pdf me-1"></i>Export PDF
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => exportToWord(viewingMemo.subject, formatCallMemoForExport(viewingMemo))}
                >
                  <i className="bi bi-file-word me-1"></i>Export Word
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewingMemo(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <CallMemoForm
          callMemo={editingMemo}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default CallMemoHistory;

