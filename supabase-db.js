const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Using service key for admin operations
);

// Test connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
    console.log('✅ Supabase connected successfully!');
    return true;
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

// Initialize Database Tables (Run once)
async function initializeDatabase() {
  try {
    console.log('📊 Initializing Supabase database tables...');

    // 1. Users Table
    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `
    }).catch(err => console.log('Users table exists or note needed'));

    // 2. Experts Table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS experts (
          id BIGSERIAL PRIMARY KEY,
          full_name TEXT NOT NULL,
          avatar_url TEXT,
          expertise TEXT,
          rating REAL DEFAULT 4.9,
          experience_years INTEGER DEFAULT 5,
          bio TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
    }).catch(err => console.log('Experts table exists or note needed'));

    // 3. Projects Table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          client_id BIGINT NOT NULL REFERENCES users(id),
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
          assigned_expert_id BIGINT REFERENCES experts(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      `
    }).catch(err => console.log('Projects table exists or note needed'));

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Helper function to create notification
async function createNotification(userId, projectId, title, message, type = 'info') {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          project_id: projectId,
          title: title,
          message: message,
          type: type,
          is_read: false
        }
      ]);
    
    if (error) console.error('Notification creation error:', error);
    return data;
  } catch (err) {
    console.error('Notification error:', err);
  }
}

// Helper function to log audit
async function logAudit(projectId, userId, action, description) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          project_id: projectId,
          user_id: userId,
          action: action,
          description: description
        }
      ]);
    
    if (error) console.error('Audit log error:', error);
  } catch (err) {
    console.error('Audit error:', err);
  }
}

// Export functions
module.exports = {
  supabase,
  testConnection,
  initializeDatabase,
  createNotification,
  logAudit
};
