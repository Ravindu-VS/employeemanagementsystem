'use client';

/**
 * =====================================================
 * PAYROLL SUMMARY
 * =====================================================
 * Displays grand payroll totals and site-wise breakdown with collapsible worker details.
 */

import { useState } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import type { SiteWorkerSummary } from '@/domain/payroll/site-workers';

interface SiteTotal {
  siteId: string;
  siteName: string;
  totalDays: number;
  totalOtHours: number;
  totalPayroll: number;
}

interface PayrollSummaryProps {
  totalWorkers: number;
  totalDays: number;
  totalOtHours: number;
  grossPayroll: number;
  advanceDeductions: number;
  finalPayroll: number;
  siteTotals: SiteTotal[];
  siteWorkerSummaries?: SiteWorkerSummary[]; // Optional: if provided, shows worker details under each site
}

export function PayrollSummary({
  totalWorkers,
  totalDays,
  totalOtHours,
  grossPayroll,
  advanceDeductions,
  finalPayroll,
  siteTotals,
  siteWorkerSummaries,
}: PayrollSummaryProps) {
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  const toggleSiteExpanded = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Payroll Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grand totals grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{totalWorkers}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Workers</p>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold">{totalDays.toFixed(1)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Days</p>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-500">{totalOtHours.toFixed(1)}h</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Total OT</p>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500">{formatCurrency(grossPayroll)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Gross</p>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-400">{formatCurrency(advanceDeductions)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Advance</p>
          </div>
          <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-400">{formatCurrency(0)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Loan</p>
          </div>
          <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-500">{formatCurrency(finalPayroll)}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Final</p>
          </div>
        </div>

        {/* Site breakdown table/cards */}
        {siteTotals.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Site Wise Breakdown
            </p>

            {/* Enhanced view with worker details if available */}
            {siteWorkerSummaries && siteWorkerSummaries.length > 0 ? (
              <div className="space-y-3">
                {siteWorkerSummaries.map((site) => {
                  const isExpanded = expandedSites.has(site.siteId);
                  return (
                    <div key={site.siteId} className="rounded-lg border border-border/50 overflow-hidden">
                      {/* Clickable Site header with dropdown icon */}
                      <button
                        type="button"
                        onClick={() => toggleSiteExpanded(site.siteId)}
                        className="w-full px-3 py-2.5 bg-muted/30 hover:bg-muted/40 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">{site.siteName}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({site.workers.length} {site.workers.length === 1 ? 'worker' : 'workers'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-green-500">
                            {formatCurrency(site.totalSalary)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expandable Workers section */}
                      {isExpanded && site.workers.length > 0 && (
                        <div className="divide-y divide-border/30">
                          {site.workers.map((worker) => (
                            <div key={worker.workerId} className="px-3 py-2.5 text-sm hover:bg-muted/5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 flex items-center gap-2">
                                  <span className="font-medium text-foreground">{worker.workerName}</span>
                                  {worker.role && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground capitalize">
                                      {worker.role}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-right">
                                  <span className="text-muted-foreground text-xs min-w-16">
                                    {worker.daysWorked.toFixed(1)} days
                                  </span>
                                  <span className="font-semibold text-foreground min-w-28">
                                    {formatCurrency(worker.totalSalary)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Site total row */}
                      {isExpanded && (
                        <div className="bg-muted/20 px-3 py-2 text-xs font-medium border-t border-border/30">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Site Total</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">
                                {site.totalDays.toFixed(1)} days
                              </span>
                              <span className="text-green-500 font-semibold min-w-28">
                                {formatCurrency(site.totalSalary)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback to original table view if no worker details available */
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="p-2.5 text-left font-medium text-muted-foreground">Site</th>
                      <th className="p-2.5 text-center font-medium text-muted-foreground">Workers</th>
                      <th className="p-2.5 text-center font-medium text-muted-foreground">Days</th>
                      <th className="p-2.5 text-center font-medium text-muted-foreground">OT Hours</th>
                      <th className="p-2.5 text-right font-medium text-muted-foreground">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteTotals.map((st) => (
                      <tr key={st.siteId} className="border-t border-border/30 hover:bg-muted/10">
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{st.siteName}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">-</td>
                        <td className="p-2.5 text-center">{st.totalDays.toFixed(1)}</td>
                        <td className="p-2.5 text-center">
                          {st.totalOtHours > 0 ? (
                            <span className="text-orange-500 font-medium">{st.totalOtHours.toFixed(1)}h</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-green-500">
                          {formatCurrency(st.totalPayroll)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {siteTotals.length > 1 && (
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30 font-bold">
                        <td className="p-2.5">Total</td>
                        <td className="p-2.5 text-center">-</td>
                        <td className="p-2.5 text-center">{siteTotals.reduce((sum, s) => sum + s.totalDays, 0).toFixed(1)}</td>
                        <td className="p-2.5 text-center text-orange-500">{siteTotals.reduce((sum, s) => sum + s.totalOtHours, 0).toFixed(1)}h</td>
                        <td className="p-2.5 text-right text-blue-500">
                          {formatCurrency(siteTotals.reduce((sum, s) => sum + s.totalPayroll, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
