import React from 'react';
import MarketingReportForm from './MarketingReportForm';
import MarketingWeeklyClientOfficerReportForm from './MarketingWeeklyClientOfficerReportForm';
import MarketingClientSpecificActivitiesReportForm from './MarketingClientSpecificActivitiesReportForm';
import InternalAuditReportForm from './InternalAuditReportForm';
import FinanceReportForm from './FinanceReportForm';
import ClientEngagementReportForm from './ClientEngagementReportForm';
import ICTWeeklyReportForm from './ICTWeeklyReportForm';
import ICTMonthlyReportForm from './ICTMonthlyReportForm';
import DepartmentReportForm from './DepartmentReportForm';
// Import other department templates as they are created
// import AcademyReportForm from './AcademyReportForm';

/**
 * ReportTemplateRouter - Routes to the appropriate report template based on department name
 * 
 * This component maps department names to their specific reporting templates.
 * As new department templates are created, they should be imported and added to the templateMap.
 * 
 * @param {Object} props
 * @param {Object} props.department - The department object with name property
 * @param {Function} props.onClose - Callback function when form is closed
 * @param {Object} props.report - Optional report object for editing
 * @param {String} props.reportType - Optional report type (e.g., 'weekly', 'monthly') for departments with multiple templates
 */
const ReportTemplateRouter = ({ department, onClose, report = null, reportType = null }) => {
  if (!department || !department.name) {
    return <DepartmentReportForm report={report} onClose={onClose} />;
  }

  const departmentName = department.name.toLowerCase().trim();

  // Special handling for ICT department (has both Weekly and Monthly reports)
  if (departmentName.includes('ict')) {
    if (reportType === 'monthly' || (report && report.title && report.title.toLowerCase().includes('monthly'))) {
      return <ICTMonthlyReportForm report={report} onClose={onClose} />;
    }
    // Default to Weekly for ICT
    return <ICTWeeklyReportForm report={report} onClose={onClose} />;
  }

  // Special handling for Marketing department (has multiple templates)
  if (departmentName.includes('marketing')) {
    // Check if it's the Client-Specific Activities Report
    if (reportType === 'client-specific-activities' ||
        (report && report.title && (
          report.title.toLowerCase().includes('client-specific activities') ||
          report.title.toLowerCase().includes('client activity report') ||
          report.title.toLowerCase().includes('client-specific')
        ))) {
      return <MarketingClientSpecificActivitiesReportForm report={report} onClose={onClose} />;
    }
    // Check if it's the Weekly Client Officer Report
    if (reportType === 'weekly-client-officer' || 
        (report && report.title && (
          report.title.toLowerCase().includes('weekly client officer') ||
          report.title.toLowerCase().includes('client officer report')
        ))) {
      return <MarketingWeeklyClientOfficerReportForm report={report} onClose={onClose} />;
    }
    // Default to general Marketing Report
    return <MarketingReportForm report={report} onClose={onClose} />;
  }

  // Special handling for Client Engagement and Audit - both can use each other's templates
  // Client Engagement department head can use Audit template
  // Audit department head can use Client Engagement template
  if (departmentName.includes('client engagement') || departmentName.includes('audit')) {
    // If reportType is specified, use it to determine which template
    if (reportType === 'audit' || (report && report.title && report.title.toLowerCase().includes('audit'))) {
      return <InternalAuditReportForm report={report} onClose={onClose} />;
    }
    if (reportType === 'client-engagement' || (report && report.title && report.title.toLowerCase().includes('client engagement'))) {
      return <ClientEngagementReportForm report={report} onClose={onClose} />;
    }
    // Default: Client Engagement uses Client Engagement template, Audit uses Audit template
    if (departmentName.includes('client engagement')) {
      return <ClientEngagementReportForm report={report} onClose={onClose} />;
    }
    if (departmentName.includes('audit')) {
      return <InternalAuditReportForm report={report} onClose={onClose} />;
    }
  }

  // Template mapping: Map department names (case-insensitive) to their template components
  const templateMap = {
    'internal audit': InternalAuditReportForm,
    'audit and engagement': InternalAuditReportForm,
    'finance': FinanceReportForm,
    'finance department': FinanceReportForm,
    'client engagement': ClientEngagementReportForm,
    // Add other department templates here as they are created:
    // 'academy': AcademyReportForm,
    // 'academy (elearning)': AcademyReportForm,
  };

  // Find matching template
  const TemplateComponent = templateMap[departmentName] || DepartmentReportForm;

  return <TemplateComponent report={report} onClose={onClose} />;
};

export default ReportTemplateRouter;

