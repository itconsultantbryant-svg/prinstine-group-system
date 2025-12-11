import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import ProposalForm from './ProposalForm';
import { exportToPDF, exportToWord, printContent } from '../../utils/exportUtils';

const ProposalHistory = () => {
  const { user } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState(null);
  const [viewingProposal, setViewingProposal] = useState(null);
  const [isMarketingDeptHead, setIsMarketingDeptHead] = useState(false);
  const [filter, setFilter] = useState({
    client: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchProposals();
    checkMarketingDeptHead();
  }, []);

  const checkMarketingDeptHead = async () => {
    if (user?.role === 'DepartmentHead') {
      try {
        const response = await api.get('/departments');
        const userEmailLower = user.email.toLowerCase().trim();
        const dept = response.data.departments.find(d => 
          (d.manager_id === user.id || 
           (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)) &&
          d.name && d.name.toLowerCase().includes('marketing')
        );
        setIsMarketingDeptHead(!!dept);
      } catch (error) {
        console.error('Error checking marketing department head:', error);
      }
    }
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/proposals');
      setProposals(response.data.proposals || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProposal(null);
    setShowForm(true);
  };

  const handleEdit = (proposal) => {
    setEditingProposal(proposal);
    setShowForm(true);
  };

  const handleView = async (proposalId) => {
    try {
      const response = await api.get(`/proposals/${proposalId}`);
      setViewingProposal(response.data.proposal);
    } catch (error) {
      console.error('Error fetching proposal:', error);
    }
  };

  const handleDelete = async (proposalId) => {
    if (!window.confirm('Are you sure you want to delete this proposal?')) {
      return;
    }

    try {
      await api.delete(`/proposals/${proposalId}`);
      fetchProposals();
    } catch (error) {
      console.error('Error deleting proposal:', error);
      alert('Failed to delete proposal');
    }
  };

  const handleMarketingReview = async (proposalId, approved) => {
    if (!window.confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} this proposal?`)) {
      return;
    }

    try {
      await api.put(`/proposals/${proposalId}/marketing-review`, {
        status: approved ? 'Marketing_Approved' : 'Marketing_Rejected',
        notes: approved ? 'Approved by Marketing Manager' : 'Rejected by Marketing Manager'
      });
      fetchProposals();
    } catch (error) {
      console.error('Error reviewing proposal:', error);
      alert(error.response?.data?.error || 'Failed to review proposal');
    }
  };

  const handleAdminReview = async (proposalId, approved) => {
    if (!window.confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} this proposal?`)) {
      return;
    }

    try {
      await api.put(`/proposals/${proposalId}/admin-review`, {
        status: approved ? 'Approved' : 'Rejected',
        notes: approved ? 'Approved by Admin' : 'Rejected by Admin'
      });
      fetchProposals();
    } catch (error) {
      console.error('Error reviewing proposal:', error);
      alert(error.response?.data?.error || 'Failed to review proposal');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProposal(null);
    fetchProposals();
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending_Marketing': 'warning',
      'Marketing_Approved': 'info',
      'Marketing_Rejected': 'danger',
      'Pending_Admin': 'primary',
      'Approved': 'success',
      'Rejected': 'danger'
    };
    return badges[status] || 'secondary';
  };

  const formatStatus = (status) => {
    const statusMap = {
      'Pending_Marketing': 'Pending Marketing Review',
      'Marketing_Approved': 'Approved by Marketing',
      'Marketing_Rejected': 'Rejected by Marketing',
      'Pending_Admin': 'Pending Admin Review',
      'Approved': 'Approved',
      'Rejected': 'Rejected'
    };
    return statusMap[status] || status;
  };

  const formatProposalForExport = (proposal) => {
    return `
Proposal Details
=================

Client: ${proposal.client_name || 'N/A'}
Date: ${proposal.proposal_date ? new Date(proposal.proposal_date).toLocaleDateString() : 'N/A'}
Status: ${formatStatus(proposal.status)}
Document: ${proposal.document_name || 'N/A'}

Created by: ${proposal.created_by_name || 'N/A'}
Created at: ${proposal.created_at ? new Date(proposal.created_at).toLocaleString() : 'N/A'}

${proposal.marketing_notes ? `Marketing Notes: ${proposal.marketing_notes}\n` : ''}
${proposal.admin_notes ? `Admin Notes: ${proposal.admin_notes}\n` : ''}
    `.trim();
  };

  const filteredProposals = proposals.filter(proposal => {
    if (filter.client && !proposal.client_name?.toLowerCase().includes(filter.client.toLowerCase())) return false;
    if (filter.status && proposal.status !== filter.status) return false;
    if (filter.dateFrom && new Date(proposal.proposal_date) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(proposal.proposal_date) > new Date(filter.dateTo)) return false;
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
          <h2>Proposal History</h2>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Create Proposal
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
            <div className="col-md-3">
              <select
                className="form-select"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="Pending_Marketing">Pending Marketing</option>
                <option value="Marketing_Approved">Marketing Approved</option>
                <option value="Marketing_Rejected">Marketing Rejected</option>
                <option value="Pending_Admin">Pending Admin</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
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
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilter({ client: '', status: '', dateFrom: '', dateTo: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Proposals Table */}
      <div className="card">
        <div className="card-body">
          {filteredProposals.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-file-text text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No proposals found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Document</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map((proposal) => (
                    <tr key={proposal.id}>
                      <td>{new Date(proposal.proposal_date).toLocaleDateString()}</td>
                      <td>{proposal.client_name || 'N/A'}</td>
                      <td>
                        {proposal.document_name || 'N/A'}
                        {proposal.document_path && (
                          <a
                            href={`http://localhost:3006${proposal.document_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ms-2"
                          >
                            <i className="bi bi-download"></i>
                          </a>
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${getStatusBadge(proposal.status)}`}>
                          {formatStatus(proposal.status)}
                        </span>
                      </td>
                      <td>{proposal.created_by_name || 'N/A'}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleView(proposal.id)}
                            title="View"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          {/* Marketing Manager Review */}
                          {isMarketingDeptHead && proposal.status === 'Pending_Marketing' && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleMarketingReview(proposal.id, true)}
                                title="Approve"
                              >
                                <i className="bi bi-check-circle"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleMarketingReview(proposal.id, false)}
                                title="Reject"
                              >
                                <i className="bi bi-x-circle"></i>
                              </button>
                            </>
                          )}
                          {/* Admin Review */}
                          {user.role === 'Admin' && (proposal.status === 'Pending_Admin' || (proposal.status === 'Pending_Marketing' && proposal.created_by === user.id)) && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleAdminReview(proposal.id, true)}
                                title="Approve"
                              >
                                <i className="bi bi-check-circle"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleAdminReview(proposal.id, false)}
                                title="Reject"
                              >
                                <i className="bi bi-x-circle"></i>
                              </button>
                            </>
                          )}
                          {(proposal.created_by === user.id || user.role === 'Admin') && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-warning"
                                onClick={() => handleEdit(proposal)}
                                title="Edit"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(proposal.id)}
                                title="Delete"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </>
                          )}
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
      {viewingProposal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Proposal Details</h5>
                <button type="button" className="btn-close" onClick={() => setViewingProposal(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Client:</strong> {viewingProposal.client_name || 'N/A'}
                  </div>
                  <div className="col-md-6">
                    <strong>Date:</strong> {new Date(viewingProposal.proposal_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <strong>Status:</strong>
                    <span className={`badge bg-${getStatusBadge(viewingProposal.status)} ms-2`}>
                      {formatStatus(viewingProposal.status)}
                    </span>
                  </div>
                  <div className="col-md-6">
                    <strong>Document:</strong> {viewingProposal.document_name || 'N/A'}
                    {viewingProposal.document_path && (
                      <a
                        href={`http://localhost:3006${viewingProposal.document_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-2 btn btn-sm btn-outline-primary"
                      >
                        <i className="bi bi-download me-1"></i>Download
                      </a>
                    )}
                  </div>
                </div>
                {viewingProposal.marketing_notes && (
                  <div className="mb-3">
                    <strong>Marketing Notes:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingProposal.marketing_notes}
                    </div>
                  </div>
                )}
                {viewingProposal.admin_notes && (
                  <div className="mb-3">
                    <strong>Admin Notes:</strong>
                    <div className="mt-2 p-3 bg-light rounded">
                      {viewingProposal.admin_notes}
                    </div>
                  </div>
                )}
                <div className="row">
                  <div className="col-md-6">
                    <strong>Created By:</strong> {viewingProposal.created_by_name || 'N/A'}
                  </div>
                  <div className="col-md-6">
                    <strong>Created At:</strong> {new Date(viewingProposal.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => printContent(`Proposal - ${viewingProposal.client_name}`, formatProposalForExport(viewingProposal))}
                >
                  <i className="bi bi-printer me-1"></i>Print
                </button>
                <button
                  className="btn btn-outline-danger"
                  onClick={() => exportToPDF(`Proposal - ${viewingProposal.client_name}`, formatProposalForExport(viewingProposal))}
                >
                  <i className="bi bi-file-pdf me-1"></i>Export PDF
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => exportToWord(`Proposal - ${viewingProposal.client_name}`, formatProposalForExport(viewingProposal))}
                >
                  <i className="bi bi-file-word me-1"></i>Export Word
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setViewingProposal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <ProposalForm
          proposal={editingProposal}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default ProposalHistory;

