const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const db = require('./db');
const { authenticateToken, optionalAuth, requireAdmin, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads Storage Config
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

// Helper: Record Audit Log
function logAudit(projectId, userId, action, description) {
  db.run(
    'INSERT INTO audit_logs (project_id, user_id, action, description) VALUES (?, ?, ?, ?)',
    [projectId, userId, action, description]
  );
}

// Helper: Add Notification
function createNotification(userId, projectId, title, message, type = 'info') {
  db.run(
    'INSERT INTO notifications (user_id, project_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
    [userId, projectId, title, message, type]
  );
}

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { full_name, email, password, phone, institution, academic_level, country } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    db.run(
      `INSERT INTO users (full_name, email, password_hash, phone, institution, academic_level, country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email.toLowerCase(), hashedPassword, phone || '', institution || '', academic_level || 'Undergraduate', country || ''],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
          }
          return res.status(500).json({ success: false, message: 'Database error creating user.' });
        }

        const userId = this.lastID;
        const userPayload = { id: userId, email: email.toLowerCase(), full_name, role: 'client' };
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({
          success: true,
          message: 'Account created successfully!',
          token,
          user: userPayload
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

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

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userPayload
    });
  });
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, full_name, email, phone, role, institution, academic_level, country, preferred_communication, avatar_url, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    return res.json({ success: true, user });
  });
});

// PUT /api/auth/profile
app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { full_name, phone, institution, academic_level, country, preferred_communication } = req.body;

  db.run(
    `UPDATE users SET full_name = ?, phone = ?, institution = ?, academic_level = ?, country = ?, preferred_communication = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [full_name, phone, institution, academic_level, country, preferred_communication, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
      }
      return res.json({ success: true, message: 'Profile updated successfully!' });
    }
  );
});

// PUT /api/auth/settings
app.put('/api/auth/settings', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (new_password) {
    db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
      if (err || !user) return res.status(404).json({ success: false, message: 'User not found.' });

      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(new_password, salt);

      db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to update password.' });
        return res.json({ success: true, message: 'Password changed successfully!' });
      });
    });
  } else {
    return res.json({ success: true, message: 'Settings saved successfully!' });
  }
});

