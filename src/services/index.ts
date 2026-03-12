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
  deactivateEmployee,
  reactivateEmployee,
  searchEmployees,
  updateEmployeeRates,
  generateWorkerId,
} from './employee-service';

// Site Service
export {
  getSite,
  getAllSites,
  getActiveSites,
  createSite,
  updateSite,
  updateSiteStatus,
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
  getDailySimpleAttendance,
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
  getUndeductedAdvances,
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
