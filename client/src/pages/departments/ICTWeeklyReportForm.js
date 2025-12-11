import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const ICTWeeklyReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    weekEnding: getWeekEndingDate(),
    preparedBy: '',
    summary: '',
    tasksCompleted: [],
    tasksPending: [],
    challenges: [],
    supportNeeded: '',
    upcomingPriorities: [],
    attachments: []
  });

  function getWeekEndingDate() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const sunday = new Date(today.setDate(diff));
    return sunday.toISOString().split('T')[0];
  }

  useEffect(() => {
    fetchDepartment();
    if (report) {
      loadReportData();
    } else {
      setFormData(prev => ({
        ...prev,
        preparedBy: user?.name || ''
      }));
    }
  }, [report, user]);

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

  const loadReportData = () => {
    // Parse report content if editing
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTaskCompleted = () => {
    setFormData(prev => ({
      ...prev,
      tasksCompleted: [...prev.tasksCompleted, { task: '', percentComplete: 100 }]
    }));
  };

  const removeTaskCompleted = (index) => {
    setFormData(prev => ({
      ...prev,
      tasksCompleted: prev.tasksCompleted.filter((_, i) => i !== index)
    }));
  };

  const updateTaskCompleted = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      tasksCompleted: prev.tasksCompleted.map((task, i) =>
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const addTaskPending = () => {
    setFormData(prev => ({
      ...prev,
      tasksPending: [...prev.tasksPending, { task: '', dueDate: '', assignee: '' }]
    }));
  };

  const removeTaskPending = (index) => {
    setFormData(prev => ({
      ...prev,
      tasksPending: prev.tasksPending.filter((_, i) => i !== index)
    }));
  };

  const updateTaskPending = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      tasksPending: prev.tasksPending.map((task, i) =>
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const addChallenge = () => {
    setFormData(prev => ({
      ...prev,
      challenges: [...prev.challenges, { issue: '', severity: 'Medium' }]
    }));
  };

  const removeChallenge = (index) => {
    setFormData(prev => ({
      ...prev,
      challenges: prev.challenges.filter((_, i) => i !== index)
    }));
  };

  const updateChallenge = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      challenges: prev.challenges.map((challenge, i) =>
        i === index ? { ...challenge, [field]: value } : challenge
      )
    }));
  };

  const addPriority = () => {
    setFormData(prev => ({
      ...prev,
      upcomingPriorities: [...prev.upcomingPriorities, { priority: '', isHigh: false }]
    }));
  };

  const removePriority = (index) => {
    setFormData(prev => ({
      ...prev,
      upcomingPriorities: prev.upcomingPriorities.filter((_, i) => i !== index)
    }));
  };

  const updatePriority = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      upcomingPriorities: prev.upcomingPriorities.map((priority, i) =>
        i === index ? { ...priority, [field]: value } : priority
      )
    }));
  };

  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, response.data.url]
      }));
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': 'success',
      'Medium': 'warning',
      'High': 'danger',
      'Critical': 'danger'
    };
    return colors[severity] || 'secondary';
  };

  const formatReportContent = () => {
    let content = `ICT DEPARTMENT WEEKLY REPORT\n`;
    content += `========================================\n\n`;
    
    content += `Department: ICT Department\n`;
    content += `Week Ending: ${formData.weekEnding}\n`;
    content += `Prepared By: ${formData.preparedBy}\n\n`;
    
    content += `1. SUMMARY OF WEEKLY ACTIVITIES\n`;
    content += `----------------------------------------\n`;
    content += `${formData.summary || '[No summary provided]'}\n\n`;
    
    content += `2. TASKS COMPLETED\n`;
    content += `----------------------------------------\n`;
    if (formData.tasksCompleted.length > 0) {
      formData.tasksCompleted.forEach((task, idx) => {
        content += `  ${idx + 1}. ${task.task} (${task.percentComplete}% complete)\n`;
      });
    } else {
      content += `  [No completed tasks recorded]\n`;
    }
    content += `\n`;
    
    content += `3. TASKS PENDING / CARRIED OVER\n`;
    content += `----------------------------------------\n`;
    if (formData.tasksPending.length > 0) {
      formData.tasksPending.forEach((task, idx) => {
        content += `  ${idx + 1}. ${task.task}\n`;
        content += `     Due Date: ${task.dueDate || 'N/A'}\n`;
        content += `     Assignee: ${task.assignee || 'N/A'}\n`;
      });
    } else {
      content += `  [No pending tasks recorded]\n`;
    }
    content += `\n`;
    
    content += `4. CHALLENGES / ISSUES\n`;
    content += `----------------------------------------\n`;
    if (formData.challenges.length > 0) {
      formData.challenges.forEach((challenge, idx) => {
        content += `  ${idx + 1}. [${challenge.severity}] ${challenge.issue}\n`;
      });
    } else {
      content += `  [No challenges recorded]\n`;
    }
    content += `\n`;
    
    content += `5. SUPPORT NEEDED\n`;
    content += `----------------------------------------\n`;
    content += `${formData.supportNeeded || '[No support needed]'}\n\n`;
    
    content += `6. UPCOMING PRIORITIES (NEXT WEEK)\n`;
    content += `----------------------------------------\n`;
    if (formData.upcomingPriorities.length > 0) {
      formData.upcomingPriorities.forEach((priority, idx) => {
        const flag = priority.isHigh ? ' [HIGH PRIORITY]' : '';
        content += `  ${idx + 1}. ${priority.priority}${flag}\n`;
      });
    } else {
      content += `  [No upcoming priorities recorded]\n`;
    }
    content += `\n`;
    
    if (formData.attachments.length > 0) {
      content += `ATTACHMENTS\n`;
      content += `----------------------------------------\n`;
      formData.attachments.forEach((attachment, idx) => {
        content += `  ${idx + 1}. ${attachment}\n`;
      });
    }
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const reportContent = formatReportContent();
      const reportTitle = report?.title || `ICT Weekly Report - Week Ending ${formData.weekEnding}`;

      if (report && report.id) {
        await api.put(`/department-reports/${report.id}`, {
          title: reportTitle,
          content: reportContent
        });
      } else {
        await api.post('/department-reports', {
          title: reportTitle,
          content: reportContent
        });
      }

      onClose();
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-laptop me-2"></i>
              {report ? 'Edit ICT Weekly Report' : 'ICT Weekly Department Report'}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-control"
                    value="ICT Department"
                    readOnly
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Week Ending (Sunday) *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.weekEnding}
                    onChange={(e) => handleChange('weekEnding', e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Prepared By *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.preparedBy}
                    onChange={(e) => handleChange('preparedBy', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">1. Summary of Weekly Activities *</label>
                <textarea
                  className="form-control"
                  rows="6"
                  value={formData.summary}
                  onChange={(e) => handleChange('summary', e.target.value)}
                  placeholder="Provide a comprehensive summary of weekly activities..."
                  required
                />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">2. Tasks Completed</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addTaskCompleted}
                  >
                    <i className="bi bi-plus"></i> Add Task
                  </button>
                </div>
                {formData.tasksCompleted.map((task, index) => (
                  <div key={index} className="card mb-2">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-10 mb-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={task.task}
                            onChange={(e) => updateTaskCompleted(index, 'task', e.target.value)}
                            placeholder="Task description"
                          />
                        </div>
                        <div className="col-md-1 mb-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={task.percentComplete}
                            onChange={(e) => updateTaskCompleted(index, 'percentComplete', parseInt(e.target.value))}
                            min="0"
                            max="100"
                            placeholder="%"
                          />
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeTaskCompleted(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">3. Tasks Pending / Carried Over</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addTaskPending}
                  >
                    <i className="bi bi-plus"></i> Add Task
                  </button>
                </div>
                {formData.tasksPending.map((task, index) => (
                  <div key={index} className="card mb-2">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4 mb-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={task.task}
                            onChange={(e) => updateTaskPending(index, 'task', e.target.value)}
                            placeholder="Task description"
                          />
                        </div>
                        <div className="col-md-3 mb-2">
                          <label className="form-label small">Due Date</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={task.dueDate}
                            onChange={(e) => updateTaskPending(index, 'dueDate', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label small">Assignee</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={task.assignee}
                            onChange={(e) => updateTaskPending(index, 'assignee', e.target.value)}
                            placeholder="Assignee name"
                          />
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeTaskPending(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">4. Challenges / Issues</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addChallenge}
                  >
                    <i className="bi bi-plus"></i> Add Challenge
                  </button>
                </div>
                {formData.challenges.map((challenge, index) => (
                  <div key={index} className="card mb-2">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-3 mb-2">
                          <label className="form-label small">Severity</label>
                          <select
                            className={`form-select form-select-sm border-${getSeverityColor(challenge.severity)}`}
                            value={challenge.severity}
                            onChange={(e) => updateChallenge(index, 'severity', e.target.value)}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                        <div className="col-md-8 mb-2">
                          <label className="form-label small">Issue Description</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={challenge.issue}
                            onChange={(e) => updateChallenge(index, 'issue', e.target.value)}
                            placeholder="Describe the challenge or issue"
                          />
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeChallenge(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <label className="form-label">5. Support Needed</label>
                <select
                  className="form-select"
                  value={formData.supportNeeded}
                  onChange={(e) => handleChange('supportNeeded', e.target.value)}
                >
                  <option value="">Select Support Type</option>
                  <option value="Budget">Budget</option>
                  <option value="Manpower">Manpower</option>
                  <option value="Vendor">Vendor</option>
                  <option value="None">None at this time</option>
                </select>
                <small className="text-muted">Triggers notification to Admin/CEO</small>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">6. Upcoming Priorities (Next Week)</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addPriority}
                  >
                    <i className="bi bi-plus"></i> Add Priority
                  </button>
                </div>
                {formData.upcomingPriorities.map((priority, index) => (
                  <div key={index} className="card mb-2">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-10 mb-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={priority.priority}
                            onChange={(e) => updatePriority(index, 'priority', e.target.value)}
                            placeholder="Priority description"
                          />
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-center">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={priority.isHigh}
                              onChange={(e) => updatePriority(index, 'isHigh', e.target.checked)}
                              id={`priority-${index}`}
                            />
                            <label className="form-check-label small" htmlFor={`priority-${index}`}>
                              High
                            </label>
                          </div>
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removePriority(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <label className="form-label">Attachments</label>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  onChange={(e) => {
                    Array.from(e.target.files).forEach(file => {
                      handleFileUpload(file);
                    });
                  }}
                />
                {formData.attachments.length > 0 && (
                  <div className="mt-2">
                    <small>Uploaded: {formData.attachments.length} file(s)</small>
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
                    {report ? 'Updating...' : 'Submitting...'}
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

export default ICTWeeklyReportForm;