// ==========================================
// 2. DASHBOARD OVERVIEW & STATS
// ==========================================

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const clientId = req.user.id;

  const queries = {
    totalProjects: `SELECT COUNT(*) AS count FROM projects WHERE client_id = ?`,
    activeProjects: `SELECT COUNT(*) AS count FROM projects WHERE client_id = ? AND status IN ('In Progress', 'Submitted', 'Expert Assigned', 'Submitted for Review', 'Revision Requested')`,
    pendingPayment: `SELECT COUNT(*) AS count FROM projects WHERE client_id = ? AND (payment_status = 'Pending' OR status = 'Payment Pending')`,
    completedProjects: `SELECT COUNT(*) AS count FROM projects WHERE client_id = ? AND status = 'Completed'`,
    revisionRequests: `SELECT COUNT(*) AS count FROM projects WHERE client_id = ? AND status = 'Revision Requested'`,
    recentProjects: `SELECT p.*, e.full_name AS expert_name, e.avatar_url AS expert_avatar 
                     FROM projects p 
                     LEFT JOIN experts e ON p.assigned_expert_id = e.id 
                     WHERE p.client_id = ? ORDER BY p.updated_at DESC LIMIT 5`,
    recentNotifications: `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
    unreadNotifications: `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
    recentFiles: `SELECT f.*, p.title AS project_title FROM attachments f 
                  JOIN projects p ON f.project_id = p.id 
                  WHERE p.client_id = ? ORDER BY f.created_at DESC LIMIT 5`
  };

  db.get(queries.totalProjects, [clientId], (err, rowTotal) => {
    db.get(queries.activeProjects, [clientId], (err, rowActive) => {
      db.get(queries.pendingPayment, [clientId], (err, rowPendingPayment) => {
        db.get(queries.completedProjects, [clientId], (err, rowCompleted) => {
          db.get(queries.revisionRequests, [clientId], (err, rowRevision) => {
            db.all(queries.recentProjects, [clientId], (err, recentProjects) => {
              db.all(queries.recentNotifications, [clientId], (err, recentNotifications) => {
                db.get(queries.unreadNotifications, [clientId], (err, rowUnread) => {
                  db.all(queries.recentFiles, [clientId], (err, recentFiles) => {
                    return res.json({
                      success: true,
                      stats: {
                        total_projects: rowTotal ? rowTotal.count : 0,
                        active_projects: rowActive ? rowActive.count : 0,
                        pending_payment_count: rowPendingPayment ? rowPendingPayment.count : 0,
                        completed_projects: rowCompleted ? rowCompleted.count : 0,
                        revision_requests: rowRevision ? rowRevision.count : 0,
                        unread_notifications: rowUnread ? rowUnread.count : 0
                      },
                      recent_projects: recentProjects || [],
                      recent_notifications: recentNotifications || [],
                      recent_files: recentFiles || []
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// ==========================================
// 3. PROJECTS MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/projects (Search, Filter, Sort, Pagination)
app.get('/api/projects', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  const { status, search, sort, page = 1, limit = 10 } = req.query;

  let query = `
    SELECT p.*, e.full_name AS expert_name, e.avatar_url AS expert_avatar, e.expertise AS expert_expertise 
    FROM projects p 
    LEFT JOIN experts e ON p.assigned_expert_id = e.id 
    WHERE p.client_id = ?
  `;
  const params = [clientId];

  if (status && status !== 'All') {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (p.title LIKE ? OR p.id LIKE ? OR p.subject LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (sort === 'deadline_asc') {
    query += ` ORDER BY p.deadline ASC`;
  } else if (sort === 'oldest') {
    query += ` ORDER BY p.created_at ASC`;
  } else {
    query += ` ORDER BY p.created_at DESC`;
  }

  const offset = (page - 1) * limit;
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, projects) => {
    if (err) return res.status(500).json({ success: false, message: 'Database error fetching projects.' });

    db.get(`SELECT COUNT(*) AS count FROM projects WHERE client_id = ?`, [clientId], (err, countRow) => {
      return res.json({
        success: true,
        projects: projects || [],
        total: countRow ? countRow.count : 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

// POST /api/projects (Submit New Project)
app.post('/api/projects', optionalAuth, upload.any(), async (req, res) => {
  let clientId = req.user ? req.user.id : null;
  let clientName = req.user ? req.user.full_name : (req.body.full_name || req.body.client_name || 'Student');
  let clientEmail = req.user ? req.user.email : (req.body.email || req.body.client_email);

  const title = (req.body.title || '').trim();
  const category = req.body.category || req.body.stream || req.body.academic_stream || 'General Academic';
  const subject = req.body.subject || req.body.stream || req.body.academic_stream || 'General';
  const project_type = req.body.project_type || req.body.type || req.body.assignment_type || 'Assignment';
  const deadline = req.body.deadline || req.body.due_date;
  const description = req.body.description || req.body.requirements || '';
  const academic_level = req.body.academic_level || 'Undergraduate';
  const institution = req.body.institution || '';
  const priority = req.body.priority || 'Medium';
  const word_count = req.body.word_count || 2500;
  const citation_style = req.body.citation_style || 'APA 7th';
  const formatting = req.body.formatting || 'Standard 12pt';

  if (!title) {
    return res.status(400).json({ success: false, message: 'Assignment title is required.' });
  }
  if (!deadline) {
    return res.status(400).json({ success: false, message: 'Due date is required.' });
  }

  const proceedWithProjectCreation = (resolvedClientId, resolvedClientName, newAuthToken = null) => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const projectId = `PRJ-${randomNum}`;

    const calculatedWordCount = parseInt(word_count) || 2500;
    const estPrice = Math.max(50, Math.round((calculatedWordCount / 250) * 15));

    db.run(
      `INSERT INTO projects (
        id, client_id, title, category, subject, academic_level, institution, project_type,
        description, requirements, word_count, page_count, citation_style, formatting,
        start_date, deadline, priority, status, progress_percent, total_amount, paid_amount,
        payment_status, assigned_expert_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', 10, ?, 0, 'Pending', 1)`,
      [
        projectId, resolvedClientId, title, category, subject, academic_level,
        institution, project_type, description, req.body.requirements || '',
        calculatedWordCount, parseInt(req.body.page_count) || Math.ceil(calculatedWordCount / 250),
        citation_style, formatting, req.body.start_date || new Date().toISOString().split('T')[0],
        deadline, priority, estPrice
      ],
      function (err) {
        if (err) {
          console.error('Project creation DB error:', err);
          return res.status(500).json({ success: false, message: 'Failed to create project.' });
        }

        // Add timeline initial entries
        db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Submitted', 'Project Submitted', 'Client created project submission', 'Client')`, [projectId]);
        db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Reviewed', 'Requirements Under Review', 'Academic team assigned for verification', 'Support')`, [projectId]);

        // Add default Quote
        db.run(`INSERT INTO quotes (project_id, estimated_price, final_quote, service_fee, additional_charges, discount, total_amount, payment_deadline, quote_expiry, status, notes) VALUES (?, ?, ?, 5.00, 0, 10.00, ?, ?, ?, 'Pending', 'Initial quote generated automatically.')`,
          [projectId, estPrice, estPrice, estPrice, deadline, deadline]);

        // Add Invoice
        db.run(`INSERT INTO payments (invoice_number, project_id, client_id, amount, tax, discount, final_amount, status) VALUES (?, ?, ?, ?, 0, 10.00, ?, 'Pending')`,
          [`INV-2026-${randomNum}`, projectId, resolvedClientId, estPrice, estPrice]);

        // Create conversation
        db.run(`INSERT INTO conversations (project_id, client_id, expert_id) VALUES (?, ?, 1)`, [projectId, resolvedClientId]);

        // Handle uploaded files
        if (req.files && req.files.length > 0) {
          const stmt = db.prepare(`INSERT INTO attachments (project_id, uploaded_by_id, uploaded_by_name, category, filename, original_name, file_size, file_type, file_path) VALUES (?, ?, ?, 'Client Files', ?, ?, ?, ?, ?)`);
          req.files.forEach(f => {
            stmt.run(projectId, resolvedClientId, resolvedClientName, f.filename, f.originalname, f.size, f.mimetype, `uploads/${f.filename}`);
          });
          stmt.finalize();
        }

        logAudit(projectId, resolvedClientId, 'PROJECT_CREATED', `Project ${projectId} created: ${title}`);
        createNotification(resolvedClientId, projectId, 'Project Created Successfully', `Your project ${projectId} has been created and is under review.`, 'project');

        return res.status(201).json({
          success: true,
          message: 'Assignment project created successfully!',
          project_id: projectId,
          token: newAuthToken
        });
      }
    );
  };

  if (clientId) {
    proceedWithProjectCreation(clientId, clientName);
  } else if (clientEmail) {
    db.get('SELECT * FROM users WHERE email = ?', [clientEmail.toLowerCase()], async (err, existingUser) => {
      if (existingUser) {
        proceedWithProjectCreation(existingUser.id, existingUser.full_name);
      } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Password123!', salt);
        db.run(
          `INSERT INTO users (full_name, email, password_hash, phone, role, institution, academic_level, country)
           VALUES (?, ?, ?, ?, 'client', ?, ?, 'Nepal')`,
          [clientName, clientEmail.toLowerCase(), hashedPassword, req.body.phone || '', institution, academic_level],
          function (err2) {
            if (err2) {
              return proceedWithProjectCreation(1, clientName);
            }
            const newUserId = this.lastID;
            const userPayload = { id: newUserId, email: clientEmail.toLowerCase(), full_name: clientName, role: 'client' };
            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
            proceedWithProjectCreation(newUserId, clientName, token);
          }
        );
      }
    });
  } else {
    // Default to demo user
    proceedWithProjectCreation(1, 'Gareema Sharma');
  }
});

// GET /api/projects/:id (Single Project Workspace)
app.get('/api/projects/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;

  const query = `
    SELECT p.*, e.full_name AS expert_name, e.avatar_url AS expert_avatar, e.expertise AS expert_expertise, e.rating AS expert_rating, e.experience_years AS expert_experience, e.bio AS expert_bio
    FROM projects p 
    LEFT JOIN experts e ON p.assigned_expert_id = e.id 
    WHERE p.id = ? AND p.client_id = ?
  `;

  db.get(query, [projectId, clientId], (err, project) => {
    if (err || !project) {
      return res.status(404).json({ success: false, message: 'Project not found or access denied.' });
    }

    // Fetch Timeline
    db.all(`SELECT * FROM project_timeline WHERE project_id = ? ORDER BY timestamp ASC`, [projectId], (err, timeline) => {
      // Fetch Quote
      db.get(`SELECT * FROM quotes WHERE project_id = ?`, [projectId], (err, quote) => {
        // Fetch Payment
        db.get(`SELECT * FROM payments WHERE project_id = ?`, [projectId], (err, payment) => {
          // Fetch Attachments
          db.all(`SELECT * FROM attachments WHERE project_id = ? ORDER BY created_at DESC`, [projectId], (err, attachments) => {
            // Fetch Revisions
            db.all(`SELECT * FROM revisions WHERE project_id = ? ORDER BY created_at DESC`, [projectId], (err, revisions) => {
              // Fetch Review if exists
              db.get(`SELECT * FROM reviews WHERE project_id = ?`, [projectId], (err, review) => {
                return res.json({
                  success: true,
                  project,
                  timeline: timeline || [],
                  quote: quote || null,
                  payment: payment || null,
                  attachments: attachments || [],
                  revisions: revisions || [],
                  review: review || null
                });
              });
            });
          });
        });
      });
    });
  });
});

// ==========================================
// 4. QUOTATION SYSTEM ENDPOINTS
// ==========================================

app.post('/api/projects/:id/quote/action', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;
  const { action, notes } = req.body; // action: 'accept', 'reject', 'clarify'

  db.get(`SELECT * FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, project) => {
    if (err || !project) return res.status(404).json({ success: false, message: 'Project not found.' });

    if (action === 'accept') {
      db.run(`UPDATE quotes SET status = 'Accepted' WHERE project_id = ?`, [projectId]);
      db.run(`UPDATE projects SET status = 'Payment Pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [projectId]);
      db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Accepted', 'Quote Accepted', 'Client accepted official project quotation', 'Client')`, [projectId]);
      logAudit(projectId, clientId, 'QUOTE_ACCEPTED', `Client accepted quote for ${projectId}`);
      createNotification(clientId, projectId, 'Quote Accepted', `Quote accepted for ${projectId}. Please proceed to payment.`, 'payment');
      return res.json({ success: true, message: 'Quote accepted! Redirecting to payment.' });
    } else if (action === 'reject') {
      db.run(`UPDATE quotes SET status = 'Rejected' WHERE project_id = ?`, [projectId]);
      db.run(`UPDATE projects SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [projectId]);
      logAudit(projectId, clientId, 'QUOTE_REJECTED', `Client rejected quote for ${projectId}`);
      return res.json({ success: true, message: 'Quote rejected.' });
    } else {
      db.run(`UPDATE quotes SET status = 'Clarification Requested', notes = ? WHERE project_id = ?`, [notes || 'Clarification requested by client', projectId]);
      return res.json({ success: true, message: 'Clarification request submitted to academic team.' });
    }
  });
});

// ==========================================
// 5. PAYMENT SYSTEM ENDPOINTS
// ==========================================

app.get('/api/payments', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  db.all(
    `SELECT pay.*, p.title AS project_title, p.status AS project_status 
     FROM payments pay 
     JOIN projects p ON pay.project_id = p.id 
     WHERE pay.client_id = ? ORDER BY pay.created_at DESC`,
    [clientId],
    (err, payments) => {
      if (err) return res.status(500).json({ success: false, message: 'Error fetching payments.' });
      return res.json({ success: true, payments: payments || [] });
    }
  );
});

app.post('/api/payments/pay', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  const { project_id, payment_method } = req.body;

  db.get(`SELECT * FROM payments WHERE project_id = ? AND client_id = ?`, [project_id, clientId], (err, invoice) => {
    if (err || !invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const txnId = 'TXN-' + Math.floor(10000000 + Math.random() * 90000000);

    db.run(
      `UPDATE payments SET status = 'Paid', payment_method = ?, transaction_id = ? WHERE id = ?`,
      [payment_method || 'Credit Card (Stripe)', txnId, invoice.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: 'Payment processing error.' });

        // Update Project Status & Progress
        db.run(
          `UPDATE projects SET status = 'In Progress', payment_status = 'Paid', paid_amount = total_amount, progress_percent = 40, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [project_id]
        );

        db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Paid', 'Payment Verified & Confirmed', 'Payment of $' || ? || ' received. Work started.', 'System')`, [project_id, invoice.final_amount]);
        db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'In Progress', 'Research & Writing Initiated', 'Assigned expert actively working on deliverable.', 'Expert')`, [project_id]);

        logAudit(project_id, clientId, 'PAYMENT_COMPLETED', `Payment of $${invoice.final_amount} verified for ${project_id}`);
        createNotification(clientId, project_id, 'Payment Successful', `Payment of $${invoice.final_amount} confirmed for ${project_id}. Expert has started work!`, 'payment');

        return res.json({
          success: true,
          message: 'Payment completed successfully!',
          transaction_id: txnId
        });
      }
    );
  });
});

// GET Invoice PDF/JSON view
app.get('/api/payments/invoice/:id', authenticateToken, (req, res) => {
  const invoiceId = req.params.id;
  const clientId = req.user.id;

  db.get(
    `SELECT pay.*, p.title AS project_title, u.full_name AS client_name, u.email AS client_email, u.institution
     FROM payments pay
     JOIN projects p ON pay.project_id = p.id
     JOIN users u ON pay.client_id = u.id
     WHERE (pay.id = ? OR pay.invoice_number = ?) AND pay.client_id = ?`,
    [invoiceId, invoiceId, clientId],
    (err, invoice) => {
      if (err || !invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
      return res.json({ success: true, invoice });
    }
  );
});

// ==========================================
// 6. MESSAGING ENDPOINTS
// ==========================================

app.get('/api/messages/conversations', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  db.all(
    `SELECT c.*, p.title AS project_title, p.status AS project_status, e.full_name AS expert_name, e.avatar_url AS expert_avatar 
     FROM conversations c 
     JOIN projects p ON c.project_id = p.id 
     LEFT JOIN experts e ON c.expert_id = e.id 
     WHERE c.client_id = ? ORDER BY c.updated_at DESC`,
    [clientId],
    (err, conversations) => {
      return res.json({ success: true, conversations: conversations || [] });
    }
  );
});

app.get('/api/messages/conversation/:projectId', authenticateToken, (req, res) => {
  const projectId = req.params.projectId;
  const clientId = req.user.id;

  db.get(`SELECT c.*, p.title AS project_title, e.full_name AS expert_name, e.avatar_url AS expert_avatar FROM conversations c JOIN projects p ON c.project_id = p.id LEFT JOIN experts e ON c.expert_id = e.id WHERE c.project_id = ? AND c.client_id = ?`, [projectId, clientId], (err, conv) => {
    if (err || !conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    db.all(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`, [conv.id], (err, messages) => {
      // Mark as read
      db.run(`UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_role != 'client'`, [conv.id]);
      return res.json({ success: true, conversation: conv, messages: messages || [] });
    });
  });
});

app.post('/api/messages/conversation/:projectId', authenticateToken, upload.single('attachment'), (req, res) => {
  const projectId = req.params.projectId;
  const clientId = req.user.id;
  const { message } = req.body;

  db.get(`SELECT * FROM conversations WHERE project_id = ? AND client_id = ?`, [projectId, clientId], (err, conv) => {
    if (err || !conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    let fileUrl = null;
    let fileName = null;
    if (req.file) {
      fileUrl = `uploads/${req.file.filename}`;
      fileName = req.file.originalname;
    }

    db.run(
      `INSERT INTO messages (conversation_id, sender_id, sender_name, sender_role, message, file_url, file_name) VALUES (?, ?, ?, 'client', ?, ?, ?)`,
      [conv.id, clientId, req.user.full_name || 'Client', message || (fileName ? 'Sent attachment: ' + fileName : ''), fileUrl, fileName],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: 'Failed to send message.' });

        db.run(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [conv.id]);

        return res.json({ success: true, message: 'Message sent!' });
      }
    );
  });
});

// ==========================================
// 7. FILE MANAGEMENT ENDPOINTS
// ==========================================

app.get('/api/projects/:id/files', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;

  db.get(`SELECT id FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, proj) => {
    if (err || !proj) return res.status(404).json({ success: false, message: 'Project access denied.' });

    db.all(`SELECT * FROM attachments WHERE project_id = ? ORDER BY created_at DESC`, [projectId], (err, files) => {
      return res.json({ success: true, files: files || [] });
    });
  });
});

app.post('/api/projects/:id/files', authenticateToken, upload.array('files'), (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;
  const category = req.body.category || 'Client Files';

  db.get(`SELECT id FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, proj) => {
    if (err || !proj) return res.status(404).json({ success: false, message: 'Project access denied.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const stmt = db.prepare(`INSERT INTO attachments (project_id, uploaded_by_id, uploaded_by_name, category, filename, original_name, file_size, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    req.files.forEach(f => {
      stmt.run(projectId, clientId, req.user.full_name || 'Client', category, f.filename, f.originalname, f.size, f.mimetype, `uploads/${f.filename}`);
    });
    stmt.finalize();

    logAudit(projectId, clientId, 'FILE_UPLOADED', `Uploaded ${req.files.length} file(s) to ${category}`);
    createNotification(clientId, projectId, 'New File Uploaded', `File uploaded to project ${projectId}.`, 'file');

    return res.json({ success: true, message: 'Files uploaded successfully!' });
  });
});

// ==========================================
// 8. REVISIONS ENDPOINTS
// ==========================================

app.post('/api/projects/:id/revisions', authenticateToken, upload.array('files'), (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;
  const { revision_reason, detailed_instructions, requested_deadline } = req.body;

  if (!revision_reason || !detailed_instructions) {
    return res.status(400).json({ success: false, message: 'Revision reason and instructions are required.' });
  }

  db.get(`SELECT * FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, proj) => {
    if (err || !proj) return res.status(404).json({ success: false, message: 'Project access denied.' });

    db.run(
      `INSERT INTO revisions (project_id, client_id, revision_reason, detailed_instructions, requested_deadline, status) VALUES (?, ?, ?, ?, ?, 'Requested')`,
      [projectId, clientId, revision_reason, detailed_instructions, requested_deadline || proj.deadline],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: 'Error creating revision request.' });

        db.run(`UPDATE projects SET status = 'Revision Requested', progress_percent = 75, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [projectId]);
        db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Revision Requested', 'Revision Request Submitted', ?, 'Client')`, [projectId, revision_reason]);

        if (req.files && req.files.length > 0) {
          const stmt = db.prepare(`INSERT INTO attachments (project_id, uploaded_by_id, uploaded_by_name, category, filename, original_name, file_size, file_type, file_path) VALUES (?, ?, ?, 'Revision Files', ?, ?, ?, ?, ?)`);
          req.files.forEach(f => {
            stmt.run(projectId, clientId, req.user.full_name || 'Client', f.filename, f.originalname, f.size, f.mimetype, `uploads/${f.filename}`);
          });
          stmt.finalize();
        }

        logAudit(projectId, clientId, 'REVISION_REQUESTED', `Client requested revision for ${projectId}`);
        createNotification(clientId, projectId, 'Revision Request Submitted', `Revision requested for ${projectId}. Assigned expert notified.`, 'revision');

        return res.json({ success: true, message: 'Revision request submitted successfully!' });
      }
    );
  });
});

// ==========================================
// 9. FINAL DELIVERY & REVIEW ENDPOINTS
// ==========================================

app.post('/api/projects/:id/approve', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;

  db.get(`SELECT * FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, proj) => {
    if (err || !proj) return res.status(404).json({ success: false, message: 'Project access denied.' });

    db.run(`UPDATE projects SET status = 'Completed', progress_percent = 100, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [projectId]);
    db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Completed', 'Final Work Approved', 'Client approved final delivery. Project completed!', 'Client')`, [projectId]);

    logAudit(projectId, clientId, 'PROJECT_APPROVED', `Client approved final work for ${projectId}`);
    createNotification(clientId, projectId, 'Project Completed!', `Project ${projectId} has been marked as Completed. Thank you!`, 'success');

    return res.json({ success: true, message: 'Project approved and completed!' });
  });
});

app.post('/api/projects/:id/review', authenticateToken, (req, res) => {
  const projectId = req.params.id;
  const clientId = req.user.id;
  const { star_rating, written_review, communication_rating, quality_rating, timeliness_rating } = req.body;

  db.get(`SELECT assigned_expert_id FROM projects WHERE id = ? AND client_id = ?`, [projectId, clientId], (err, proj) => {
    if (err || !proj) return res.status(404).json({ success: false, message: 'Project access denied.' });

    db.run(
      `INSERT INTO reviews (project_id, client_id, expert_id, star_rating, written_review, communication_rating, quality_rating, timeliness_rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, clientId, proj.assigned_expert_id || 1, parseInt(star_rating) || 5, written_review || '', parseInt(communication_rating) || 5, parseInt(quality_rating) || 5, parseInt(timeliness_rating) || 5],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ success: false, message: 'You have already submitted a review for this project.' });
          }
          return res.status(500).json({ success: false, message: 'Database error saving review.' });
        }
        return res.json({ success: true, message: 'Thank you for your feedback!' });
      }
    );
  });
});

// ==========================================
// 10. NOTIFICATIONS ENDPOINTS
// ==========================================

app.get('/api/notifications', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [clientId], (err, notifications) => {
    db.get(`SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`, [clientId], (err, row) => {
      return res.json({
        success: true,
        notifications: notifications || [],
        unread_count: row ? row.count : 0
      });
    });
  });
});

app.put('/api/notifications/read', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  const { id } = req.body;

  if (id) {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [id, clientId]);
  } else {
    db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [clientId]);
  }
  return res.json({ success: true, message: 'Notifications updated.' });
});

// ==========================================
// 11. SUPPORT CENTER ENDPOINTS
// ==========================================

app.get('/api/support/tickets', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  db.all(`SELECT * FROM support_tickets WHERE client_id = ? ORDER BY updated_at DESC`, [clientId], (err, tickets) => {
    return res.json({ success: true, tickets: tickets || [] });
  });
});

app.post('/api/support/tickets', authenticateToken, (req, res) => {
  const clientId = req.user.id;
  const { subject, category, priority, initial_message } = req.body;

  if (!subject || !initial_message) {
    return res.status(400).json({ success: false, message: 'Subject and message are required.' });
  }

  const ticketId = `TCK-${Math.floor(100 + Math.random() * 900)}`;

  db.run(
    `INSERT INTO support_tickets (id, client_id, subject, category, priority, status) VALUES (?, ?, ?, ?, ?, 'Open')`,
    [ticketId, clientId, subject, category || 'General Inquiry', priority || 'Medium'],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Error creating support ticket.' });

      db.run(
        `INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message) VALUES (?, ?, ?, 'client', ?)`,
        [ticketId, clientId, req.user.full_name || 'Client', initial_message]
      );

      return res.status(201).json({ success: true, message: 'Support ticket submitted!', ticket_id: ticketId });
    }
  );
});

app.get('/api/support/tickets/:id', authenticateToken, (req, res) => {
  const ticketId = req.params.id;
  const clientId = req.user.id;

  db.get(`SELECT * FROM support_tickets WHERE id = ? AND client_id = ?`, [ticketId, clientId], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    db.all(`SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`, [ticketId], (err, messages) => {
      return res.json({ success: true, ticket, messages: messages || [] });
    });
  });
});

app.post('/api/support/tickets/:id/messages', authenticateToken, (req, res) => {
  const ticketId = req.params.id;
  const clientId = req.user.id;
  const { message } = req.body;

  db.get(`SELECT * FROM support_tickets WHERE id = ? AND client_id = ?`, [ticketId, clientId], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    db.run(
      `INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message) VALUES (?, ?, ?, 'client', ?)`,
      [ticketId, clientId, req.user.full_name || 'Client', message],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: 'Failed to send message.' });

        db.run(`UPDATE support_tickets SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ticketId]);
        return res.json({ success: true, message: 'Reply added to ticket.' });
      }
    );
  });
});

// Contact Inquiries Submission Endpoint
app.post('/api/contact', (req, res) => {
  const { full_name, email, subject, message } = req.body;
  if (!full_name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Please provide full name, email, and message.' });
  }

  db.run(
    `INSERT INTO contact_inquiries (full_name, email, subject, message) VALUES (?, ?, ?, ?)`,
    [full_name, email, subject || 'General Inquiry', message],
    function (err) {
      if (err) {
        console.error('Contact inquiry save error:', err);
        return res.status(500).json({ success: false, message: 'Failed to record your message. Please try again.' });
      }
      return res.status(201).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully. Our team will contact you shortly.',
        inquiry_id: this.lastID
      });
    }
  );
});

// ==========================================
// 12. FULLY FUNCTIONAL ADMIN PANEL ENDPOINTS
// ==========================================

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide admin email and password.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Administrator account not found.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Account does not have administrator privileges.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    const adminPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: 'admin',
      phone: user.phone,
      avatar_url: user.avatar_url || 'images/logo1.png'
    };

    const token = jwt.sign(adminPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Admin authentication successful!',
      token,
      user: adminPayload
    });
  });
});

