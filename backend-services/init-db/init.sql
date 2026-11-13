-- Initialize Database Tables for KK & SONS Workforce Management Platform

-- Role table (application RBAC roles)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Seed basic roles
INSERT INTO roles (name) VALUES 
('owner'), 
('ceo'), 
('manager'), 
('supervisor'), 
('draughtsman'), 
('bass'), 
('helper'), 
('driver')
ON CONFLICT (name) DO NOTHING;

-- Employee Profile table
CREATE TABLE IF NOT EXISTS employees (
    uid VARCHAR(128) PRIMARY KEY,
    worker_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    phone VARCHAR(30),
    address TEXT,
    daily_rate NUMERIC(10, 2) DEFAULT 0.00,
    joining_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    bank_name VARCHAR(100),
    account_number VARCHAR(100),
    account_holder VARCHAR(100),
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(30),
    
    -- Transport Settings
    transport_type VARCHAR(50) DEFAULT 'none',
    pickup_location VARCHAR(100),
    drop_location VARCHAR(100),
    distance NUMERIC(5, 2) DEFAULT 0.00,
    transport_rate NUMERIC(10, 2) DEFAULT 0.00,
    transport_rate_type VARCHAR(50) DEFAULT 'per_day'
);

-- Site details table
CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    client VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, completed, archived
    geofence_lat NUMERIC(9, 6),
    geofence_lng NUMERIC(9, 6),
    geofence_radius NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(128) REFERENCES employees(uid) ON DELETE CASCADE,
    site_id VARCHAR(100) REFERENCES sites(id),
    date DATE NOT NULL,
    present BOOLEAN DEFAULT TRUE,
    morning_present BOOLEAN DEFAULT TRUE,
    evening_present BOOLEAN DEFAULT TRUE,
    ot_hours NUMERIC(4, 2) DEFAULT 0.00,
    morning_ot_hours NUMERIC(4, 2) DEFAULT 0.00,
    evening_ot_hours NUMERIC(4, 2) DEFAULT 0.00,
    verified BOOLEAN DEFAULT FALSE,
    UNIQUE(worker_id, date)
);

-- Active Loans
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(100) PRIMARY KEY,
    employee_id VARCHAR(128) REFERENCES employees(uid) ON DELETE CASCADE,
    principal_amount NUMERIC(12, 2) NOT NULL,
    remaining_amount NUMERIC(12, 2) NOT NULL,
    emi_amount NUMERIC(10, 2) NOT NULL,
    total_emis INT NOT NULL,
    paid_emis INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' -- active, paid, default
);

-- Salary Advances
CREATE TABLE IF NOT EXISTS advances (
    id VARCHAR(100) PRIMARY KEY,
    employee_id VARCHAR(128) REFERENCES employees(uid) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, paid, carried_forward
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Payroll Aggregations
CREATE TABLE IF NOT EXISTS payroll (
    id VARCHAR(100) PRIMARY KEY,
    employee_id VARCHAR(128) REFERENCES employees(uid) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    days_worked NUMERIC(4, 2) DEFAULT 0.00,
    ot_hours NUMERIC(5, 2) DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) DEFAULT 0.00,
    advance_deductions NUMERIC(10, 2) DEFAULT 0.00,
    loan_deductions NUMERIC(10, 2) DEFAULT 0.00,
    transport_allowance NUMERIC(10, 2) DEFAULT 0.00,
    net_pay NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid, approved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
