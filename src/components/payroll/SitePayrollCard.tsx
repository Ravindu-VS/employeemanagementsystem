'use client';

/**
 * =====================================================
 * SITE PAYROLL CARD
 * =====================================================
 * Individual site summary card showing worker count,
 * days worked, OT hours, and total payroll for that site.
 */

import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface SitePayrollCardProps {
  siteId: string;
  siteName: string;
  workerCount: number;
  totalDays: number;
  totalOtHours: number;
  totalPayroll: number;
}

export function SitePayrollCard({
  siteId,
  siteName,
  workerCount,
  totalDays,
  totalOtHours,
  totalPayroll,
}: SitePayrollCardProps) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">{siteName}</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Workers</p>
              <p className="font-semibold">{workerCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Days</p>
              <p className="font-semibold">{totalDays.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">OT Hours</p>
              <p className="font-semibold text-orange-500">
                {totalOtHours > 0 ? `${totalOtHours.toFixed(1)}h` : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Salary</p>
              <p className="font-bold text-green-500">{formatCurrency(totalPayroll)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
