// ==========================================
// ASSIGNMENT DAI - SUPABASE VERSION
// Uses PostgreSQL via Supabase instead of SQLite
// ==========================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const { supabase, createNotification, logAudit } = require('./supabase-db');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads Storage Config - Using Supabase Storage
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Serve Static Frontend Assets & Uploads
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDir));

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, institution, academic_level, country } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          full_name,
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          phone: phone || '',
          institution: institution || '',
          academic_level: academic_level || 'Undergraduate',
          country: country || ''
        }
      ])
      .select();

    if (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ success: false, message: 'Database error creating user.' });
    }

    const userId = data[0].id;
    const userPayload = { id: userId, email: email.toLowerCase(), full_name, role: 'client' };
    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: userPayload
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      institution: user.institution,
      academic_level: user.academic_level,
      country: user.country,
      avatar_url: user.avatar_url
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userPayload
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, institution, academic_level, country, preferred_communication, avatar_url, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching profile.' });
  }
});

// PUT /api/auth/profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, institution, academic_level, country, preferred_communication } = req.body;

    const { error } = await supabase
      .from('users')
      .update({
        full_name,
        phone,
        institution,
        academic_level,
        country,
        preferred_communication,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (error) {
      return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }

    return res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Error updating profile.' });
  }
});

// PUT /api/auth/settings
app.put('/api/auth/settings', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (new_password) {
      // Get current password hash
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', req.user.id)
        .single();

      if (fetchError || !user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(new_password, salt);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user.id);

      if (updateError) {
        return res.status(500).json({ success: false, message: 'Failed to update password.' });
      }

      return res.json({ success: true, message: 'Password changed successfully!' });
    }

    return res.json({ success: true, message: 'Settings saved successfully!' });
  } catch (error) {
    console.error('Settings error:', error);
    return res.status(500).json({ success: false, message: 'Error updating settings.' });
  }
});

// ==========================================
// 2. DASHBOARD OVERVIEW & STATS
// ==========================================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;

    // Use Promise.all for concurrent queries
    const [totalProjects, activeProjects, pendingPayment, completedProjects, revisionRequests, recentProjects, recentNotifications, unreadNotifications, recentFiles] = await Promise.all([
      supabase
        .from('projects')
        .select('count', { count: 'exact' })
        .eq('client_id', clientId),
      supabase
        .from('projects')
        .select('count', { count: 'exact' })
        .eq('client_id', clientId)
        .in('status', ['In Progress', 'Submitted', 'Expert Assigned', 'Submitted for Review', 'Revision Requested']),
      supabase
        .from('projects')
        .select('count', { count: 'exact' })
        .eq('client_id', clientId)
        .in('payment_status', ['Pending']),
      supabase
        .from('projects')
        .select('count', { count: 'exact' })
        .eq('client_id', clientId)
        .eq('status', 'Completed'),
      supabase
        .from('projects')
        .select('count', { count: 'exact' })
        .eq('client_id', clientId)
        .eq('status', 'Revision Requested'),
      supabase
        .from('projects')
        .select('*, experts!inner(full_name, avatar_url)')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(5),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('notifications')
        .select('count', { count: 'exact' })
        .eq('user_id', clientId)
        .eq('is_read', false),
      supabase
        .from('attachments')
        .select('*, projects(title)')
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    return res.json({
      success: true,
      stats: {
        total_projects: totalProjects.count || 0,
        active_projects: activeProjects.count || 0,
        pending_payment_count: pendingPayment.count || 0,
        completed_projects: completedProjects.count || 0,
        revision_requests: revisionRequests.count || 0,
        unread_notifications: unreadNotifications.count || 0
      },
      recent_projects: recentProjects.data || [],
      recent_notifications: recentNotifications.data || [],
      recent_files: recentFiles.data || []
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching dashboard stats.' });
  }
});

// ==========================================
// 3. PROJECTS MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/projects (Search, Filter, Sort, Pagination)
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, search, sort, page = 1, limit = 10 } = req.query;

    let query = supabase
      .from('projects')
      .select('*, experts(full_name, avatar_url, expertise)', { count: 'exact' })
      .eq('client_id', clientId);

    if (status && status !== 'All') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    if (sort === 'deadline_asc') {
      query = query.order('deadline', { ascending: true });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: projects, count, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      projects: projects || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Projects error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching projects.' });
  }
});

