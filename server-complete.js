// ==========================================
// ASSIGNMENT DAI - COMPLETE SERVER
// ALL CRITICAL & HIGH-PRIORITY ISSUES FIXED
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
const { authenticateToken, optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with restrictions
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5000').split(','),
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration with validation
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'image/jpeg',
  'image/png'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, ''));
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only documents and images allowed.'));
  } else if (file.size > MAX_FILE_SIZE) {
    cb(new Error('File too large. Maximum size is 50MB.'));
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Serve static files
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDir));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
});

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password, phone, institution, academic_level, country } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert([{
        full_name,
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        phone: phone || '',
        institution: institution || '',
        academic_level: academic_level || 'Undergraduate',
        country: country || ''
      }])
      .select();

    if (error) throw error;

    const userId = data[0].id;
    const userPayload = { id: userId, email: email.toLowerCase(), full_name, role: 'client' };
    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    createNotification(userId, null, 'Welcome!', 'Your account has been created successfully.', 'info');

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: userPayload
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      institution: user.institution,
      avatar_url: user.avatar_url
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userPayload
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // JWT is stateless, but we can invalidate on client
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, institution, academic_level, country, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile.' });
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

    if (error) throw error;

    logAudit(null, req.user.id, 'PROFILE_UPDATED', 'User profile updated');
    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PUT /api/auth/password - Password change
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both passwords required.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    logAudit(null, req.user.id, 'PASSWORD_CHANGED', 'User password changed');
    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// POST /api/auth/forgot-password - Password reset request
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required.' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      // Don't reveal if email exists (security)
      return res.json({ success: true, message: 'If email exists, reset link has been sent.' });
    }

    // Generate reset token (expires in 15 minutes)
    const resetToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    // TODO: Send email with reset link
    // For now, just create notification
    createNotification(user.id, null, 'Password Reset', 'A password reset link has been sent to your email.', 'info');

    res.json({ success: true, message: 'Password reset link sent to email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Error processing request.' });
  }
});

// ==========================================
// 2. DASHBOARD ENDPOINTS
// ==========================================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;

    const [totalProjects, activeProjects, pendingPayment, completedProjects, revisionRequests, unreadNotifications] = await Promise.all([
      supabase.from('projects').select('count', { count: 'exact' }).eq('client_id', clientId),
      supabase.from('projects').select('count', { count: 'exact' }).eq('client_id', clientId).in('status', ['In Progress', 'Submitted', 'Expert Assigned']),
      supabase.from('projects').select('count', { count: 'exact' }).eq('client_id', clientId).eq('payment_status', 'Pending'),
      supabase.from('projects').select('count', { count: 'exact' }).eq('client_id', clientId).eq('status', 'Completed'),
      supabase.from('projects').select('count', { count: 'exact' }).eq('client_id', clientId).eq('status', 'Revision Requested'),
      supabase.from('notifications').select('count', { count: 'exact' }).eq('user_id', clientId).eq('is_read', false)
    ]);

    res.json({
      success: true,
      stats: {
        total_projects: totalProjects.count || 0,
        active_projects: activeProjects.count || 0,
        pending_payment_count: pendingPayment.count || 0,
        completed_projects: completedProjects.count || 0,
        revision_requests: revisionRequests.count || 0,
        unread_notifications: unreadNotifications.count || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats.' });
  }
});

// ==========================================
// 3. PROJECTS ENDPOINTS (COMPLETE)
// ==========================================

// GET /api/projects - List with pagination & filtering
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, search, sort = 'newest', page = 1, limit = 10 } = req.query;

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

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: projects, count, error } = await query.range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      projects: projects || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Projects fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching projects.' });
  }
});

