/**
 * Payroll domain public API.
 *  - rates.ts  : OT rate (daily ÷ 8), salary-history lookup
 *  - engine.ts : the single authoritative payroll calculation
 */
export * from './rates';
export * from './engine';