// POST /api/projects (Create New Project)
app.post('/api/projects', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const clientId = req.user.id;
    const {
      title, category, subject, academic_level, institution, project_type,
      description, requirements, word_count, page_count, citation_style,
      formatting, start_date, deadline, priority
    } = req.body;

    if (!title || !category || !subject || !deadline) {
      return res.status(400).json({ success: false, message: 'Title, category, subject, and deadline are required.' });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const projectId = `PRJ-${randomNum}`;

    const calculatedWordCount = parseInt(word_count) || 2500;
    const estPrice = Math.max(50, Math.round((calculatedWordCount / 250) * 15));

    // Create project
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert([
        {
          id: projectId,
          client_id: clientId,
          title,
          category,
          subject,
          academic_level: academic_level || 'Undergraduate',
          institution: institution || '',
          project_type: project_type || 'Essay',
          description: description || '',
          requirements: requirements || '',
          word_count: calculatedWordCount,
          page_count: parseInt(page_count) || Math.ceil(calculatedWordCount / 250),
          citation_style: citation_style || 'APA 7th',
          formatting: formatting || 'Standard 12pt',
          start_date: start_date || new Date().toISOString().split('T')[0],
          deadline,
          priority: priority || 'Medium',
          status: 'Submitted',
          progress_percent: 10,
          total_amount: estPrice,
          paid_amount: 0,
          payment_status: 'Pending',
          assigned_expert_id: 1
        }
      ])
      .select();

    if (projectError) throw projectError;

    // Add timeline entries
    await supabase.from('project_timeline').insert([
      {
        project_id: projectId,
        status: 'Submitted',
        title: 'Project Submitted',
        description: 'Client created project submission',
        responsible_party: 'Client'
      },
      {
        project_id: projectId,
        status: 'Reviewed',
        title: 'Requirements Under Review',
        description: 'Academic team assigned for verification',
        responsible_party: 'Support'
      }
    ]);

    // Add quote
    await supabase.from('quotes').insert([
      {
        project_id: projectId,
        estimated_price: estPrice,
        final_quote: estPrice,
        service_fee: 5.00,
        additional_charges: 0,
        discount: 10.00,
        total_amount: estPrice,
        payment_deadline: deadline,
        quote_expiry: deadline,
        status: 'Pending',
        notes: 'Initial quote generated automatically.'
      }
    ]);

    // Add invoice
    await supabase.from('payments').insert([
      {
        invoice_number: `INV-2026-${randomNum}`,
        project_id: projectId,
        client_id: clientId,
        amount: estPrice,
        tax: 0,
        discount: 10.00,
        final_amount: estPrice,
        status: 'Pending'
      }
    ]);

    // Create conversation
    await supabase.from('conversations').insert([
      {
        project_id: projectId,
        client_id: clientId,
        expert_id: 1
      }
    ]);

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(f => ({
        project_id: projectId,
        uploaded_by_id: clientId,
        uploaded_by_name: req.user.full_name || 'Client',
        category: 'Client Files',
        filename: f.filename,
        original_name: f.originalname,
        file_size: f.size,
        file_type: f.mimetype,
        file_path: `uploads/${f.filename}`
      }));
      await supabase.from('attachments').insert(attachments);
    }

    logAudit(projectId, clientId, 'PROJECT_CREATED', `Project ${projectId} created: ${title}`);
    createNotification(clientId, projectId, 'Project Created Successfully', `Your project ${projectId} has been created and is under review.`, 'project');

    return res.status(201).json({
      success: true,
      message: 'Project created successfully!',
      project_id: projectId
    });
  } catch (error) {
    console.error('Project creation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
});

// GET /api/projects/:id
app.get('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const clientId = req.user.id;

    const [project, timeline, quote, payment, attachments, revisions, review] = await Promise.all([
      supabase
        .from('projects')
        .select('*, experts(full_name, avatar_url, expertise, rating, experience_years, bio)')
        .eq('id', projectId)
        .eq('client_id', clientId)
        .single(),
      supabase
        .from('project_timeline')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: true }),
      supabase
        .from('quotes')
        .select('*')
        .eq('project_id', projectId)
        .single(),
      supabase
        .from('payments')
        .select('*')
        .eq('project_id', projectId)
        .single(),
      supabase
        .from('attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('revisions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('*')
        .eq('project_id', projectId)
        .single()
    ]);

    if (project.error || !project.data) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied.' });
    }

    return res.json({
      success: true,
      project: project.data,
      timeline: timeline.data || [],
      quote: quote.data || null,
      payment: payment.data || null,
      attachments: attachments.data || [],
      revisions: revisions.data || [],
      review: review.data || null
    });
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching project.' });
  }
});

// ==========================================
// SERVER STARTUP
// ==========================================

app.listen(PORT, () => {
  console.log(`✅ Supabase Server running on port ${PORT}`);
  console.log(`📊 Database: Supabase PostgreSQL`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
});

module.exports = app;