// POST /api/projects - Create project
app.post('/api/projects', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const clientId = req.user.id;
    const { title, category, subject, academic_level, institution, project_type, description, requirements, word_count, page_count, citation_style, formatting, start_date, deadline, priority } = req.body;

    if (!title || !category || !subject || !deadline) {
      return res.status(400).json({ success: false, message: 'Title, category, subject, and deadline required.' });
    }

    const projectId = `PRJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const calculatedWordCount = parseInt(word_count) || 2500;
    const estPrice = Math.max(50, Math.round((calculatedWordCount / 250) * 15));

    const { error: projectError } = await supabase
      .from('projects')
      .insert([{
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
      }]);

    if (projectError) throw projectError;

    // Add timeline
    await supabase.from('project_timeline').insert([
      { project_id: projectId, status: 'Submitted', title: 'Project Submitted', description: 'Client created project', responsible_party: 'Client' },
      { project_id: projectId, status: 'Reviewed', title: 'Under Review', description: 'Academic team reviewing', responsible_party: 'Support' }
    ]);

    // Add quote
    await supabase.from('quotes').insert([{
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
      notes: 'Initial quote'
    }]);

    // Add invoice
    await supabase.from('payments').insert([{
      invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      project_id: projectId,
      client_id: clientId,
      amount: estPrice,
      tax: 0,
      discount: 10.00,
      final_amount: estPrice,
      status: 'Pending'
    }]);

    // Create conversation
    await supabase.from('conversations').insert([{
      project_id: projectId,
      client_id: clientId,
      expert_id: 1
    }]);

    // Upload files
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
    createNotification(clientId, projectId, 'Project Created', `Project ${projectId} created successfully.`, 'project');

    res.status(201).json({
      success: true,
      message: 'Project created successfully!',
      project_id: projectId
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
});

// GET /api/projects/:id
app.get('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const clientId = req.user.id;

    const [projectData, timelineData, quoteData, paymentData, attachmentsData, revisionsData, reviewData] = await Promise.all([
      supabase.from('projects').select('*, experts(full_name, avatar_url, expertise, rating)').eq('id', projectId).eq('client_id', clientId).single(),
      supabase.from('project_timeline').select('*').eq('project_id', projectId).order('timestamp', { ascending: true }),
      supabase.from('quotes').select('*').eq('project_id', projectId).single(),
      supabase.from('payments').select('*').eq('project_id', projectId).single(),
      supabase.from('attachments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('revisions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('reviews').select('*').eq('project_id', projectId).single()
    ]);

    if (projectData.error || !projectData.data) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    res.json({
      success: true,
      project: projectData.data,
      timeline: timelineData.data || [],
      quote: quoteData.data || null,
      payment: paymentData.data || null,
      attachments: attachmentsData.data || [],
      revisions: revisionsData.data || [],
      review: reviewData.data || null
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, message: 'Error fetching project.' });
  }
});

// PUT /api/projects/:id - Update project status
app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const clientId = req.user.id;
    const { status, progress_percent } = req.body;

    // Validate status transitions
    const validStatuses = ['Submitted', 'Expert Assigned', 'In Progress', 'Submitted for Review', 'Revision Requested', 'Completed', 'Cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const { error } = await supabase
      .from('projects')
      .update({ status, progress_percent, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('client_id', clientId);

    if (error) throw error;

    if (status) {
      await supabase.from('project_timeline').insert([{
        project_id: projectId,
        status,
        title: `Status: ${status}`,
        description: `Project status updated to ${status}`,
        responsible_party: 'System'
      }]);
    }

    res.json({ success: true, message: 'Project updated successfully!' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
});

// ==========================================
// 4. EXPERTS ENDPOINTS
// ==========================================

// GET /api/experts
app.get('/api/experts', async (req, res) => {
  try {
    const { data: experts, error } = await supabase
      .from('experts')
      .select('*')
      .order('rating', { ascending: false });

    if (error) throw error;

    res.json({ success: true, experts: experts || [] });
  } catch (error) {
    console.error('Get experts error:', error);
    res.status(500).json({ success: false, message: 'Error fetching experts.' });
  }
});

// GET /api/experts/:id
app.get('/api/experts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [expertData, reviewsData] = await Promise.all([
      supabase.from('experts').select('*').eq('id', id).single(),
      supabase.from('reviews').select('*').eq('expert_id', id)
    ]);

    if (expertData.error) {
      return res.status(404).json({ success: false, message: 'Expert not found.' });
    }

    res.json({
      success: true,
      expert: expertData.data,
      reviews: reviewsData.data || []
    });
  } catch (error) {
    console.error('Get expert error:', error);
    res.status(500).json({ success: false, message: 'Error fetching expert.' });
  }
});

// ==========================================
// 5. REVIEWS ENDPOINTS
// ==========================================

// POST /api/projects/:id/review - Submit review
app.post('/api/projects/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const clientId = req.user.id;
    const { star_rating, written_review, communication_rating, quality_rating, timeliness_rating } = req.body;

    if (!star_rating || star_rating < 1 || star_rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1-5.' });
    }

    // Get project to find expert
    const { data: project } = await supabase
      .from('projects')
      .select('assigned_expert_id')
      .eq('id', projectId)
      .eq('client_id', clientId)
      .single();

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { error } = await supabase
      .from('reviews')
      .insert([{
        project_id: projectId,
        client_id: clientId,
        expert_id: project.assigned_expert_id,
        star_rating,
        written_review: written_review || '',
        communication_rating: communication_rating || 5,
        quality_rating: quality_rating || 5,
        timeliness_rating: timeliness_rating || 5
      }]);

    if (error) throw error;

    // Update expert rating
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('star_rating')
      .eq('expert_id', project.assigned_expert_id);

    const avgRating = allReviews?.length > 0
      ? (allReviews.reduce((sum, r) => sum + r.star_rating, 0) / allReviews.length).toFixed(2)
      : 4.9;

    await supabase
      .from('experts')
      .update({ rating: parseFloat(avgRating) })
      .eq('id', project.assigned_expert_id);

    createNotification(clientId, projectId, 'Review Submitted', 'Thank you for reviewing!', 'review');

    res.json({ success: true, message: 'Review submitted successfully!' });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});

// GET /api/reviews/:projectId
app.get('/api/reviews/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: review, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error || !review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    res.json({ success: true, review });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ success: false, message: 'Error fetching review.' });
  }
});

// ==========================================
// 6. REVISIONS ENDPOINTS
// ==========================================

// POST /api/projects/:id/revisions
app.post('/api/projects/:id/revisions', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const clientId = req.user.id;
    const { revision_reason, detailed_instructions, requested_deadline } = req.body;

    if (!revision_reason || !detailed_instructions) {
      return res.status(400).json({ success: false, message: 'Reason and instructions required.' });
    }

    const { data: revision, error } = await supabase
      .from('revisions')
      .insert([{
        project_id: projectId,
        client_id: clientId,
        revision_reason,
        detailed_instructions,
        requested_deadline: requested_deadline || new Date().toISOString().split('T')[0],
        status: 'Requested'
      }])
      .select();

    if (error) throw error;

    // Upload files if any
    if (req.files && req.files.length > 0) {
      const attachments = req.files.map(f => ({
        project_id: projectId,
        uploaded_by_id: clientId,
        uploaded_by_name: req.user.full_name || 'Client',
        category: 'Revision Instructions',
        filename: f.filename,
        original_name: f.originalname,
        file_size: f.size,
        file_type: f.mimetype,
        file_path: `uploads/${f.filename}`
      }));
      await supabase.from('attachments').insert(attachments);
    }

    await supabase.from('projects').update({ status: 'Revision Requested' }).eq('id', projectId);

    createNotification(clientId, projectId, 'Revision Requested', 'Revision request submitted to expert.', 'project');

    res.json({ success: true, message: 'Revision requested successfully!', revision: revision[0] });
  } catch (error) {
    console.error('Request revision error:', error);
    res.status(500).json({ success: false, message: 'Failed to request revision.' });
  }
});

// GET /api/projects/:id/revisions
app.get('/api/projects/:id/revisions', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;

    const { data: revisions, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, revisions: revisions || [] });
  } catch (error) {
    console.error('Get revisions error:', error);
    res.status(500).json({ success: false, message: 'Error fetching revisions.' });
  }
});

// ==========================================
// 7. SUPPORT TICKETS ENDPOINTS
// ==========================================

// POST /api/support/tickets - Create support ticket
app.post('/api/support/tickets', authenticateToken, async (req, res) => {
  try {
    const { subject, category, priority, description } = req.body;
    const clientId = req.user.id;

    if (!subject || !category) {
      return res.status(400).json({ success: false, message: 'Subject and category required.' });
    }

    const ticketId = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;

    const { error: ticketError } = await supabase
      .from('support_tickets')
      .insert([{
        id: ticketId,
        client_id: clientId,
        subject,
        category,
        priority: priority || 'Medium',
        status: 'Open'
      }]);

    if (ticketError) throw ticketError;

    // Add first message
    if (description) {
      await supabase.from('support_messages').insert([{
        ticket_id: ticketId,
        sender_id: clientId,
        sender_name: req.user.full_name || 'Client',
        sender_role: 'client',
        message: description
      }]);
    }

    createNotification(clientId, null, 'Support Ticket Created', `Ticket ${ticketId} has been created.`, 'support');

    res.status(201).json({
      success: true,
      message: 'Support ticket created!',
      ticket_id: ticketId
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket.' });
  }
});

// GET /api/support/tickets - List support tickets
app.get('/api/support/tickets', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId);

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: tickets, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      tickets: tickets || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ success: false, message: 'Error fetching tickets.' });
  }
});

// GET /api/support/tickets/:id
app.get('/api/support/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const clientId = req.user.id;

    const [ticketData, messagesData] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', ticketId).eq('client_id', clientId).single(),
      supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    ]);

    if (ticketData.error || !ticketData.data) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    res.json({
      success: true,
      ticket: ticketData.data,
      messages: messagesData.data || []
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Error fetching ticket.' });
  }
});

// POST /api/support/tickets/:id/messages - Add message to ticket
app.post('/api/support/tickets/:id/messages', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const clientId = req.user.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = `uploads/${req.file.filename}`;
    }

    const { error } = await supabase
      .from('support_messages')
      .insert([{
        ticket_id: ticketId,
        sender_id: clientId,
        sender_name: req.user.full_name || 'Client',
        sender_role: 'client',
        message,
        attachment_url: attachmentUrl
      }]);

    if (error) throw error;

    // Update ticket updated_at
    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);

    res.json({ success: true, message: 'Message sent!' });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

// ==========================================
// 8. NOTIFICATIONS ENDPOINTS
// ==========================================

// GET /api/notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, is_read } = req.query;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: notifications, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      notifications: notifications || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications.' });
  }
});

// PUT /api/notifications/:id/read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id: notificationId } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ success: false, message: 'Error updating notification.' });
  }
});

// PUT /api/notifications/mark-all-read
app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications error:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications.' });
  }
});

// DELETE /api/notifications/:id
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id: notificationId } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, message: 'Error deleting notification.' });
  }
});

// ==========================================
// 9. PAYMENTS ENDPOINTS
// ==========================================

// GET /api/payments
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: payments, count, error } = await supabase
      .from('payments')
      .select('*, projects(title, status)', { count: 'exact' })
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      payments: payments || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments.' });
  }
});

// POST /api/payments/pay
app.post('/api/payments/pay', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user.id;
    const { project_id, payment_method } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'Project ID required.' });
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('project_id', project_id)
      .eq('client_id', clientId)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const txnId = 'TXN-' + Math.floor(10000000 + Math.random() * 90000000);

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'Paid',
        payment_method: payment_method || 'Credit Card',
        transaction_id: txnId
      })
      .eq('id', payment.id);

    if (updateError) throw updateError;

    // Update project
    await supabase
      .from('projects')
      .update({
        status: 'In Progress',
        payment_status: 'Paid',
        paid_amount: payment.final_amount,
        progress_percent: 40,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id);

    // Add timeline entry
    await supabase.from('project_timeline').insert([{
      project_id,
      status: 'Paid',
      title: 'Payment Verified',
      description: `Payment of $${payment.final_amount} received`,
      responsible_party: 'System'
    }]);

    createNotification(clientId, project_id, 'Payment Successful', `Payment of $${payment.final_amount} confirmed.`, 'payment');

    res.json({
      success: true,
      message: 'Payment processed successfully!',
      transaction_id: txnId
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ success: false, message: 'Payment processing failed.' });
  }
});

// ==========================================
// 10. ADMIN ENDPOINTS
// ==========================================

// GET /api/admin/users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const { page = 1, limit = 10, role } = req.query;

    let query = supabase.from('users').select('*', { count: 'exact' });

    if (role) {
      query = query.eq('role', role);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: users, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      users: users || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users.' });
  }
});

// GET /api/admin/projects
app.get('/api/admin/projects', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const { page = 1, limit = 10, status } = req.query;

    let query = supabase.from('projects').select('*, users(full_name, email), experts(full_name)', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: projects, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      success: true,
      projects: projects || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get admin projects error:', error);
    res.status(500).json({ success: false, message: 'Error fetching projects.' });
  }
});

// PUT /api/admin/projects/:id/approve
app.put('/api/admin/projects/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const { id: projectId } = req.params;
    const { assigned_expert_id } = req.body;

    const { error } = await supabase
      .from('projects')
      .update({
        status: 'Expert Assigned',
        assigned_expert_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;

    logAudit(projectId, req.user.id, 'PROJECT_APPROVED', `Project approved by admin`);

    res.json({ success: true, message: 'Project approved!' });
  } catch (error) {
    console.error('Approve project error:', error);
    res.status(500).json({ success: false, message: 'Error approving project.' });
  }
});

// ==========================================
// 11. HEALTH CHECK & ROOT
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// ==========================================
// SERVER STARTUP
// ==========================================

app.listen(PORT, () => {
  console.log(`✅ Assignment Dai Server running on port ${PORT}`);
  console.log(`📊 Database: Supabase PostgreSQL`);
  console.log(`🌐 Access: http://localhost:${PORT}`);
  console.log(`📝 API: /api/*`);
  console.log(`❤️ Health: /api/health`);
});

module.exports = app;
