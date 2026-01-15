-- Add more positions to the database
INSERT INTO public.positions (name, department, color) VALUES
-- Creative Department
('Motion Grapher', 'Creative', '#a855f7'),
('3D Artist', 'Creative', '#d946ef'),
('Illustrator', 'Creative', '#f472b6'),
('Art Director', 'Creative', '#be185d'),
('Creative Director', 'Creative', '#9333ea'),
('Content Creator', 'Creative', '#c026d3'),
('Animator', 'Creative', '#7c3aed'),

-- Social Media & Digital
('Social Media Specialist', 'Social Media', '#facc15'),
('Social Media Manager', 'Social Media', '#fbbf24'),
('Community Manager', 'Social Media', '#f59e0b'),
('Digital Marketing Specialist', 'Social Media', '#d97706'),
('Content Strategist', 'Social Media', '#b45309'),
('Influencer Manager', 'Social Media', '#92400e'),
('KOL Specialist', 'Social Media', '#78350f'),

-- Marketing
('Brand Manager', 'Marketing', '#fb923c'),
('Marketing Manager', 'Marketing', '#ea580c'),
('Campaign Manager', 'Marketing', '#c2410c'),
('Marketing Coordinator', 'Marketing', '#9a3412'),
('PR Specialist', 'Marketing', '#7c2d12'),

-- Production
('Producer', 'Production', '#f87171'),
('Production Manager', 'Production', '#dc2626'),
('Production Coordinator', 'Production', '#b91c1c'),
('Campers', 'Production', '#991b1b'),
('Sound Engineer', 'Production', '#7f1d1d'),
('Lighting Technician', 'Production', '#450a0a'),
('Talent Coordinator', 'Production', '#fca5a5'),

-- Operations
('Operations Manager', 'Operations', '#2dd4bf'),
('Operations Coordinator', 'Operations', '#14b8a6'),
('Office Manager', 'Operations', '#0f766e'),
('Admin', 'Operations', '#115e59'),
('General Affairs', 'Operations', '#134e4a'),

-- IT & Tech
('IT Support', 'IT', '#38bdf8'),
('Web Developer', 'IT', '#0284c7'),
('Software Engineer', 'IT', '#0369a1'),
('UI/UX Designer', 'IT', '#075985'),
('Data Analyst', 'IT', '#0c4a6e'),
('System Administrator', 'IT', '#082f49'),

-- Finance
('Finance Manager', 'Finance', '#34d399'),
('Accountant', 'Finance', '#10b981'),
('Finance Coordinator', 'Finance', '#059669'),
('Tax Specialist', 'Finance', '#047857'),

-- Human Resources
('HR Manager', 'Human Resources', '#60a5fa'),
('HR Coordinator', 'Human Resources', '#3b82f6'),
('Recruiter', 'Human Resources', '#2563eb'),
('Training Specialist', 'Human Resources', '#1d4ed8'),
('People Operations', 'Human Resources', '#1e40af'),

-- Sales & BD
('Sales Manager', 'Sales', '#2dd4bf'),
('Account Executive', 'Sales', '#14b8a6'),
('Business Development', 'Sales', '#0d9488'),
('Sales Coordinator', 'Sales', '#0f766e'),
('Key Account Manager', 'Sales', '#115e59'),

-- Client Services
('Account Manager', 'Client Services', '#a78bfa'),
('Client Services Manager', 'Client Services', '#8b5cf6'),
('Client Coordinator', 'Client Services', '#7c3aed'),

-- Executive
('CEO', 'Executive', '#6366f1'),
('COO', 'Executive', '#4f46e5'),
('CFO', 'Executive', '#4338ca'),
('CMO', 'Executive', '#3730a3'),
('Managing Director', 'Executive', '#312e81'),

-- Intern
('Intern', 'Intern', '#94a3b8'),
('Creative Intern', 'Intern', '#64748b'),
('Marketing Intern', 'Intern', '#475569'),
('Social Media Intern', 'Intern', '#334155')

ON CONFLICT (name) DO NOTHING;