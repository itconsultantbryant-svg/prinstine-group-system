import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const ICTMonthlyReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [activeSection, setActiveSection] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear(),
    executiveSummary: '',
    keyAchievements: [],
    kpis: {
      coreSystemsUptime: { target: 99.9, actual: '', remarks: '' },
      websiteResponseTime: { target: 2, actual: '', remarks: '' },
      ticketsResolvedSLA: { target: 95, actual: '', remarks: '' },
      avgResolutionTime: { target: 4, actual: '', remarks: '' },
      securityIncidents: { target: 0, actual: '', remarks: '' },
      systemsPatched: { target: 100, actual: '', remarks: '' },
      projectsOnTime: { target: 90, actual: '', remarks: '' },
      budgetVariance: { target: 5, actual: '', remarks: '' },
      helpdeskCSAT: { target: 4.5, actual: '', remarks: '' }
    },
    projectProgress: [],
    challenges: '',
    riskMitigation: [],
    staffPerformance: {
      absences: '',
      overtime: '',
      trainingHours: ''
    },
    nextMonthPlans: [],
    approvedBy: '',
    approvedSignature: ''
  });

  useEffect(() => {
    fetchDepartment();
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

  const loadReportData = () => {
    // Parse report content if editing
  };

  const handleChange = (section, field, value) => {
    if (section === 'kpis') {
      setFormData(prev => ({
        ...prev,
        kpis: {
          ...prev.kpis,
          [field]: {
            ...prev.kpis[field],
            ...value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    }
  };

  const addAchievement = () => {
    setFormData(prev => ({
      ...prev,
      keyAchievements: [...prev.keyAchievements, { text: '', image: null, imageUrl: '' }]
    }));
  };

  const removeAchievement = (index) => {
    setFormData(prev => ({
      ...prev,
      keyAchievements: prev.keyAchievements.filter((_, i) => i !== index)
    }));
  };

  const updateAchievement = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      keyAchievements: prev.keyAchievements.map((achievement, i) =>
        i === index ? { ...achievement, [field]: value } : achievement
      )
    }));
  };

  const handleAchievementImageUpload = async (index, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      updateAchievement(index, 'imageUrl', response.data.url);
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload image');
    }
  };

  const addProject = () => {
    setFormData(prev => ({
      ...prev,
      projectProgress: [...prev.projectProgress, { project: '', status: 'In Progress', percentComplete: 0, owner: '', eta: '' }]
    }));
  };

  const removeProject = (index) => {
    setFormData(prev => ({
      ...prev,
      projectProgress: prev.projectProgress.filter((_, i) => i !== index)
    }));
  };

  const updateProject = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      projectProgress: prev.projectProgress.map((project, i) =>
        i === index ? { ...project, [field]: value } : project
      )
    }));
  };

  const addRisk = () => {
    setFormData(prev => ({
      ...prev,
      riskMitigation: [...prev.riskMitigation, { risk: '', impact: '', mitigation: '', status: 'Open' }]
    }));
  };

  const removeRisk = (index) => {
    setFormData(prev => ({
      ...prev,
      riskMitigation: prev.riskMitigation.filter((_, i) => i !== index)
    }));
  };

  const updateRisk = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      riskMitigation: prev.riskMitigation.map((risk, i) =>
        i === index ? { ...risk, [field]: value } : risk
      )
    }));
  };

  const addNextMonthPlan = () => {
    setFormData(prev => ({
      ...prev,
      nextMonthPlans: [...prev.nextMonthPlans, '']
    }));
  };

  const removeNextMonthPlan = (index) => {
    setFormData(prev => ({
      ...prev,
      nextMonthPlans: prev.nextMonthPlans.filter((_, i) => i !== index)
    }));
  };

  const updateNextMonthPlan = (index, value) => {
    setFormData(prev => ({
      ...prev,
      nextMonthPlans: prev.nextMonthPlans.map((plan, i) =>
        i === index ? value : plan
      )
    }));
  };

  const calculateKPIPerformance = (actual, target) => {
    if (!actual || actual === '') return 0;
    return ((parseFloat(actual) / parseFloat(target)) * 100).toFixed(1);
  };

  const getKPIRating = (actual, target, isLowerBetter = false) => {
    if (!actual || actual === '') return 'N/A';
    const actualNum = parseFloat(actual);
    const targetNum = parseFloat(target);
    
    if (isLowerBetter) {
      if (actualNum <= targetNum) return 'Green';
      if (actualNum <= targetNum * 1.1) return 'Amber';
      return 'Red';
    } else {
      if (actualNum >= targetNum) return 'Green';
      if (actualNum >= targetNum * 0.9) return 'Amber';
      return 'Red';
    }
  };

  const formatReportContent = () => {
    let content = `ICT DEPARTMENT MONTHLY REPORT\n`;
    content += `========================================\n\n`;
    
    content += `Month: ${formData.month} ${formData.year}\n`;
    content += `Prepared By: ${user?.name || 'N/A'}\n\n`;
    
    content += `1. EXECUTIVE SUMMARY\n`;
    content += `----------------------------------------\n`;
    content += `${formData.executiveSummary || '[No executive summary provided]'}\n\n`;
    
    content += `2. KEY ACHIEVEMENTS (Top 5)\n`;
    content += `----------------------------------------\n`;
    if (formData.keyAchievements.length > 0) {
      formData.keyAchievements.forEach((achievement, idx) => {
        if (achievement.text) {
          content += `  ${idx + 1}. ${achievement.text}\n`;
          if (achievement.imageUrl) {
            content += `     [Image: ${achievement.imageUrl}]\n`;
          }
        }
      });
    } else {
      content += `  [No key achievements recorded]\n`;
    }
    content += `\n`;
    
    content += `3. KPIs & PERFORMANCE INDICATORS\n`;
    content += `----------------------------------------\n`;
    content += `KPI Category | KPI Name | Target | Actual | Performance % | Rating | Remarks\n`;
    content += `----------------------------------------------------------------------------\n`;
    
    const kpiList = [
      { key: 'coreSystemsUptime', name: 'Core Systems Uptime', target: formData.kpis.coreSystemsUptime.target, actual: formData.kpis.coreSystemsUptime.actual, isLowerBetter: false },
      { key: 'websiteResponseTime', name: 'Website Response Time', target: formData.kpis.websiteResponseTime.target, actual: formData.kpis.websiteResponseTime.actual, isLowerBetter: true },
      { key: 'ticketsResolvedSLA', name: 'Tickets Resolved within SLA', target: formData.kpis.ticketsResolvedSLA.target, actual: formData.kpis.ticketsResolvedSLA.actual, isLowerBetter: false },
      { key: 'avgResolutionTime', name: 'Average Resolution Time', target: formData.kpis.avgResolutionTime.target, actual: formData.kpis.avgResolutionTime.actual, isLowerBetter: true },
      { key: 'securityIncidents', name: 'Security Incidents', target: formData.kpis.securityIncidents.target, actual: formData.kpis.securityIncidents.actual, isLowerBetter: true },
      { key: 'systemsPatched', name: 'Systems Patched', target: formData.kpis.systemsPatched.target, actual: formData.kpis.systemsPatched.actual, isLowerBetter: false },
      { key: 'projectsOnTime', name: 'Projects Delivered On Time', target: formData.kpis.projectsOnTime.target, actual: formData.kpis.projectsOnTime.actual, isLowerBetter: false },
      { key: 'budgetVariance', name: 'ICT Budget Variance', target: formData.kpis.budgetVariance.target, actual: formData.kpis.budgetVariance.actual, isLowerBetter: false },
      { key: 'helpdeskCSAT', name: 'Helpdesk CSAT Score', target: formData.kpis.helpdeskCSAT.target, actual: formData.kpis.helpdeskCSAT.actual, isLowerBetter: false }
    ];
    
    kpiList.forEach(kpi => {
      const data = formData.kpis[kpi.key];
      const performance = calculateKPIPerformance(data.actual, kpi.target);
      const rating = getKPIRating(data.actual, kpi.target, kpi.isLowerBetter);
      content += `Availability | ${kpi.name} | ${kpi.target}% | ${data.actual || 'N/A'} | ${performance}% | ${rating} | ${data.remarks || 'N/A'}\n`;
    });
    content += `\n`;
    
    content += `4. PROJECT & TASK PROGRESS\n`;
    content += `----------------------------------------\n`;
    if (formData.projectProgress.length > 0) {
      content += `Project | Status | % Complete | Owner | ETA\n`;
      content += `------------------------------------------------\n`;
      formData.projectProgress.forEach((project, idx) => {
        content += `${project.project || 'N/A'} | ${project.status || 'N/A'} | ${project.percentComplete || 0}% | ${project.owner || 'N/A'} | ${project.eta || 'N/A'}\n`;
      });
    } else {
      content += `  [No projects recorded]\n`;
    }
    content += `\n`;
    
    content += `5. DEPARTMENTAL CHALLENGES\n`;
    content += `----------------------------------------\n`;
    content += `${formData.challenges || '[No challenges recorded]'}\n\n`;
    
    content += `6. RISK & MITIGATION ACTIONS\n`;
    content += `----------------------------------------\n`;
    if (formData.riskMitigation.length > 0) {
      content += `Risk | Impact | Mitigation | Status\n`;
      content += `----------------------------------------\n`;
      formData.riskMitigation.forEach((risk, idx) => {
        content += `${risk.risk || 'N/A'} | ${risk.impact || 'N/A'} | ${risk.mitigation || 'N/A'} | ${risk.status || 'N/A'}\n`;
      });
    } else {
      content += `  [No risks recorded]\n`;
    }
    content += `\n`;
    
    content += `7. STAFF PERFORMANCE & ATTENDANCE\n`;
    content += `----------------------------------------\n`;
    content += `Absences: ${formData.staffPerformance.absences || 'N/A'}\n`;
    content += `Overtime: ${formData.staffPerformance.overtime || 'N/A'}\n`;
    content += `Training Hours: ${formData.staffPerformance.trainingHours || 'N/A'}\n\n`;
    
    content += `8. PLANS FOR NEXT MONTH\n`;
    content += `----------------------------------------\n`;
    if (formData.nextMonthPlans.length > 0) {
      formData.nextMonthPlans.forEach((plan, idx) => {
        if (plan.trim()) {
          content += `  • ${plan}\n`;
        }
      });
    } else {
      content += `  [No plans recorded]\n`;
    }
    content += `\n`;
    
    content += `9. APPROVAL\n`;
    content += `----------------------------------------\n`;
    content += `Approved By: ${formData.approvedBy || 'Pending'}\n`;
    if (formData.approvedSignature) {
      content += `Approved Signature: ${formData.approvedSignature}\n`;
    }
    
    return content;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const reportContent = formatReportContent();
      const reportTitle = report?.title || `ICT Monthly Report - ${formData.month} ${formData.year}`;

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
    { id: 1, name: 'Executive Summary', icon: 'bi-file-text' },
    { id: 2, name: 'Key Achievements', icon: 'bi-trophy' },
    { id: 3, name: 'KPIs & Performance', icon: 'bi-graph-up' },
    { id: 4, name: 'Project Progress', icon: 'bi-list-task' },
    { id: 5, name: 'Challenges', icon: 'bi-exclamation-triangle' },
    { id: 6, name: 'Risk Mitigation', icon: 'bi-shield-check' },
    { id: 7, name: 'Staff Performance', icon: 'bi-people' },
    { id: 8, name: 'Next Month Plans', icon: 'bi-calendar' },
    { id: 9, name: 'Approval', icon: 'bi-check-circle' }
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 1:
        return (
          <div className="section-content">
            <h5 className="section-title">1. Executive Summary</h5>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Month *</label>
                <select
                  className="form-select"
                  value={formData.month}
                  onChange={(e) => handleChange('', 'month', e.target.value)}
                  required
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Year *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.year}
                  onChange={(e) => handleChange('', 'year', parseInt(e.target.value))}
                  min="2020"
                  max="2100"
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Executive Summary *</label>
              <textarea
                className="form-control"
                rows="8"
                value={formData.executiveSummary}
                onChange={(e) => handleChange('', 'executiveSummary', e.target.value)}
                placeholder="Auto-generated from weekly summaries or manual override..."
                required
              />
              <small className="text-muted">AI-summarized (or manual override)</small>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="section-content">
            <h5 className="section-title">2. Key Achievements (Top 5)</h5>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <label className="form-label mb-0">Achievements</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addAchievement}
              >
                <i className="bi bi-plus"></i> Add Achievement
              </button>
            </div>
            {formData.keyAchievements.map((achievement, index) => (
              <div key={index} className="card mb-3">
                <div className="card-header">
                  <h6 className="mb-0">Achievement {index + 1}</h6>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={achievement.text}
                      onChange={(e) => updateAchievement(index, 'text', e.target.value)}
                      placeholder="Describe the achievement..."
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
                          handleAchievementImageUpload(index, e.target.files[0]);
                        }
                      }}
                    />
                    {achievement.imageUrl && (
                      <div className="mt-2">
                        <img src={achievement.imageUrl} alt={`Achievement ${index + 1}`} style={{ maxWidth: '200px', maxHeight: '200px' }} className="img-thumbnail" />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() => updateAchievement(index, 'imageUrl', '')}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeAchievement(index)}
                  >
                    <i className="bi bi-trash"></i> Remove
                  </button>
                </div>
              </div>
            ))}
            {formData.keyAchievements.length === 0 && (
              <p className="text-muted">No achievements added. Click "Add Achievement" to add one.</p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="section-content">
            <h5 className="section-title">3. KPIs & Performance Indicators</h5>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead className="table-light">
                  <tr>
                    <th>KPI Category</th>
                    <th>KPI Name</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Performance %</th>
                    <th>Rating (RAG)</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td rowSpan="2">Availability</td>
                    <td>Core Systems Uptime</td>
                    <td>{formData.kpis.coreSystemsUptime.target}%</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.coreSystemsUptime.actual}
                        onChange={(e) => handleChange('kpis', 'coreSystemsUptime', { actual: e.target.value })}
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.coreSystemsUptime.actual, formData.kpis.coreSystemsUptime.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.coreSystemsUptime.actual, formData.kpis.coreSystemsUptime.target) === 'Green' ? 'success' : getKPIRating(formData.kpis.coreSystemsUptime.actual, formData.kpis.coreSystemsUptime.target) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.coreSystemsUptime.actual, formData.kpis.coreSystemsUptime.target)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.coreSystemsUptime.remarks}
                        onChange={(e) => handleChange('kpis', 'coreSystemsUptime', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Website Response Time</td>
                    <td>&lt; {formData.kpis.websiteResponseTime.target}s</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.websiteResponseTime.actual}
                        onChange={(e) => handleChange('kpis', 'websiteResponseTime', { actual: e.target.value })}
                        step="0.1"
                        min="0"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.websiteResponseTime.actual, formData.kpis.websiteResponseTime.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.websiteResponseTime.actual, formData.kpis.websiteResponseTime.target, true) === 'Green' ? 'success' : getKPIRating(formData.kpis.websiteResponseTime.actual, formData.kpis.websiteResponseTime.target, true) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.websiteResponseTime.actual, formData.kpis.websiteResponseTime.target, true)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.websiteResponseTime.remarks}
                        onChange={(e) => handleChange('kpis', 'websiteResponseTime', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td rowSpan="2">Support</td>
                    <td>Tickets Resolved within SLA</td>
                    <td>{formData.kpis.ticketsResolvedSLA.target}%</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.ticketsResolvedSLA.actual}
                        onChange={(e) => handleChange('kpis', 'ticketsResolvedSLA', { actual: e.target.value })}
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.ticketsResolvedSLA.actual, formData.kpis.ticketsResolvedSLA.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.ticketsResolvedSLA.actual, formData.kpis.ticketsResolvedSLA.target) === 'Green' ? 'success' : getKPIRating(formData.kpis.ticketsResolvedSLA.actual, formData.kpis.ticketsResolvedSLA.target) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.ticketsResolvedSLA.actual, formData.kpis.ticketsResolvedSLA.target)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.ticketsResolvedSLA.remarks}
                        onChange={(e) => handleChange('kpis', 'ticketsResolvedSLA', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Average Resolution Time</td>
                    <td>&lt; {formData.kpis.avgResolutionTime.target} hrs</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.avgResolutionTime.actual}
                        onChange={(e) => handleChange('kpis', 'avgResolutionTime', { actual: e.target.value })}
                        step="0.1"
                        min="0"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.avgResolutionTime.actual, formData.kpis.avgResolutionTime.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.avgResolutionTime.actual, formData.kpis.avgResolutionTime.target, true) === 'Green' ? 'success' : getKPIRating(formData.kpis.avgResolutionTime.actual, formData.kpis.avgResolutionTime.target, true) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.avgResolutionTime.actual, formData.kpis.avgResolutionTime.target, true)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.avgResolutionTime.remarks}
                        onChange={(e) => handleChange('kpis', 'avgResolutionTime', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td rowSpan="2">Security</td>
                    <td>Security Incidents</td>
                    <td>{formData.kpis.securityIncidents.target}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.securityIncidents.actual}
                        onChange={(e) => handleChange('kpis', 'securityIncidents', { actual: e.target.value })}
                        min="0"
                      />
                    </td>
                    <td>-</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.securityIncidents.actual, formData.kpis.securityIncidents.target, true) === 'Green' ? 'success' : getKPIRating(formData.kpis.securityIncidents.actual, formData.kpis.securityIncidents.target, true) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.securityIncidents.actual, formData.kpis.securityIncidents.target, true)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.securityIncidents.remarks}
                        onChange={(e) => handleChange('kpis', 'securityIncidents', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Systems Patched</td>
                    <td>{formData.kpis.systemsPatched.target}%</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.systemsPatched.actual}
                        onChange={(e) => handleChange('kpis', 'systemsPatched', { actual: e.target.value })}
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.systemsPatched.actual, formData.kpis.systemsPatched.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.systemsPatched.actual, formData.kpis.systemsPatched.target) === 'Green' ? 'success' : getKPIRating(formData.kpis.systemsPatched.actual, formData.kpis.systemsPatched.target) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.systemsPatched.actual, formData.kpis.systemsPatched.target)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.systemsPatched.remarks}
                        onChange={(e) => handleChange('kpis', 'systemsPatched', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Projects</td>
                    <td>Projects Delivered On Time</td>
                    <td>{formData.kpis.projectsOnTime.target}%</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.projectsOnTime.actual}
                        onChange={(e) => handleChange('kpis', 'projectsOnTime', { actual: e.target.value })}
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.projectsOnTime.actual, formData.kpis.projectsOnTime.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.projectsOnTime.actual, formData.kpis.projectsOnTime.target) === 'Green' ? 'success' : getKPIRating(formData.kpis.projectsOnTime.actual, formData.kpis.projectsOnTime.target) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.projectsOnTime.actual, formData.kpis.projectsOnTime.target)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.projectsOnTime.remarks}
                        onChange={(e) => handleChange('kpis', 'projectsOnTime', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Cost</td>
                    <td>ICT Budget Variance</td>
                    <td>±{formData.kpis.budgetVariance.target}%</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.budgetVariance.actual}
                        onChange={(e) => handleChange('kpis', 'budgetVariance', { actual: e.target.value })}
                        step="0.01"
                      />
                    </td>
                    <td>-</td>
                    <td>
                      <span className={`badge bg-${Math.abs(parseFloat(formData.kpis.budgetVariance.actual || 0)) <= formData.kpis.budgetVariance.target ? 'success' : 'warning'}`}>
                        {Math.abs(parseFloat(formData.kpis.budgetVariance.actual || 0)) <= formData.kpis.budgetVariance.target ? 'Green' : 'Amber'}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.budgetVariance.remarks}
                        onChange={(e) => handleChange('kpis', 'budgetVariance', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>User Satisfaction</td>
                    <td>Helpdesk CSAT Score</td>
                    <td>&gt; {formData.kpis.helpdeskCSAT.target}/5</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.kpis.helpdeskCSAT.actual}
                        onChange={(e) => handleChange('kpis', 'helpdeskCSAT', { actual: e.target.value })}
                        step="0.1"
                        min="0"
                        max="5"
                      />
                    </td>
                    <td>{calculateKPIPerformance(formData.kpis.helpdeskCSAT.actual, formData.kpis.helpdeskCSAT.target)}%</td>
                    <td>
                      <span className={`badge bg-${getKPIRating(formData.kpis.helpdeskCSAT.actual, formData.kpis.helpdeskCSAT.target) === 'Green' ? 'success' : getKPIRating(formData.kpis.helpdeskCSAT.actual, formData.kpis.helpdeskCSAT.target) === 'Amber' ? 'warning' : 'danger'}`}>
                        {getKPIRating(formData.kpis.helpdeskCSAT.actual, formData.kpis.helpdeskCSAT.target)}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.kpis.helpdeskCSAT.remarks}
                        onChange={(e) => handleChange('kpis', 'helpdeskCSAT', { remarks: e.target.value })}
                        placeholder="Remarks"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="section-content">
            <h5 className="section-title">4. Project & Task Progress</h5>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <label className="form-label mb-0">Projects</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addProject}
              >
                <i className="bi bi-plus"></i> Add Project
              </button>
            </div>
            {formData.projectProgress.map((project, index) => (
              <div key={index} className="card mb-2">
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3 mb-2">
                      <label className="form-label small">Project Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={project.project}
                        onChange={(e) => updateProject(index, 'project', e.target.value)}
                        placeholder="Project name"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">Status</label>
                      <select
                        className="form-select form-select-sm"
                        value={project.status}
                        onChange={(e) => updateProject(index, 'status', e.target.value)}
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">% Complete</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={project.percentComplete}
                        onChange={(e) => updateProject(index, 'percentComplete', parseInt(e.target.value))}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">Owner</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={project.owner}
                        onChange={(e) => updateProject(index, 'owner', e.target.value)}
                        placeholder="Owner"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">ETA</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={project.eta}
                        onChange={(e) => updateProject(index, 'eta', e.target.value)}
                      />
                    </div>
                    <div className="col-md-1 mb-2 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeProject(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {formData.projectProgress.length === 0 && (
              <p className="text-muted">No projects added. Click "Add Project" to add one.</p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="section-content">
            <h5 className="section-title">5. Departmental Challenges</h5>
            <div className="mb-3">
              <label className="form-label">Challenges</label>
              <textarea
                className="form-control"
                rows="6"
                value={formData.challenges}
                onChange={(e) => handleChange('', 'challenges', e.target.value)}
                placeholder="Describe departmental challenges..."
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="section-content">
            <h5 className="section-title">6. Risk & Mitigation Actions</h5>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <label className="form-label mb-0">Risks</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addRisk}
              >
                <i className="bi bi-plus"></i> Add Risk
              </button>
            </div>
            {formData.riskMitigation.map((risk, index) => (
              <div key={index} className="card mb-2">
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-3 mb-2">
                      <label className="form-label small">Risk</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={risk.risk}
                        onChange={(e) => updateRisk(index, 'risk', e.target.value)}
                        placeholder="Risk description"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">Impact</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={risk.impact}
                        onChange={(e) => updateRisk(index, 'impact', e.target.value)}
                        placeholder="Impact"
                      />
                    </div>
                    <div className="col-md-3 mb-2">
                      <label className="form-label small">Mitigation</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={risk.mitigation}
                        onChange={(e) => updateRisk(index, 'mitigation', e.target.value)}
                        placeholder="Mitigation action"
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label small">Status</label>
                      <select
                        className="form-select form-select-sm"
                        value={risk.status}
                        onChange={(e) => updateRisk(index, 'status', e.target.value)}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <div className="col-md-2 mb-2 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeRisk(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {formData.riskMitigation.length === 0 && (
              <p className="text-muted">No risks added. Click "Add Risk" to add one.</p>
            )}
          </div>
        );

      case 7:
        return (
          <div className="section-content">
            <h5 className="section-title">7. Staff Performance & Attendance</h5>
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Absences</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.staffPerformance.absences}
                  onChange={(e) => handleChange('staffPerformance', 'absences', e.target.value)}
                  placeholder="e.g., 2 days"
                />
                <small className="text-muted">From HR module</small>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Overtime</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.staffPerformance.overtime}
                  onChange={(e) => handleChange('staffPerformance', 'overtime', e.target.value)}
                  placeholder="e.g., 15 hours"
                />
                <small className="text-muted">From HR module</small>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Training Hours</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.staffPerformance.trainingHours}
                  onChange={(e) => handleChange('staffPerformance', 'trainingHours', e.target.value)}
                  placeholder="e.g., 8 hours"
                />
                <small className="text-muted">From HR module</small>
              </div>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="section-content">
            <h5 className="section-title">8. Plans for Next Month</h5>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <label className="form-label mb-0">Plans</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={addNextMonthPlan}
              >
                <i className="bi bi-plus"></i> Add Plan
              </button>
            </div>
            {formData.nextMonthPlans.map((plan, index) => (
              <div key={index} className="input-group mb-2">
                <span className="input-group-text">•</span>
                <input
                  type="text"
                  className="form-control"
                  value={plan}
                  onChange={(e) => updateNextMonthPlan(index, e.target.value)}
                  placeholder="Enter plan for next month"
                />
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => removeNextMonthPlan(index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            ))}
            {formData.nextMonthPlans.length === 0 && (
              <p className="text-muted">No plans added. Click "Add Plan" to add one.</p>
            )}
          </div>
        );

      case 9:
        return (
          <div className="section-content">
            <h5 className="section-title">9. Approval</h5>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Approved By (CEO) *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.approvedBy}
                  onChange={(e) => handleChange('', 'approvedBy', e.target.value)}
                  placeholder="CEO name"
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Approved Signature</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.approvedSignature}
                  onChange={(e) => handleChange('', 'approvedSignature', e.target.value)}
                  placeholder="Signature or initials"
                />
                <small className="text-muted">One-click approve with digital signature</small>
              </div>
            </div>
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
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-laptop me-2"></i>
              {report ? 'Edit ICT Monthly Report' : 'ICT Monthly Department Report'}
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
                      className={`btn btn-sm ${activeSection === section.id ? 'btn-primary' : 'btn-outline-primary'}`}
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

export default ICTMonthlyReportForm;

