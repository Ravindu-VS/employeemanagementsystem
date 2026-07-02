'use client';

import Link from 'next/link';
import { Building2, Clock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            EMS <span className="text-blue-400">Admin</span>
          </h1>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-8 w-8 text-amber-400 animate-pulse" />
            </div>
            <CardTitle className="text-xl text-white">Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-400">
              Your account is awaiting approval from an administrator. Once approved, you will be assigned a role and can access the dashboard.
            </p>

            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600/50">
              <div className="flex items-center justify-center gap-3 text-sm text-slate-300">
                <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
                <span>An Owner or CEO will review and approve your account.</span>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Link href={ROUTES.LOGIN}>
                <Button 
                  variant="outline" 
                  className="w-full border-slate-600 text-slate-200 hover:bg-slate-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </Link>
            </div>

            <p className="text-xs text-slate-500 pt-2">
              If you believe this is an error, please contact the system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