// GET /api/admin/me
app.get('/api/admin/me', requireAdmin, (req, res) => {
  db.get('SELECT id, full_name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ success: false, message: 'Admin user not found.' });
    return res.json({ success: true, user });
  });
});

// GET /api/admin/stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });

    const runAll = (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const revRow = await runQuery("SELECT SUM(paid_amount) AS total_revenue FROM projects");
    const projRow = await runQuery("SELECT COUNT(*) AS total_projects, SUM(CASE WHEN status NOT IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) AS active_projects, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_projects FROM projects");
    const quoteRow = await runQuery("SELECT COUNT(*) AS pending_quotes FROM quotes WHERE status = 'Pending'");
    const userRow = await runQuery("SELECT COUNT(*) AS total_students FROM users WHERE role = 'client'");
    const expRow = await runQuery("SELECT COUNT(*) AS total_experts FROM experts");
    const tckRow = await runQuery("SELECT COUNT(*) AS open_tickets FROM support_tickets WHERE status != 'Resolved'");
    const inqRow = await runQuery("SELECT COUNT(*) AS new_inquiries FROM contact_inquiries WHERE status = 'New'");

    const recentProjects = await runAll(`
      SELECT p.id, p.title, p.category, p.status, p.progress_percent, p.total_amount, p.paid_amount, p.payment_status, p.deadline, p.created_at,
             u.full_name AS client_name, u.email AS client_email,
             e.full_name AS expert_name
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      LEFT JOIN experts e ON p.assigned_expert_id = e.id
      ORDER BY p.created_at DESC LIMIT 6
    `);

    const recentInquiries = await runAll(`
      SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 5
    `);

    const recentPayments = await runAll(`
      SELECT pm.*, u.full_name AS client_name, p.title AS project_title
      FROM payments pm
      LEFT JOIN users u ON pm.client_id = u.id
      LEFT JOIN projects p ON pm.project_id = p.id
      ORDER BY pm.created_at DESC LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        total_revenue: (revRow && revRow.total_revenue) || 0,
        total_projects: (projRow && projRow.total_projects) || 0,
        active_projects: (projRow && projRow.active_projects) || 0,
        completed_projects: (projRow && projRow.completed_projects) || 0,
        pending_quotes: (quoteRow && quoteRow.pending_quotes) || 0,
        total_students: (userRow && userRow.total_students) || 0,
        total_experts: (expRow && expRow.total_experts) || 0,
        open_tickets: (tckRow && tckRow.open_tickets) || 0,
        new_inquiries: (inqRow && inqRow.new_inquiries) || 0
      },
      recent_projects: recentProjects || [],
      recent_inquiries: recentInquiries || [],
      recent_payments: recentPayments || []
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching admin stats.' });
  }
});

// GET /api/admin/projects
app.get('/api/admin/projects', requireAdmin, (req, res) => {
  const { status, search } = req.query;
  let query = `
    SELECT p.*,
           u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone, u.institution AS client_institution,
           e.full_name AS expert_name, e.expertise AS expert_expertise
    FROM projects p
    LEFT JOIN users u ON p.client_id = u.id
    LEFT JOIN experts e ON p.assigned_expert_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (p.id LIKE ? OR p.title LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ` ORDER BY p.created_at DESC`;

  db.all(query, params, (err, projects) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
    return res.json({ success: true, projects: projects || [] });
  });
});

