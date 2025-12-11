import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const MarketingWeeklyClientOfficerReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [clients, setClients] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  
  // Helper function to get current week info
  const getCurrentWeekInfo = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Calculate week number (1-4 or 1-5 depending on month)
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysSinceFirstMonday = Math.floor((today - firstDayOfMonth) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.ceil((daysSinceFirstMonday + firstDayOfMonth.getDay()) / 7);
    
    const weekNames = ['One', 'Two', 'Three', 'Four', 'Five'];
    const weekName = weekNames[weekNumber - 1] || `Week ${weekNumber}`;
    
    return {
      week: weekName,
      weekNumber: weekNumber,
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
      period: `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  };

  const weekInfo = getCurrentWeekInfo();

  // Form state
  const [formData, setFormData] = useState({
    // Report Header
    week: weekInfo.week,
    weekNumber: weekInfo.weekNumber,
    reportingPeriod: weekInfo.period,
    reportingPeriodStart: weekInfo.startDate,
    reportingPeriodEnd: weekInfo.endDate,
    assignedOfficer: user?.name || '',
    assignedOfficerId: user?.id || null,
    preparedBy: `${user?.name || ''} - ${user?.role || ''}`,
    approvedBy: '',
    approvedBySignature: '',
    
    // Weekly Tasks
    tasks: [{
      week: weekInfo.week,
      clientName: '',
      clientId: null,
      assignedOfficer: user?.name || '',
      assignedOfficerId: user?.id || null,
      taskForWeek: '',
      status: 'Pending',
      dateStarted: weekInfo.startDate,
      dateCompleted: '',
      priorityLevel: 'Medium',
      supportNeeded: '',
      remarks: '',
      attachments: []
    }],
    
    // Summary & Analytics
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    cancelledTasks: 0,
    highPriorityTasks: 0,
    clientsEngaged: [],
    weeklyHighlights: '',
    challenges: '',
    
    // Attachments
    proposalsContracts: [],
    meetingMinutesPhotos: [],
    flyersPostsScreenshots: [],
    
    // Approval
    submissionDate: new Date().toISOString()
  });

  useEffect(() => {
    fetchDepartment();
    fetchClients();
    fetchStaffMembers();
    if (report) {
      loadReportData();
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

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const response = await api.get('/staff');
      // Filter for marketing staff or all staff if no department filter
      const marketingStaff = response.data.staff || [];
      setStaffMembers(marketingStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const loadReportData = () => {
    if (report && report.content) {
      try {
        // Try to parse JSON content
        const parsed = JSON.parse(report.content);
        setFormData(parsed);
      } catch (e) {
        // If not JSON, it's plain text - parse it
        console.log('Report content is plain text, parsing...');
        // For now, just set basic info
        setFormData(prev => ({
          ...prev,
          week: report.title.includes('Week') ? extractWeek(report.title) : prev.week
        }));
      }
    }
  };

  const extractWeek = (title) => {
    const match = title.match(/Week\s+(\w+)/i);
    return match ? match[1] : 'One';
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, {
        week: prev.week,
        clientName: '',
        clientId: null,
        assignedOfficer: prev.assignedOfficer,
        assignedOfficerId: prev.assignedOfficerId,
        taskForWeek: '',
        status: 'Pending',
        dateStarted: prev.reportingPeriodStart,
        dateCompleted: '',
        priorityLevel: 'Medium',
        supportNeeded: '',
        remarks: '',
        attachments: []
      }]
    }));
  };

  const removeTask = (index) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
    updateAnalytics();
  };

  const updateTask = (index, field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.tasks[index] = { ...updated.tasks[index], [field]: value };
      
      // Auto-fill dateCompleted if status is Done
      if (field === 'status' && value === 'Done' && !updated.tasks[index].dateCompleted) {
        updated.tasks[index].dateCompleted = new Date().toISOString().split('T')[0];
      }
      
      // Update analytics
      setTimeout(() => updateAnalytics(), 0);
      
      return updated;
    });
  };

  const updateAnalytics = () => {
    setFormData(prev => {
      const tasks = prev.tasks;
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Done').length;
      const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
      const cancelledTasks = tasks.filter(t => t.status === 'Cancelled').length;
      const highPriorityTasks = tasks.filter(t => t.priorityLevel === 'High').length;
      
      // Get unique clients
      const clientsEngaged = [...new Set(tasks.map(t => t.clientName).filter(Boolean))];
      
      return {
        ...prev,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        cancelledTasks,
        highPriorityTasks,
        clientsEngaged
      };
    });
  };

  useEffect(() => {
    updateAnalytics();
  }, [formData.tasks]);

  const handleFileUpload = async (file, category) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFormData(prev => {
        const updated = { ...prev };
        if (category === 'proposals') {
          updated.proposalsContracts = [...prev.proposalsContracts, response.data.url];
        } else if (category === 'meetings') {
          updated.meetingMinutesPhotos = [...prev.meetingMinutesPhotos, response.data.url];
        } else if (category === 'flyers') {
          updated.flyersPostsScreenshots = [...prev.flyersPostsScreenshots, response.data.url];
        }
        return updated;
      });
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    }
  };

  const formatReportContent = () => {
    const data = { ...formData };
    // Return JSON for structured storage
    return JSON.stringify(data);
  };

  const formatReportText = () => {
    let content = `MARKETING DEPARTMENT WEEKLY CLIENT OFFICER REPORT\n`;
    content += `==================================================\n\n`;
    
    content += `REPORT HEADER\n`;
    content += `-------------\n`;
    content += `Week: ${formData.week} (Week ${formData.weekNumber})\n`;
    content += `Reporting Period: ${formData.reportingPeriod}\n`;
    content += `Assigned Officer: ${formData.assignedOfficer}\n`;
    content += `Prepared By: ${formData.preparedBy}\n`;
    if (formData.approvedBy) {
      content += `Approved By: ${formData.approvedBy}\n`;
    }
    content += `\n`;
    
    content += `WEEKLY TASKS\n`;
    content += `-------------\n`;
    formData.tasks.forEach((task, index) => {
      content += `\nTask ${index + 1}:\n`;
      content += `  Client Name: ${task.clientName || 'N/A'}\n`;
      content += `  Assigned Officer: ${task.assignedOfficer}\n`;
      content += `  Task for the Week: ${task.taskForWeek}\n`;
      content += `  Status: ${task.status}\n`;
      content += `  Date Started: ${task.dateStarted}\n`;
      if (task.dateCompleted) {
        content += `  Date Completed: ${task.dateCompleted}\n`;
      }
      content += `  Priority Level: ${task.priorityLevel}\n`;
      if (task.supportNeeded) {
        content += `  Support Needed: ${task.supportNeeded}\n`;
      }
      if (task.remarks) {
        content += `  Remarks/Next Steps: ${task.remarks}\n`;
      }
    });
    
    content += `\n\nSUMMARY & ANALYTICS\n`;
    content += `--------------------\n`;
    content += `Total Tasks This Week: ${formData.totalTasks}\n`;
    content += `Completed: ${formData.completedTasks} (${formData.totalTasks > 0 ? Math.round((formData.completedTasks / formData.totalTasks) * 100) : 0}%)\n`;
    content += `Pending: ${formData.pendingTasks}\n`;
    content += `In Progress: ${formData.inProgressTasks}\n`;
    content += `Cancelled: ${formData.cancelledTasks}\n`;
    content += `High Priority Tasks: ${formData.highPriorityTasks}\n`;
    content += `Clients Engaged: ${formData.clientsEngaged.length} (${formData.clientsEngaged.join(', ') || 'None'})\n`;
    
    if (formData.weeklyHighlights) {
      content += `\nWeekly Highlights:\n${formData.weeklyHighlights}\n`;
    }
    
    if (formData.challenges) {
      content += `\nChallenges:\n${formData.challenges}\n`;
    }
    
    content += `\n\nATTACHMENTS\n`;
    content += `-----------\n`;
    if (formData.proposalsContracts.length > 0) {
      content += `Proposals/Contracts: ${formData.proposalsContracts.length} file(s)\n`;
    }
    if (formData.meetingMinutesPhotos.length > 0) {
      content += `Meeting Minutes/Photos: ${formData.meetingMinutesPhotos.length} file(s)\n`;
    }
    if (formData.flyersPostsScreenshots.length > 0) {
      content += `Flyers/Posts Screenshots: ${formData.flyersPostsScreenshots.length} file(s)\n`;
    }
    
    content += `\n\nAPPROVAL & SIGN-OFF\n`;
    content += `-------------------\n`;
    content += `Prepared By: ${formData.preparedBy}\n`;
    content += `Submission Date: ${new Date(formData.submissionDate).toLocaleString()}\n`;
    if (formData.approvedBy) {
      content += `Approved By: ${formData.approvedBy}\n`;
    }
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Format both JSON (for structured data) and text (for display)
      const structuredData = formatReportContent();
      const textContent = formatReportText();
      
      const reportTitle = `Marketing Weekly Client Officer Report - Week ${formData.weekNumber} (${formData.reportingPeriod})`;

      if (report) {
        await api.put(`/department-reports/${report.id}`, {
          title: reportTitle,
          content: structuredData // Store JSON, but we can also store text version
        });
      } else {
        await api.post('/department-reports', {
          title: reportTitle,
          content: structuredData
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

  const getStatusColor = (status) => {
    const colors = {
      'Done': 'success',
      'Pending': 'warning',
      'In Progress': 'info',
      'Cancelled': 'danger'
    };
    return colors[status] || 'secondary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'High': 'danger',
      'Medium': 'warning',
      'Low': 'success'
    };
    return colors[priority] || 'secondary';
  };

  const completionPercentage = formData.totalTasks > 0 
    ? Math.round((formData.completedTasks / formData.totalTasks) * 100) 
    : 0;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-fullscreen modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-file-text me-2"></i>
              {report ? 'Edit Marketing Weekly Client Officer Report' : 'Marketing Weekly Client Officer Report'}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}

              {/* Report Header */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">Report Header</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-bold">Week</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.week}
                        onChange={(e) => handleChange('week', e.target.value)}
                        required
                      />
                      <small className="text-muted">e.g., "Two" or "Week 2"</small>
                    </div>
                    <div className="col-md-5 mb-3">
                      <label className="form-label fw-bold">Reporting Period</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.reportingPeriod}
                        onChange={(e) => handleChange('reportingPeriod', e.target.value)}
                        required
                      />
                      <small className="text-muted">e.g., "Nov 10-13"</small>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Assigned Officer</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.assignedOfficer}
                        onChange={(e) => handleChange('assignedOfficer', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Prepared By</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.preparedBy}
                        onChange={(e) => handleChange('preparedBy', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Approved By</label>
                      <select
                        className="form-select"
                        value={formData.approvedBy}
                        onChange={(e) => handleChange('approvedBy', e.target.value)}
                      >
                        <option value="">Select approver...</option>
                        <option value="Head of Marketing">Head of Marketing</option>
                        <option value="CEO - Mr. Prince S. Cooper">CEO - Mr. Prince S. Cooper</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Tasks Table */}
              <div className="card mb-4">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Weekly Tasks</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addTask}
                  >
                    <i className="bi bi-plus-circle me-1"></i>Add Task
                  </button>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '15%' }}>Client Name</th>
                          <th style={{ width: '12%' }}>Assigned Officer</th>
                          <th style={{ width: '20%' }}>Task for the Week</th>
                          <th style={{ width: '8%' }}>Status</th>
                          <th style={{ width: '10%' }}>Date Started</th>
                          <th style={{ width: '10%' }}>Date Completed</th>
                          <th style={{ width: '8%' }}>Priority</th>
                          <th style={{ width: '12%' }}>Support Needed</th>
                          <th style={{ width: '15%' }}>Remarks/Next Steps</th>
                          <th style={{ width: '5%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.tasks.map((task, index) => (
                          <tr key={index}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={task.clientId || ''}
                                onChange={(e) => {
                                  const client = clients.find(c => c.id === parseInt(e.target.value));
                                  updateTask(index, 'clientId', e.target.value);
                                  updateTask(index, 'clientName', client ? (client.company_name || client.name) : '');
                                }}
                                required
                              >
                                <option value="">Select client...</option>
                                {clients.map(client => (
                                  <option key={client.id} value={client.id}>
                                    {client.company_name || client.name || client.email}
                                  </option>
                                ))}
                              </select>
                              {task.clientId && (
                                <input
                                  type="text"
                                  className="form-control form-control-sm mt-1"
                                  placeholder="Or enter manually"
                                  value={task.clientName}
                                  onChange={(e) => updateTask(index, 'clientName', e.target.value)}
                                />
                              )}
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={task.assignedOfficerId || ''}
                                onChange={(e) => {
                                  const staff = staffMembers.find(s => s.id === parseInt(e.target.value));
                                  updateTask(index, 'assignedOfficerId', e.target.value);
                                  updateTask(index, 'assignedOfficer', staff ? staff.name : '');
                                }}
                              >
                                <option value="">Select officer...</option>
                                {staffMembers.map(staff => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="form-control form-control-sm mt-1"
                                value={task.assignedOfficer}
                                onChange={(e) => updateTask(index, 'assignedOfficer', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <textarea
                                className="form-control form-control-sm"
                                rows="2"
                                value={task.taskForWeek}
                                onChange={(e) => updateTask(index, 'taskForWeek', e.target.value)}
                                placeholder="Describe the task..."
                                required
                              />
                            </td>
                            <td>
                              <select
                                className={`form-select form-select-sm border-${getStatusColor(task.status)}`}
                                value={task.status}
                                onChange={(e) => updateTask(index, 'status', e.target.value)}
                                required
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Done">Done</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={task.dateStarted}
                                onChange={(e) => updateTask(index, 'dateStarted', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={task.dateCompleted}
                                onChange={(e) => updateTask(index, 'dateCompleted', e.target.value)}
                                disabled={task.status !== 'Done'}
                              />
                            </td>
                            <td>
                              <select
                                className={`form-select form-select-sm border-${getPriorityColor(task.priorityLevel)}`}
                                value={task.priorityLevel}
                                onChange={(e) => updateTask(index, 'priorityLevel', e.target.value)}
                                required
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={task.supportNeeded}
                                onChange={(e) => updateTask(index, 'supportNeeded', e.target.value)}
                                placeholder="N/A or name"
                              />
                            </td>
                            <td>
                              <textarea
                                className="form-control form-control-sm"
                                rows="2"
                                value={task.remarks}
                                onChange={(e) => updateTask(index, 'remarks', e.target.value)}
                                placeholder="Remarks..."
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeTask(index)}
                                disabled={formData.tasks.length === 1}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Summary & Analytics */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">Summary & Analytics</h5>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <div className="card text-center">
                        <div className="card-body">
                          <h4 className="text-primary">{formData.totalTasks}</h4>
                          <small className="text-muted">Total Tasks</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center">
                        <div className="card-body">
                          <h4 className="text-success">{formData.completedTasks}</h4>
                          <small className="text-muted">Completed ({completionPercentage}%)</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center">
                        <div className="card-body">
                          <h4 className="text-warning">{formData.pendingTasks}</h4>
                          <small className="text-muted">Pending</small>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="card text-center">
                        <div className="card-body">
                          <h4 className="text-danger">{formData.highPriorityTasks}</h4>
                          <small className="text-muted">High Priority</small>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label fw-bold">Clients Engaged</label>
                    <div className="badge bg-info me-2">
                      {formData.clientsEngaged.length} Client(s)
                    </div>
                    {formData.clientsEngaged.length > 0 && (
                      <div className="mt-2">
                        {formData.clientsEngaged.map((client, idx) => (
                          <span key={idx} className="badge bg-secondary me-1">{client}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Weekly Highlights</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.weeklyHighlights}
                      onChange={(e) => handleChange('weeklyHighlights', e.target.value)}
                      placeholder="Summarize key achievements and highlights for the week..."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Challenges</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.challenges}
                      onChange={(e) => handleChange('challenges', e.target.value)}
                      placeholder="Describe any challenges faced during the week..."
                    />
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">Attachments & Evidence</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Proposals/Contracts</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handleFileUpload(e.target.files[0], 'proposals');
                          }
                        }}
                      />
                      {formData.proposalsContracts.length > 0 && (
                        <div className="mt-2">
                          {formData.proposalsContracts.map((url, idx) => (
                            <div key={idx} className="badge bg-primary me-1">
                              File {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Meeting Minutes/Photos</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*,.pdf,.doc,.docx"
                        multiple
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file, 'meetings');
                          });
                        }}
                      />
                      {formData.meetingMinutesPhotos.length > 0 && (
                        <div className="mt-2">
                          {formData.meetingMinutesPhotos.map((url, idx) => (
                            <div key={idx} className="badge bg-info me-1">
                              File {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Flyers/Posts Screenshots</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file, 'flyers');
                          });
                        }}
                      />
                      {formData.flyersPostsScreenshots.length > 0 && (
                        <div className="mt-2">
                          {formData.flyersPostsScreenshots.map((url, idx) => (
                            <div key={idx} className="badge bg-warning me-1">
                              File {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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

export default MarketingWeeklyClientOfficerReportForm;

