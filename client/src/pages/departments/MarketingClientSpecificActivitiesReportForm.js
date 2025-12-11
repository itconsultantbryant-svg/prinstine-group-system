import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const MarketingClientSpecificActivitiesReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [clients, setClients] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    // 1. Basic Information
    reportTitle: '',
    clientName: '',
    clientId: null,
    nameOfOfficer: user?.name || '',
    officerId: user?.id || null,
    departmentUnit: 'Marketing Department',
    reportingPeriod: '',
    dateSubmitted: new Date().toISOString().split('T')[0],
    supervisorManager: '',
    supervisorId: null,
    
    // 2. Summary of Key Activities (Repeatable Table)
    activities: [{
      activityDate: new Date().toISOString().split('T')[0],
      dateSubmittedFiled: '',
      objectiveTaskPerformed: '',
      activityType: '', // Tax Filing, Proposal Delivery, Meeting, Training, etc.
      location: '',
      timeSpent: '',
      timeSpentHours: 0, // Auto-converted
      supervisorWitness: '',
      supervisorWitnessId: null,
      status: 'Pending',
      supportingDocuments: []
    }],
    
    // 3. Achievements / Results
    achievementsSummary: '',
    keyOutcomes: [],
    
    // 4. Challenges Encountered
    challengesDescription: '',
    challengesSeverity: 'Low',
    
    // 5. Recommendations / Next Steps
    nextActions: [],
    generalRecommendations: '',
    
    // 6. Attachments
    taxFilingReceipts: [],
    emailsConfirmations: [],
    photos: [],
    
    // 7. Approval Workflow
    preparedBy: user?.name || '',
    preparedBySignature: '',
    reviewedBy: '',
    reviewedById: null,
    reviewedBySignature: '',
    finalApproval: '',
    finalApprovalSignature: '',
    reportStatus: 'Draft'
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
      const allStaff = response.data.staff || [];
      // Also get users for supervisors (if user has permission)
      try {
        const usersResponse = await api.get('/users');
        const allUsers = usersResponse.data.users || [];
        setStaffMembers([...allStaff, ...allUsers.filter(u => !allStaff.find(s => s.id === u.id))]);
      } catch (usersError) {
        // If users endpoint fails, just use staff list
        console.warn('Could not fetch users, using staff list only:', usersError);
        setStaffMembers(allStaff);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      setStaffMembers([]);
    }
  };

  const loadReportData = () => {
    if (report && report.content) {
      try {
        const parsed = JSON.parse(report.content);
        setFormData(parsed);
      } catch (e) {
        console.log('Report content is plain text, parsing...');
        // Parse plain text if needed
      }
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addActivity = () => {
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, {
        activityDate: new Date().toISOString().split('T')[0],
        dateSubmittedFiled: '',
        objectiveTaskPerformed: '',
        activityType: '',
        location: '',
        timeSpent: '',
        timeSpentHours: 0,
        supervisorWitness: '',
        supervisorWitnessId: null,
        status: 'Pending',
        supportingDocuments: []
      }]
    }));
  };

  const removeActivity = (index) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index)
    }));
  };

  const updateActivity = (index, field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.activities[index] = { ...updated.activities[index], [field]: value };
      
      // Auto-convert time spent to hours
      if (field === 'timeSpent') {
        const hours = convertTimeToHours(value);
        updated.activities[index].timeSpentHours = hours;
      }
      
      // Auto-set status to Completed if dateSubmittedFiled is filled
      if (field === 'dateSubmittedFiled' && value) {
        updated.activities[index].status = 'Completed';
      }
      
      return updated;
    });
  };

  const convertTimeToHours = (timeString) => {
    if (!timeString) return 0;
    
    // Handle formats like "15 Min", "2 Hours", "1.5 Hours", "30 Min"
    const lower = timeString.toLowerCase();
    if (lower.includes('hour')) {
      const match = timeString.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    } else if (lower.includes('min')) {
      const match = timeString.match(/(\d+)/);
      return match ? parseFloat(match[1]) / 60 : 0;
    }
    return 0;
  };

  const addKeyOutcome = () => {
    setFormData(prev => ({
      ...prev,
      keyOutcomes: [...prev.keyOutcomes, '']
    }));
  };

  const removeKeyOutcome = (index) => {
    setFormData(prev => ({
      ...prev,
      keyOutcomes: prev.keyOutcomes.filter((_, i) => i !== index)
    }));
  };

  const updateKeyOutcome = (index, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.keyOutcomes[index] = value;
      return updated;
    });
  };

  const addNextAction = () => {
    setFormData(prev => ({
      ...prev,
      nextActions: [...prev.nextActions, {
        action: '',
        owner: '',
        ownerId: null,
        dueDate: ''
      }]
    }));
  };

  const removeNextAction = (index) => {
    setFormData(prev => ({
      ...prev,
      nextActions: prev.nextActions.filter((_, i) => i !== index)
    }));
  };

  const updateNextAction = (index, field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated.nextActions[index] = { ...updated.nextActions[index], [field]: value };
      return updated;
    });
  };

  const handleFileUpload = async (file, category, activityIndex = null) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFormData(prev => {
        const updated = { ...prev };
        
        if (activityIndex !== null) {
          // Supporting document for specific activity
          updated.activities[activityIndex].supportingDocuments = [
            ...updated.activities[activityIndex].supportingDocuments,
            response.data.url
          ];
        } else {
          // General attachment
          if (category === 'tax') {
            updated.taxFilingReceipts = [...prev.taxFilingReceipts, response.data.url];
          } else if (category === 'emails') {
            updated.emailsConfirmations = [...prev.emailsConfirmations, response.data.url];
          } else if (category === 'photos') {
            updated.photos = [...prev.photos, response.data.url];
          }
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
    return JSON.stringify(data);
  };

  const formatReportText = () => {
    let content = `MARKETING DEPARTMENT – CLIENT-SPECIFIC ACTIVITIES REPORT\n`;
    content += `==========================================================\n\n`;
    
    content += `1. BASIC INFORMATION\n`;
    content += `--------------------\n`;
    content += `Report Title: ${formData.reportTitle}\n`;
    content += `Client Name: ${formData.clientName}\n`;
    content += `Name of Officer: ${formData.nameOfOfficer}\n`;
    content += `Department/Unit: ${formData.departmentUnit}\n`;
    content += `Reporting Period: ${formData.reportingPeriod}\n`;
    content += `Date Submitted: ${formData.dateSubmitted}\n`;
    content += `Supervisor/Manager: ${formData.supervisorManager}\n\n`;
    
    content += `2. SUMMARY OF KEY ACTIVITIES\n`;
    content += `---------------------------\n`;
    formData.activities.forEach((activity, index) => {
      content += `\nActivity ${index + 1}:\n`;
      content += `  Activity Date: ${activity.activityDate}\n`;
      if (activity.dateSubmittedFiled) {
        content += `  Date Submitted/Filed: ${activity.dateSubmittedFiled}\n`;
      }
      content += `  Activity Type: ${activity.activityType || 'N/A'}\n`;
      content += `  Objective/Task Performed: ${activity.objectiveTaskPerformed}\n`;
      content += `  Location: ${activity.location || 'N/A'}\n`;
      content += `  Time Spent: ${activity.timeSpent} (${activity.timeSpentHours.toFixed(2)} hours)\n`;
      if (activity.supervisorWitness) {
        content += `  Supervisor/Witness: ${activity.supervisorWitness}\n`;
      }
      content += `  Status: ${activity.status}\n`;
      if (activity.supportingDocuments.length > 0) {
        content += `  Supporting Documents: ${activity.supportingDocuments.length} file(s)\n`;
      }
    });
    
    content += `\n\n3. ACHIEVEMENTS / RESULTS\n`;
    content += `------------------------\n`;
    content += `Summary: ${formData.achievementsSummary || 'N/A'}\n\n`;
    if (formData.keyOutcomes.length > 0) {
      content += `Key Outcomes:\n`;
      formData.keyOutcomes.forEach((outcome, index) => {
        if (outcome.trim()) {
          content += `  • ${outcome}\n`;
        }
      });
    }
    
    if (formData.challengesDescription) {
      content += `\n\n4. CHALLENGES ENCOUNTERED\n`;
      content += `--------------------------\n`;
      content += `Description: ${formData.challengesDescription}\n`;
      content += `Severity: ${formData.challengesSeverity}\n`;
    }
    
    if (formData.nextActions.length > 0 || formData.generalRecommendations) {
      content += `\n\n5. RECOMMENDATIONS / NEXT STEPS\n`;
      content += `-------------------------------\n`;
      if (formData.nextActions.length > 0) {
        content += `Next Actions:\n`;
        formData.nextActions.forEach((action, index) => {
          if (action.action.trim()) {
            content += `  ${index + 1}. ${action.action}`;
            if (action.owner) content += ` (Owner: ${action.owner})`;
            if (action.dueDate) content += ` (Due: ${action.dueDate})`;
            content += `\n`;
          }
        });
      }
      if (formData.generalRecommendations) {
        content += `\nGeneral Recommendations:\n${formData.generalRecommendations}\n`;
      }
    }
    
    content += `\n\n6. ATTACHMENTS\n`;
    content += `---------------\n`;
    if (formData.taxFilingReceipts.length > 0) {
      content += `Tax Filing Receipts: ${formData.taxFilingReceipts.length} file(s)\n`;
    }
    if (formData.emailsConfirmations.length > 0) {
      content += `Emails/Confirmations: ${formData.emailsConfirmations.length} file(s)\n`;
    }
    if (formData.photos.length > 0) {
      content += `Photos: ${formData.photos.length} file(s)\n`;
    }
    
    content += `\n\n7. APPROVAL WORKFLOW\n`;
    content += `--------------------\n`;
    content += `Prepared By: ${formData.preparedBy}\n`;
    content += `Report Status: ${formData.reportStatus}\n`;
    if (formData.reviewedBy) {
      content += `Reviewed By: ${formData.reviewedBy}\n`;
    }
    if (formData.finalApproval) {
      content += `Final Approval: ${formData.finalApproval}\n`;
    }
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const structuredData = formatReportContent();
      const textContent = formatReportText();
      
      const reportTitle = formData.reportTitle || 
        `Client Activity Report - ${formData.clientName} - ${formData.reportingPeriod}`;

      if (report) {
        await api.put(`/department-reports/${report.id}`, {
          title: reportTitle,
          content: structuredData
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
      'Completed': 'success',
      'Pending': 'warning',
      'Overdue': 'danger'
    };
    return colors[status] || 'secondary';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': 'success',
      'Medium': 'warning',
      'High': 'danger'
    };
    return colors[severity] || 'secondary';
  };

  const activityTypes = [
    'Tax Filing',
    'Proposal Delivery',
    'Meeting',
    'Training',
    'Compliance Work',
    'Document Preparation',
    'Client Visit',
    'Other'
  ];

  const locationOptions = [
    'At our Office',
    'Client Site',
    'Remote',
    'LRA Office',
    'Other'
  ];

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-fullscreen modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-file-text me-2"></i>
              {report ? 'Edit Client-Specific Activities Report' : 'Marketing - Client-Specific Activities Report'}
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

              {/* 1. Basic Information */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">1. Basic Information</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label fw-bold">Report Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.reportTitle}
                        onChange={(e) => handleChange('reportTitle', e.target.value)}
                        placeholder="e.g., W/H on Salaries & Wages, CIT & GST – Monroe Chicken"
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Client Name</label>
                      <select
                        className="form-select"
                        value={formData.clientId || ''}
                        onChange={(e) => {
                          const client = clients.find(c => c.id === parseInt(e.target.value));
                          handleChange('clientId', e.target.value);
                          handleChange('clientName', client ? (client.company_name || client.name) : '');
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
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Or enter client name manually"
                        value={formData.clientName}
                        onChange={(e) => handleChange('clientName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Name of Officer</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.nameOfOfficer}
                        onChange={(e) => handleChange('nameOfOfficer', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Department/Unit</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.departmentUnit}
                        disabled
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Reporting Period</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.reportingPeriod}
                        onChange={(e) => handleChange('reportingPeriod', e.target.value)}
                        placeholder="e.g., W/H Salaries (Sept), CIT & GST (Oct)"
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Date Submitted</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.dateSubmitted}
                        onChange={(e) => handleChange('dateSubmitted', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">Supervisor/Manager</label>
                      <select
                        className="form-select"
                        value={formData.supervisorId || ''}
                        onChange={(e) => {
                          const staff = staffMembers.find(s => s.id === parseInt(e.target.value));
                          handleChange('supervisorId', e.target.value);
                          handleChange('supervisorManager', staff ? staff.name : '');
                        }}
                        required
                      >
                        <option value="">Select supervisor...</option>
                        <option value="ceo">Mr. Prince S. Cooper (CEO)</option>
                        <option value="head-marketing">Head of Marketing</option>
                        {staffMembers.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-control mt-2"
                        value={formData.supervisorManager}
                        onChange={(e) => handleChange('supervisorManager', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Summary of Key Activities */}
              <div className="card mb-4">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">2. Summary of Key Activities</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addActivity}
                  >
                    <i className="bi bi-plus-circle me-1"></i>Add Activity
                  </button>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '10%' }}>Activity Date</th>
                          <th style={{ width: '10%' }}>Date Submitted/Filed</th>
                          <th style={{ width: '10%' }}>Activity Type</th>
                          <th style={{ width: '20%' }}>Objective/Task Performed</th>
                          <th style={{ width: '10%' }}>Location</th>
                          <th style={{ width: '8%' }}>Time Spent</th>
                          <th style={{ width: '10%' }}>Supervisor/Witness</th>
                          <th style={{ width: '8%' }}>Status</th>
                          <th style={{ width: '9%' }}>Documents</th>
                          <th style={{ width: '5%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.activities.map((activity, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={activity.activityDate}
                                onChange={(e) => updateActivity(index, 'activityDate', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={activity.dateSubmittedFiled}
                                onChange={(e) => updateActivity(index, 'dateSubmittedFiled', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={activity.activityType}
                                onChange={(e) => updateActivity(index, 'activityType', e.target.value)}
                              >
                                <option value="">Select type...</option>
                                {activityTypes.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <textarea
                                className="form-control form-control-sm"
                                rows="2"
                                value={activity.objectiveTaskPerformed}
                                onChange={(e) => updateActivity(index, 'objectiveTaskPerformed', e.target.value)}
                                placeholder="Describe the task..."
                                required
                              />
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm mb-1"
                                value={activity.location}
                                onChange={(e) => updateActivity(index, 'location', e.target.value)}
                              >
                                <option value="">Select location...</option>
                                {locationOptions.map(loc => (
                                  <option key={loc} value={loc}>{loc}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Or enter manually"
                                value={activity.location}
                                onChange={(e) => updateActivity(index, 'location', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={activity.timeSpent}
                                onChange={(e) => updateActivity(index, 'timeSpent', e.target.value)}
                                placeholder="e.g., 15 Min, 2 Hours"
                              />
                              <small className="text-muted">
                                {activity.timeSpentHours > 0 && `${activity.timeSpentHours.toFixed(2)} hrs`}
                              </small>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={activity.supervisorWitnessId || ''}
                                onChange={(e) => {
                                  const staff = staffMembers.find(s => s.id === parseInt(e.target.value));
                                  updateActivity(index, 'supervisorWitnessId', e.target.value);
                                  updateActivity(index, 'supervisorWitness', staff ? staff.name : '');
                                }}
                              >
                                <option value="">Select...</option>
                                {staffMembers.map(staff => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className={`form-select form-select-sm border-${getStatusColor(activity.status)}`}
                                value={activity.status}
                                onChange={(e) => updateActivity(index, 'status', e.target.value)}
                                required
                              >
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="Overdue">Overdue</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="file"
                                className="form-control form-control-sm"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], 'activity', index);
                                  }
                                }}
                              />
                              {activity.supportingDocuments.length > 0 && (
                                <small className="text-muted">
                                  {activity.supportingDocuments.length} file(s)
                                </small>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeActivity(index)}
                                disabled={formData.activities.length === 1}
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

              {/* 3. Achievements / Results */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">3. Achievements / Results</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Summary</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.achievementsSummary}
                      onChange={(e) => handleChange('achievementsSummary', e.target.value)}
                      placeholder="Auto-suggestion: All required filings successfully completed on time"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Key Outcomes</label>
                    {formData.keyOutcomes.map((outcome, index) => (
                      <div key={index} className="input-group mb-2">
                        <span className="input-group-text">•</span>
                        <input
                          type="text"
                          className="form-control"
                          value={outcome}
                          onChange={(e) => updateKeyOutcome(index, e.target.value)}
                          placeholder="e.g., Avoided late penalties, Client satisfied"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={() => removeKeyOutcome(index)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={addKeyOutcome}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Outcome
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Challenges Encountered */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">4. Challenges Encountered</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.challengesDescription}
                      onChange={(e) => handleChange('challengesDescription', e.target.value)}
                      placeholder="e.g., LRA portal was slow, Missing client documents"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Severity</label>
                    <select
                      className={`form-select border-${getSeverityColor(formData.challengesSeverity)}`}
                      value={formData.challengesSeverity}
                      onChange={(e) => handleChange('challengesSeverity', e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 5. Recommendations / Next Steps */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">5. Recommendations / Next Steps</h5>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Next Actions</label>
                    {formData.nextActions.map((action, index) => (
                      <div key={index} className="card mb-2">
                        <div className="card-body">
                          <div className="row">
                            <div className="col-md-5 mb-2">
                              <input
                                type="text"
                                className="form-control"
                                value={action.action}
                                onChange={(e) => updateNextAction(index, 'action', e.target.value)}
                                placeholder="Action description"
                              />
                            </div>
                            <div className="col-md-3 mb-2">
                              <select
                                className="form-select"
                                value={action.ownerId || ''}
                                onChange={(e) => {
                                  const staff = staffMembers.find(s => s.id === parseInt(e.target.value));
                                  updateNextAction(index, 'ownerId', e.target.value);
                                  updateNextAction(index, 'owner', staff ? staff.name : '');
                                }}
                              >
                                <option value="">Select owner...</option>
                                {staffMembers.map(staff => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="form-control mt-1"
                                value={action.owner}
                                onChange={(e) => updateNextAction(index, 'owner', e.target.value)}
                                placeholder="Or enter manually"
                              />
                            </div>
                            <div className="col-md-3 mb-2">
                              <input
                                type="date"
                                className="form-control"
                                value={action.dueDate}
                                onChange={(e) => updateNextAction(index, 'dueDate', e.target.value)}
                                placeholder="Due date"
                              />
                            </div>
                            <div className="col-md-1 mb-2">
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => removeNextAction(index)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={addNextAction}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Next Action
                    </button>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">General Recommendations</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.generalRecommendations}
                      onChange={(e) => handleChange('generalRecommendations', e.target.value)}
                      placeholder="Enter general recommendations..."
                    />
                  </div>
                </div>
              </div>

              {/* 6. Attachments */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">6. Attachments</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Tax Filing Receipts</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file, 'tax');
                          });
                        }}
                      />
                      {formData.taxFilingReceipts.length > 0 && (
                        <div className="mt-2">
                          {formData.taxFilingReceipts.map((url, idx) => (
                            <div key={idx} className="badge bg-primary me-1">
                              Receipt {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Emails / Confirmation from LRA</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.jpg,.jpeg,.png,.eml"
                        multiple
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file, 'emails');
                          });
                        }}
                      />
                      {formData.emailsConfirmations.length > 0 && (
                        <div className="mt-2">
                          {formData.emailsConfirmations.map((url, idx) => (
                            <div key={idx} className="badge bg-info me-1">
                              Email {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Photos (if client visit)</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          Array.from(e.target.files).forEach(file => {
                            handleFileUpload(file, 'photos');
                          });
                        }}
                      />
                      {formData.photos.length > 0 && (
                        <div className="mt-2">
                          {formData.photos.map((url, idx) => (
                            <div key={idx} className="badge bg-warning me-1">
                              Photo {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. Approval Workflow */}
              <div className="card mb-4">
                <div className="card-header bg-light">
                  <h5 className="mb-0">7. Approval Workflow</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Prepared By</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.preparedBy}
                        onChange={(e) => handleChange('preparedBy', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Reviewed By</label>
                      <select
                        className="form-select"
                        value={formData.reviewedById || ''}
                        onChange={(e) => {
                          const staff = staffMembers.find(s => s.id === parseInt(e.target.value));
                          handleChange('reviewedById', e.target.value);
                          handleChange('reviewedBy', staff ? staff.name : '');
                        }}
                      >
                        <option value="">Select reviewer...</option>
                        <option value="head-marketing">Head of Marketing</option>
                        {staffMembers.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Final Approval</label>
                      <select
                        className="form-select"
                        value={formData.finalApproval}
                        onChange={(e) => handleChange('finalApproval', e.target.value)}
                      >
                        <option value="">Select approver...</option>
                        <option value="Mr. Prince S. Cooper (CEO)">Mr. Prince S. Cooper (CEO)</option>
                        <option value="Head of Marketing">Head of Marketing</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-bold">Report Status</label>
                      <select
                        className="form-select"
                        value={formData.reportStatus}
                        onChange={(e) => handleChange('reportStatus', e.target.value)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Approved">Approved</option>
                        <option value="Archived">Archived</option>
                      </select>
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

export default MarketingClientSpecificActivitiesReportForm;