// GET /api/admin/projects/:id
app.get('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const projectId = req.params.id;

  db.get(`
    SELECT p.*,
           u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone, u.institution AS client_institution,
           e.full_name AS expert_name, e.expertise AS expert_expertise, e.avatar_url AS expert_avatar
    FROM projects p
    LEFT JOIN users u ON p.client_id = u.id
    LEFT JOIN experts e ON p.assigned_expert_id = e.id
    WHERE p.id = ?
  `, [projectId], (err, project) => {
    if (err || !project) return res.status(404).json({ success: false, message: 'Project not found.' });

    db.get('SELECT * FROM quotes WHERE project_id = ?', [projectId], (err, quote) => {
      db.all('SELECT * FROM project_timeline WHERE project_id = ? ORDER BY timestamp ASC', [projectId], (err, timeline) => {
        db.all('SELECT * FROM attachments WHERE project_id = ? ORDER BY created_at DESC', [projectId], (err, attachments) => {
          db.all('SELECT * FROM payments WHERE project_id = ? ORDER BY created_at DESC', [projectId], (err, payments) => {
            return res.json({
              success: true,
              project,
              quote,
              timeline: timeline || [],
              attachments: attachments || [],
              payments: payments || []
            });
          });
        });
      });
    });
  });
});

// PUT /api/admin/projects/:id
app.put('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const projectId = req.params.id;
  const { status, progress_percent, assigned_expert_id, priority, deadline, total_amount, payment_status, timeline_note } = req.body;

  db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err || !project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const newStatus = status !== undefined ? status : project.status;
    const newProgress = progress_percent !== undefined ? parseInt(progress_percent) : project.progress_percent;
    const newExpert = assigned_expert_id !== undefined ? (assigned_expert_id ? parseInt(assigned_expert_id) : null) : project.assigned_expert_id;
    const newPriority = priority || project.priority;
    const newDeadline = deadline || project.deadline;
    const newAmount = total_amount !== undefined ? parseFloat(total_amount) : project.total_amount;
    const newPaymentStatus = payment_status || project.payment_status;

    db.run(`
      UPDATE projects
      SET status = ?, progress_percent = ?, assigned_expert_id = ?, priority = ?, deadline = ?, total_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newStatus, newProgress, newExpert, newPriority, newDeadline, newAmount, newPaymentStatus, projectId], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to update project.' });

      if (newStatus !== project.status || timeline_note) {
        const title = timeline_note ? 'Admin Update' : `Status updated to ${newStatus}`;
        const desc = timeline_note || `Project status changed from ${project.status} to ${newStatus}. Progress: ${newProgress}%`;
        db.run(
          `INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, ?, ?, ?, 'Admin')`,
          [projectId, newStatus, title, desc]
        );
      }

      createNotification(
        project.client_id,
        projectId,
        `Project ${projectId} Updated`,
        `Your project status has been updated to "${newStatus}" (Progress: ${newProgress}%).`,
        'progress'
      );

      logAudit(projectId, req.user.id, 'Project Updated', `Admin updated project ${projectId}`);

      return res.json({ success: true, message: 'Project updated successfully!' });
    });
  });
});

// POST /api/admin/projects/:id/quote
app.post('/api/admin/projects/:id/quote', requireAdmin, (req, res) => {
  const projectId = req.params.id;
  const { estimated_price, service_fee, discount, final_quote, payment_deadline, notes } = req.body;

  if (!final_quote) {
    return res.status(400).json({ success: false, message: 'Final quote amount is required.' });
  }

  db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err || !project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const est = parseFloat(estimated_price || final_quote);
    const sFee = parseFloat(service_fee || 0);
    const disc = parseFloat(discount || 0);
    const fin = parseFloat(final_quote);

    db.run(`
      INSERT INTO quotes (project_id, estimated_price, final_quote, service_fee, discount, total_amount, payment_deadline, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
      ON CONFLICT(project_id) DO UPDATE SET
        estimated_price = excluded.estimated_price,
        final_quote = excluded.final_quote,
        service_fee = excluded.service_fee,
        discount = excluded.discount,
        total_amount = excluded.total_amount,
        payment_deadline = excluded.payment_deadline,
        notes = excluded.notes,
        status = 'Pending'
    `, [projectId, est, fin, sFee, disc, fin, payment_deadline || null, notes || 'Quote generated by Assignment Dai Coordinator'], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to save quote.' });

      db.run('UPDATE projects SET total_amount = ?, status = CASE WHEN status = "Submitted" THEN "Reviewed" ELSE status END WHERE id = ?', [fin, projectId]);

      db.run(
        `INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Reviewed', 'Quote Ready', ?, 'Admin')`,
        [projectId, `Official quotation generated: $${fin.toFixed(2)}`]
      );

      createNotification(
        project.client_id,
        projectId,
        'Project Quote Ready for Review',
        `Your official quote for project ${projectId} is ready ($${fin.toFixed(2)}). Please review in your dashboard.`,
        'quote'
      );

      return res.json({ success: true, message: 'Official quote sent to student!' });
    });
  });
});

// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  db.all(`
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.institution, u.academic_level, u.country, u.created_at,
           COUNT(p.id) AS total_projects,
           COALESCE(SUM(p.paid_amount), 0) AS total_spent
    FROM users u
    LEFT JOIN projects p ON u.id = p.client_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `, (err, users) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    return res.json({ success: true, users: users || [] });
  });
});

// POST /api/admin/users
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { full_name, email, password, phone, role, institution, academic_level, country } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    db.run(`
      INSERT INTO users (full_name, email, password_hash, phone, role, institution, academic_level, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [full_name, email.toLowerCase().trim(), hashedPassword, phone || '', role || 'client', institution || '', academic_level || 'Undergraduate', country || 'Nepal'], function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Email already exists.' });
        return res.status(500).json({ success: false, message: 'Database error creating user.' });
      }
      return res.status(201).json({ success: true, message: 'User created successfully!', user_id: this.lastID });
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error creating user.' });
  }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
  }

  db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to delete user.' });
    return res.json({ success: true, message: 'User deleted successfully.' });
  });
});

// GET /api/admin/experts
app.get('/api/admin/experts', requireAdmin, (req, res) => {
  db.all(`
    SELECT e.*, COUNT(p.id) AS active_projects
    FROM experts e
    LEFT JOIN projects p ON e.id = p.assigned_expert_id AND p.status NOT IN ('Completed', 'Cancelled')
    GROUP BY e.id
    ORDER BY e.rating DESC
  `, (err, experts) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch experts.' });
    return res.json({ success: true, experts: experts || [] });
  });
});

