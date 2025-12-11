import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const InternalAuditReportForm = ({ report, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState(null);
  const [activeSection, setActiveSection] = useState(1);
  
  // Form state for all 12 sections
  const [formData, setFormData] = useState({
    // Section 1: Introduction Sheet (Overview)
    introduction: {
      auditPeriod: '',
      auditDate: new Date().toISOString().split('T')[0],
      auditorName: '',
      departmentName: ''
    },
    
    // Section 2: Working Papers Cover Sheet
    workingPapers: [
      { ref: 1, description: 'Completion checklist', workpaperRef: 'WOP 1', status: 'Pending' },
      { ref: 2, description: 'Lead schedule (including sign-off)', workpaperRef: 'WOP 2', status: 'Pending' },
      { ref: 3, description: 'Working papers supporting lead schedule', workpaperRef: 'WOP 3', status: 'Pending' },
      { ref: 4, description: 'Financial statements note disclosure', workpaperRef: 'WOP 4', status: 'Pending' },
      { ref: 5, description: 'Audit findings and remedial actions', workpaperRef: 'WOP 5', status: 'Pending' },
      { ref: 6, description: 'Compliance and legal issues', workpaperRef: 'WOP 6', status: 'Pending' },
      { ref: 7, description: 'Quality control and assurance', workpaperRef: 'WOP 7', status: 'Pending' },
      { ref: 8, description: 'Other work performed', workpaperRef: 'WOP 8', status: 'Pending' },
      { ref: 9, description: 'Matters for next financial year', workpaperRef: 'WOP 9', status: 'Pending' },
      { ref: 10, description: 'Background information', workpaperRef: 'WOP 10', status: 'Pending' }
    ],
    
    // Section 3: Background Information
    backgroundInfo: {
      companyProfile: '',
      ownershipStructure: '',
      natureOfOperation: '',
      industryOverview: '',
      organizationalStructure: '',
      accountingSystemUsed: '',
      significantEvents: '',
      orgChartFile: null
    },
    
    // Section 4: Lead Schedule
    leadSchedule: {
      accounts: [],
      analyticalReview: '',
      preparedBy: '',
      reviewedBy: '',
      managementSignOff: '',
      completedChecklist: false
    },
    
    // Section 5: Balance Sheet
    balanceSheet: {
      assets: {
        currentAssets: [],
        fixedAssets: [],
        otherAssets: []
      },
      liabilities: {
        currentLiabilities: [],
        longTermLiabilities: []
      },
      equity: []
    },
    
    // Section 6: Income Statement
    incomeStatement: {
      revenue: [],
      expenses: {
        generalAdmin: [],
        operational: []
      }
    },
    
    // Section 7: Cash Flow Statement
    cashFlow: {
      operating: [],
      investing: [],
      financing: []
    },
    
    // Section 8: Equity Statement
    equityStatement: {
      previousYear: {
        openingBalance: { capital: '', retainedEarnings: '' },
        changes: [],
        closingBalance: { capital: '', retainedEarnings: '' }
      },
      currentYear: {
        openingBalance: { capital: '', retainedEarnings: '' },
        changes: [],
        closingBalance: { capital: '', retainedEarnings: '' }
      }
    },
    
    // Section 9: Notes to Financial Statements
    financialNotes: {
      generalInfo: '',
      accountingPolicies: '',
      balanceSheetNotes: '',
      incomeStatementNotes: '',
      cashFlowNotes: '',
      otherDisclosures: ''
    },
    
    // Section 10: Audit Findings
    auditFindings: {
      auditInfo: {
        title: '',
        department: '',
        period: '',
        date: new Date().toISOString().split('T')[0],
        auditors: ''
      },
      summary: {
        totalFindings: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        resolved: 0,
        outstanding: 0
      },
      findings: []
    },
    
    // Section 11: Compliance and Legal Issues
    complianceIssues: [],
    
    // Section 12: Completion Checklist
    completionChecklist: {
      planning: [],
      preparation: [],
      review: []
    },
    
    // Additional Sheets - Dynamic selection of any template section
    additionalSheets: []
  });

  useEffect(() => {
    fetchDepartment();
    initializeCompletionChecklist();
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
      if (dept) {
        setFormData(prev => ({
          ...prev,
          introduction: {
            ...prev.introduction,
            departmentName: dept.name,
            auditorName: user.name || ''
          },
          auditFindings: {
            ...prev.auditFindings,
            auditInfo: {
              ...prev.auditFindings.auditInfo,
              department: dept.name
            }
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching department:', error);
    }
  };

  const initializeCompletionChecklist = () => {
    setFormData(prev => ({
      ...prev,
      completionChecklist: {
        planning: [
          { item: 'Risk management and planning decisions revised as necessary.', checked: false, comments: '' },
          { item: 'Ensure data from Business Areas received by due date; follow up if needed.', checked: false, comments: '' },
          { item: 'Review Treasury requirements; obtain additional info by due date.', checked: false, comments: '' }
        ],
        preparation: [
          { item: 'Agree lead schedule to financial statements.', checked: false, comments: '' },
          { item: 'Agree lead schedule to trial balance.', checked: false, comments: '' },
          { item: 'Ensure comparative amounts match last year\'s report.', checked: false, comments: '' },
          { item: 'Complete analytical review (±5% prior, ±2% budget; trend).', checked: false, comments: '' },
          { item: 'Verify to supporting docs; comply with regs.', checked: false, comments: '' }
        ],
        review: [
          { item: 'All material matters disclosed; figures complete/accurate?', checked: false, comments: '' },
          { item: 'All adjustments resolved; update schedule.', checked: false, comments: '' },
          { item: 'Format consistent with standards; include narratives.', checked: false, comments: '' },
          { item: 'Lead schedule signed off.', checked: false, comments: '' }
        ]
      }
    }));
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNestedChange = (section, subsection, field, value) => {
    setFormData(prev => {
      // Handle deeply nested paths like 'previousYear.openingBalance'
      if (subsection.includes('.')) {
        const parts = subsection.split('.');
        const nested = { ...prev[section] };
        let current = nested;
        
        // Navigate to the nested object
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = { ...current[parts[i]] };
          current = current[parts[i]];
        }
        
        // Set the final field
        current[parts[parts.length - 1]] = {
          ...current[parts[parts.length - 1]],
          [field]: value
        };
        
        return { ...prev, [section]: nested };
      } else if (subsection) {
        // Handle single level nesting
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [subsection]: {
              ...prev[section][subsection],
              [field]: value
            }
          }
        };
      } else {
        // Handle direct field change
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value
          }
        };
      }
    });
  };

  const addAccountToLeadSchedule = () => {
    setFormData(prev => ({
      ...prev,
      leadSchedule: {
        ...prev.leadSchedule,
        accounts: [
          ...prev.leadSchedule.accounts,
          {
            accountCode: '',
            accountName: '',
            source: '',
            actualCurrentYr: '',
            actualLastYr: '',
            budgetCurrentYr: '',
            budgetLastYr: ''
          }
        ]
      }
    }));
  };

  const updateLeadScheduleAccount = (index, field, value) => {
    setFormData(prev => {
      const accounts = [...prev.leadSchedule.accounts];
      accounts[index] = { ...accounts[index], [field]: value };
      return {
        ...prev,
        leadSchedule: { ...prev.leadSchedule, accounts }
      };
    });
  };

  const removeLeadScheduleAccount = (index) => {
    setFormData(prev => ({
      ...prev,
      leadSchedule: {
        ...prev.leadSchedule,
        accounts: prev.leadSchedule.accounts.filter((_, i) => i !== index)
      }
    }));
  };

  // Balance Sheet helpers
  const addBalanceSheetItem = (category, subCategory) => {
    setFormData(prev => {
      const newItem = { subItem: '', currentYear: '', previousYear: '' };
      if (category === 'assets') {
        const assets = { ...prev.balanceSheet.assets };
        assets[subCategory] = [...assets[subCategory], newItem];
        return { ...prev, balanceSheet: { ...prev.balanceSheet, assets } };
      } else if (category === 'liabilities') {
        const liabilities = { ...prev.balanceSheet.liabilities };
        liabilities[subCategory] = [...liabilities[subCategory], newItem];
        return { ...prev, balanceSheet: { ...prev.balanceSheet, liabilities } };
      } else if (category === 'equity') {
        const equity = [...prev.balanceSheet.equity, newItem];
        return { ...prev, balanceSheet: { ...prev.balanceSheet, equity } };
      }
      return prev;
    });
  };

  const updateBalanceSheetItem = (category, subCategory, index, field, value) => {
    setFormData(prev => {
      if (category === 'assets') {
        const assets = { ...prev.balanceSheet.assets };
        const items = [...assets[subCategory]];
        items[index] = { ...items[index], [field]: value };
        assets[subCategory] = items;
        return { ...prev, balanceSheet: { ...prev.balanceSheet, assets } };
      } else if (category === 'liabilities') {
        const liabilities = { ...prev.balanceSheet.liabilities };
        const items = [...liabilities[subCategory]];
        items[index] = { ...items[index], [field]: value };
        liabilities[subCategory] = items;
        return { ...prev, balanceSheet: { ...prev.balanceSheet, liabilities } };
      } else {
        const equity = [...prev.balanceSheet.equity];
        equity[index] = { ...equity[index], [field]: value };
        return { ...prev, balanceSheet: { ...prev.balanceSheet, equity } };
      }
    });
  };

  const removeBalanceSheetItem = (category, subCategory, index) => {
    setFormData(prev => {
      if (category === 'assets') {
        const assets = { ...prev.balanceSheet.assets };
        assets[subCategory] = assets[subCategory].filter((_, i) => i !== index);
        return { ...prev, balanceSheet: { ...prev.balanceSheet, assets } };
      } else if (category === 'liabilities') {
        const liabilities = { ...prev.balanceSheet.liabilities };
        liabilities[subCategory] = liabilities[subCategory].filter((_, i) => i !== index);
        return { ...prev, balanceSheet: { ...prev.balanceSheet, liabilities } };
      } else {
        const equity = prev.balanceSheet.equity.filter((_, i) => i !== index);
        return { ...prev, balanceSheet: { ...prev.balanceSheet, equity } };
      }
    });
  };

  // Income Statement helpers
  const addIncomeStatementItem = (category, subCategory) => {
    setFormData(prev => {
      const newItem = { subItem: '', currentYear: '', previousYear: '' };
      if (category === 'revenue') {
        const revenue = [...prev.incomeStatement.revenue, newItem];
        return { ...prev, incomeStatement: { ...prev.incomeStatement, revenue } };
      } else {
        const expenses = { ...prev.incomeStatement.expenses };
        expenses[subCategory] = [...expenses[subCategory], newItem];
        return { ...prev, incomeStatement: { ...prev.incomeStatement, expenses } };
      }
    });
  };

  const updateIncomeStatementItem = (category, subCategory, index, field, value) => {
    setFormData(prev => {
      if (category === 'revenue') {
        const revenue = [...prev.incomeStatement.revenue];
        revenue[index] = { ...revenue[index], [field]: value };
        return { ...prev, incomeStatement: { ...prev.incomeStatement, revenue } };
      } else {
        const expenses = { ...prev.incomeStatement.expenses };
        const items = [...expenses[subCategory]];
        items[index] = { ...items[index], [field]: value };
        expenses[subCategory] = items;
        return { ...prev, incomeStatement: { ...prev.incomeStatement, expenses } };
      }
    });
  };

  const removeIncomeStatementItem = (category, subCategory, index) => {
    setFormData(prev => {
      if (category === 'revenue') {
        const revenue = prev.incomeStatement.revenue.filter((_, i) => i !== index);
        return { ...prev, incomeStatement: { ...prev.incomeStatement, revenue } };
      } else {
        const expenses = { ...prev.incomeStatement.expenses };
        expenses[subCategory] = expenses[subCategory].filter((_, i) => i !== index);
        return { ...prev, incomeStatement: { ...prev.incomeStatement, expenses } };
      }
    });
  };

  // Cash Flow helpers
  const addCashFlowItem = (activityType) => {
    setFormData(prev => {
      const newItem = { subItem: '', currentYear: '', previousYear: '' };
      const cashFlow = { ...prev.cashFlow };
      cashFlow[activityType] = [...cashFlow[activityType], newItem];
      return { ...prev, cashFlow };
    });
  };

  const updateCashFlowItem = (activityType, index, field, value) => {
    setFormData(prev => {
      const cashFlow = { ...prev.cashFlow };
      const items = [...cashFlow[activityType]];
      items[index] = { ...items[index], [field]: value };
      cashFlow[activityType] = items;
      return { ...prev, cashFlow };
    });
  };

  const removeCashFlowItem = (activityType, index) => {
    setFormData(prev => {
      const cashFlow = { ...prev.cashFlow };
      cashFlow[activityType] = cashFlow[activityType].filter((_, i) => i !== index);
      return { ...prev, cashFlow };
    });
  };

  // Equity Statement helpers
  const addEquityChange = (year) => {
    setFormData(prev => {
      const newChange = { description: '', capital: '', retainedEarnings: '' };
      const equityStatement = { ...prev.equityStatement };
      equityStatement[year].changes = [...equityStatement[year].changes, newChange];
      return { ...prev, equityStatement };
    });
  };

  const updateEquityChange = (year, index, field, value) => {
    setFormData(prev => {
      const equityStatement = { ...prev.equityStatement };
      const changes = [...equityStatement[year].changes];
      changes[index] = { ...changes[index], [field]: value };
      equityStatement[year].changes = changes;
      return { ...prev, equityStatement };
    });
  };

  const removeEquityChange = (year, index) => {
    setFormData(prev => {
      const equityStatement = { ...prev.equityStatement };
      equityStatement[year].changes = equityStatement[year].changes.filter((_, i) => i !== index);
      return { ...prev, equityStatement };
    });
  };

  const addAuditFinding = () => {
    setFormData(prev => ({
      ...prev,
      auditFindings: {
        ...prev.auditFindings,
        findings: [
          ...prev.auditFindings.findings,
          {
            findingTitle: '',
            refNumber: `AF-${String(prev.auditFindings.findings.length + 1).padStart(3, '0')}/${new Date().getFullYear()}`,
            riskRating: 'Medium',
            condition: '',
            criteria: '',
            cause: '',
            consequence: '',
            remedialAction: {
              actionRequired: '',
              responsiblePerson: '',
              deadline: '',
              status: 'Pending'
            },
            managementResponse: '',
            auditorFollowUp: '',
            finalStatus: 'Open'
          }
        ]
      }
    }));
  };

  const updateAuditFinding = (index, field, value) => {
    setFormData(prev => {
      const findings = [...prev.auditFindings.findings];
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        findings[index] = {
          ...findings[index],
          [parent]: {
            ...findings[index][parent],
            [child]: value
          }
        };
      } else {
        findings[index] = { ...findings[index], [field]: value };
      }
      return {
        ...prev,
        auditFindings: { ...prev.auditFindings, findings }
      };
    });
  };

  const removeAuditFinding = (index) => {
    setFormData(prev => ({
      ...prev,
      auditFindings: {
        ...prev.auditFindings,
        findings: prev.auditFindings.findings.filter((_, i) => i !== index)
      }
    }));
  };

  const addComplianceIssue = () => {
    setFormData(prev => ({
      ...prev,
      complianceIssues: [
        ...prev.complianceIssues,
        {
          issueId: `CL-${String(prev.complianceIssues.length + 1).padStart(3, '0')}`,
          issueType: 'Compliance',
          description: '',
          dateIdentified: new Date().toISOString().split('T')[0],
          department: department?.name || '',
          criteriaViolated: '',
          cause: '',
          riskLevel: 'Medium',
          impact: '',
          correctiveAction: '',
          responsiblePerson: '',
          deadline: '',
          status: 'Open',
          followUpNotes: ''
        }
      ]
    }));
  };

  const updateComplianceIssue = (index, field, value) => {
    setFormData(prev => {
      const issues = [...prev.complianceIssues];
      issues[index] = { ...issues[index], [field]: value };
      return {
        ...prev,
        complianceIssues: issues
      };
    });
  };

  const removeComplianceIssue = (index) => {
    setFormData(prev => ({
      ...prev,
      complianceIssues: prev.complianceIssues.filter((_, i) => i !== index)
    }));
  };

  const updateWorkingPaperStatus = (index, status) => {
    setFormData(prev => {
      const papers = [...prev.workingPapers];
      papers[index] = { ...papers[index], status };
      return {
        ...prev,
        workingPapers: papers
      };
    });
  };

  const updateChecklistItem = (category, index, field, value) => {
    setFormData(prev => {
      const checklist = [...prev.completionChecklist[category]];
      checklist[index] = { ...checklist[index], [field]: value };
      return {
        ...prev,
        completionChecklist: {
          ...prev.completionChecklist,
          [category]: checklist
        }
      };
    });
  };

  // Additional Sheets helpers
  const availableTemplateSections = [
    { id: 1, name: 'Introduction Sheet', key: 'introduction' },
    { id: 2, name: 'Working Papers Cover Sheet', key: 'workingPapers' },
    { id: 3, name: 'Background Information', key: 'backgroundInfo' },
    { id: 4, name: 'Lead Schedule', key: 'leadSchedule' },
    { id: 5, name: 'Balance Sheet', key: 'balanceSheet' },
    { id: 6, name: 'Income Statement', key: 'incomeStatement' },
    { id: 7, name: 'Cash Flow Statement', key: 'cashFlow' },
    { id: 8, name: 'Equity Statement', key: 'equityStatement' },
    { id: 9, name: 'Notes to Financial Statements', key: 'financialNotes' },
    { id: 10, name: 'Audit Findings', key: 'auditFindings' },
    { id: 11, name: 'Compliance and Legal Issues', key: 'complianceIssues' },
    { id: 12, name: 'Completion Checklist', key: 'completionChecklist' }
  ];

  const addAdditionalSheet = (sheetType) => {
    setFormData(prev => {
      const newSheet = {
        id: Date.now(),
        sheetType: sheetType,
        sheetName: availableTemplateSections.find(s => s.key === sheetType)?.name || sheetType,
        data: getDefaultSheetData(sheetType)
      };
      return {
        ...prev,
        additionalSheets: [...prev.additionalSheets, newSheet]
      };
    });
  };

  const getDefaultSheetData = (sheetType) => {
    // Return default structure based on sheet type
    switch(sheetType) {
      case 'introduction':
        return { auditPeriod: '', auditDate: new Date().toISOString().split('T')[0], auditorName: '', departmentName: '' };
      case 'workingPapers':
        return [];
      case 'backgroundInfo':
        return { companyProfile: '', ownershipStructure: '', natureOfOperation: '', industryOverview: '', organizationalStructure: '', accountingSystemUsed: '', significantEvents: '' };
      case 'leadSchedule':
        return { accounts: [], analyticalReview: '', preparedBy: '', reviewedBy: '', managementSignOff: '' };
      case 'balanceSheet':
        return { assets: { currentAssets: [], fixedAssets: [], otherAssets: [] }, liabilities: { currentLiabilities: [], longTermLiabilities: [] }, equity: [] };
      case 'incomeStatement':
        return { revenue: [], expenses: { generalAdmin: [], operational: [] } };
      case 'cashFlow':
        return { operating: [], investing: [], financing: [] };
      case 'equityStatement':
        return { previousYear: { openingBalance: { capital: '', retainedEarnings: '' }, changes: [], closingBalance: { capital: '', retainedEarnings: '' } }, currentYear: { openingBalance: { capital: '', retainedEarnings: '' }, changes: [], closingBalance: { capital: '', retainedEarnings: '' } } };
      case 'financialNotes':
        return { generalInfo: '', accountingPolicies: '', balanceSheetNotes: '', incomeStatementNotes: '', cashFlowNotes: '', otherDisclosures: '' };
      case 'auditFindings':
        return { auditInfo: { title: '', department: '', period: '', date: new Date().toISOString().split('T')[0], auditors: '' }, summary: { totalFindings: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, resolved: 0, outstanding: 0 }, findings: [] };
      case 'complianceIssues':
        return [];
      case 'completionChecklist':
        return { planning: [], preparation: [], review: [] };
      default:
        return {};
    }
  };

  const removeAdditionalSheet = (sheetId) => {
    setFormData(prev => ({
      ...prev,
      additionalSheets: prev.additionalSheets.filter(sheet => sheet.id !== sheetId)
    }));
  };

  const updateAdditionalSheetData = (sheetId, field, value) => {
    setFormData(prev => {
      const sheets = [...prev.additionalSheets];
      const sheetIndex = sheets.findIndex(s => s.id === sheetId);
      if (sheetIndex !== -1) {
        sheets[sheetIndex] = {
          ...sheets[sheetIndex],
          data: {
            ...sheets[sheetIndex].data,
            [field]: value
          }
        };
      }
      return { ...prev, additionalSheets: sheets };
    });
  };

  const formatReportContent = () => {
    let content = `INTERNAL AUDIT DEPARTMENT REPORT\n`;
    content += `=====================================\n\n`;
    
    // Section 1: Introduction
    content += `1. INTRODUCTION SHEET (OVERVIEW)\n`;
    content += `-----------------------------------\n`;
    content += `Audit Period: ${formData.introduction.auditPeriod || 'N/A'}\n`;
    content += `Audit Date: ${formData.introduction.auditDate}\n`;
    content += `Auditor: ${formData.introduction.auditorName}\n`;
    content += `Department: ${formData.introduction.departmentName}\n\n`;
    
    // Section 2: Working Papers Cover Sheet
    content += `2. WORKING PAPERS COVER SHEET\n`;
    content += `-----------------------------\n`;
    formData.workingPapers.forEach(paper => {
      content += `Ref ${paper.ref}: ${paper.description} (${paper.workpaperRef}) - Status: ${paper.status}\n`;
    });
    content += `\n`;
    
    // Section 3: Background Information
    content += `3. BACKGROUND INFORMATION\n`;
    content += `-------------------------\n`;
    content += `Company Profile: ${formData.backgroundInfo.companyProfile || 'N/A'}\n`;
    content += `Ownership Structure: ${formData.backgroundInfo.ownershipStructure || 'N/A'}\n`;
    content += `Nature of Operation: ${formData.backgroundInfo.natureOfOperation || 'N/A'}\n`;
    content += `Industry Overview: ${formData.backgroundInfo.industryOverview || 'N/A'}\n`;
    content += `Organizational Structure: ${formData.backgroundInfo.organizationalStructure || 'N/A'}\n`;
    content += `Accounting System: ${formData.backgroundInfo.accountingSystemUsed || 'N/A'}\n`;
    content += `Significant Events: ${formData.backgroundInfo.significantEvents || 'N/A'}\n\n`;
    
    // Section 4: Lead Schedule
    content += `4. LEAD SCHEDULE\n`;
    content += `----------------\n`;
    if (formData.leadSchedule.accounts.length > 0) {
      content += `Account Code | Account Name | Source | Actual Current Yr | Actual Last Yr | Budget Current Yr | Budget Last Yr\n`;
      formData.leadSchedule.accounts.forEach(acc => {
        content += `${acc.accountCode} | ${acc.accountName} | ${acc.source} | ${acc.actualCurrentYr} | ${acc.actualLastYr} | ${acc.budgetCurrentYr} | ${acc.budgetLastYr}\n`;
      });
    }
    content += `Analytical Review/Comments: ${formData.leadSchedule.analyticalReview || 'N/A'}\n`;
    content += `Prepared By: ${formData.leadSchedule.preparedBy || 'N/A'}\n`;
    content += `Reviewed By: ${formData.leadSchedule.reviewedBy || 'N/A'}\n`;
    content += `Management Sign-Off: ${formData.leadSchedule.managementSignOff || 'N/A'}\n\n`;
    
    // Section 5: Balance Sheet
    content += `5. BALANCE SHEET (ASSET/LIABILITY TEMPLATE)\n`;
    content += `-------------------------------------------\n`;
    content += `Assets:\n`;
    content += `Current Assets:\n`;
    formData.balanceSheet.assets.currentAssets.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Fixed Assets:\n`;
    formData.balanceSheet.assets.fixedAssets.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Other Assets:\n`;
    formData.balanceSheet.assets.otherAssets.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Liabilities:\n`;
    content += `Current Liabilities:\n`;
    formData.balanceSheet.liabilities.currentLiabilities.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Long-term Liabilities:\n`;
    formData.balanceSheet.liabilities.longTermLiabilities.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Equity:\n`;
    formData.balanceSheet.equity.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `\n`;
    
    // Section 6: Income Statement
    content += `6. INCOME STATEMENT (PROFIT/LOSS TEMPLATE)\n`;
    content += `-------------------------------------------\n`;
    content += `Revenue:\n`;
    formData.incomeStatement.revenue.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Expenses:\n`;
    content += `General & Admin. Expenses:\n`;
    formData.incomeStatement.expenses.generalAdmin.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Operational Expenses:\n`;
    formData.incomeStatement.expenses.operational.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `\n`;
    
    // Section 7: Cash Flow Statement
    content += `7. CASH FLOW STATEMENT (CASH MOVEMENT TEMPLATE)\n`;
    content += `------------------------------------------------\n`;
    content += `Operating Activities:\n`;
    formData.cashFlow.operating.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Investing Activities:\n`;
    formData.cashFlow.investing.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `Financing Activities:\n`;
    formData.cashFlow.financing.forEach(item => {
      content += `  ${item.subItem || 'N/A'}: Current Year: ${item.currentYear || '0'}, Previous Year: ${item.previousYear || '0'}\n`;
    });
    content += `\n`;
    
    // Section 8: Equity Statement
    content += `8. EQUITY STATEMENT (CHANGES IN EQUITY TEMPLATE)\n`;
    content += `------------------------------------------------\n`;
    content += `Previous Year:\n`;
    content += `Opening Balance - Owners Capital: ${formData.equityStatement.previousYear.openingBalance.capital || '0'}\n`;
    content += `Opening Balance - Retained Earnings: ${formData.equityStatement.previousYear.openingBalance.retainedEarnings || '0'}\n`;
    content += `Changes in Equity:\n`;
    formData.equityStatement.previousYear.changes.forEach(change => {
      content += `  ${change.description || 'N/A'}: Capital: ${change.capital || '0'}, Retained Earnings: ${change.retainedEarnings || '0'}\n`;
    });
    content += `Closing Balance - Owners Capital: ${formData.equityStatement.previousYear.closingBalance.capital || '0'}\n`;
    content += `Closing Balance - Retained Earnings: ${formData.equityStatement.previousYear.closingBalance.retainedEarnings || '0'}\n\n`;
    content += `Current Year:\n`;
    content += `Opening Balance - Owners Capital: ${formData.equityStatement.currentYear.openingBalance.capital || '0'}\n`;
    content += `Opening Balance - Retained Earnings: ${formData.equityStatement.currentYear.openingBalance.retainedEarnings || '0'}\n`;
    content += `Changes in Equity:\n`;
    formData.equityStatement.currentYear.changes.forEach(change => {
      content += `  ${change.description || 'N/A'}: Capital: ${change.capital || '0'}, Retained Earnings: ${change.retainedEarnings || '0'}\n`;
    });
    content += `Closing Balance - Owners Capital: ${formData.equityStatement.currentYear.closingBalance.capital || '0'}\n`;
    content += `Closing Balance - Retained Earnings: ${formData.equityStatement.currentYear.closingBalance.retainedEarnings || '0'}\n\n`;
    
    // Section 10: Audit Findings
    content += `10. AUDIT FINDINGS AND REMEDIAL ACTIONS\n`;
    content += `--------------------------------------\n`;
    content += `Title: ${formData.auditFindings.auditInfo.title || 'N/A'}\n`;
    content += `Period: ${formData.auditFindings.auditInfo.period || 'N/A'}\n`;
    content += `Date: ${formData.auditFindings.auditInfo.date}\n`;
    content += `Auditors: ${formData.auditFindings.auditInfo.auditors || 'N/A'}\n\n`;
    content += `Summary:\n`;
    content += `- Total Findings: ${formData.auditFindings.summary.totalFindings}\n`;
    content += `- High Risk: ${formData.auditFindings.summary.highRisk}\n`;
    content += `- Medium Risk: ${formData.auditFindings.summary.mediumRisk}\n`;
    content += `- Low Risk: ${formData.auditFindings.summary.lowRisk}\n`;
    content += `- Resolved: ${formData.auditFindings.summary.resolved}\n`;
    content += `- Outstanding: ${formData.auditFindings.summary.outstanding}\n\n`;
    
    formData.auditFindings.findings.forEach((finding, idx) => {
      content += `Finding ${idx + 1}: ${finding.findingTitle}\n`;
      content += `Ref: ${finding.refNumber} | Risk: ${finding.riskRating}\n`;
      content += `Condition: ${finding.condition || 'N/A'}\n`;
      content += `Criteria: ${finding.criteria || 'N/A'}\n`;
      content += `Cause: ${finding.cause || 'N/A'}\n`;
      content += `Consequence: ${finding.consequence || 'N/A'}\n`;
      content += `Remedial Action: ${finding.remedialAction.actionRequired || 'N/A'}\n`;
      content += `Responsible: ${finding.remedialAction.responsiblePerson || 'N/A'}\n`;
      content += `Deadline: ${finding.remedialAction.deadline || 'N/A'}\n`;
      content += `Status: ${finding.remedialAction.status}\n`;
      content += `Management Response: ${finding.managementResponse || 'N/A'}\n`;
      content += `Final Status: ${finding.finalStatus}\n\n`;
    });
    
    // Section 11: Compliance and Legal Issues
    content += `11. COMPLIANCE AND LEGAL ISSUES\n`;
    content += `------------------------------\n`;
    formData.complianceIssues.forEach((issue, idx) => {
      content += `Issue ${idx + 1}: ${issue.issueId}\n`;
      content += `Type: ${issue.issueType} | Risk Level: ${issue.riskLevel}\n`;
      content += `Description: ${issue.description || 'N/A'}\n`;
      content += `Date Identified: ${issue.dateIdentified}\n`;
      content += `Criteria Violated: ${issue.criteriaViolated || 'N/A'}\n`;
      content += `Corrective Action: ${issue.correctiveAction || 'N/A'}\n`;
      content += `Responsible: ${issue.responsiblePerson || 'N/A'}\n`;
      content += `Deadline: ${issue.deadline || 'N/A'}\n`;
      content += `Status: ${issue.status}\n\n`;
    });
    
    // Section 12: Completion Checklist
    content += `12. COMPLETION CHECKLIST\n`;
    content += `-----------------------\n`;
    content += `Planning:\n`;
    formData.completionChecklist.planning.forEach((item, idx) => {
      content += `${item.checked ? '✓' : '☐'} ${item.item}\n`;
      if (item.comments) content += `  Comments: ${item.comments}\n`;
    });
    content += `\nPreparation:\n`;
    formData.completionChecklist.preparation.forEach((item, idx) => {
      content += `${item.checked ? '✓' : '☐'} ${item.item}\n`;
      if (item.comments) content += `  Comments: ${item.comments}\n`;
    });
    content += `\nReview:\n`;
    formData.completionChecklist.review.forEach((item, idx) => {
      content += `${item.checked ? '✓' : '☐'} ${item.item}\n`;
      if (item.comments) content += `  Comments: ${item.comments}\n`;
    });
    
    // Additional Sheets
    if (formData.additionalSheets.length > 0) {
      content += `\nADDITIONAL SHEETS\n`;
      content += `==================\n\n`;
      formData.additionalSheets.forEach((sheet, idx) => {
        content += `Additional Sheet ${idx + 1}: ${sheet.sheetName}\n`;
        content += `----------------------------------------\n`;
        
        if (sheet.sheetType === 'introduction') {
          content += `Audit Period: ${sheet.data.auditPeriod || 'N/A'}\n`;
          content += `Audit Date: ${sheet.data.auditDate || 'N/A'}\n`;
          content += `Auditor: ${sheet.data.auditorName || 'N/A'}\n`;
          content += `Department: ${sheet.data.departmentName || 'N/A'}\n`;
        } else if (sheet.sheetType === 'backgroundInfo') {
          content += `Company Profile: ${sheet.data.companyProfile || 'N/A'}\n`;
          content += `Ownership Structure: ${sheet.data.ownershipStructure || 'N/A'}\n`;
          content += `Nature of Operation: ${sheet.data.natureOfOperation || 'N/A'}\n`;
        } else if (sheet.sheetType === 'leadSchedule') {
          content += `Analytical Review: ${sheet.data.analyticalReview || 'N/A'}\n`;
          content += `Prepared By: ${sheet.data.preparedBy || 'N/A'}\n`;
          content += `Reviewed By: ${sheet.data.reviewedBy || 'N/A'}\n`;
          content += `Management Sign-Off: ${sheet.data.managementSignOff || 'N/A'}\n`;
        } else if (sheet.sheetType === 'financialNotes') {
          content += `General Info: ${sheet.data.generalInfo || 'N/A'}\n`;
          content += `Accounting Policies: ${sheet.data.accountingPolicies || 'N/A'}\n`;
          content += `Balance Sheet Notes: ${sheet.data.balanceSheetNotes || 'N/A'}\n`;
          content += `Income Statement Notes: ${sheet.data.incomeStatementNotes || 'N/A'}\n`;
          content += `Cash Flow Notes: ${sheet.data.cashFlowNotes || 'N/A'}\n`;
          content += `Other Disclosures: ${sheet.data.otherDisclosures || 'N/A'}\n`;
        }
        
        if (sheet.data.notes) {
          content += `\nAdditional Notes:\n${sheet.data.notes}\n`;
        }
        content += `\n`;
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
      const reportTitle = `Internal Audit Report - ${department?.name || 'Department'} - ${formData.introduction.auditPeriod || new Date().toLocaleDateString()}`;

      await api.post('/department-reports', {
        title: reportTitle,
        content: reportContent
      });

      onClose();
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 1, name: 'Introduction', icon: 'bi-file-text' },
    { id: 2, name: 'Working Papers', icon: 'bi-folder' },
    { id: 3, name: 'Background Info', icon: 'bi-building' },
    { id: 4, name: 'Lead Schedule', icon: 'bi-table' },
    { id: 5, name: 'Balance Sheet', icon: 'bi-calculator' },
    { id: 6, name: 'Income Statement', icon: 'bi-graph-up' },
    { id: 7, name: 'Cash Flow', icon: 'bi-arrow-left-right' },
    { id: 8, name: 'Equity Statement', icon: 'bi-pie-chart' },
    { id: 10, name: 'Audit Findings', icon: 'bi-exclamation-triangle' },
    { id: 11, name: 'Compliance Issues', icon: 'bi-shield-check' },
    { id: 12, name: 'Completion Checklist', icon: 'bi-check-square' },
    { id: 13, name: 'Additional Sheets', icon: 'bi-file-plus' }
  ];

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '95%' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-clipboard-check me-2"></i>
              {report ? 'Edit Internal Audit Department Report' : 'Internal Audit Department Report'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            {/* Section Navigation */}
            <div className="mb-3">
              <div className="btn-group flex-wrap" role="group">
                {sections.map(section => (
                  <button
                    key={section.id}
                    type="button"
                    className={`btn btn-sm ${activeSection === section.id ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <i className={`bi ${section.icon} me-1`}></i>
                    {section.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Section 1: Introduction */}
              {activeSection === 1 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">1. Introduction Sheet (Overview Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Audit Period *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.introduction.auditPeriod}
                          onChange={(e) => handleInputChange('introduction', 'auditPeriod', e.target.value)}
                          placeholder="e.g., Q1 2025, January 2025"
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Audit Date *</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.introduction.auditDate}
                          onChange={(e) => handleInputChange('introduction', 'auditDate', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Auditor Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.introduction.auditorName}
                          onChange={(e) => handleInputChange('introduction', 'auditorName', e.target.value)}
                          placeholder="Auditor name"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Department Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.introduction.departmentName}
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> High-level guide to the working paper package, linking to other templates.
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: Working Papers Cover Sheet */}
              {activeSection === 2 && (
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">2. Working Papers Cover Sheet (Index Template)</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        const nextRef = formData.workingPapers.length + 1;
                        setFormData(prev => ({
                          ...prev,
                          workingPapers: [
                            ...prev.workingPapers,
                            { ref: nextRef, description: '', workpaperRef: `WOP ${nextRef}`, status: 'Pending' }
                          ]
                        }));
                      }}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Paper
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-bordered table-sm">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Description</th>
                            <th>Workpaper Reference</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.workingPapers.map((paper, index) => (
                            <tr key={index}>
                              <td>{paper.ref}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={paper.description}
                                  onChange={(e) => {
                                    const papers = [...formData.workingPapers];
                                    papers[index] = { ...papers[index], description: e.target.value };
                                    setFormData(prev => ({ ...prev, workingPapers: papers }));
                                  }}
                                  placeholder="Enter description..."
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={paper.workpaperRef}
                                  onChange={(e) => {
                                    const papers = [...formData.workingPapers];
                                    papers[index] = { ...papers[index], workpaperRef: e.target.value };
                                    setFormData(prev => ({ ...prev, workingPapers: papers }));
                                  }}
                                  placeholder="e.g., WOP 1"
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={paper.status}
                                  onChange={(e) => updateWorkingPaperStatus(index, e.target.value)}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      workingPapers: prev.workingPapers.filter((_, i) => i !== index)
                                    }));
                                  }}
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
              )}

              {/* Section 3: Background Information */}
              {activeSection === 3 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">3. Background Information (Company Profile Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label">Company Profile *</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={formData.backgroundInfo.companyProfile}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'companyProfile', e.target.value)}
                        placeholder="Enter company profile information..."
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Ownership Structure</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.backgroundInfo.ownershipStructure}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'ownershipStructure', e.target.value)}
                        placeholder="Describe ownership structure..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Nature of Operation</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.backgroundInfo.natureOfOperation}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'natureOfOperation', e.target.value)}
                        placeholder="Describe nature of operations..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Industry Overview</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.backgroundInfo.industryOverview}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'industryOverview', e.target.value)}
                        placeholder="Enter industry overview..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Organizational Structure</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.backgroundInfo.organizationalStructure}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'organizationalStructure', e.target.value)}
                        placeholder="Describe organizational structure..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Accounting System Used</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.backgroundInfo.accountingSystemUsed}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'accountingSystemUsed', e.target.value)}
                        placeholder="e.g., QuickBooks, SAP, Oracle"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Significant Events During the Year</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={formData.backgroundInfo.significantEvents}
                        onChange={(e) => handleNestedChange('backgroundInfo', '', 'significantEvents', e.target.value)}
                        placeholder="List any significant events..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Lead Schedule */}
              {activeSection === 4 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">4. Lead Schedule (Financial Balance Verification Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={addAccountToLeadSchedule}
                      >
                        <i className="bi bi-plus-circle me-1"></i>Add Account
                      </button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-bordered table-sm">
                        <thead>
                          <tr>
                            <th>Account Code</th>
                            <th>Account Name</th>
                            <th>Source</th>
                            <th>Actual Current Yr ($)</th>
                            <th>Actual Last Yr ($)</th>
                            <th>Budget Current Yr ($)</th>
                            <th>Budget Last Yr ($)</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.leadSchedule.accounts.map((account, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={account.accountCode}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'accountCode', e.target.value)}
                                  placeholder="e.g., 1001"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={account.accountName}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'accountName', e.target.value)}
                                  placeholder="e.g., Cash"
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={account.source}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'source', e.target.value)}
                                  placeholder="e.g., Bank Stmt"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={account.actualCurrentYr}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'actualCurrentYr', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={account.actualLastYr}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'actualLastYr', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={account.budgetCurrentYr}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'budgetCurrentYr', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={account.budgetLastYr}
                                  onChange={(e) => updateLeadScheduleAccount(index, 'budgetLastYr', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeLeadScheduleAccount(index)}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="row mt-3">
                      <div className="col-12 mb-3">
                        <label className="form-label">Analytical Review/Comments</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={formData.leadSchedule.analyticalReview}
                          onChange={(e) => handleInputChange('leadSchedule', 'analyticalReview', e.target.value)}
                          placeholder="Enter analytical review and comments..."
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Prepared By</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.leadSchedule.preparedBy}
                          onChange={(e) => handleInputChange('leadSchedule', 'preparedBy', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Reviewed By</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.leadSchedule.reviewedBy}
                          onChange={(e) => handleInputChange('leadSchedule', 'reviewedBy', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Management Sign-Off</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.leadSchedule.managementSignOff}
                          onChange={(e) => handleInputChange('leadSchedule', 'managementSignOff', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 5: Balance Sheet */}
              {activeSection === 5 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">5. Balance Sheet (Asset/Liability Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> Detailed schedule for balance sheet items, with comparatives.
                    </div>

                    {/* Assets */}
                    <h6 className="mt-3">Assets</h6>
                    
                    {/* Current Assets */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Current Assets</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('assets', 'currentAssets')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.assets.currentAssets.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'currentAssets', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Cash, Accounts Receivable"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'currentAssets', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'currentAssets', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('assets', 'currentAssets', index)}
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

                    {/* Fixed Assets */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Fixed Assets</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('assets', 'fixedAssets')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.assets.fixedAssets.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'fixedAssets', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Property, Plant & Equipment"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'fixedAssets', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'fixedAssets', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('assets', 'fixedAssets', index)}
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

                    {/* Other Assets */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Other Assets</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('assets', 'otherAssets')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.assets.otherAssets.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'otherAssets', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Deferred Income Tax"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'otherAssets', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('assets', 'otherAssets', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('assets', 'otherAssets', index)}
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

                    {/* Liabilities */}
                    <h6 className="mt-4">Liabilities & Equity</h6>
                    
                    {/* Current Liabilities */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Current Liabilities</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('liabilities', 'currentLiabilities')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.liabilities.currentLiabilities.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'currentLiabilities', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Accounts Payable"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'currentLiabilities', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'currentLiabilities', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('liabilities', 'currentLiabilities', index)}
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

                    {/* Long-term Liabilities */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Long-term Liabilities</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('liabilities', 'longTermLiabilities')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.liabilities.longTermLiabilities.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'longTermLiabilities', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Long-term Debt"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'longTermLiabilities', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('liabilities', 'longTermLiabilities', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('liabilities', 'longTermLiabilities', index)}
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

                    {/* Equity */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Equity</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addBalanceSheetItem('equity', '')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.balanceSheet.equity.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateBalanceSheetItem('equity', '', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Owners Capital, Retained Earnings"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateBalanceSheetItem('equity', '', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateBalanceSheetItem('equity', '', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeBalanceSheetItem('equity', '', index)}
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

                    <div className="alert alert-warning">
                      <strong>Footer Check:</strong> Total Assets = Total Liabilities + Equity
                    </div>
                  </div>
                </div>
              )}

              {/* Section 6: Income Statement */}
              {activeSection === 6 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">6. Income Statement (Profit/Loss Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> Revenue/expense breakdown with gross profit and net earnings.
                    </div>

                    {/* Revenue */}
                    <h6 className="mt-3">Revenue</h6>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Revenue Items</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addIncomeStatementItem('revenue', '')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.incomeStatement.revenue.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateIncomeStatementItem('revenue', '', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Sales, Service"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateIncomeStatementItem('revenue', '', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateIncomeStatementItem('revenue', '', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeIncomeStatementItem('revenue', '', index)}
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

                    {/* Expenses */}
                    <h6 className="mt-4">Expenses</h6>
                    
                    {/* General & Admin Expenses */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>General & Admin. Expenses</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addIncomeStatementItem('expenses', 'generalAdmin')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.incomeStatement.expenses.generalAdmin.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'generalAdmin', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Salaries & Wages, Professional Fees"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'generalAdmin', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'generalAdmin', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeIncomeStatementItem('expenses', 'generalAdmin', index)}
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

                    {/* Operational Expenses */}
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Operational Expenses</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addIncomeStatementItem('expenses', 'operational')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.incomeStatement.expenses.operational.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'operational', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Cost of Goods Sold"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'operational', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateIncomeStatementItem('expenses', 'operational', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeIncomeStatementItem('expenses', 'operational', index)}
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

                    <div className="alert alert-info">
                      <strong>Note:</strong> Gross Profit = Revenue - Cost of Goods Sold | Net Earnings = Revenue - Total Expenses
                    </div>
                  </div>
                </div>
              )}

              {/* Section 7: Cash Flow Statement */}
              {activeSection === 7 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">7. Cash Flow Statement (Cash Movement Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> Tracks cash inflows/outflows by activity type.
                    </div>

                    {/* Operating Activities */}
                    <h6 className="mt-3">Operating Activities</h6>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Operating Items</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addCashFlowItem('operating')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.cashFlow.operating.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateCashFlowItem('operating', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Net Income, Depreciation"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateCashFlowItem('operating', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateCashFlowItem('operating', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeCashFlowItem('operating', index)}
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

                    {/* Investing Activities */}
                    <h6 className="mt-4">Investing Activities</h6>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Investing Items</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addCashFlowItem('investing')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.cashFlow.investing.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateCashFlowItem('investing', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Purchase of PPE"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateCashFlowItem('investing', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateCashFlowItem('investing', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeCashFlowItem('investing', index)}
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

                    {/* Financing Activities */}
                    <h6 className="mt-4">Financing Activities</h6>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Financing Items</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addCashFlowItem('financing')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Item
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Sub-Item</th>
                              <th>Current Year (000')</th>
                              <th>Previous Year (000')</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.cashFlow.financing.map((item, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.subItem}
                                    onChange={(e) => updateCashFlowItem('financing', index, 'subItem', e.target.value)}
                                    placeholder="e.g., Proceeds from Loans"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.currentYear}
                                    onChange={(e) => updateCashFlowItem('financing', index, 'currentYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.previousYear}
                                    onChange={(e) => updateCashFlowItem('financing', index, 'previousYear', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeCashFlowItem('financing', index)}
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

                    <div className="row mt-3">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Opening Cash Balance</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Closing Cash Balance</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="alert alert-info">
                      <strong>Note:</strong> Net Change in Cash = Net Operating + Net Investing + Net Financing
                    </div>
                  </div>
                </div>
              )}

              {/* Section 8: Equity Statement */}
              {activeSection === 8 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">8. Equity Statement (Changes in Equity Template)</h6>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> Tracks equity movements over periods.
                    </div>

                    {/* Previous Year */}
                    <h6 className="mt-3">Previous Year</h6>
                    <div className="row mb-3">
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Jan 1 (Owners Capital)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.previousYear.openingBalance.capital}
                          onChange={(e) => handleNestedChange('equityStatement', 'previousYear.openingBalance', 'capital', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Jan 1 (Retained Earnings)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.previousYear.openingBalance.retainedEarnings}
                          onChange={(e) => handleNestedChange('equityStatement', 'previousYear.openingBalance', 'retainedEarnings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Changes in Equity</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addEquityChange('previousYear')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Change
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Owners Capital ($)</th>
                              <th>Retained Earnings ($)</th>
                              <th>Total Equity ($)</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.equityStatement.previousYear.changes.map((change, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={change.description}
                                    onChange={(e) => updateEquityChange('previousYear', index, 'description', e.target.value)}
                                    placeholder="e.g., Profit for the Year"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={change.capital}
                                    onChange={(e) => updateEquityChange('previousYear', index, 'capital', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={change.retainedEarnings}
                                    onChange={(e) => updateEquityChange('previousYear', index, 'retainedEarnings', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={(parseFloat(change.capital) || 0) + (parseFloat(change.retainedEarnings) || 0)}
                                    readOnly
                                    placeholder="Auto-calculated"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeEquityChange('previousYear', index)}
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

                    <div className="row mb-4">
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Dec 31 (Owners Capital)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.previousYear.closingBalance.capital}
                          onChange={(e) => handleNestedChange('equityStatement', 'previousYear.closingBalance', 'capital', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Dec 31 (Retained Earnings)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.previousYear.closingBalance.retainedEarnings}
                          onChange={(e) => handleNestedChange('equityStatement', 'previousYear.closingBalance', 'retainedEarnings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Current Year */}
                    <h6 className="mt-4">Current Year</h6>
                    <div className="row mb-3">
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Jan 1 (Owners Capital)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.currentYear.openingBalance.capital}
                          onChange={(e) => handleNestedChange('equityStatement', 'currentYear.openingBalance', 'capital', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Jan 1 (Retained Earnings)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.currentYear.openingBalance.retainedEarnings}
                          onChange={(e) => handleNestedChange('equityStatement', 'currentYear.openingBalance', 'retainedEarnings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong>Changes in Equity</strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => addEquityChange('currentYear')}
                        >
                          <i className="bi bi-plus-circle me-1"></i>Add Change
                        </button>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Owners Capital ($)</th>
                              <th>Retained Earnings ($)</th>
                              <th>Total Equity ($)</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.equityStatement.currentYear.changes.map((change, index) => (
                              <tr key={index}>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={change.description}
                                    onChange={(e) => updateEquityChange('currentYear', index, 'description', e.target.value)}
                                    placeholder="e.g., Profit for the Year"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={change.capital}
                                    onChange={(e) => updateEquityChange('currentYear', index, 'capital', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={change.retainedEarnings}
                                    onChange={(e) => updateEquityChange('currentYear', index, 'retainedEarnings', e.target.value)}
                                    placeholder="0.00"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={(parseFloat(change.capital) || 0) + (parseFloat(change.retainedEarnings) || 0)}
                                    readOnly
                                    placeholder="Auto-calculated"
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeEquityChange('currentYear', index)}
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

                    <div className="row mb-4">
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Dec 31 (Owners Capital)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.currentYear.closingBalance.capital}
                          onChange={(e) => handleNestedChange('equityStatement', 'currentYear.closingBalance', 'capital', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Balance as at Dec 31 (Retained Earnings)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.equityStatement.currentYear.closingBalance.retainedEarnings}
                          onChange={(e) => handleNestedChange('equityStatement', 'currentYear.closingBalance', 'retainedEarnings', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="alert alert-info">
                      <strong>Note:</strong> Total Equity = Owners Capital + Retained Earnings
                    </div>
                  </div>
                </div>
              )}

              {/* Section 10: Audit Findings */}
              {activeSection === 10 && (
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">10. Audit Findings and Remedial Actions</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={addAuditFinding}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Finding
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.auditFindings.auditInfo.title}
                          onChange={(e) => handleNestedChange('auditFindings', 'auditInfo', 'title', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Period</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.auditFindings.auditInfo.period}
                          onChange={(e) => handleNestedChange('auditFindings', 'auditInfo', 'period', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.auditFindings.auditInfo.date}
                          onChange={(e) => handleNestedChange('auditFindings', 'auditInfo', 'date', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Auditors</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.auditFindings.auditInfo.auditors}
                          onChange={(e) => handleNestedChange('auditFindings', 'auditInfo', 'auditors', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <div className="col-md-2">
                        <label className="form-label">Total Findings</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.totalFindings}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'totalFindings', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">High Risk</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.highRisk}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'highRisk', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Medium Risk</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.mediumRisk}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'mediumRisk', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Low Risk</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.lowRisk}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'lowRisk', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Resolved</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.resolved}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'resolved', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Outstanding</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.auditFindings.summary.outstanding}
                          onChange={(e) => handleNestedChange('auditFindings', 'summary', 'outstanding', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    
                    {formData.auditFindings.findings.map((finding, index) => (
                      <div key={index} className="card mb-3">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <strong>Finding {index + 1}</strong>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeAuditFinding(index)}
                          >
                            <i className="bi bi-trash"></i> Remove
                          </button>
                        </div>
                        <div className="card-body">
                          <div className="row mb-2">
                            <div className="col-md-6">
                              <label className="form-label">Finding Title *</label>
                              <input
                                type="text"
                                className="form-control"
                                value={finding.findingTitle}
                                onChange={(e) => updateAuditFinding(index, 'findingTitle', e.target.value)}
                                required
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Ref Number</label>
                              <input
                                type="text"
                                className="form-control"
                                value={finding.refNumber}
                                readOnly
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Risk Rating</label>
                              <select
                                className="form-select"
                                value={finding.riskRating}
                                onChange={(e) => updateAuditFinding(index, 'riskRating', e.target.value)}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="form-label">A. Condition (Describe issue observed)</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.condition}
                              onChange={(e) => updateAuditFinding(index, 'condition', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">B. Criteria (Violated policy/law)</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.criteria}
                              onChange={(e) => updateAuditFinding(index, 'criteria', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">C. Cause (Root cause)</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.cause}
                              onChange={(e) => updateAuditFinding(index, 'cause', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">D. Consequence (Impact/risk if unfixed)</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.consequence}
                              onChange={(e) => updateAuditFinding(index, 'consequence', e.target.value)}
                            />
                          </div>
                          <div className="card bg-light mb-2">
                            <div className="card-body">
                              <h6 className="card-title">E. Remedial Action Plan</h6>
                              <div className="mb-2">
                                <label className="form-label">Action Required</label>
                                <textarea
                                  className="form-control"
                                  rows="2"
                                  value={finding.remedialAction.actionRequired}
                                  onChange={(e) => updateAuditFinding(index, 'remedialAction.actionRequired', e.target.value)}
                                />
                              </div>
                              <div className="row">
                                <div className="col-md-4 mb-2">
                                  <label className="form-label">Responsible Person</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={finding.remedialAction.responsiblePerson}
                                    onChange={(e) => updateAuditFinding(index, 'remedialAction.responsiblePerson', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-4 mb-2">
                                  <label className="form-label">Deadline</label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    value={finding.remedialAction.deadline}
                                    onChange={(e) => updateAuditFinding(index, 'remedialAction.deadline', e.target.value)}
                                  />
                                </div>
                                <div className="col-md-4 mb-2">
                                  <label className="form-label">Status</label>
                                  <select
                                    className="form-select"
                                    value={finding.remedialAction.status}
                                    onChange={(e) => updateAuditFinding(index, 'remedialAction.status', e.target.value)}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="In-Progress">In-Progress</option>
                                    <option value="Completed">Completed</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Management Response</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.managementResponse}
                              onChange={(e) => updateAuditFinding(index, 'managementResponse', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Auditor Follow-Up</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={finding.auditorFollowUp}
                              onChange={(e) => updateAuditFinding(index, 'auditorFollowUp', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Final Status</label>
                            <select
                              className="form-select"
                              value={finding.finalStatus}
                              onChange={(e) => updateAuditFinding(index, 'finalStatus', e.target.value)}
                            >
                              <option value="Open">Open</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 11: Compliance and Legal Issues */}
              {activeSection === 11 && (
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">11. Compliance and Legal Issues</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={addComplianceIssue}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Issue
                    </button>
                  </div>
                  <div className="card-body">
                    {formData.complianceIssues.map((issue, index) => (
                      <div key={index} className="card mb-3">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <strong>{issue.issueId}</strong>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeComplianceIssue(index)}
                          >
                            <i className="bi bi-trash"></i> Remove
                          </button>
                        </div>
                        <div className="card-body">
                          <div className="row mb-2">
                            <div className="col-md-6">
                              <label className="form-label">Issue Type</label>
                              <select
                                className="form-select"
                                value={issue.issueType}
                                onChange={(e) => updateComplianceIssue(index, 'issueType', e.target.value)}
                              >
                                <option value="Compliance">Compliance</option>
                                <option value="Legal">Legal</option>
                              </select>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Date Identified</label>
                              <input
                                type="date"
                                className="form-control"
                                value={issue.dateIdentified}
                                onChange={(e) => updateComplianceIssue(index, 'dateIdentified', e.target.value)}
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Risk Level</label>
                              <select
                                className="form-select"
                                value={issue.riskLevel}
                                onChange={(e) => updateComplianceIssue(index, 'riskLevel', e.target.value)}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Description</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={issue.description}
                              onChange={(e) => updateComplianceIssue(index, 'description', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Criteria Violated</label>
                            <input
                              type="text"
                              className="form-control"
                              value={issue.criteriaViolated}
                              onChange={(e) => updateComplianceIssue(index, 'criteriaViolated', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Cause</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={issue.cause}
                              onChange={(e) => updateComplianceIssue(index, 'cause', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Impact/Consequence</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={issue.impact}
                              onChange={(e) => updateComplianceIssue(index, 'impact', e.target.value)}
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Corrective Action</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={issue.correctiveAction}
                              onChange={(e) => updateComplianceIssue(index, 'correctiveAction', e.target.value)}
                            />
                          </div>
                          <div className="row mb-2">
                            <div className="col-md-4">
                              <label className="form-label">Responsible Person</label>
                              <input
                                type="text"
                                className="form-control"
                                value={issue.responsiblePerson}
                                onChange={(e) => updateComplianceIssue(index, 'responsiblePerson', e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Deadline</label>
                              <input
                                type="date"
                                className="form-control"
                                value={issue.deadline}
                                onChange={(e) => updateComplianceIssue(index, 'deadline', e.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Status</label>
                              <select
                                className="form-select"
                                value={issue.status}
                                onChange={(e) => updateComplianceIssue(index, 'status', e.target.value)}
                              >
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Closed">Closed</option>
                              </select>
                            </div>
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Follow-Up Notes</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={issue.followUpNotes}
                              onChange={(e) => updateComplianceIssue(index, 'followUpNotes', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 12: Completion Checklist */}
              {activeSection === 12 && (
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">12. Completion Checklist (Quality Control Template)</h6>
                  </div>
                  <div className="card-body">
                    <h6>Planning</h6>
                    <div className="table-responsive mb-3">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>✓</th>
                            <th>Checklist Item</th>
                            <th>WP Ref</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.completionChecklist.planning.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={(e) => updateChecklistItem('planning', index, 'checked', e.target.checked)}
                                />
                              </td>
                              <td>{item.item}</td>
                              <td>WOP {index + 1}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={item.comments}
                                  onChange={(e) => updateChecklistItem('planning', index, 'comments', e.target.value)}
                                  placeholder="Comments..."
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h6>Preparation</h6>
                    <div className="table-responsive mb-3">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>✓</th>
                            <th>Checklist Item</th>
                            <th>WP Ref</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.completionChecklist.preparation.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={(e) => updateChecklistItem('preparation', index, 'checked', e.target.checked)}
                                />
                              </td>
                              <td>{item.item}</td>
                              <td>WOP {index + 3}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={item.comments}
                                  onChange={(e) => updateChecklistItem('preparation', index, 'comments', e.target.value)}
                                  placeholder="Comments..."
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h6>Review</h6>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>✓</th>
                            <th>Checklist Item</th>
                            <th>WP Ref</th>
                            <th>Comments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.completionChecklist.review.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={(e) => updateChecklistItem('review', index, 'checked', e.target.checked)}
                                />
                              </td>
                              <td>{item.item}</td>
                              <td>WOP {index + 8}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={item.comments}
                                  onChange={(e) => updateChecklistItem('review', index, 'comments', e.target.value)}
                                  placeholder="Comments..."
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 13: Additional Sheets */}
              {activeSection === 13 && (
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Additional Sheets</h6>
                    <div className="d-flex gap-2">
                      <select
                        className="form-select form-select-sm"
                        onChange={(e) => {
                          if (e.target.value) {
                            addAdditionalSheet(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">Select Template Sheet to Add...</option>
                        {availableTemplateSections.map(section => (
                          <option key={section.key} value={section.key}>
                            {section.id}. {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info">
                      <strong>Purpose:</strong> Add any additional template sheets as needed for your audit report.
                    </div>
                    
                    {formData.additionalSheets.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="bi bi-file-plus" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                        <p className="text-muted mt-3">No additional sheets added yet</p>
                        <p className="text-muted small">Select a template sheet from the dropdown above to add</p>
                      </div>
                    ) : (
                      <div>
                        {formData.additionalSheets.map((sheet, sheetIndex) => (
                          <div key={sheet.id} className="card mb-3">
                            <div className="card-header d-flex justify-content-between align-items-center">
                              <strong>{sheet.sheetName}</strong>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeAdditionalSheet(sheet.id)}
                              >
                                <i className="bi bi-trash me-1"></i>Remove
                              </button>
                            </div>
                            <div className="card-body">
                              {/* Render form based on sheet type */}
                              {sheet.sheetType === 'introduction' && (
                                <div className="row">
                                  <div className="col-md-6 mb-3">
                                    <label className="form-label">Audit Period</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={sheet.data.auditPeriod || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'auditPeriod', e.target.value)}
                                      placeholder="e.g., Q1 2025"
                                    />
                                  </div>
                                  <div className="col-md-6 mb-3">
                                    <label className="form-label">Audit Date</label>
                                    <input
                                      type="date"
                                      className="form-control"
                                      value={sheet.data.auditDate || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'auditDate', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-md-6 mb-3">
                                    <label className="form-label">Auditor Name</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={sheet.data.auditorName || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'auditorName', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-md-6 mb-3">
                                    <label className="form-label">Department Name</label>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={sheet.data.departmentName || department?.name || ''}
                                      readOnly
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {sheet.sheetType === 'backgroundInfo' && (
                                <div>
                                  <div className="mb-3">
                                    <label className="form-label">Company Profile</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.companyProfile || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'companyProfile', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Ownership Structure</label>
                                    <textarea
                                      className="form-control"
                                      rows="2"
                                      value={sheet.data.ownershipStructure || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'ownershipStructure', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Nature of Operation</label>
                                    <textarea
                                      className="form-control"
                                      rows="2"
                                      value={sheet.data.natureOfOperation || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'natureOfOperation', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {sheet.sheetType === 'leadSchedule' && (
                                <div>
                                  <div className="mb-3">
                                    <label className="form-label">Analytical Review/Comments</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.analyticalReview || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'analyticalReview', e.target.value)}
                                    />
                                  </div>
                                  <div className="row">
                                    <div className="col-md-4 mb-3">
                                      <label className="form-label">Prepared By</label>
                                      <input
                                        type="text"
                                        className="form-control"
                                        value={sheet.data.preparedBy || ''}
                                        onChange={(e) => updateAdditionalSheetData(sheet.id, 'preparedBy', e.target.value)}
                                      />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                      <label className="form-label">Reviewed By</label>
                                      <input
                                        type="text"
                                        className="form-control"
                                        value={sheet.data.reviewedBy || ''}
                                        onChange={(e) => updateAdditionalSheetData(sheet.id, 'reviewedBy', e.target.value)}
                                      />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                      <label className="form-label">Management Sign-Off</label>
                                      <input
                                        type="text"
                                        className="form-control"
                                        value={sheet.data.managementSignOff || ''}
                                        onChange={(e) => updateAdditionalSheetData(sheet.id, 'managementSignOff', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {sheet.sheetType === 'financialNotes' && (
                                <div>
                                  <div className="mb-3">
                                    <label className="form-label">General Information</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.generalInfo || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'generalInfo', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Accounting Policies</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.accountingPolicies || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'accountingPolicies', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Balance Sheet Notes</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.balanceSheetNotes || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'balanceSheetNotes', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Income Statement Notes</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.incomeStatementNotes || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'incomeStatementNotes', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Cash Flow Notes</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.cashFlowNotes || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'cashFlowNotes', e.target.value)}
                                    />
                                  </div>
                                  <div className="mb-3">
                                    <label className="form-label">Other Disclosures</label>
                                    <textarea
                                      className="form-control"
                                      rows="3"
                                      value={sheet.data.otherDisclosures || ''}
                                      onChange={(e) => updateAdditionalSheetData(sheet.id, 'otherDisclosures', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {(sheet.sheetType === 'balanceSheet' || sheet.sheetType === 'incomeStatement' || 
                                sheet.sheetType === 'cashFlow' || sheet.sheetType === 'equityStatement' ||
                                sheet.sheetType === 'auditFindings' || sheet.sheetType === 'complianceIssues' ||
                                sheet.sheetType === 'completionChecklist' || sheet.sheetType === 'workingPapers') && (
                                <div className="alert alert-warning">
                                  <i className="bi bi-info-circle me-2"></i>
                                  This sheet type requires complex data entry. Please use the main sections (1-12) for detailed entry, 
                                  or add notes/comments in a text area below.
                                </div>
                              )}
                              
                              {/* Generic text area for any sheet type */}
                              <div className="mb-3">
                                <label className="form-label">Additional Notes/Comments</label>
                                <textarea
                                  className="form-control"
                                  rows="5"
                                  value={sheet.data.notes || ''}
                                  onChange={(e) => updateAdditionalSheetData(sheet.id, 'notes', e.target.value)}
                                  placeholder="Enter any additional information, notes, or comments for this sheet..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
    </div>
  );
};

export default InternalAuditReportForm;

