/* ==========================================================================
   ASSIGNMENT DAI - UNIVERSAL SITE AUTHENTICATION CLIENT CONTROLLER
   Handles Login modal, Student / Admin authentication, and Session Navbar
   ========================================================================== */

window.AssignmentDaiAuth = (function () {
  'use strict';

  // State
  let currentToken = localStorage.getItem('aw_token') || null;
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('aw_user') || 'null');
  } catch (e) {
    currentUser = null;
  }
  let adminToken = localStorage.getItem('assignmentdai_admin_token') || null;

  // Initialize Navbar and Listeners on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initAuthNavbar();
    bindAuthEvents();
  });

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Show Alert inside Modal
  function showAlert(boxId, msg, isSuccess = false) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.className = `auth-alert-box ${isSuccess ? 'auth-alert-success' : 'auth-alert-danger'}`;
    box.innerHTML = `<i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'} mr-1"></i> ${escapeHtml(msg)}`;
    box.style.display = 'flex';
  }

  function hideAlert(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.style.display = 'none';
  }

  // Navbar Initialization (Preserves clean Sign Up button navigating directly to signup.html)
  function initAuthNavbar() {
    // Only bind elements explicitly marked with data-open-auth if any exist
    document.querySelectorAll('[data-open-auth]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-open-auth') || 'student';
        openModal(tab);
      });
    });
  }

  // Open Modal and select specific tab
  function openModal(tab = 'student') {
    // Close mobile drawer if open
    const drawer = document.getElementById('awMobileDrawer');
    if (drawer && drawer.classList.contains('is-active')) {
      drawer.classList.remove('is-active');
      document.body.classList.remove('aw-drawer-open');
    }

    hideAlert('studentLoginAlert');
    hideAlert('adminLoginAlert');
    hideAlert('registerAlert');

    switchTab(tab);
    $('#siteAuthModal').modal('show');
  }

  // Tab Switcher
  function switchTab(tab) {
    document.querySelectorAll('.auth-nav-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-tab-pane').forEach(p => p.style.display = 'none');

    const btn = document.getElementById(`tabBtn_${tab}`);
    const pane = document.getElementById(`tabPane_${tab}`);
    if (btn) btn.classList.add('active');
    if (pane) pane.style.display = 'block';
  }

  // Bind Form Submits
  function bindAuthEvents() {
    // Tab buttons
    const tabBtns = document.querySelectorAll('.auth-nav-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // Student Login Form
    const studentForm = document.getElementById('formStudentLogin');
    if (studentForm) {
      studentForm.addEventListener('submit', handleStudentLogin);
    }

    // Admin Login Form
    const adminForm = document.getElementById('formAdminLogin');
    if (adminForm) {
      adminForm.addEventListener('submit', handleAdminLogin);
    }

    // Register Form
    const registerForm = document.getElementById('formRegister');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
  }

  // 1. Student Login Handler
  async function handleStudentLogin(e) {
    e.preventDefault();
    hideAlert('studentLoginAlert');
    const btn = document.getElementById('btnSubmitStudentLogin');
    const email = document.getElementById('studentEmail').value.trim();
    const password = document.getElementById('studentPassword').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Authenticating...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('aw_token', data.token);
        localStorage.setItem('aw_user', JSON.stringify(data.user));
        showAlert('studentLoginAlert', 'Authentication successful! Redirecting to dashboard...', true);
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      } else {
        showAlert('studentLoginAlert', data.message || 'Invalid email or password.');
      }
    } catch (err) {
      showAlert('studentLoginAlert', 'Network connection error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt mr-1"></i> Sign In to Student Portal';
    }
  }

  // 2. Admin Login Handler
  async function handleAdminLogin(e) {
    e.preventDefault();
    hideAlert('adminLoginAlert');
    const btn = document.getElementById('btnSubmitAdminLogin');
    const email = document.getElementById('siteAdminEmail').value.trim();
    const password = document.getElementById('siteAdminPassword').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Authenticating...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('assignmentdai_admin_token', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        showAlert('adminLoginAlert', 'Admin credentials verified! Entering Operations Console...', true);
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 500);
      } else {
        showAlert('adminLoginAlert', data.message || 'Invalid administrator credentials.');
      }
    } catch (err) {
      showAlert('adminLoginAlert', 'Network connection error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-shield-alt mr-1"></i> Sign In to Admin Console';
    }
  }

  // 3. Register Handler
  async function handleRegister(e) {
    e.preventDefault();
    hideAlert('registerAlert');
    const btn = document.getElementById('btnSubmitRegister');

    const payload = {
      full_name: document.getElementById('regFullName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPassword').value,
      phone: document.getElementById('regPhone').value.trim(),
      institution: document.getElementById('regInstitution').value.trim(),
      academic_level: document.getElementById('regAcademicLevel').value
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Creating Account...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('aw_token', data.token);
        localStorage.setItem('aw_user', JSON.stringify(data.user));
        showAlert('registerAlert', 'Account registered successfully! Welcome to Assignment Dai.', true);
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      } else {
        showAlert('registerAlert', data.message || 'Failed to create account.');
      }
    } catch (err) {
      showAlert('registerAlert', 'Network connection error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus mr-1"></i> Complete Registration';
    }
  }

  // Demo Credentials Quick Filler
  function fillDemo(type) {
    if (type === 'student') {
      switchTab('student');
      document.getElementById('studentEmail').value = 'student@demo.com';
      document.getElementById('studentPassword').value = 'Password123!';
    } else if (type === 'admin') {
      switchTab('admin');
      document.getElementById('siteAdminEmail').value = 'admin@assignmentdai.com';
      document.getElementById('siteAdminPassword').value = 'Admin123!';
    }
  }

  // Password Visibility Toggle
  function togglePassword(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btnEl) {
      btnEl.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    }
  }

  // Logout
  function logout() {
    localStorage.removeItem('aw_token');
    localStorage.removeItem('aw_user');
    localStorage.removeItem('assignmentdai_admin_token');
    localStorage.removeItem('adminUser');
    window.location.reload();
  }

  return {
    openModal,
    switchTab,
    fillDemo,
    togglePassword,
    logout
  };

})();