// POST /api/admin/experts
app.post('/api/admin/experts', requireAdmin, (req, res) => {
  const { full_name, expertise, rating, experience_years, bio, avatar_url } = req.body;
  if (!full_name || !expertise) {
    return res.status(400).json({ success: false, message: 'Name and expertise are required.' });
  }

  db.run(`
    INSERT INTO experts (full_name, avatar_url, expertise, rating, experience_years, bio)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [full_name, avatar_url || 'images/tm.jpg', expertise, parseFloat(rating || 4.9), parseInt(experience_years || 5), bio || ''], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to add expert.' });
    return res.status(201).json({ success: true, message: 'Expert added successfully!', expert_id: this.lastID });
  });
});

// PUT /api/admin/experts/:id
app.put('/api/admin/experts/:id', requireAdmin, (req, res) => {
  const expertId = req.params.id;
  const { full_name, expertise, rating, experience_years, bio } = req.body;

  db.run(`
    UPDATE experts
    SET full_name = ?, expertise = ?, rating = ?, experience_years = ?, bio = ?
    WHERE id = ?
  `, [full_name, expertise, parseFloat(rating), parseInt(experience_years), bio, expertId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to update expert.' });
    return res.json({ success: true, message: 'Expert updated successfully!' });
  });
});

// DELETE /api/admin/experts/:id
app.delete('/api/admin/experts/:id', requireAdmin, (req, res) => {
  const expertId = req.params.id;
  db.run('DELETE FROM experts WHERE id = ?', [expertId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to delete expert.' });
    return res.json({ success: true, message: 'Expert deleted.' });
  });
});

// GET /api/admin/payments
app.get('/api/admin/payments', requireAdmin, (req, res) => {
  db.all(`
    SELECT pm.*, u.full_name AS client_name, u.email AS client_email, p.title AS project_title
    FROM payments pm
    LEFT JOIN users u ON pm.client_id = u.id
    LEFT JOIN projects p ON pm.project_id = p.id
    ORDER BY pm.created_at DESC
  `, (err, payments) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
    return res.json({ success: true, payments: payments || [] });
  });
});

// PUT /api/admin/payments/:id/status
app.put('/api/admin/payments/:id/status', requireAdmin, (req, res) => {
  const paymentId = req.params.id;
  const { status } = req.body;

  db.get('SELECT * FROM payments WHERE id = ?', [paymentId], (err, payment) => {
    if (err || !payment) return res.status(404).json({ success: false, message: 'Payment record not found.' });

    db.run('UPDATE payments SET status = ? WHERE id = ?', [status, paymentId], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to update payment status.' });

      if (status === 'Paid') {
        db.run('UPDATE projects SET payment_status = "Paid", paid_amount = total_amount WHERE id = ?', [payment.project_id]);
        db.run(
          `INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Paid', 'Payment Verified', ?, 'Admin')`,
          [payment.project_id, `Payment verified by admin ($${payment.final_amount.toFixed(2)})`]
        );
        createNotification(payment.client_id, payment.project_id, 'Payment Verified', `Your payment of $${payment.final_amount} for ${payment.project_id} has been verified.`, 'payment');
      }

      return res.json({ success: true, message: `Payment marked as ${status}.` });
    });
  });
});

