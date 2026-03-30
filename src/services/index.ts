/**
 * =====================================================
 * SERVICES INDEX
 * =====================================================
 * Central export for all data services.
 */

// Employee Service
export {
  getEmployee,
  getAllEmployees,
  getEmployeesByRole,
  getEmployeesBySite,
  getActiveEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  deactivateEmployee,
  reactivateEmployee,
  searchEmployees,
  updateEmployeeRates,
  generateWorkerId,
  updateEmployeePhoto,
} from './employee-service';

// Site Service
export {
  getSite,
  getAllSites,
  getActiveSites,
  createSite,
  updateSite,
  updateSiteStatus,
  deleteSite,
  assignSupervisorsToSite,
  isWithinGeofence,
  getSitesBySupervisor,
  generateSiteCode,
} from './site-service';

// Attendance Service
export {
  getAttendance,
  getOrCreateAttendance,
  startAttendanceSegment,
  endAttendanceSegment,
  markAbsent,
  markOnLeave,
  getTodayAttendance,
  getEmployeeAttendanceSummary,
  autoCloseOrphanedSegments,
  // Simplified attendance (supervisor marking)
  getSimpleAttendance,
  getWorkerSimpleAttendance,
  markSimpleAttendance,
  bulkMarkSimpleAttendance,
  getWorkerWeeklyAttendanceSummary,
  getWorkerWeeklyAttendanceBySite,
  getDailySimpleAttendance,
  getSimpleAttendanceForDateRange,
} from './attendance-service';

// Payroll Service
export {
  getPayroll,
  getPayrollsForWeek,
  getEmployeePayrollHistory,
  generateEmployeePayroll,
  generateWeeklyPayroll,
  addBonus,
  addDeduction,
  updatePayrollStatus,
  markAsPaid,
  getWeeklyPayrollSummary,
} from './payroll-service';

// Advance Service
export {
  getAdvance,
  getPendingAdvances,
  getEmployeeAdvances,
  getAdvancesPaginated,
  createAdvanceRequest,
  approveAdvance,
  rejectAdvance,
  cancelAdvance,
  markAdvanceDeducted,
  getAdvancesForPayrollWeek,
  getAllPendingAdvances,
  getPendingAdvancesByWorkerIds,
  checkDuplicatePendingAdvance,
  updateAdvanceRequest,
  deleteAdvance,
} from './advance-service';

// Loan Service
export {
  getLoan,
  getPendingLoans,
  getActiveLoans,
  getEmployeeLoans,
  getEmployeeActiveLoan,
  getLoansPaginated,
  createLoanRequest,
  approveLoan,
  disburseLoan,
  rejectLoan,
  recordLoanPayment,
  getLoansDueForDeduction,
  getLoanStats,
  calculateLoanSchedule,
} from './loan-service';

// Audit Log Service
export {
  createAuditLog,
  getAuditLogs,
} from './audit-service';

// Settings Service
export {
  getCompanySettings,
  saveCompanySettings,
  getPayrollSettings,
  savePayrollSettings,
  getAttendanceSettings,
  saveAttendanceSettings,
  getNotificationSettings,
  saveNotificationSettings,
  getAllSettings,
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_PAYROLL_SETTINGS,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
} from './settings-service';
