"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Mail, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { resetPassword } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ROUTES, APP_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Forgot password form validation schema
 */
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Forgot Password Page Component
 */
export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEmailSent, setIsEmailSent] = React.useState(false);

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    
    try {
      await resetPassword(data.email);
      setIsEmailSent(true);
      toast({
        title: "Email Sent",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset email. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md px-4">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {APP_CONFIG.shortName} <span className="text-blue-400">Admin</span>
          </h1>
        </div>

        {/* Forgot Password Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-2xl">
          {!isEmailSent ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl text-white">
                  Forgot Password
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your email address and we'll send you a link to reset your password.
                </CardDescription>
              </CardHeader>
              
              <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-200">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@company.com"
                        className={cn(
                          "pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500",
                          "focus:border-blue-500 focus:ring-blue-500/20",
                          errors.email && "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        )}
                        disabled={isLoading}
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    loading={isLoading}
                  >
                    Send Reset Link
                  </Button>
                  
                  <Link
                    href={ROUTES.LOGIN}
                    className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Link>
                </CardFooter>
              </form>
            </>
          ) : (
            /* Success State */
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-slate-400 text-sm">
                    We've sent a password reset link to:
                  </p>
                  <p className="text-white font-medium mt-1">
                    {getValues("email")}
                  </p>
                </div>
                <p className="text-slate-500 text-xs">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    type="button"
                    onClick={() => setIsEmailSent(false)}
                    className="text-blue-400 hover:underline"
                  >
                    try again
                  </button>
                </p>
                <Link
                  href={ROUTES.LOGIN}
                  className="inline-flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mt-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          © {new Date().getFullYear()} {APP_CONFIG.company}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