// GET /api/admin/tickets
app.get('/api/admin/tickets', requireAdmin, (req, res) => {
  db.all(`
    SELECT t.*, u.full_name AS client_name, u.email AS client_email
    FROM support_tickets t
    LEFT JOIN users u ON t.client_id = u.id
    ORDER BY CASE WHEN t.status = 'Open' THEN 1 WHEN t.status = 'In Progress' THEN 2 ELSE 3 END, t.updated_at DESC
  `, (err, tickets) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
    return res.json({ success: true, tickets: tickets || [] });
  });
});

// GET /api/admin/tickets/:id
app.get('/api/admin/tickets/:id', requireAdmin, (req, res) => {
  const ticketId = req.params.id;

  db.get(`
    SELECT t.*, u.full_name AS client_name, u.email AS client_email, u.phone AS client_phone
    FROM support_tickets t
    LEFT JOIN users u ON t.client_id = u.id
    WHERE t.id = ?
  `, [ticketId], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    db.all('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId], (err, messages) => {
      return res.json({ success: true, ticket, messages: messages || [] });
    });
  });
});

// POST /api/admin/tickets/:id/reply
app.post('/api/admin/tickets/:id/reply', requireAdmin, (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;

  if (!message) return res.status(400).json({ success: false, message: 'Message content is required.' });

  db.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    db.run(`
      INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message)
      VALUES (?, ?, ?, 'admin', ?)
    `, [ticketId, req.user.id, req.user.full_name || 'Assignment Dai Support Team', message], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to post reply.' });

      db.run('UPDATE support_tickets SET status = "In Progress", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

      createNotification(ticket.client_id, null, `New Support Reply on ${ticketId}`, `Admin team replied to your support ticket "${ticket.subject}".`, 'support');

      return res.json({ success: true, message: 'Reply sent to student.' });
    });
  });
});

