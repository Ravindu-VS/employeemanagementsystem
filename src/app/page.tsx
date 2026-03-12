import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  Clock, 
  DollarSign, 
  MapPin, 
  Shield,
  ArrowRight,
  UserPlus,
  LogIn
} from "lucide-react";

// Feature cards data
const features = [
  {
    icon: Users,
    title: "Employee Management",
    description: "Manage all employees, roles, and departments from one central dashboard.",
  },
  {
    icon: Clock,
    title: "Attendance Tracking",
    description: "GPS-based attendance with segment tracking for multiple work sites.",
  },
  {
    icon: DollarSign,
    title: "Payroll Processing",
    description: "Automated weekly payroll with OT, advances, and loan deductions.",
  },
  {
    icon: MapPin,
    title: "Site Management",
    description: "Track work sites, geofencing, and employee location verification.",
  },
  {
    icon: Building2,
    title: "Multi-Site Support",
    description: "Handle multiple construction sites with independent tracking.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure access control for owners, managers, and supervisors.",
  },
];

// Role cards for signup info
const roles = [
  { name: "Owner/CEO", description: "Full system access", color: "from-purple-500 to-purple-600" },
  { name: "Manager", description: "Manage employees & payroll", color: "from-blue-500 to-blue-600" },
  { name: "Supervisor", description: "Track attendance & sites", color: "from-green-500 to-green-600" },
  { name: "Field Workers", description: "Mark attendance", color: "from-orange-500 to-orange-600" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                EMS<span className="text-blue-400">Admin</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-200 hover:bg-slate-800">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-400 text-sm font-medium">
              Welcome to Employee Management System
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Manage Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">
              Workforce
            </span>
            <br />
            <span className="text-3xl md:text-5xl">Effortlessly</span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Complete workforce management solution for construction companies. 
            Track attendance, manage payroll, and streamline operations from a single dashboard.
          </p>
          
          {/* CTA Buttons - Prominent Sign In / Sign Up */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-w-[200px] h-14 text-lg">
                <UserPlus className="mr-2 h-5 w-5" />
                Create Account
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 w-full sm:w-auto min-w-[200px] h-14 text-lg">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </Link>
          </div>

          <p className="text-slate-500 text-sm">
            New user? Sign up and select your role to get started
          </p>
        </div>
      </section>

      {/* Roles Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Roles Available
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Choose your role when you sign up
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {roles.map((role, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm text-center hover:bg-slate-800 transition-all"
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${role.color} flex items-center justify-center mx-auto mb-3`}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-1">{role.name}</h3>
              <p className="text-slate-400 text-xs">{role.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              Get Started - Sign Up Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16 border-t border-slate-700/30">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Comprehensive Management Features
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Everything you need to manage your workforce effectively
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm hover:bg-slate-800 hover:border-slate-600 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-blue-600/30 transition-all">
                <feature.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { value: "500+", label: "Employees" },
            { value: "50+", label: "Work Sites" },
            { value: "99.9%", label: "Uptime" },
            { value: "24/7", label: "Support" },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center p-8 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-slate-300 mb-6">
            Join now and start managing your workforce more efficiently
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 w-full sm:w-auto">
                <UserPlus className="mr-2 h-5 w-5" />
                Create Free Account
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-400 text-sm">
                © 2025 Employee Management System
              </span>
            </div>
            <div className="flex gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
