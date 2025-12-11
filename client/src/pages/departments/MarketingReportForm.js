import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const MarketingReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    overview: '',
    staffPerformance: [],
    generalObservations: {
      completionRate: '',
      observations: []
    },
    recommendations: [],
    conclusion: '',
    attachments: []
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDepartment();
    fetchStaffMembers();
  }, []);

  const fetchDepartment = async () => {
    try {
      const response = await api.get('/departments');
      const userEmailLower = user.email.toLowerCase().trim();
      const dept = response.data.departments.find(d => 
        d.manager_id === user.id || 
        (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)
      );
      setDepartment(dept);
    } catch (error) {
      console.error('Error fetching department:', error);
    }
  };

  const fetchStaffMembers = async () => {
    if (!department) return;
    
    try {
      // Fetch staff filtered by department
      const response = await api.get(`/staff?department=${encodeURIComponent(department.name)}`);
      const deptStaff = response.data.staff || [];
      setStaffMembers(deptStaff);
      
      // Initialize staff performance array
      if (deptStaff.length > 0) {
        setFormData(prev => ({
          ...prev,
          staffPerformance: deptStaff.map(staff => ({
            staffId: staff.id,
            staffName: staff.name || 'Staff Member',
            completedTasks: [],
            pendingTasks: [],
            tasksCompletedCount: 0,
            tasksPendingCount: 0,
            supportNeeded: '',
            remarks: ''
          }))
        }));
      } else {
        // If no staff found, initialize with empty array
        setFormData(prev => ({
          ...prev,
          staffPerformance: []
        }));
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      // If error, still initialize empty array
      setFormData(prev => ({
        ...prev,
        staffPerformance: []
      }));
    }
  };

  useEffect(() => {
    if (department) {
      fetchStaffMembers();
    }
  }, [department]);

  const handleOverviewChange = (e) => {
    setFormData(prev => ({ ...prev, overview: e.target.value }));
  };

  const handleStaffTaskChange = (staffIndex, field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      if (field === 'completedTasks' || field === 'pendingTasks') {
        updated.staffPerformance[staffIndex][field] = value.split('\n').filter(t => t.trim());
        // Update counts
        updated.staffPerformance[staffIndex].tasksCompletedCount = 
          field === 'completedTasks' ? value.split('\n').filter(t => t.trim()).length : 
          updated.staffPerformance[staffIndex].completedTasks.length;
        updated.staffPerformance[staffIndex].tasksPendingCount = 
          field === 'pendingTasks' ? value.split('\n').filter(t => t.trim()).length : 
          updated.staffPerformance[staffIndex].pendingTasks.length;
      } else {
        updated.staffPerformance[staffIndex][field] = value;
      }
      return updated;
    });
  };

  const handleObservationChange = (index, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.generalObservations.observations[index] = value;
      return updated;
    });
  };

  const addObservation = () => {
    setFormData(prev => ({
      ...prev,
      generalObservations: {
        ...prev.generalObservations,
        observations: [...prev.generalObservations.observations, '']
      }
    }));
  };

  const removeObservation = (index) => {
    setFormData(prev => ({
      ...prev,
      generalObservations: {
        ...prev.generalObservations,
        observations: prev.generalObservations.observations.filter((_, i) => i !== index)
      }
    }));
  };

  const handleRecommendationChange = (index, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.recommendations[index] = value;
      return updated;
    });
  };

  const addRecommendation = () => {
    setFormData(prev => ({
      ...prev,
      recommendations: [...prev.recommendations, '']
    }));
  };

  const removeRecommendation = (index) => {
    setFormData(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index)
    }));
  };

  const handleConclusionChange = (e) => {
    setFormData(prev => ({ ...prev, conclusion: e.target.value }));
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

  const getFileIcon = (mimetype) => {
    if (mimetype?.includes('pdf')) return 'bi-file-pdf text-danger';
    if (mimetype?.includes('word') || mimetype?.includes('document')) return 'bi-file-word text-primary';
    if (mimetype?.includes('excel') || mimetype?.includes('spreadsheet')) return 'bi-file-excel text-success';
    if (mimetype?.includes('image')) return 'bi-file-image text-info';
    if (mimetype?.includes('zip') || mimetype?.includes('rar')) return 'bi-file-zip text-warning';
    return 'bi-file-earmark';
  };

  const formatReportContent = () => {
    let content = `1. Overview\n\n${formData.overview}\n\n`;
    
    content += `2. Staff Performance Summary\n\n`;
    
    formData.staffPerformance.forEach((staff, index) => {
      content += `${staff.staffName}\n\n`;
      content += `Key Tasks Completed / Ongoing:\n`;
      if (staff.completedTasks.length > 0) {
        staff.completedTasks.forEach(task => {
          content += `• ${task}\n`;
        });
      } else {
        content += `• [No completed tasks listed]\n`;
      }
      
      if (staff.pendingTasks.length > 0) {
        content += `\nPending Task:\n`;
        staff.pendingTasks.forEach(task => {
          content += `• ${task}\n`;
        });
      }
      
      content += `\nStatus Summary:\n`;
      content += `• Tasks Completed: ${staff.tasksCompletedCount}\n`;
      content += `• Tasks Pending/Not Started: ${staff.tasksPendingCount}\n`;
      
      content += `\nSupport Needed:\n`;
      content += `• ${staff.supportNeeded || 'None at this time'}\n`;
      
      content += `\nRemarks:\n${staff.remarks || '[No remarks]'}\n\n`;
    });
    
    content += `3. General Observations\n\n`;
    content += `• Overall Task Completion Rate: ${formData.generalObservations.completionRate || '[Percentage]'}%\n\n`;
    
    if (formData.generalObservations.observations.length > 0) {
      formData.generalObservations.observations.forEach(obs => {
        if (obs.trim()) {
          content += `• ${obs}\n`;
        }
      });
    }
    
    content += `\n4. Recommendations\n\n`;
    if (formData.recommendations.length > 0) {
      formData.recommendations.forEach((rec, index) => {
        if (rec.trim()) {
          content += `${index + 1}. ${rec}\n`;
        }
      });
    } else {
      content += `[No recommendations at this time]\n`;
    }
    
    content += `\n5. Conclusion\n\n${formData.conclusion || '[Closing statement]'}`;
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const reportContent = formatReportContent();
      const reportTitle = `Marketing Department Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

      await api.post('/department-reports', {
        title: reportTitle,
        content: reportContent,
        attachments: formData.attachments.length > 0 ? formData.attachments : null
      });

      onClose();
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">{report ? 'Edit Marketing Department Report' : 'Marketing Department Report'}
              <i className="bi bi-file-text me-2"></i>Marketing Department Report Template
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}

              {/* 1. Overview */}
              <div className="mb-4">
                <h5 className="mb-3">1. Overview</h5>
                <p className="text-muted small mb-2">
                  Brief summary of the week's activities, overall workload status, and general performance note
                </p>
                <textarea
                  className="form-control"
                  rows="4"
                  value={formData.overview}
                  onChange={handleOverviewChange}
                  placeholder="Enter overview..."
                  required
                />
              </div>

              {/* 2. Staff Performance Summary */}
              <div className="mb-4">
                <h5 className="mb-3">2. Staff Performance Summary</h5>
                {staffMembers.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    No staff members found in this department.
                  </div>
                ) : (
                  formData.staffPerformance.map((staff, index) => (
                    <div key={staff.staffId} className="card mb-3">
                      <div className="card-header bg-light">
                        <h6 className="mb-0">{staff.staffName}</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label fw-bold">Key Tasks Completed / Ongoing:</label>
                          <textarea
                            className="form-control"
                            rows="3"
                            value={staff.completedTasks.join('\n')}
                            onChange={(e) => handleStaffTaskChange(index, 'completedTasks', e.target.value)}
                            placeholder="Enter tasks (one per line)..."
                          />
                          <small className="text-muted">Enter each task on a new line</small>
                        </div>

                        <div className="mb-3">
                          <label className="form-label fw-bold">Pending Task:</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={staff.pendingTasks.join('\n')}
                            onChange={(e) => handleStaffTaskChange(index, 'pendingTasks', e.target.value)}
                            placeholder="Enter pending tasks (one per line)..."
                          />
                          <small className="text-muted">Enter each task on a new line (optional)</small>
                        </div>

                        <div className="row mb-3">
                          <div className="col-md-6">
                            <label className="form-label">Tasks Completed:</label>
                            <input
                              type="number"
                              className="form-control"
                              value={staff.tasksCompletedCount}
                              onChange={(e) => handleStaffTaskChange(index, 'tasksCompletedCount', parseInt(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Tasks Pending/Not Started:</label>
                            <input
                              type="number"
                              className="form-control"
                              value={staff.tasksPendingCount}
                              onChange={(e) => handleStaffTaskChange(index, 'tasksPendingCount', parseInt(e.target.value) || 0)}
                              min="0"
                            />
                          </div>
                        </div>

                        <div className="mb-3">
                          <label className="form-label">Support Needed:</label>
                          <input
                            type="text"
                            className="form-control"
                            value={staff.supportNeeded}
                            onChange={(e) => handleStaffTaskChange(index, 'supportNeeded', e.target.value)}
                            placeholder="Enter support needed or 'None at this time'"
                          />
                        </div>

                        <div className="mb-0">
                          <label className="form-label">Remarks:</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={staff.remarks}
                            onChange={(e) => handleStaffTaskChange(index, 'remarks', e.target.value)}
                            placeholder="Short evaluative comment on performance, attitude, strengths, areas for improvement"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 3. General Observations */}
              <div className="mb-4">
                <h5 className="mb-3">3. General Observations</h5>
                <div className="mb-3">
                  <label className="form-label fw-bold">Overall Task Completion Rate:</label>
                  <div className="input-group" style={{ maxWidth: '200px' }}>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.generalObservations.completionRate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        generalObservations: {
                          ...prev.generalObservations,
                          completionRate: e.target.value
                        }
                      }))}
                      placeholder="0"
                      min="0"
                      max="100"
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label fw-bold">Observations:</label>
                  {formData.generalObservations.observations.map((obs, index) => (
                    <div key={index} className="input-group mb-2">
                      <span className="input-group-text">•</span>
                      <input
                        type="text"
                        className="form-control"
                        value={obs}
                        onChange={(e) => handleObservationChange(index, e.target.value)}
                        placeholder="Enter observation..."
                      />
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => removeObservation(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={addObservation}
                  >
                    <i className="bi bi-plus-circle me-1"></i>Add Observation
                  </button>
                </div>
              </div>

              {/* 4. Recommendations */}
              <div className="mb-4">
                <h5 className="mb-3">4. Recommendations</h5>
                {formData.recommendations.map((rec, index) => (
                  <div key={index} className="input-group mb-2">
                    <span className="input-group-text">{index + 1}.</span>
                    <input
                      type="text"
                      className="form-control"
                      value={rec}
                      onChange={(e) => handleRecommendationChange(index, e.target.value)}
                      placeholder="Enter recommendation..."
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => removeRecommendation(index)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={addRecommendation}
                >
                  <i className="bi bi-plus-circle me-1"></i>Add Recommendation
                </button>
              </div>

              {/* 5. Conclusion */}
              <div className="mb-4">
                <h5 className="mb-3">5. Conclusion</h5>
                <p className="text-muted small mb-2">
                  Closing statement summarizing the week's performance and outlook
                </p>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.conclusion}
                  onChange={handleConclusionChange}
                  placeholder="Enter conclusion..."
                  required
                />
              </div>

              {/* 6. Attachments */}
              <div className="mb-4">
                <h5 className="mb-3">6. Attachments</h5>
                <p className="text-muted small mb-2">
                  Upload supporting documents (PDF, Word, Excel, Images, etc.)
                </p>
                <div className="mb-3">
                  <input
                    type="file"
                    className="form-control"
                    onChange={handleFileUpload}
                    multiple
                    disabled={uploading}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
                  />
                  {uploading && (
                    <div className="mt-2">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      <small className="text-muted">Uploading files...</small>
                    </div>
                  )}
                </div>
                {formData.attachments.length > 0 && (
                  <div className="list-group">
                    {formData.attachments.map((attachment, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <i className={`bi ${getFileIcon(attachment.mimetype)} me-2`} style={{ fontSize: '1.5rem' }}></i>
                          <div>
                            <div className="fw-bold">{attachment.originalName || attachment.filename}</div>
                            <small className="text-muted">
                              {attachment.size ? `${(attachment.size / 1024).toFixed(2)} KB` : ''}
                            </small>
                          </div>
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
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    {report ? 'Update Report' : 'Submit Report'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MarketingReportForm;

