const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const db = require('./db');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');

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
app.post('/api/projects', authenticateToken, upload.array('files'), (req, res) => {
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

  // Estimate price calculation based on word count & deadline
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
      projectId, clientId, title, category, subject, academic_level || 'Undergraduate',
      institution || '', project_type || 'Essay', description || '', requirements || '',
      calculatedWordCount, parseInt(page_count) || Math.ceil(calculatedWordCount / 250),
      citation_style || 'APA 7th', formatting || 'Standard 12pt', start_date || new Date().toISOString().split('T')[0],
      deadline, priority || 'Medium', estPrice
    ],
    function (err) {
      if (err) {
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
        [`INV-2026-${randomNum}`, projectId, clientId, estPrice, estPrice]);

      // Create conversation
      db.run(`INSERT INTO conversations (project_id, client_id, expert_id) VALUES (?, ?, 1)`, [projectId, clientId]);

      // Handle uploaded files
      if (req.files && req.files.length > 0) {
        const stmt = db.prepare(`INSERT INTO attachments (project_id, uploaded_by_id, uploaded_by_name, category, filename, original_name, file_size, file_type, file_path) VALUES (?, ?, ?, 'Client Files', ?, ?, ?, ?, ?)`);
        req.files.forEach(f => {
          stmt.run(projectId, clientId, req.user.full_name || 'Client', f.filename, f.originalname, f.size, f.mimetype, `uploads/${f.filename}`);
        });
        stmt.finalize();
      }

      logAudit(projectId, clientId, 'PROJECT_CREATED', `Project ${projectId} created: ${title}`);
      createNotification(clientId, projectId, 'Project Created Successfully', `Your project ${projectId} has been created and is under review.`, 'project');

      return res.status(201).json({
        success: true,
        message: 'Project created successfully!',
        project_id: projectId
      });
    }
  );
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

// Fallback Route for SPA Dashboard Navigation
app.get(/^\/dashboard/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AssignmentWaala Client Dashboard Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📱 SPA Route: http://localhost:${PORT}/dashboard.html`);
  console.log(`=======================================================`);
});