// PUT /api/admin/tickets/:id/status
app.put('/api/admin/tickets/:id/status', requireAdmin, (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;

  db.run('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, ticketId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
    return res.json({ success: true, message: `Ticket status updated to ${status}.` });
  });
});

// GET /api/admin/inquiries
app.get('/api/admin/inquiries', requireAdmin, (req, res) => {
  db.all('SELECT * FROM contact_inquiries ORDER BY created_at DESC', (err, inquiries) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to fetch inquiries.' });
    return res.json({ success: true, inquiries: inquiries || [] });
  });
});

// PUT /api/admin/inquiries/:id/status
app.put('/api/admin/inquiries/:id/status', requireAdmin, (req, res) => {
  const inquiryId = req.params.id;
  const { status } = req.body;

  db.run('UPDATE contact_inquiries SET status = ? WHERE id = ?', [status, inquiryId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to update inquiry status.' });
    return res.json({ success: true, message: `Inquiry status changed to ${status}.` });
  });
});

// DELETE /api/admin/inquiries/:id
app.delete('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  const inquiryId = req.params.id;
  db.run('DELETE FROM contact_inquiries WHERE id = ?', [inquiryId], function (err) {
    if (err) return res.status(500).json({ success: false, message: 'Failed to delete inquiry.' });
    return res.json({ success: true, message: 'Inquiry deleted.' });
  });
});

// Fallback Routes for SPA Navigation
app.get(/^\/admin/, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Fallback Route for Client SPA Dashboard Navigation
app.get(/^\/dashboard/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Assignment Dai Client Dashboard Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📱 SPA Route: http://localhost:${PORT}/dashboard.html`);
  console.log(`=======================================================`);
});
