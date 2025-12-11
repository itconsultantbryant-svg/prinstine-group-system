import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const ClientEngagementReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [clients, setClients] = useState([]);
  const [activeSection, setActiveSection] = useState(1);
  
  // Form state for all 6 sections
  const [formData, setFormData] = useState({
    // Section 1: Report Header
    header: {
      weekEnding: getWeekEndingDate(),
      preparedBy: '',
      position: '',
      approvedBy: '',
      approvedSignature: '',
      periodCovered: ''
    },
    
    // Section 2: Activities Summary
    activities: {
      newClientsSigned: '',
      clientMeetingsConducted: '',
      proposalsSubmitted: ''
    },
    
    // Section 3: Weekly Highlights
    highlights: [
      { text: '', image: null, imageUrl: '' },
      { text: '', image: null, imageUrl: '' },
      { text: '', image: null, imageUrl: '' }
    ],
    
    // Section 4: Overall Weekly Feedback
    feedback: {
      achievements: [],
      challenges: [],
      lessonsLearned: '',
      clientFeedback: []
    },
    
    // Section 5: Client Engagement Weekly Portfolio (auto-generated)
    portfolio: {
      selectedClients: [],
      filterServiceType: 'all'
    },
    
    // Section 6: Next Steps and Action Items
    actionItems: []
  });

  // Helper function to get week ending date (Sunday)
  function getWeekEndingDate() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Get Sunday of current week
    const sunday = new Date(today.setDate(diff));
    return sunday.toISOString().split('T')[0];
  }

  // Helper function to format period covered
  function formatPeriodCovered(weekEnding) {
    if (!weekEnding) return '';
    const endDate = new Date(weekEnding);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7 days including Sunday
    
    const formatDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      return `${day} ${month}`;
    };
    
    return `${formatDate(startDate)} – ${formatDate(endDate)} ${endDate.getFullYear()}`;
  }

  useEffect(() => {
    fetchDepartment();
    fetchClients();
    if (report) {
      loadReportData();
    } else {
      // Set default values
      setFormData(prev => ({
        ...prev,
        header: {
          ...prev.header,
          preparedBy: user?.name || '',
          position: user?.position || 'Head of Client Engagement',
          periodCovered: formatPeriodCovered(prev.header.weekEnding)
        }
      }));
    }
  }, [report, user]);

  useEffect(() => {
    // Update period covered when week ending changes
    setFormData(prev => ({
      ...prev,
      header: {
        ...prev.header,
        periodCovered: formatPeriodCovered(prev.header.weekEnding)
      }
    }));
  }, [formData.header.weekEnding]);

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
      const clientsData = response.data.clients || [];
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const loadReportData = () => {
    // Parse report content if editing
    if (report.title) {
      // Extract week ending from title if available
      // For now, just set basic info
    }
  };

  const handleChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleHighlightChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      highlights: prev.highlights.map((highlight, i) =>
        i === index ? { ...highlight, [field]: value } : highlight
      )
    }));
  };

  const handleHighlightImageUpload = async (index, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      handleHighlightChange(index, 'imageUrl', response.data.url);
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload image');
    }
  };

  const addAchievement = () => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        achievements: [...prev.feedback.achievements, '']
      }
    }));
  };

  const removeAchievement = (index) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        achievements: prev.feedback.achievements.filter((_, i) => i !== index)
      }
    }));
  };

  const updateAchievement = (index, value) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        achievements: prev.feedback.achievements.map((item, i) =>
          i === index ? value : item
        )
      }
    }));
  };

  const addChallenge = () => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        challenges: [...prev.feedback.challenges, '']
      }
    }));
  };

  const removeChallenge = (index) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        challenges: prev.feedback.challenges.filter((_, i) => i !== index)
      }
    }));
  };

  const updateChallenge = (index, value) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        challenges: prev.feedback.challenges.map((item, i) =>
          i === index ? value : item
        )
      }
    }));
  };

  const addClientFeedback = () => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        clientFeedback: [
          ...prev.feedback.clientFeedback,
          { clientName: '', rating: 5, comment: '' }
        ]
      }
    }));
  };

  const removeClientFeedback = (index) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        clientFeedback: prev.feedback.clientFeedback.filter((_, i) => i !== index)
      }
    }));
  };

  const updateClientFeedback = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      feedback: {
        ...prev.feedback,
        clientFeedback: prev.feedback.clientFeedback.map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const calculateAverageRating = () => {
    if (formData.feedback.clientFeedback.length === 0) return 0;
    const sum = formData.feedback.clientFeedback.reduce((acc, item) => acc + (parseInt(item.rating) || 0), 0);
    return (sum / formData.feedback.clientFeedback.length).toFixed(1);
  };

  const getActiveClients = () => {
    return clients.filter(c => c.status === 'Active');
  };

  const getPendingLeads = () => {
    return clients.filter(c => c.status === 'Lead' || c.status === 'Proposal Sent');
  };

  const getActiveEngagements = () => {
    // This would need to be linked to projects/consultations module
    // For now, return clients with active status
    return clients.filter(c => c.status === 'Active' && c.services_availed);
  };

  const getNewClientsThisWeek = () => {
    const weekEnding = new Date(formData.header.weekEnding);
    const weekStart = new Date(weekEnding);
    weekStart.setDate(weekStart.getDate() - 6);
    
    return clients.filter(client => {
      const createdDate = new Date(client.created_at);
      return createdDate >= weekStart && createdDate <= weekEnding;
    });
  };

  const getFilteredClients = () => {
    let filtered = clients;
    
    if (formData.portfolio.filterServiceType !== 'all') {
      filtered = filtered.filter(client => {
        if (!client.services_availed) return false;
        const services = typeof client.services_availed === 'string' 
          ? JSON.parse(client.services_availed) 
          : client.services_availed;
        return services.includes(formData.portfolio.filterServiceType);
      });
    }
    
    return filtered;
  };

  const addActionItem = () => {
    setFormData(prev => ({
      ...prev,
      actionItems: [
        ...prev.actionItems,
        {
          actionItem: '',
          responsiblePerson: '',
          deadline: '',
          priority: 'Medium',
          status: 'Not Started',
          comments: ''
        }
      ]
    }));
  };

  const removeActionItem = (index) => {
    setFormData(prev => ({
      ...prev,
      actionItems: prev.actionItems.filter((_, i) => i !== index)
    }));
  };

  const updateActionItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      actionItems: prev.actionItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const formatReportContent = () => {
    const activeClients = getActiveClients();
    const pendingLeads = getPendingLeads();
    const activeEngagements = getActiveEngagements();
    const newClients = getNewClientsThisWeek();
    const avgRating = calculateAverageRating();
    
    let content = `CLIENT ENGAGEMENT DEPARTMENT REPORT\n`;
    content += `========================================\n\n`;
    
    content += `1. REPORT HEADER\n`;
    content += `----------------------------------------\n`;
    content += `Date (Week Ending): ${formData.header.weekEnding}\n`;
    content += `Prepared By: ${formData.header.preparedBy} (${formData.header.position})\n`;
    content += `Approved By: ${formData.header.approvedBy || 'Pending'}\n`;
    if (formData.header.approvedSignature) {
      content += `Approved Signature: ${formData.header.approvedSignature}\n`;
    }
    content += `Period Covered: ${formData.header.periodCovered}\n\n`;
    
    content += `2. ACTIVITIES SUMMARY\n`;
    content += `----------------------------------------\n`;
    content += `Total Active Clients: ${activeClients.length}\n`;
    content += `Total Pending/New Leads: ${pendingLeads.length}\n`;
    content += `Total Active Audit/Consultancy Engagements: ${activeEngagements.length}\n`;
    content += `New Clients Signed This Week: ${formData.activities.newClientsSigned || newClients.length}\n`;
    if (newClients.length > 0) {
      content += `  New Clients:\n`;
      newClients.forEach((client, idx) => {
        content += `    ${idx + 1}. ${client.company_name || client.name || 'N/A'}\n`;
      });
    }
    content += `Client Meetings Conducted: ${formData.activities.clientMeetingsConducted || 0}\n`;
    content += `Proposals Submitted: ${formData.activities.proposalsSubmitted || 0}\n\n`;
    
    content += `3. WEEKLY HIGHLIGHTS\n`;
    content += `----------------------------------------\n`;
    formData.highlights.forEach((highlight, idx) => {
      if (highlight.text) {
        content += `Highlight ${idx + 1}:\n`;
        content += `${highlight.text}\n`;
        if (highlight.imageUrl) {
          content += `[Image attached: ${highlight.imageUrl}]\n`;
        }
        content += `\n`;
      }
    });
    
    content += `4. OVERALL WEEKLY FEEDBACK, CHALLENGES & ACHIEVEMENTS\n`;
    content += `----------------------------------------\n`;
    content += `Achievements:\n`;
    if (formData.feedback.achievements.length > 0) {
      formData.feedback.achievements.forEach((achievement, idx) => {
        if (achievement.trim()) {
          content += `  • ${achievement}\n`;
        }
      });
    } else {
      content += `  [No achievements recorded]\n`;
    }
    content += `\nChallenges Faced:\n`;
    if (formData.feedback.challenges.length > 0) {
      formData.feedback.challenges.forEach((challenge, idx) => {
        if (challenge.trim()) {
          content += `  • ${challenge}\n`;
        }
      });
    } else {
      content += `  [No challenges recorded]\n`;
    }
    content += `\nLessons Learned:\n`;
    content += `${formData.feedback.lessonsLearned || '[No lessons learned recorded]'}\n\n`;
    content += `Client Feedback Received:\n`;
    if (formData.feedback.clientFeedback.length > 0) {
      formData.feedback.clientFeedback.forEach((feedback, idx) => {
        content += `  ${idx + 1}. ${feedback.clientName}: Rating ${feedback.rating}/5\n`;
        if (feedback.comment) {
          content += `     Comment: ${feedback.comment}\n`;
        }
      });
      content += `\nAverage Rating: ${avgRating}/5\n`;
    } else {
      content += `  [No client feedback recorded]\n`;
    }
    content += `\n`;
    
    content += `5. CLIENT ENGAGEMENT WEEKLY PORTFOLIO\n`;
    content += `----------------------------------------\n`;
    const filteredClients = getFilteredClients();
    if (filteredClients.length > 0) {
      content += `Client Name | Service Type | Status | Value ($) | Next Action\n`;
      content += `----------------------------------------------------------------\n`;
      filteredClients.slice(0, 20).forEach(client => {
        const services = typeof client.services_availed === 'string' 
          ? JSON.parse(client.services_availed) 
          : (client.services_availed || []);
        const serviceType = services.length > 0 ? services.join(', ') : 'N/A';
        const value = client.loan_amount || 0;
        content += `${client.company_name || client.name || 'N/A'} | ${serviceType} | ${client.status || 'N/A'} | $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | [Next Action]\n`;
      });
    } else {
      content += `[No clients found]\n`;
    }
    content += `\n`;
    
    content += `6. NEXT STEPS AND ACTION ITEMS\n`;
    content += `----------------------------------------\n`;
    if (formData.actionItems.length > 0) {
      content += `Action Item | Responsible Person | Deadline | Priority | Status | Comments\n`;
      content += `----------------------------------------------------------------------------\n`;
      formData.actionItems.forEach((item, idx) => {
        content += `${item.actionItem || 'N/A'} | ${item.responsiblePerson || 'N/A'} | ${item.deadline || 'N/A'} | ${item.priority || 'N/A'} | ${item.status || 'N/A'} | ${item.comments || 'N/A'}\n`;
      });
    } else {
      content += `[No action items recorded]\n`;
    }
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const reportContent = formatReportContent();
      const reportTitle = report?.title || `Client Engagement Report - Week Ending ${formData.header.weekEnding}`;

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

  const sections = [
    { id: 1, name: 'Report Header', icon: 'bi-file-text' },
    { id: 2, name: 'Activities Summary', icon: 'bi-activity' },
    { id: 3, name: 'Weekly Highlights', icon: 'bi-star' },
    { id: 4, name: 'Feedback & Achievements', icon: 'bi-chat-dots' },
    { id: 5, name: 'Client Portfolio', icon: 'bi-people' },
    { id: 6, name: 'Action Items', icon: 'bi-list-check' }
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 1:
        return (
          <div className="section-content">
            <h5 className="section-title">1. Report Header</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Date (Week Ending) *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.header.weekEnding}
                  onChange={(e) => {
                    const date = e.target.value;
                    handleChange('header', 'weekEnding', date);
                  }}
                  required
                />
                <small className="text-muted">Auto-set to week-ending Sunday</small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Period Covered</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.header.periodCovered}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa' }}
                />
                <small className="text-muted">Auto-calculated from week ending date</small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Prepared By *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.header.preparedBy}
                  onChange={(e) => handleChange('header', 'preparedBy', e.target.value)}
                  required
                />
                <small className="text-muted">Auto-filled from logged-in user</small>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Position *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.header.position}
                  onChange={(e) => handleChange('header', 'position', e.target.value)}
                  placeholder="e.g., Head of Client Engagement"
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Approved By *</label>
                <select
                  className="form-select"
                  value={formData.header.approvedBy}
                  onChange={(e) => handleChange('header', 'approvedBy', e.target.value)}
                  required
                >
                  <option value="">Select Approver</option>
                  <option value="CEO">CEO</option>
                  <option value="COO">COO</option>
                  <option value="CFO">CFO</option>
                  <option value="Managing Director">Managing Director</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Approved Signature</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.header.approvedSignature}
                  onChange={(e) => handleChange('header', 'approvedSignature', e.target.value)}
                  placeholder="Signature or initials"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        const activeClients = getActiveClients();
        const pendingLeads = getPendingLeads();
        const activeEngagements = getActiveEngagements();
        const newClients = getNewClientsThisWeek();
        
        return (
          <div className="section-content">
            <h5 className="section-title">2. Activities Summary</h5>
            <div className="row mb-3">
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="card-title">Total Active Clients</h6>
                    <h3 className="mb-0">{activeClients.length}</h3>
                    <small className="text-muted">Auto-counted from Client Management</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="card-title">Total Pending/New Leads</h6>
                    <h3 className="mb-0">{pendingLeads.length}</h3>
                    <small className="text-muted">Status = Lead / Proposal Sent</small>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="card-title">Active Engagements</h6>
                    <h3 className="mb-0">{activeEngagements.length}</h3>
                    <small className="text-muted">Projects In Progress</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">New Clients Signed This Week *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.activities.newClientsSigned}
                  onChange={(e) => handleChange('activities', 'newClientsSigned', e.target.value)}
                  min="0"
                  required
                />
                <small className="text-muted">Auto-counted: {newClients.length} new client(s) this week</small>
                {newClients.length > 0 && (
                  <div className="mt-2">
                    <small><strong>New Clients:</strong></small>
                    <ul className="small mb-0">
                      {newClients.map((client, idx) => (
                        <li key={idx}>{client.company_name || client.name || 'N/A'}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Client Meetings Conducted *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.activities.clientMeetingsConducted}
                  onChange={(e) => handleChange('activities', 'clientMeetingsConducted', e.target.value)}
                  min="0"
                  required
                />
                <small className="text-muted">Auto-pull from Calendar module</small>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Proposals Submitted *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.activities.proposalsSubmitted}
                  onChange={(e) => handleChange('activities', 'proposalsSubmitted', e.target.value)}
                  min="0"
                  required
                />
                <small className="text-muted">Linked to Proposals module</small>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="section-content">
            <h5 className="section-title">3. Weekly Highlights</h5>
            {formData.highlights.map((highlight, index) => (
              <div key={index} className="card mb-3">
                <div className="card-header">
                  <h6 className="mb-0">Highlight {index + 1} {index === 0 && <span className="badge bg-danger">Required</span>}</h6>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Description {index === 0 && '*'}</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      value={highlight.text}
                      onChange={(e) => handleHighlightChange(index, 'text', e.target.value)}
                      placeholder="e.g., Closed $250k audit deal with ABC Corp"
                      required={index === 0}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Image Upload</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          handleHighlightImageUpload(index, e.target.files[0]);
                        }
                      }}
                    />
                    {highlight.imageUrl && (
                      <div className="mt-2">
                        <img src={highlight.imageUrl} alt={`Highlight ${index + 1}`} style={{ maxWidth: '200px', maxHeight: '200px' }} className="img-thumbnail" />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() => handleHighlightChange(index, 'imageUrl', '')}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 4:
        const avgRating = calculateAverageRating();
        return (
          <div className="section-content">
            <h5 className="section-title">4. Overall Weekly Feedback, Challenges & Achievements</h5>
            <div className="row">
              <div className="col-12 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Achievements *</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addAchievement}
                  >
                    <i className="bi bi-plus"></i> Add Achievement
                  </button>
                </div>
                {formData.feedback.achievements.map((achievement, index) => (
                  <div key={index} className="input-group mb-2">
                    <span className="input-group-text">•</span>
                    <input
                      type="text"
                      className="form-control"
                      value={achievement}
                      onChange={(e) => updateAchievement(index, e.target.value)}
                      placeholder="Enter achievement"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => removeAchievement(index)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                ))}
                {formData.feedback.achievements.length === 0 && (
                  <p className="text-muted">No achievements added. Click "Add Achievement" to add one.</p>
                )}
              </div>
              <div className="col-12 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Challenges Faced *</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addChallenge}
                  >
                    <i className="bi bi-plus"></i> Add Challenge
                  </button>
                </div>
                {formData.feedback.challenges.map((challenge, index) => (
                  <div key={index} className="input-group mb-2">
                    <span className="input-group-text">•</span>
                    <input
                      type="text"
                      className="form-control"
                      value={challenge}
                      onChange={(e) => updateChallenge(index, e.target.value)}
                      placeholder="Enter challenge"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => removeChallenge(index)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                ))}
                {formData.feedback.challenges.length === 0 && (
                  <p className="text-muted">No challenges added. Click "Add Challenge" to add one.</p>
                )}
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">Lessons Learned</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={formData.feedback.lessonsLearned}
                  onChange={(e) => handleChange('feedback', 'lessonsLearned', e.target.value)}
                  placeholder="Enter lessons learned from this week..."
                />
              </div>
              <div className="col-12 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">Client Feedback Received *</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addClientFeedback}
                  >
                    <i className="bi bi-plus"></i> Add Feedback
                  </button>
                </div>
                {formData.feedback.clientFeedback.map((feedback, index) => (
                  <div key={index} className="card mb-2">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4 mb-2">
                          <label className="form-label">Client Name</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={feedback.clientName}
                            onChange={(e) => updateClientFeedback(index, 'clientName', e.target.value)}
                            placeholder="Client name"
                          />
                        </div>
                        <div className="col-md-2 mb-2">
                          <label className="form-label">Rating (1-5)</label>
                          <select
                            className="form-select form-select-sm"
                            value={feedback.rating}
                            onChange={(e) => updateClientFeedback(index, 'rating', parseInt(e.target.value))}
                          >
                            <option value="5">5 - Excellent</option>
                            <option value="4">4 - Very Good</option>
                            <option value="3">3 - Good</option>
                            <option value="2">2 - Fair</option>
                            <option value="1">1 - Poor</option>
                          </select>
                        </div>
                        <div className="col-md-5 mb-2">
                          <label className="form-label">Comment</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={feedback.comment}
                            onChange={(e) => updateClientFeedback(index, 'comment', e.target.value)}
                            placeholder="Client comment"
                          />
                        </div>
                        <div className="col-md-1 mb-2 d-flex align-items-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeClientFeedback(index)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {formData.feedback.clientFeedback.length > 0 && (
                  <div className="alert alert-info mt-2">
                    <strong>Average Rating: {avgRating}/5</strong>
                  </div>
                )}
                {formData.feedback.clientFeedback.length === 0 && (
                  <p className="text-muted">No client feedback added. Click "Add Feedback" to add one.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        const filteredClients = getFilteredClients();
        return (
          <div className="section-content">
            <h5 className="section-title">5. Client Engagement Weekly Portfolio</h5>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Filter by Service Type</label>
                <select
                  className="form-select"
                  value={formData.portfolio.filterServiceType}
                  onChange={(e) => handleChange('portfolio', 'filterServiceType', e.target.value)}
                >
                  <option value="all">All Services</option>
                  <option value="Consultancy">Consultancy</option>
                  <option value="Microfinance">Microfinance</option>
                  <option value="Academy">Academy</option>
                  <option value="Audit">Audit</option>
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div className="alert alert-info mb-0 w-100">
                  <small>Showing {filteredClients.length} client(s). Click any row to view full client profile.</small>
                </div>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover table-sm">
                <thead className="table-light">
                  <tr>
                    <th>Client Name</th>
                    <th>Service Type</th>
                    <th>Status</th>
                    <th>Value ($)</th>
                    <th>Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.slice(0, 50).map((client) => {
                    const services = typeof client.services_availed === 'string' 
                      ? JSON.parse(client.services_availed) 
                      : (client.services_availed || []);
                    const serviceType = services.length > 0 ? services.join(', ') : 'N/A';
                    const value = client.loan_amount || 0;
                    return (
                      <tr key={client.id} style={{ cursor: 'pointer' }} onClick={() => window.open(`/clients/view/${client.id}`, '_blank')}>
                        <td>{client.company_name || client.name || 'N/A'}</td>
                        <td>{serviceType}</td>
                        <td>
                          <span className={`badge bg-${client.status === 'Active' ? 'success' : client.status === 'Lead' ? 'warning' : 'secondary'}`}>
                            {client.status || 'N/A'}
                          </span>
                        </td>
                        <td>${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/clients/view/${client.id}`, '_blank');
                            }}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredClients.length === 0 && (
              <div className="alert alert-warning">
                No clients found with the selected filter.
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="section-content">
            <h5 className="section-title">6. Next Steps and Action Items</h5>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <label className="form-label mb-0">Action Items</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addActionItem}
              >
                <i className="bi bi-plus"></i> Add Action Item
              </button>
            </div>
            {formData.actionItems.map((item, index) => (
              <div key={index} className="card mb-2">
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Action Item</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={item.actionItem}
                        onChange={(e) => updateActionItem(index, 'actionItem', e.target.value)}
                        placeholder="e.g., Follow up with ABC Corp on proposal"
                      />
                    </div>
                    <div className="col-md-3 mb-2">
                      <label className="form-label">Responsible Person</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={item.responsiblePerson}
                        onChange={(e) => updateActionItem(index, 'responsiblePerson', e.target.value)}
                        placeholder="Name"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label">Deadline</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={item.deadline}
                        onChange={(e) => updateActionItem(index, 'deadline', e.target.value)}
                      />
                    </div>
                    <div className="col-md-1 mb-2">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select form-select-sm"
                        value={item.priority}
                        onChange={(e) => updateActionItem(index, 'priority', e.target.value)}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="col-md-1 mb-2">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select form-select-sm"
                        value={item.status}
                        onChange={(e) => updateActionItem(index, 'status', e.target.value)}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div className="col-md-1 mb-2 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeActionItem(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                    <div className="col-12 mb-2">
                      <label className="form-label">Comments</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        value={item.comments}
                        onChange={(e) => updateActionItem(index, 'comments', e.target.value)}
                        placeholder="Additional comments..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {formData.actionItems.length === 0 && (
              <p className="text-muted">No action items added. Click "Add Action Item" to add one.</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-info text-white">
            <h5 className="modal-title">
              <i className="bi bi-people me-2"></i>
              {report ? 'Edit Client Engagement Report' : 'Client Engagement Report Template'}
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

              {/* Section Navigation */}
              <div className="mb-4">
                <div className="d-flex flex-wrap gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`btn btn-sm ${activeSection === section.id ? 'btn-info' : 'btn-outline-info'}`}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <i className={`bi ${section.icon} me-1`}></i>
                      {section.id}. {section.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Content */}
              {renderSection()}
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
                className="btn btn-info"
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

export default ClientEngagementReportForm;

