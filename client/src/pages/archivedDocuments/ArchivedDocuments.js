import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { getSocket } from '../../config/socket';
import { exportToPDF, exportToExcel, exportToWord, printContent } from '../../utils/exportUtils';
import { handleViewDocument, handleDownloadDocument, handlePrintDocument } from '../../utils/documentUtils';

const ArchivedDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState({
    source_type: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [uploadFormData, setUploadFormData] = useState({
    file_name: '',
    description: '',
    file: null
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Listen for real-time document updates
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (socket) {
      const handleDocumentUploaded = async (data) => {
        console.log('Document uploaded event received:', data);
        // For admin, refresh the entire list to see new document
        // For regular users, only refresh if it's their document
        if (user.role === 'Admin' || data.user_id === user.id) {
          // Refresh documents list to get the full document details
          fetchDocuments();
        }
      };

      const handleDocumentDeleted = (data) => {
        console.log('Document deleted event received:', data);
        // Remove document from local state
        setDocuments(prev => prev.filter(doc => doc.id !== data.document_id));
      };

      socket.on('document_uploaded', handleDocumentUploaded);
      socket.on('document_deleted', handleDocumentDeleted);

      return () => {
        socket.off('document_uploaded', handleDocumentUploaded);
        socket.off('document_deleted', handleDocumentDeleted);
      };
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/archived-documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFormData(prev => ({
        ...prev,
        file: e.target.files[0],
        file_name: prev.file_name || e.target.files[0].name
      }));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadFormData.file_name || !uploadFormData.file) {
      alert('Please provide a file name and select a file');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file_name', uploadFormData.file_name);
      formData.append('description', uploadFormData.description || '');
      formData.append('file', uploadFormData.file);
      
      if (user.role === 'Admin') {
        // Admin can upload for other users - for now, upload for themselves
        // Can be extended to allow selecting target user
      }

      await api.post('/archived-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert('Document uploaded successfully');
      setShowUploadForm(false);
      setUploadFormData({ file_name: '', description: '', file: null });
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/archived-documents/${docId}`);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleView = (doc) => {
    handleViewDocument(doc.file_path);
  };

  const handleDownload = async (doc) => {
    await handleDownloadDocument(doc.file_path, doc.file_name || doc.original_file_name);
  };

  const handlePrint = (doc) => {
    handlePrintDocument(doc.file_path);
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return 'bi-file-earmark';
    if (fileType.includes('pdf')) return 'bi-file-pdf';
    if (fileType.includes('doc')) return 'bi-file-word';
    if (fileType.includes('xls')) return 'bi-file-excel';
    if (fileType.includes('ppt')) return 'bi-file-slides';
    if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) return 'bi-file-image';
    return 'bi-file-earmark';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const filteredDocuments = documents.filter(doc => {
    if (filter.source_type && doc.source_type !== filter.source_type) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (!doc.file_name?.toLowerCase().includes(searchLower) && 
          !doc.description?.toLowerCase().includes(searchLower)) return false;
    }
    if (filter.dateFrom && new Date(doc.created_at) < new Date(filter.dateFrom)) return false;
    if (filter.dateTo && new Date(doc.created_at) > new Date(filter.dateTo)) return false;
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
          <h2>Archived Documents</h2>
          <button className="btn btn-primary" onClick={() => setShowUploadForm(true)}>
            <i className="bi bi-upload me-2"></i>Upload Document
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
                placeholder="Search documents..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={filter.source_type}
                onChange={(e) => setFilter({ ...filter, source_type: e.target.value })}
              >
                <option value="">All Sources</option>
                <option value="manual">Manual Upload</option>
                <option value="report">Report</option>
                <option value="proposal">Proposal</option>
                <option value="call_memo">Call Memo</option>
                <option value="meeting">Meeting</option>
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
                onClick={() => setFilter({ source_type: '', search: '', dateFrom: '', dateTo: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="card-body">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-folder text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">No documents found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Size</th>
                    {user.role === 'Admin' && <th>Owner</th>}
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <i className={`bi ${getFileIcon(doc.file_type)} me-2`}></i>
                        <strong>{doc.file_name}</strong>
                        {doc.description && (
                          <>
                            <br />
                            <small className="text-muted">{doc.description}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-info">
                          {doc.source_type === 'manual' ? 'Manual' :
                           doc.source_type === 'report' ? 'Report' :
                           doc.source_type === 'proposal' ? 'Proposal' :
                           doc.source_type === 'call_memo' ? 'Call Memo' :
                           doc.source_type === 'meeting' ? 'Meeting' : doc.source_type || 'N/A'}
                        </span>
                      </td>
                      <td>{doc.file_type?.toUpperCase() || 'N/A'}</td>
                      <td>{formatFileSize(doc.file_size)}</td>
                      {user.role === 'Admin' && (
                        <td>{doc.user_name || 'N/A'}</td>
                      )}
                      <td>{doc.uploader_name || 'N/A'}</td>
                      <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => handleView(doc)}
                            title="View"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleDownload(doc)}
                            title="Download"
                          >
                            <i className="bi bi-download"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handlePrint(doc)}
                            title="Print"
                          >
                            <i className="bi bi-printer"></i>
                          </button>
                          {(doc.user_id === user.id || user.role === 'Admin') && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(doc.id)}
                              title="Delete"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
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

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Upload Document</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setShowUploadForm(false);
                  setUploadFormData({ file_name: '', description: '', file: null });
                }}></button>
              </div>
              <form onSubmit={handleUpload}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">File Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={uploadFormData.file_name}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, file_name: e.target.value })}
                      placeholder="Enter file name"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Upload File <span className="text-danger">*</span></label>
                    <input
                      type="file"
                      className="form-control"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
                      required
                    />
                    <small className="text-muted">Allowed: PDF, Word, Excel, PowerPoint, Images, Archives (Max 100MB)</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      value={uploadFormData.description}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                      rows="3"
                      placeholder="Enter document description (optional)"
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowUploadForm(false);
                    setUploadFormData({ file_name: '', description: '', file: null });
                  }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedDocuments;

