import React, { useState } from 'react';
import api from '../../config/api';

const getFileIcon = (mimetype) => {
  if (!mimetype) return 'bi-file-earmark';
  if (mimetype.includes('pdf')) return 'bi-file-pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'bi-file-word';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'bi-file-excel';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'bi-file-ppt';
  if (mimetype.includes('image')) return 'bi-file-image';
  if (mimetype.includes('zip') || mimetype.includes('rar')) return 'bi-file-zip';
  return 'bi-file-earmark';
};

const DepartmentReportForm = ({ report, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    attachments: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (report) {
      setFormData({
        title: report.title || '',
        content: report.content || '',
        attachments: report.attachments ? (typeof report.attachments === 'string' ? JSON.parse(report.attachments) : report.attachments) : []
      });
    }
  }, [report]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await api.post('/upload/report', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        return {
          url: response.data.url,
          filename: response.data.filename,
          originalName: response.data.originalName || file.name,
          size: response.data.size || file.size,
          mimetype: response.data.mimetype || file.type
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }));
    } catch (error) {
      console.error('File upload error:', error);
      setError(error.response?.data?.error || 'Failed to upload file(s)');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        attachments: formData.attachments.length > 0 ? formData.attachments : null
      };
      
      if (report && report.id) {
        // Update existing report
        await api.put(`/department-reports/${report.id}`, submitData);
      } else {
        // Create new report
        await api.post('/department-reports', submitData);
      }
      onClose();
    } catch (err) {
      console.error('Report submit error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to submit report';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{report ? 'Edit Department Report' : 'Submit Department Report'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              <div className="mb-3">
                <label className="form-label">Report Title *</label>
                <input
                  type="text"
                  className="form-control"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter report title"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Report Content *</label>
                <textarea
                  className="form-control"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows="10"
                  required
                  placeholder="Enter detailed report content..."
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Attachments</label>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.csv,.txt,.zip,.rar"
                />
                <small className="text-muted">
                  Allowed: Images (JPEG, PNG, GIF), Documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV, TXT), Archives (ZIP, RAR). Max 10MB per file.
                </small>
                {uploading && (
                  <div className="mt-2">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">Uploading...</span>
                    </div>
                    <span className="text-muted">Uploading files...</span>
                  </div>
                )}
                {formData.attachments.length > 0 && (
                  <div className="mt-2">
                    <label className="form-label small">Uploaded Files:</label>
                    <div className="list-group">
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <i className={`bi ${getFileIcon(file.mimetype || file.url)} me-2`}></i>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                              {file.originalName || file.filename}
                            </a>
                            {file.size && (
                              <small className="text-muted ms-2">
                                ({(file.size / 1024).toFixed(2)} KB)
                              </small>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeAttachment(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (report ? 'Updating...' : 'Submitting...') : (report ? 'Update Report' : 'Submit Report')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DepartmentReportForm;

