/**
 * =====================================================
 * PAYSLIP PDF (KK & SONS branding)
 * =====================================================
 * Builds a one-page payslip from a STORED (approved/paid) payroll record.
 * It only prints the stored figures — it never recalculates pay.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants';
import type { WeeklyPayroll } from '@/types';

/** Standard PDF fonts are Latin-1 only, so printed text avoids Unicode dashes/minus signs. */
/** Standard PDF fonts are Latin-1 only, so printed text avoids Unicode dashes/minus signs. */
const lkr = (n: number | undefined) =>
  `LKR ${(Number(n) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** dd/MM/yyyy from a yyyy-MM-dd calendar string (no timezone conversion). */
const dmy = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '-');

type StoredPayroll = WeeklyPayroll;

export function buildPayslipPdf(p: StoredPayroll, options: { generatedAt?: Date } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  const W = doc.internal.pageSize.getWidth();
  const brand: [number, number, number] = [185, 28, 28]; // company red

  doc.setProperties({
    title: `Payslip ${p.employeeName} ${p.weekStartDate}`,
    author: COMPANY.NAME,
    creator: `${COMPANY.NAME} Workforce Management`,
    subject: 'Weekly payslip',
  });

  // Header
  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(COMPANY.NAME, 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Weekly Payslip', 14, 19);
  doc.text(`Week ${dmy(p.weekStartDate)} to ${dmy(p.weekEndDate)}`, W - 14, 19, { align: 'right' });

  // Employee block
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  const rows: Array<[string, string]> = [
    ['Employee', p.employeeName || '-'],
    ['Employee ID', String(p.workerId || p.employeeId || '-')],
    ['Role', String(p.employeeRole || '-')],
    ['Daily salary', lkr(p.dailyRate)],
    ['OT rate (daily ÷ 8)', `${lkr(p.otRate)} / hour`],
    ['Status', String(p.status || '').toUpperCase()],
  ];
  let y = 36;
  rows.forEach(([k, v], i) => {
    const x = i % 2 === 0 ? 14 : W / 2 + 4;
    if (i % 2 === 0 && i > 0) y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, x + 38, y);
  });

  // Site breakdown
  autoTable(doc, {
    startY: y + 8,
    head: [['Site / duty', 'Days / visits', 'OT hours', 'Normal pay', 'OT pay', 'Total']],
    body: (p.siteBreakdowns || []).map((s) => {
      const visits = (s as { visits?: number }).visits;
      return [
        s.siteName || s.siteId,
        visits ? `${visits} visits` : String(s.daysWorked ?? 0),
        String(s.otHours ?? 0),
        lkr(s.regularPay),
        lkr(s.otPay),
        lkr(s.totalPay),
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: brand, textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  // Earnings & deductions
  const advTotal = (p.advances || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const loanTotal = (p.loanDeductions || []).reduce((s, l) => s + (Number(l.emiAmount) || 0), 0);
  const ladder: Array<[string, string]> = [
    ['Normal earnings', lkr(p.regularEarnings)],
    ['OT earnings', lkr(p.overtimeEarnings)],
    [`Transport${p.transportBasis ? ` (${p.transportBasis})` : ''}`, lkr(p.transportAllowance)],
    ['Gross salary', lkr(p.totalEarnings)],
    ...(p.advances || []).map((a) => [`Less: advance ${a.description || ''} ${dmy((a as { date?: string }).date)}`.trim(), lkr(a.amount)] as [string, string]),
    ...(p.loanDeductions || []).map((l) => [`Less: loan instalment ${l.emiNumber}${l.totalEmis ? `/${l.totalEmis}` : ''} (balance after ${lkr(l.remainingAmount)})`, lkr(l.emiAmount)] as [string, string]),
    ['Total deductions', lkr(advTotal + loanTotal)],
  ];
  autoTable(doc, {
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6,
    body: ladder,
    theme: 'plain',
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === 3) data.cell.styles.fontStyle = 'bold';
    },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200) + 4;
  doc.setFillColor(254, 242, 242);
  doc.rect(14, finalY, W - 28, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...brand);
  doc.text('NET SALARY', 18, finalY + 8);
  doc.text(lkr(p.netPay), W - 18, finalY + 8, { align: 'right' });

  if ((p.advancesCarriedForward || []).length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const cf = p.advancesCarriedForward!.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    doc.text(`Advances carried forward to next week (not deducted): ${lkr(cf)}`, 14, finalY + 20);
  }

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a computer-generated payslip and does not require a signature.', 14, H - 16);
  doc.text(`Generated ${(options.generatedAt || new Date()).toISOString().slice(0, 10)} · ${COMPANY.COPYRIGHT}`, 14, H - 11);
  return doc;
}

export function downloadPayslip(p: WeeklyPayroll): void {
  const safe = (p.employeeName || 'employee').replace(/[^\w-]+/g, '_');
  buildPayslipPdf(p).save(`payslip_${safe}_${p.weekStartDate}.pdf`);
}
