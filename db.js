const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'client',
      institution TEXT,
      academic_level TEXT,
      country TEXT,
      preferred_communication TEXT DEFAULT 'Email & Dashboard',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Experts Table
  db.run(`
    CREATE TABLE IF NOT EXISTS experts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      expertise TEXT,
      rating REAL DEFAULT 4.9,
      experience_years INTEGER DEFAULT 5,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Projects Table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      academic_level TEXT,
      institution TEXT,
      project_type TEXT,
      description TEXT,
      requirements TEXT,
      word_count INTEGER DEFAULT 0,
      page_count INTEGER DEFAULT 0,
      citation_style TEXT,
      formatting TEXT,
      start_date DATE,
      deadline DATE,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Submitted',
      progress_percent INTEGER DEFAULT 10,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Pending',
      assigned_expert_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id),
      FOREIGN KEY (assigned_expert_id) REFERENCES experts(id)
    )
  `);

  // 4. Project Timeline Audit Table
  db.run(`
    CREATE TABLE IF NOT EXISTS project_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      responsible_party TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 5. Quotes Table
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      estimated_price REAL NOT NULL,
      final_quote REAL NOT NULL,
      service_fee REAL DEFAULT 0,
      additional_charges REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_deadline DATE,
      quote_expiry DATE,
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 6. Payments / Invoices Table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      final_amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      payment_method TEXT,
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (client_id) REFERENCES users(id)
    )
  `);

  // 7. Conversations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      expert_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 8. Messages Table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_name TEXT,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      file_url TEXT,
      file_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `);

  // 9. Attachments Table
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      uploaded_by_id INTEGER NOT NULL,
      uploaded_by_name TEXT,
      category TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT,
      file_path TEXT NOT NULL,
      file_version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 10. Revisions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      revision_reason TEXT NOT NULL,
      detailed_instructions TEXT NOT NULL,
      requested_deadline DATE,
      status TEXT DEFAULT 'Requested',
      response_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 11. Reviews Table
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      expert_id INTEGER NOT NULL,
      star_rating INTEGER CHECK(star_rating BETWEEN 1 AND 5),
      written_review TEXT,
      communication_rating INTEGER DEFAULT 5,
      quality_rating INTEGER DEFAULT 5,
      timeliness_rating INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // 12. Notifications Table
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 13. Support Tickets Table
  db.run(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id)
    )
  `);

  // 14. Support Messages Table
  db.run(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_name TEXT,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
    )
  `);

  // 15. Audit Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      user_id INTEGER,
      action TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 16. Contact Inquiries Table
  db.run(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'New',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Default Demo Experts if empty
  db.get("SELECT COUNT(*) AS count FROM experts", (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare("INSERT INTO experts (full_name, avatar_url, expertise, rating, experience_years, bio) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run("Dr. Aris Thorne", "images/tm.jpg", "Computer Science & Artificial Intelligence", 4.95, 8, "PhD in Computer Science, Senior Academic Researcher & Algorithm Specialist.");
      stmt.run("Prof. Elena Rostova", "images/tm2.jpg", "Business Administration & Finance", 4.90, 10, "MBA Professor with expertise in financial modeling and strategic business analysis.");
      stmt.run("Marcus Vance", "images/tm3.jpg", "Software Engineering & Data Science", 4.88, 7, "Senior Software Architect, specialist in Python, React, and Full-Stack Engineering.");
      stmt.run("Dr. Sophia Sterling", "images/tm4.jpg", "Biomedical Sciences & Healthcare", 4.98, 12, "Senior Researcher in Life Sciences and Clinical Bio-statistics.");
      stmt.finalize();
      console.log("Seeded default experts into database.");
    }
  });

  // Seed Demo Client Account (Email: student@demo.com / Password: Password123!)
  db.get("SELECT COUNT(*) AS count FROM users WHERE email = 'student@demo.com'", async (err, row) => {
    if (!err && row.count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Password123!', salt);
      db.run(`
        INSERT INTO users (full_name, email, password_hash, phone, role, institution, academic_level, country, preferred_communication, avatar_url)
        VALUES ('Gareema Sharma', 'student@demo.com', ?, '+1 415 555 0199', 'client', 'Tribhuvan University', 'Postgraduate', 'Nepal', 'Email & Dashboard', 'images/fv.png')
      `, [hashedPassword], function(err) {
        if (!err) {
          const userId = this.lastID;
          console.log("Seeded demo user student@demo.com (ID: " + userId + ")");
          seedDemoData(userId);
        }
      });
    }
  });

  // Seed Default Administrator Account (Email: admin@assignmentdai.com / Password: Admin123!)
  db.get("SELECT COUNT(*) AS count FROM users WHERE email = 'admin@assignmentdai.com'", async (err, row) => {
    if (!err && row.count === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin123!', salt);
      db.run(`
        INSERT INTO users (full_name, email, password_hash, phone, role, institution, academic_level, country, preferred_communication, avatar_url)
        VALUES ('Assignment Dai Admin', 'admin@assignmentdai.com', ?, '+977 980-123-4567', 'admin', 'Assignment Dai Operations', 'Administrator', 'Nepal', 'Email & Dashboard', 'images/logo1.png')
      `, [hashedPassword], function(err) {
        if (!err) {
          console.log("Seeded default admin user admin@assignmentdai.com (ID: " + this.lastID + ")");
        }
      });
    }
  });
});

function seedDemoData(userId) {
  // Project 1: Advanced Neural Networks Analysis (In Progress)
  const p1Id = 'PRJ-1082';
  db.run(`
    INSERT INTO projects (id, client_id, title, category, subject, academic_level, institution, project_type, description, requirements, word_count, page_count, citation_style, formatting, start_date, deadline, priority, status, progress_percent, total_amount, paid_amount, payment_status, assigned_expert_id)
    VALUES (?, ?, 'Advanced Neural Network Optimization Report', 'Computer Science', 'Machine Learning', 'Postgraduate', 'Oxford University', 'Research Paper', 'Comprehensive empirical study on gradient descent acceleration algorithms.', 'Must include Python PyTorch code benchmarks, confusion matrices, and APA 7th citations.', 4500, 15, 'APA 7th', 'Double Spaced, 12pt Times New Roman', '2026-10-01', '2026-10-18', 'High', 'In Progress', 65, 240.00, 240.00, 'Paid', 1)
  `, [p1Id, userId]);

  // Project 1 Timeline
  db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Submitted', 'Project Submitted', 'Client submitted project request', 'Client')`, [p1Id]);
  db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Reviewed', 'Requirements Reviewed', 'Academic coordinator verified requirements', 'Support')`, [p1Id]);
  db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Assigned', 'Expert Assigned', 'Dr. Aris Thorne assigned to project', 'System')`, [p1Id]);
  db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'Paid', 'Payment Completed', 'Full payment of $240.00 received', 'Client')`, [p1Id]);
  db.run(`INSERT INTO project_timeline (project_id, status, title, description, responsible_party) VALUES (?, 'In Progress', 'Research & Writing in Progress', 'First draft empirical benchmarks generated (65%)', 'Expert')`, [p1Id]);

  // Project 1 Quote & Payment
  db.run(`INSERT INTO quotes (project_id, estimated_price, final_quote, service_fee, additional_charges, discount, total_amount, payment_deadline, quote_expiry, status, notes) VALUES (?, 260.00, 240.00, 10.00, 0, 30.00, 240.00, '2026-10-05', '2026-10-10', 'Accepted', 'Discount applied for postgraduate standard package.')`, [p1Id]);
  db.run(`INSERT INTO payments (invoice_number, project_id, client_id, amount, tax, discount, final_amount, status, payment_method, transaction_id) VALUES ('INV-2026-1082', ?, ?, 240.00, 0, 30.00, 240.00, 'Paid', 'Credit Card (Stripe)', 'TXN-99882311')`, [p1Id, userId]);

  // Project 1 Conversation & Messages
  db.run(`INSERT INTO conversations (project_id, client_id, expert_id) VALUES (?, ?, 1)`, [p1Id, userId], function(err) {
    if (!err) {
      const convId = this.lastID;
      db.run(`INSERT INTO messages (conversation_id, sender_id, sender_name, sender_role, message, is_read) VALUES (?, 1, 'Dr. Aris Thorne', 'expert', 'Hello Gareema! I have reviewed your PyTorch requirements. Research is progressing smoothly.', 1)`, [convId]);
      db.run(`INSERT INTO messages (conversation_id, sender_id, sender_name, sender_role, message, is_read) VALUES (?, ?, 'Gareema Sharma', 'client', 'Thank you Dr. Aris! Please make sure to emphasize the ResNet loss curves.', 1)`, [convId, userId]);
      db.run(`INSERT INTO messages (conversation_id, sender_id, sender_name, sender_role, message, is_read) VALUES (?, 1, 'Dr. Aris Thorne', 'expert', 'Understood! I will upload the loss curves chart draft shortly.', 0)`, [convId]);
    }
  });

  // Project 1 Attachment
  db.run(`INSERT INTO attachments (project_id, uploaded_by_id, uploaded_by_name, category, filename, original_name, file_size, file_type, file_path, file_version) VALUES (?, ?, 'Gareema Sharma', 'Client Files', 'dataset_spec.pdf', 'Dataset Specifications.pdf', 1048576, 'application/pdf', 'uploads/dataset_spec.pdf', 1)`, [p1Id, userId]);

  // Project 2: Global Financial Strategy Essay (Awaiting Payment)
  const p2Id = 'PRJ-1085';
  db.run(`
    INSERT INTO projects (id, client_id, title, category, subject, academic_level, institution, project_type, description, requirements, word_count, page_count, citation_style, formatting, start_date, deadline, priority, status, progress_percent, total_amount, paid_amount, payment_status, assigned_expert_id)
    VALUES (?, ?, 'Global Financial Market Dynamics Essay', 'Business & Management', 'Corporate Finance', 'Postgraduate', 'Oxford University', 'Case Study', 'Analysis of interest rate shifts on emerging market debt portfolios.', 'Include Harvard style referencing and 2026 inflation metrics.', 3000, 10, 'Harvard', '1.5 Spaced', '2026-10-08', '2026-10-22', 'Medium', 'Payment Pending', 25, 180.00, 0, 'Pending', 2)
  `, [p2Id, userId]);

  db.run(`INSERT INTO quotes (project_id, estimated_price, final_quote, service_fee, additional_charges, discount, total_amount, payment_deadline, quote_expiry, status, notes) VALUES (?, 195.00, 180.00, 5.00, 0, 20.00, 180.00, '2026-10-12', '2026-10-15', 'Pending', 'Special seasonal discount applied.')`, [p2Id]);
  db.run(`INSERT INTO payments (invoice_number, project_id, client_id, amount, tax, discount, final_amount, status, payment_method, transaction_id) VALUES ('INV-2026-1085', ?, ?, 180.00, 0, 20.00, 180.00, 'Pending', 'Credit Card', NULL)`, [p2Id, userId]);

  // Project 3: Completed Thesis Review
  const p3Id = 'PRJ-1040';
  db.run(`
    INSERT INTO projects (id, client_id, title, category, subject, academic_level, institution, project_type, description, requirements, word_count, page_count, citation_style, formatting, start_date, deadline, priority, status, progress_percent, total_amount, paid_amount, payment_status, assigned_expert_id)
    VALUES (?, ?, 'Healthcare Systems Econometrics Thesis', 'Medicine & Health', 'Biostatistics', 'Postgraduate', 'Oxford University', 'Thesis Dissertation', 'Proofreading and statistical validation of healthcare survey regressions.', 'Validate SPSS data files and edit final chapter.', 8000, 26, 'IEEE', 'Double Spaced', '2026-09-01', '2026-09-25', 'High', 'Completed', 100, 450.00, 450.00, 'Paid', 4)
  `, [p3Id, userId]);

  db.run(`INSERT INTO reviews (project_id, client_id, expert_id, star_rating, written_review, communication_rating, quality_rating, timeliness_rating) VALUES (?, ?, 4, 5, 'Outstanding statistical verification and detailed feedback! Delivered 2 days early.', 5, 5, 5)`, [p3Id, userId]);

  // Notifications
  db.run(`INSERT INTO notifications (user_id, project_id, title, message, type, is_read) VALUES (?, 'PRJ-1082', 'New Expert Message', 'Dr. Aris Thorne sent you a new message regarding your neural network benchmarks.', 'message', 0)`, [userId]);
  db.run(`INSERT INTO notifications (user_id, project_id, title, message, type, is_read) VALUES (?, 'PRJ-1085', 'Quote Ready for Review', 'Your quote for Project PRJ-1085 is ready ($180.00). Please review and accept.', 'quote', 0)`, [userId]);
  db.run(`INSERT INTO notifications (user_id, project_id, title, message, type, is_read) VALUES (?, 'PRJ-1082', 'Progress Milestone Reached', 'Project PRJ-1082 progress updated to 65%.', 'progress', 1)`, [userId]);

  // Support Tickets
  db.run(`INSERT INTO support_tickets (id, client_id, subject, category, priority, status) VALUES ('TCK-501', ?, 'Inquiry regarding citation style customization', 'Academic Guidance', 'Low', 'Resolved')`, [userId]);
  db.run(`INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message) VALUES ('TCK-501', ?, 'Gareema Sharma', 'client', 'Can I specify custom IEEE superscript citation formats?')`, [userId]);
  db.run(`INSERT INTO support_messages (ticket_id, sender_id, sender_name, sender_role, message) VALUES ('TCK-501', 99, 'Support Officer Mark', 'support', 'Yes absolutely! You can attach your institution style guide directly in the project files section.')`);

  console.log("Seeded comprehensive demo project data.");
}

module.exports = db;
