/* ==========================================================================
   ASSIGNMENT DAI - ENTERPRISE ADMIN PANEL SPA CONTROLLER (V2 PRO)
   Executive SaaS Dashboard with Rich Composite Rows & Card View
   ========================================================================== */

(function () {
  'use strict';

  const API_BASE = '/api/admin';
  let adminUser = null;
  let adminToken = localStorage.getItem('assignmentdai_admin_token') || null;

  // Global State Cache
  let currentStats = null;
  let cachedProjects = [];
  let cachedUsers = [];
  let cachedExperts = [];
  let cachedTickets = [];
  let cachedInquiries = [];
  let cachedPayments = [];

  // Project View State
  let currentProjectFilter = 'all';
  let currentProjectSearch = '';
  let currentProjectViewMode = 'table'; // 'table' | 'grid'

  // Helper: API Request with Admin Auth
  async function apiRequest(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (adminToken) {
      options.headers['Authorization'] = `Bearer ${adminToken}`;
    }
    if (!(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        if (!endpoint.includes('/login')) {
          adminLogout('Your administrator session has expired. Please sign in again.');
        }
      }
      return data;
    } catch (err) {
      console.error('API Error:', err);
      return { success: false, message: 'Network connection failed.' };
    }
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 24px; right: 24px; z-index: 999999; min-width: 320px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); border-radius: 12px; font-weight: 500;';
    toast.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${type === 'success' ? 'check-circle text-success' : 'exclamation-circle text-danger'} mr-2" style="font-size: 1.2rem;"></i>
        <div>
          <strong class="d-block">${type === 'success' ? 'Success' : 'Notice'}</strong>
          <span class="small">${escapeHtml(message)}</span>
        </div>
        <button type="button" class="close ml-auto" data-dismiss="alert">&times;</button>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      $(toast).alert('close');
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return `$${num.toFixed(2)}`;
  }

  function formatDate(d) {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return d;
    }
  }

  function getDaysRemainingBadge(deadline) {
    if (!deadline) return '';
    const due = new Date(deadline);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `<span class="badge badge-danger font-weight-bold ml-1"><i class="fas fa-exclamation-triangle"></i> Overdue</span>`;
    } else if (diffDays === 0) {
      return `<span class="badge badge-warning text-dark font-weight-bold ml-1"><i class="fas fa-clock"></i> Today</span>`;
    } else if (diffDays <= 2) {
      return `<span class="badge badge-warning text-dark font-weight-bold ml-1"><i class="fas fa-bolt"></i> ${diffDays}d left</span>`;
    }
    return `<span class="badge badge-light border text-muted ml-1">${diffDays}d left</span>`;
  }

  // Modern Progress Bar
  function getModernProgressBar(percent, status) {
    const pct = Math.min(100, Math.max(0, parseInt(percent) || 0));
    let fillClass = 'fill-progress';
    const s = (status || '').toLowerCase();
    if (pct === 100 || s.includes('completed')) {
      fillClass = 'fill-complete';
    } else if (pct === 0) {
      fillClass = 'fill-submitted';
    } else if (s.includes('review')) {
      fillClass = 'fill-review';
    }
    return `
      <div class="modern-progress-wrap">
        <div class="modern-progress-header">
          <span class="modern-progress-label">Milestone</span>
          <span class="modern-progress-val">${pct}%</span>
        </div>
        <div class="modern-progress-track">
          <div class="modern-progress-fill ${fillClass}" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }

  // Modern Status Pill
  function getStatusPill(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('completed')) {
      return `<span class="status-pill status-completed"><i class="fas fa-check-circle"></i> Completed</span>`;
    }
    if (s.includes('progress')) {
      return `<span class="status-pill status-inprogress"><i class="fas fa-spinner fa-spin"></i> In Progress</span>`;
    }
    if (s.includes('reviewed')) {
      return `<span class="status-pill status-reviewed"><i class="fas fa-file-invoice"></i> Reviewed</span>`;
    }
    if (s.includes('paid')) {
      return `<span class="status-pill status-paid"><i class="fas fa-check-double"></i> Paid</span>`;
    }
    if (s.includes('pending')) {
      return `<span class="status-pill status-pending"><i class="fas fa-hourglass-half"></i> Pending</span>`;
    }
    return `<span class="status-pill status-submitted"><i class="fas fa-paper-plane"></i> ${escapeHtml(status || 'Submitted')}</span>`;
  }

  // Check Session
  async function initAuth() {
    if (!adminToken) {
      showLoginView();
      return;
    }

    const data = await apiRequest('/me');
    if (data.success && data.user) {
      adminUser = data.user;
      showAppView();
    } else {
      adminLogout();
    }
  }

  // Show Login Screen
  function showLoginView() {
    document.getElementById('adminLoginView').style.display = 'flex';
    document.getElementById('adminAppView').style.display = 'none';
  }

  // Show Main App Screen
  function showAppView() {
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminAppView').style.display = 'flex';

    if (adminUser) {
      document.getElementById('adminCurrentUserName').innerText = adminUser.full_name || 'Admin';
      document.getElementById('adminCurrentUserRole').innerText = 'Super Admin';
    }

    handleRoute();
  }

  // Handle Login Submission
  async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const alertBox = document.getElementById('loginAlert');
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Authenticating...';
    alertBox.style.display = 'none';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        adminToken = data.token;
        adminUser = data.user;
        localStorage.setItem('assignmentdai_admin_token', adminToken);
        showToast('Welcome back, Administrator!', 'success');
        showAppView();
      } else {
        alertBox.innerText = data.message || 'Invalid administrator credentials.';
        alertBox.style.display = 'block';
      }
    } catch (err) {
      alertBox.innerText = 'Unable to connect to the authentication service.';
      alertBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-shield-alt mr-2"></i> Secure Admin Sign In';
    }
  }

  // Logout
  window.adminLogout = function (msg) {
    adminToken = null;
    adminUser = null;
    localStorage.removeItem('assignmentdai_admin_token');
    showLoginView();
    if (msg) showToast(msg, 'info');
  };

  // Hash Routing
  function handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    const route = hash.split('?')[0];

    // Update active nav class
    document.querySelectorAll('.admin-nav-item').forEach(el => {
      const href = el.getAttribute('href');
      if (href === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    const contentContainer = document.getElementById('adminMainContent');
    const headline = document.getElementById('pageHeadline');
    const sectionTag = document.getElementById('topbarSectionTag');

    switch (route) {
      case '#/dashboard':
        if (sectionTag) sectionTag.innerText = 'Overview';
        headline.innerText = 'Executive Dashboard & Metrics';
        renderDashboard(contentContainer);
        break;
      case '#/projects':
        if (sectionTag) sectionTag.innerText = 'Orders';
        headline.innerText = 'Assignment Projects & Orders';
        renderProjects(contentContainer);
        break;
      case '#/quotes':
        if (sectionTag) sectionTag.innerText = 'Finance';
        headline.innerText = 'Quotations & Pricing Manager';
        renderQuotes(contentContainer);
        break;
      case '#/users':
        if (sectionTag) sectionTag.innerText = 'Accounts';
        headline.innerText = 'Registered Students & Accounts';
        renderUsers(contentContainer);
        break;
      case '#/experts':
        if (sectionTag) sectionTag.innerText = 'Roster';
        headline.innerText = 'Verified Mentors & Academic Scholars';
        renderExperts(contentContainer);
        break;
      case '#/payments':
        if (sectionTag) sectionTag.innerText = 'Billing';
        headline.innerText = 'Invoices, Fees & Payment Ledger';
        renderPayments(contentContainer);
        break;
      case '#/support':
        if (sectionTag) sectionTag.innerText = 'Helpdesk';
        headline.innerText = 'Student Support Tickets';
        renderSupport(contentContainer);
        break;
      case '#/inquiries':
        if (sectionTag) sectionTag.innerText = 'Leads';
        headline.innerText = 'Website Contact Form Leads';
        renderInquiries(contentContainer);
        break;
      default:
        if (sectionTag) sectionTag.innerText = 'Overview';
        headline.innerText = 'Executive Dashboard';
        renderDashboard(contentContainer);
        break;
    }
  }

  // ==========================================
  // VIEW 1: DASHBOARD OVERVIEW
  // ==========================================
  async function renderDashboard(container) {
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="text-muted mt-2 font-weight-bold">Loading assignment metrics...</div>
      </div>
    `;

    const res = await apiRequest('/stats');
    if (!res.success) {
      container.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
      return;
    }

    currentStats = res.stats;
    const recentProjects = res.recent_projects || [];
    const recentInquiries = res.recent_inquiries || [];

    // Update badge counters in sidebar
    if (document.getElementById('badgePendingQuotes')) {
      document.getElementById('badgePendingQuotes').innerText = currentStats.pending_quotes || 0;
    }
    if (document.getElementById('badgeOpenTickets')) {
      document.getElementById('badgeOpenTickets').innerText = currentStats.open_tickets || 0;
    }
    if (document.getElementById('badgeNewInquiries')) {
      document.getElementById('badgeNewInquiries').innerText = currentStats.new_inquiries || 0;
    }

    container.innerHTML = `
      <!-- KPI CARDS GRID -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-green">
            <i class="fas fa-wallet"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">Gross Revenue</div>
            <div class="kpi-value">${formatCurrency(currentStats.total_revenue)}</div>
            <div class="kpi-trend trend-up">
              <i class="fas fa-arrow-up"></i> All settled transactions
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-blue">
            <i class="fas fa-layer-group"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">Active Projects</div>
            <div class="kpi-value">${currentStats.active_projects}</div>
            <div class="kpi-trend trend-sub">
              ${currentStats.total_projects} total submitted
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-amber">
            <i class="fas fa-file-invoice-dollar"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">Pending Quotes</div>
            <div class="kpi-value">${currentStats.pending_quotes}</div>
            <div class="kpi-trend text-warning font-weight-bold">
              <i class="fas fa-bell mr-1"></i> Needs quote review
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-purple">
            <i class="fas fa-user-graduate"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">Enrolled Students</div>
            <div class="kpi-value">${currentStats.total_users}</div>
            <div class="kpi-trend trend-sub">
              Across major universities
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-cyan">
            <i class="fas fa-chalkboard-teacher"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">Verified Mentors</div>
            <div class="kpi-value">${currentStats.total_experts}</div>
            <div class="kpi-trend trend-sub">
              PhD & Masters scholars
            </div>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box kpi-icon-pink">
            <i class="fas fa-envelope-open-text"></i>
          </div>
          <div class="kpi-info">
            <div class="kpi-title">New Contact Leads</div>
            <div class="kpi-value">${currentStats.new_inquiries}</div>
            <div class="kpi-trend text-danger font-weight-bold">
              <i class="fas fa-comment-dots mr-1"></i> Website inquiries
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN ROW: RECENT ASSIGNMENTS (CLEAN COMPOSITE ROWS) & QUICK LEADS -->
      <div class="row">
        <!-- Recent Projects Table (4 Clean Columns - NO OVERFLOW) -->
        <div class="col-lg-8 mb-4">
          <div class="admin-card">
            <div class="admin-card-header">
              <div>
                <h3 class="admin-card-title">
                  <i class="fas fa-tasks text-primary"></i> Recent Assignment Requests
                </h3>
                <div class="admin-card-subtitle">Active submissions requiring coordination or milestone updates</div>
              </div>
              <a href="#/projects" class="btn btn-sm btn-outline-primary rounded-pill font-weight-bold px-3">
                View All <i class="fas fa-arrow-right ml-1"></i>
              </a>
            </div>
            <div class="admin-table-wrapper">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th style="width: 44%;">Assignment & Student</th>
                    <th style="width: 26%;">Status & Progress</th>
                    <th style="width: 16%;">Fee & Billing</th>
                    <th style="width: 14%; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentProjects.length === 0 ? '<tr><td colspan="4" class="text-center py-5 text-muted">No projects found.</td></tr>' : ''}
                  ${recentProjects.map(p => `
                    <tr>
                      <td>
                        <div class="cell-composite">
                          <div class="cell-avatar cell-avatar-blue">
                            <i class="fas fa-file-alt"></i>
                          </div>
                          <div class="cell-composite-content">
                            <a href="javascript:void(0)" onclick="openProjectModal('${p.id}')" class="cell-primary-title text-truncate d-block" style="max-width: 250px;">
                              ${escapeHtml(p.title)}
                            </a>
                            <div class="cell-secondary-text">
                              <span class="badge badge-light border text-muted">#${escapeHtml(p.id)}</span>
                              <span><i class="fas fa-user-graduate text-muted mr-1"></i>${escapeHtml(p.client_name || 'Student')}</span>
                              <span>• ${escapeHtml(p.category)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div class="mb-1">${getStatusPill(p.status)}</div>
                          ${getModernProgressBar(p.progress_percent, p.status)}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div class="font-weight-800 text-dark" style="font-size: 0.96rem;">${formatCurrency(p.total_amount)}</div>
                          <span class="badge badge-${p.payment_status === 'Paid' ? 'success' : 'warning'} font-weight-600 mt-1">
                            ${escapeHtml(p.payment_status || 'Pending')}
                          </span>
                        </div>
                      </td>
                      <td style="text-align: right;">
                        <button class="btn-admin-manage" onclick="openProjectModal('${p.id}')">
                          <i class="fas fa-sliders-h"></i> Manage
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Recent Contact Leads -->
        <div class="col-lg-4 mb-4">
          <div class="admin-card">
            <div class="admin-card-header">
              <div>
                <h3 class="admin-card-title">
                  <i class="fas fa-inbox text-info"></i> Latest Contact Leads
                </h3>
                <div class="admin-card-subtitle">Incoming inquiries from website</div>
              </div>
              <a href="#/inquiries" class="btn btn-sm btn-outline-secondary rounded-pill">All Leads</a>
            </div>
            <div class="p-3">
              ${recentInquiries.length === 0 ? '<div class="text-muted text-center py-4">No contact inquiries yet.</div>' : ''}
              ${recentInquiries.map(inq => `
                <div class="p-3 mb-2 rounded border bg-light">
                  <div class="d-flex justify-content-between align-items-start mb-1">
                    <strong class="text-dark">${escapeHtml(inq.full_name)}</strong>
                    <span class="badge badge-${inq.status === 'New' ? 'danger' : 'success'} font-weight-bold">${inq.status}</span>
                  </div>
                  <div class="text-muted small mb-2"><i class="fas fa-envelope mr-1"></i> ${escapeHtml(inq.email)}</div>
                  <p class="small text-secondary mb-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                    "${escapeHtml(inq.message)}"
                  </p>
                  <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${formatDate(inq.created_at)}</small>
                    <a href="https://wa.me/?text=Hello%20${encodeURIComponent(inq.full_name)}%2C%20regarding%20your%20inquiry%20at%20Assignment%20Dai" target="_blank" class="btn btn-xs btn-outline-success font-weight-bold px-2 py-1" style="font-size: 0.75rem;">
                      <i class="fab fa-whatsapp"></i> Chat
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // VIEW 2: PROJECTS & ASSIGNMENTS
  // ==========================================
  async function renderProjects(container) {
    container.innerHTML = `
      <div class="admin-card">
        <!-- HEADER WITH SEARCH & VIEW SWITCHER -->
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title">
              <i class="fas fa-folder-open text-primary mr-1"></i> Assignment Projects & Orders
            </h3>
            <div class="admin-card-subtitle">Manage lifecycle, progress, deadlines, and assigned scholars</div>
          </div>

          <div class="d-flex align-items-center gap-3 flex-wrap">
            <div class="search-control-wrap">
              <i class="fas fa-search"></i>
              <input type="text" id="projectSearchInput" value="${escapeHtml(currentProjectSearch)}" placeholder="Search title, student, or ID..." oninput="handleProjectSearchInput(this.value)">
            </div>

            <div class="view-mode-toggle">
              <button class="view-mode-btn ${currentProjectViewMode === 'table' ? 'active' : ''}" onclick="switchProjectViewMode('table')" title="Table View">
                <i class="fas fa-list"></i>
              </button>
              <button class="view-mode-btn ${currentProjectViewMode === 'grid' ? 'active' : ''}" onclick="switchProjectViewMode('grid')" title="Card Grid View">
                <i class="fas fa-th-large"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- MODERN FILTER TABS BAR -->
        <div class="filter-tabs-bar" id="projectFilterTabsBar">
          <button class="filter-tab-pill ${currentProjectFilter === 'all' ? 'active' : ''}" onclick="selectProjectFilter('all')">
            All Assignments
          </button>
          <button class="filter-tab-pill ${currentProjectFilter === 'Submitted' ? 'active' : ''}" onclick="selectProjectFilter('Submitted')">
            Submitted (New)
          </button>
          <button class="filter-tab-pill ${currentProjectFilter === 'Reviewed' ? 'active' : ''}" onclick="selectProjectFilter('Reviewed')">
            Reviewed (Quote Ready)
          </button>
          <button class="filter-tab-pill ${currentProjectFilter === 'In Progress' ? 'active' : ''}" onclick="selectProjectFilter('In Progress')">
            In Progress
          </button>
          <button class="filter-tab-pill ${currentProjectFilter === 'Completed' ? 'active' : ''}" onclick="selectProjectFilter('Completed')">
            Completed
          </button>
          <button class="filter-tab-pill ${currentProjectFilter === 'Payment Pending' ? 'active' : ''}" onclick="selectProjectFilter('Payment Pending')">
            Payment Pending
          </button>
        </div>

        <!-- CONTENT AREA (TABLE OR GRID) -->
        <div id="projectsContentContainer">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    loadProjectsList();
  }

  window.selectProjectFilter = function (filter) {
    currentProjectFilter = filter;
    document.querySelectorAll('.filter-tab-pill').forEach(btn => {
      if (btn.innerText.toLowerCase().includes(filter.toLowerCase()) || (filter === 'all' && btn.innerText.includes('All'))) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    loadProjectsList();
  };

  window.handleProjectSearchInput = function (val) {
    currentProjectSearch = val;
    // Debounce search
    clearTimeout(window._projectSearchTimer);
    window._projectSearchTimer = setTimeout(() => {
      loadProjectsList();
    }, 250);
  };

  window.switchProjectViewMode = function (mode) {
    currentProjectViewMode = mode;
    document.querySelectorAll('.view-mode-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    renderProjectsContent();
  };

  async function loadProjectsList() {
    const res = await apiRequest(`/projects?status=${encodeURIComponent(currentProjectFilter)}&search=${encodeURIComponent(currentProjectSearch)}`);
    const container = document.getElementById('projectsContentContainer');
    if (!container) return;

    if (!res.success) {
      container.innerHTML = `<div class="alert alert-danger m-3">${res.message}</div>`;
      return;
    }

    cachedProjects = res.projects || [];
    renderProjectsContent();
  }

  function renderProjectsContent() {
    const container = document.getElementById('projectsContentContainer');
    if (!container) return;

    if (cachedProjects.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-folder-open fa-3x mb-3 text-light"></i>
          <h5>No assignments match the selected criteria</h5>
          <p class="small">Try adjusting your status filter or search keyword.</p>
        </div>
      `;
      return;
    }

    if (currentProjectViewMode === 'table') {
      // Sleek 6-column composite table (No horizontal clipping!)
      container.innerHTML = `
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="width: 28%;">Assignment & Subject</th>
                <th style="width: 18%;">Student</th>
                <th style="width: 16%;">Assigned Mentor</th>
                <th style="width: 14%;">Deadline</th>
                <th style="width: 14%;">Status & Progress</th>
                <th style="width: 10%; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${cachedProjects.map(p => `
                <tr>
                  <td>
                    <div class="cell-composite">
                      <div class="cell-avatar cell-avatar-blue">
                        <i class="fas fa-book-open"></i>
                      </div>
                      <div class="cell-composite-content">
                        <a href="javascript:void(0)" onclick="openProjectModal('${p.id}')" class="cell-primary-title text-truncate d-block" style="max-width: 250px;">
                          ${escapeHtml(p.title)}
                        </a>
                        <div class="cell-secondary-text">
                          <span class="badge badge-light border text-muted">#${escapeHtml(p.id)}</span>
                          <span class="text-primary font-weight-bold">${escapeHtml(p.subject || p.category)}</span>
                          <span>• ${p.word_count || 0} words</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <strong class="text-dark d-block">${escapeHtml(p.client_name || 'Anonymous')}</strong>
                      <small class="text-muted">${escapeHtml(p.client_email || '')}</small>
                    </div>
                  </td>
                  <td>
                    ${p.expert_name ? `
                      <div class="d-flex align-items-center gap-2">
                        <div class="cell-avatar cell-avatar-purple" style="width: 28px; height: 28px; font-size: 0.75rem;">
                          <i class="fas fa-chalkboard-teacher"></i>
                        </div>
                        <div>
                          <strong class="small text-dark d-block">${escapeHtml(p.expert_name)}</strong>
                          <span class="badge badge-light border text-muted" style="font-size: 0.7rem;">Verified</span>
                        </div>
                      </div>
                    ` : `
                      <button class="btn btn-xs btn-outline-warning text-dark font-weight-bold rounded-pill px-2 py-1" onclick="openProjectModal('${p.id}')">
                        <i class="fas fa-plus mr-1"></i> Assign Scholar
                      </button>
                    `}
                  </td>
                  <td>
                    <div>
                      <div class="font-weight-700 text-dark">${formatDate(p.deadline)}</div>
                      <div class="mt-1">${getDaysRemainingBadge(p.deadline)}</div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div class="mb-1">${getStatusPill(p.status)}</div>
                      ${getModernProgressBar(p.progress_percent, p.status)}
                    </div>
                  </td>
                  <td style="text-align: right;">
                    <div class="d-flex justify-content-end align-items-center gap-2">
                      <div class="text-right mr-2 d-none d-xl-block">
                        <strong class="text-dark d-block">${formatCurrency(p.total_amount)}</strong>
                        <span class="badge badge-${p.payment_status === 'Paid' ? 'success' : 'warning'} font-weight-600">${escapeHtml(p.payment_status || 'Pending')}</span>
                      </div>
                      <button class="btn-admin-manage" onclick="openProjectModal('${p.id}')">
                        <i class="fas fa-sliders-h"></i> Manage
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Modern Responsive Card Grid View
      container.innerHTML = `
        <div class="project-card-grid">
          ${cachedProjects.map(p => `
            <div class="project-item-card">
              <div class="project-item-card-header">
                <span class="badge badge-light border font-weight-bold">#${escapeHtml(p.id)}</span>
                <span class="badge badge-light border text-primary font-weight-bold">${escapeHtml(p.category || 'Academic')}</span>
                ${getStatusPill(p.status)}
              </div>

              <div class="project-item-card-title">
                ${escapeHtml(p.title)}
              </div>

              <div class="project-item-card-meta">
                <span><i class="fas fa-user-graduate text-muted mr-1"></i> ${escapeHtml(p.client_name)}</span>
                <span>•</span>
                <span><i class="fas fa-file-word text-muted mr-1"></i> ${p.word_count || 0} w</span>
              </div>

              <div class="mb-3">
                ${getModernProgressBar(p.progress_percent, p.status)}
              </div>

              <div class="d-flex justify-content-between align-items-center small text-muted mb-3 pt-2 border-top">
                <div>
                  <i class="fas fa-calendar-alt mr-1"></i> ${formatDate(p.deadline)}
                  ${getDaysRemainingBadge(p.deadline)}
                </div>
                <div>
                  ${p.expert_name ? `<span class="badge badge-primary"><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(p.expert_name)}</span>` : '<span class="badge badge-warning text-dark">Unassigned</span>'}
                </div>
              </div>

              <div class="project-item-card-footer">
                <div>
                  <strong class="h6 font-weight-bold text-dark mb-0">${formatCurrency(p.total_amount)}</strong>
                  <span class="badge badge-${p.payment_status === 'Paid' ? 'success' : 'warning'} ml-1">${escapeHtml(p.payment_status || 'Pending')}</span>
                </div>
                <button class="btn-admin-manage" onclick="openProjectModal('${p.id}')">
                  <i class="fas fa-sliders-h mr-1"></i> Manage
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // ==========================================
  // PROJECT MANAGEMENT MODAL (PERFECT VIEWPORT CONTAINMENT)
  // ==========================================
  window.openProjectModal = async function (projectId) {
    const modalEl = document.getElementById('projectManagementModal');
    const modalBody = document.getElementById('projectModalBody');
    const idBadge = document.getElementById('projectModalIdBadge');
    const statusBadge = document.getElementById('projectModalStatusBadge');
    const footerQuoteArea = document.getElementById('projectModalFooterQuoteArea');

    if (idBadge) idBadge.innerText = '#' + projectId;
    if (statusBadge) statusBadge.innerHTML = '';
    if (footerQuoteArea) footerQuoteArea.innerHTML = '';

    $(modalEl).modal('show');
    modalBody.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    // Load project details and experts list
    const [pRes, expRes] = await Promise.all([
      apiRequest(`/projects/${projectId}`),
      apiRequest('/experts')
    ]);

    if (!pRes.success) {
      modalBody.innerHTML = `<div class="alert alert-danger">${pRes.message}</div>`;
      return;
    }

    const p = pRes.project;
    const quote = pRes.quote;
    const attachments = pRes.attachments || [];
    const timeline = pRes.timeline || [];
    const experts = expRes.experts || [];

    if (statusBadge) statusBadge.innerHTML = getStatusPill(p.status);
    if (footerQuoteArea) {
      footerQuoteArea.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <span class="small text-muted font-weight-600">Quote: <strong>${quote ? formatCurrency(quote.total_amount) : 'None'}</strong></span>
          <button type="button" class="btn btn-xs btn-outline-warning text-dark font-weight-bold rounded-pill px-3 py-1" onclick="openQuoteModal('${p.id}', ${p.total_amount || 150})">
            <i class="fas fa-file-invoice mr-1"></i> ${quote ? 'Revise Quote' : 'Create Quote'}
          </button>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <!-- TOP BANNER SUMMARY -->
      <div class="p-3 mb-3 rounded-lg border bg-light d-flex justify-content-between align-items-center flex-wrap gap-2" style="border-radius: 12px;">
        <div style="max-width: 65%;">
          <h5 class="font-weight-800 text-dark mb-1" style="line-height: 1.35;">${escapeHtml(p.title)}</h5>
          <div class="small text-muted">
            <span><i class="fas fa-user-graduate text-muted mr-1"></i> <strong>${escapeHtml(p.client_name)}</strong> (${escapeHtml(p.client_email)})</span>
            <span class="mx-2">•</span>
            <span><i class="fas fa-layer-group text-primary mr-1"></i> <strong>${escapeHtml(p.category)}</strong></span>
          </div>
        </div>
        <div class="text-right">
          <div class="small text-muted font-weight-600">Due: <strong class="text-dark">${formatDate(p.deadline)}</strong></div>
          <div class="mt-1">${getDaysRemainingBadge(p.deadline)}</div>
        </div>
      </div>

      <div class="row">
        <!-- LEFT COLUMN: Guidelines, Specs, Files & Timeline -->
        <div class="col-lg-6 pr-lg-3">
          <!-- Guidelines Card -->
          <div class="modal-section-card mb-3">
            <div class="modal-section-title">
              <i class="fas fa-align-left text-primary"></i> Guidelines & Instructions
            </div>
            <p class="small text-secondary mb-2" style="white-space: pre-line; line-height: 1.5;">${escapeHtml(p.description || 'No detailed instructions provided.')}</p>
            ${p.requirements ? `
              <div class="small text-dark font-weight-bold mt-2">Special Notes:</div>
              <p class="small text-muted mb-0" style="white-space: pre-line;">${escapeHtml(p.requirements)}</p>
            ` : ''}
          </div>

          <!-- Specs Summary -->
          <div class="modal-section-card mb-3">
            <div class="modal-section-title">
              <i class="fas fa-info-circle text-info"></i> Project Specifications
            </div>
            <div class="row small">
              <div class="col-6 mb-2"><strong>Word Count:</strong> ${p.word_count || 0} words</div>
              <div class="col-6 mb-2"><strong>Citation:</strong> ${escapeHtml(p.citation_style || 'APA 7th')}</div>
              <div class="col-6 mb-2"><strong>Academic Level:</strong> ${escapeHtml(p.academic_level || 'Masters / Graduate')}</div>
              <div class="col-6 mb-2"><strong>Deadline:</strong> <span class="text-danger font-weight-bold">${formatDate(p.deadline)}</span></div>
            </div>
          </div>

          <!-- Attachments -->
          <div class="modal-section-card mb-3">
            <div class="modal-section-title">
              <i class="fas fa-paperclip text-info"></i> Uploaded Documents (${attachments.length})
            </div>
            ${attachments.length === 0 ? '<p class="small text-muted mb-0">No attachment files uploaded.</p>' : `
              <div class="list-group list-group-flush">
                ${attachments.map(att => `
                  <div class="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                    <div class="small text-truncate mr-2" style="max-width: 75%;">
                      <i class="fas fa-file-alt text-primary mr-1"></i> <strong>${escapeHtml(att.original_name)}</strong>
                      <span class="text-muted">(${(att.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <a href="/${att.file_path}" target="_blank" class="btn btn-xs btn-outline-primary py-1 px-2 font-weight-bold" download>
                      <i class="fas fa-download mr-1"></i> Download
                    </a>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Activity Timeline -->
          <div class="modal-section-card">
            <div class="modal-section-title">
              <i class="fas fa-history text-secondary"></i> Milestone Log
            </div>
            <div class="timeline-stream small pl-2 border-left" style="border-left: 2px solid #e2e8f0 !important; max-height: 180px; overflow-y: auto;">
              ${timeline.map(t => `
                <div class="mb-2 pl-3 position-relative">
                  <strong class="text-dark">${escapeHtml(t.title)}</strong>
                  <span class="text-muted ml-2">${formatDate(t.timestamp)}</span>
                  <p class="text-muted mb-0">${escapeHtml(t.description || '')}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Interactive Controls Form -->
        <div class="col-lg-6 pl-lg-3">
          <div class="modal-section-card">
            <div class="modal-section-title">
              <i class="fas fa-sliders-h text-primary"></i> Project Controls & Coordination
            </div>

            <form id="projectUpdateForm" data-project-id="${p.id}" onsubmit="submitProjectUpdate(event, '${p.id}')">
              <!-- Assignment Status -->
              <div class="form-group mb-3">
                <label class="font-weight-600 small">Assignment Status</label>
                <select name="status" class="form-control">
                  <option value="Submitted" ${p.status === 'Submitted' ? 'selected' : ''}>Submitted (New Request)</option>
                  <option value="Reviewed" ${p.status === 'Reviewed' ? 'selected' : ''}>Reviewed (Quote Ready)</option>
                  <option value="In Progress" ${p.status === 'In Progress' ? 'selected' : ''}>In Progress (Scholar Active)</option>
                  <option value="In Revision" ${p.status === 'In Revision' ? 'selected' : ''}>In Revision (Client Feedback)</option>
                  <option value="Completed" ${p.status === 'Completed' ? 'selected' : ''}>Completed (Ready for Delivery)</option>
                  <option value="Cancelled" ${p.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </div>

              <!-- Assign Academic Scholar -->
              <div class="form-group mb-3">
                <label class="font-weight-600 small">Assign Academic Scholar</label>
                <select name="assigned_expert_id" class="form-control">
                  <option value="">-- No Scholar Assigned --</option>
                  ${experts.map(e => `
                    <option value="${e.id}" ${p.assigned_expert_id == e.id ? 'selected' : ''}>
                      ${escapeHtml(e.full_name)} — ${escapeHtml(e.expertise)} (${e.rating}★)
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Progress Slider -->
              <div class="form-group mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="font-weight-600 small mb-0">Milestone Progress (%)</label>
                  <span class="badge badge-primary px-2 py-1 font-weight-bold" id="progressValDisplay">${p.progress_percent}%</span>
                </div>
                <input type="range" name="progress_percent" class="custom-range" min="0" max="100" value="${p.progress_percent}" oninput="document.getElementById('progressValDisplay').innerText = this.value + '%'">
              </div>

              <!-- Priority & Deadline -->
              <div class="form-grid-pair">
                <div>
                  <label class="font-weight-600 small">Priority Level</label>
                  <select name="priority" class="form-control">
                    <option value="Low" ${p.priority === 'Low' ? 'selected' : ''}>Low</option>
                    <option value="Medium" ${p.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="High" ${p.priority === 'High' ? 'selected' : ''}>High</option>
                    <option value="Urgent" ${p.priority === 'Urgent' ? 'selected' : ''}>Urgent (Express)</option>
                  </select>
                </div>
                <div>
                  <label class="font-weight-600 small">Deadline Date</label>
                  <input type="date" name="deadline" class="form-control" value="${p.deadline || ''}">
                </div>
              </div>

              <!-- Fee & Payment Status -->
              <div class="form-grid-pair">
                <div>
                  <label class="font-weight-600 small">Total Fee ($)</label>
                  <input type="number" step="0.01" name="total_amount" class="form-control font-weight-bold" value="${p.total_amount || 0}">
                </div>
                <div>
                  <label class="font-weight-600 small">Payment Status</label>
                  <select name="payment_status" class="form-control">
                    <option value="Pending" ${p.payment_status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Partial" ${p.payment_status === 'Partial' ? 'selected' : ''}>Partial</option>
                    <option value="Paid" ${p.payment_status === 'Paid' ? 'selected' : ''}>Paid (Settled)</option>
                  </select>
                </div>
              </div>

              <!-- Timeline Note -->
              <div class="form-group mb-2">
                <label class="font-weight-600 small">Milestone Update Note</label>
                <input type="text" name="timeline_note" class="form-control" placeholder="e.g. Scholar finalized methodology & draft analysis">
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  };

  window.submitProjectUpdate = async function (e, projectId) {
    if (e && e.preventDefault) e.preventDefault();
    const form = document.getElementById('projectUpdateForm');
    if (!form) return;

    const pId = projectId || form.dataset.projectId;
    const formData = new FormData(form);
    const payload = {};
    formData.forEach((val, key) => payload[key] = val);

    const res = await apiRequest(`/projects/${pId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Assignment updated successfully! Student has been notified.', 'success');
      $('#projectManagementModal').modal('hide');
      loadProjectsList();
      if (window.location.hash === '#/dashboard' || !window.location.hash) {
        renderDashboard(document.getElementById('adminMainContent'));
      }
    } else {
      showToast(res.message || 'Error updating assignment', 'error');
    }
  };

  // ==========================================
  // VIEW 3: QUOTES & PRICING
  // ==========================================
  async function renderQuotes(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-file-invoice-dollar text-warning mr-1"></i> Project Quotations & Cost Estimator</h3>
            <div class="admin-card-subtitle">Calculate base rates, apply scholarships, and dispatch formal academic quotes</div>
          </div>
        </div>
        <div class="p-4" id="quotesContentArea">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/projects');
    const area = document.getElementById('quotesContentArea');
    if (!area) return;

    if (!res.success) {
      area.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
      return;
    }

    const projects = res.projects || [];
    area.innerHTML = `
      <p class="text-muted mb-4">Select any assignment to calculate, discount, or dispatch an official academic pricing quotation directly to the student dashboard.</p>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width: 10%;">ID</th>
              <th style="width: 32%;">Assignment</th>
              <th style="width: 20%;">Student</th>
              <th style="width: 12%;">Word Count</th>
              <th style="width: 12%;">Current Total</th>
              <th style="width: 14%; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(p => `
              <tr>
                <td><span class="badge badge-light border font-weight-bold">#${escapeHtml(p.id)}</span></td>
                <td>
                  <strong class="text-dark d-block">${escapeHtml(p.title)}</strong>
                  <small class="text-muted">${escapeHtml(p.category)}</small>
                </td>
                <td>
                  <div class="font-weight-600 text-dark">${escapeHtml(p.client_name)}</div>
                  <small class="text-muted">${escapeHtml(p.client_email)}</small>
                </td>
                <td><span class="badge badge-light border">${p.word_count || 0} words</span></td>
                <td><strong class="text-dark">${formatCurrency(p.total_amount)}</strong></td>
                <td style="text-align: right;">
                  <button class="btn-admin-quote" onclick="openQuoteModal('${p.id}', ${p.total_amount || 150})">
                    <i class="fas fa-calculator"></i> Quote
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.openQuoteModal = function (projectId, currentTotal = 150) {
    const modal = document.getElementById('quoteModal');
    document.getElementById('quoteProjectId').value = projectId;
    document.getElementById('quoteEstimatedPrice').value = (currentTotal * 1.1).toFixed(2);
    document.getElementById('quoteServiceFee').value = '10.00';
    document.getElementById('quoteDiscount').value = '15.00';
    document.getElementById('quoteFinalAmount').value = currentTotal.toFixed(2);
    document.getElementById('quoteNotes').value = 'Official quotation by Assignment Dai academic board.';

    const d = new Date();
    d.setDate(d.getDate() + 7);
    document.getElementById('quoteDeadline').value = d.toISOString().split('T')[0];

    $(modal).modal('show');
  };

  window.calculateQuoteTotal = function () {
    const est = parseFloat(document.getElementById('quoteEstimatedPrice').value) || 0;
    const fee = parseFloat(document.getElementById('quoteServiceFee').value) || 0;
    const disc = parseFloat(document.getElementById('quoteDiscount').value) || 0;
    const finalAmt = Math.max(0, est + fee - disc);
    document.getElementById('quoteFinalAmount').value = finalAmt.toFixed(2);
  };

  window.submitQuote = async function (e) {
    e.preventDefault();
    const projectId = document.getElementById('quoteProjectId').value;
    const payload = {
      estimated_price: parseFloat(document.getElementById('quoteEstimatedPrice').value),
      service_fee: parseFloat(document.getElementById('quoteServiceFee').value),
      discount: parseFloat(document.getElementById('quoteDiscount').value),
      final_quote: parseFloat(document.getElementById('quoteFinalAmount').value),
      payment_deadline: document.getElementById('quoteDeadline').value,
      notes: document.getElementById('quoteNotes').value
    };

    const res = await apiRequest(`/projects/${projectId}/quote`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Official quotation sent to student dashboard!', 'success');
      $('#quoteModal').modal('hide');
      handleRoute();
    } else {
      showToast(res.message || 'Failed to dispatch quote', 'error');
    }
  };

  // ==========================================
  // VIEW 4: STUDENTS & USERS
  // ==========================================
  async function renderUsers(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-users text-primary mr-1"></i> Enrolled Students & Accounts</h3>
            <div class="admin-card-subtitle">Student profiles, academic levels, and assignment volume</div>
          </div>
          <button class="btn btn-sm btn-primary rounded-pill font-weight-bold px-3" onclick="$('#addUserModal').modal('show')">
            <i class="fas fa-user-plus mr-1"></i> Add Student
          </button>
        </div>
        <div class="admin-table-wrapper" id="usersTableContainer">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/users');
    const tableArea = document.getElementById('usersTableContainer');
    if (!tableArea) return;

    if (!res.success) {
      tableArea.innerHTML = `<div class="alert alert-danger m-3">${res.message}</div>`;
      return;
    }

    cachedUsers = res.users || [];
    tableArea.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 25%;">User</th>
            <th style="width: 20%;">Contact</th>
            <th style="width: 15%;">Institution</th>
            <th style="width: 12%;">Level</th>
            <th style="width: 12%;">Orders</th>
            <th style="width: 10%;">Total Paid</th>
            <th style="width: 6%; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${cachedUsers.map(u => `
            <tr>
              <td>
                <div class="d-flex align-items-center gap-2">
                  <div class="cell-avatar cell-avatar-green" style="width: 34px; height: 34px; font-size: 0.82rem;">
                    ${escapeHtml((u.full_name || 'U').charAt(0))}
                  </div>
                  <div>
                    <strong class="text-dark d-block">${escapeHtml(u.full_name)}</strong>
                    <span class="badge badge-${u.role === 'admin' ? 'danger' : 'info'} font-weight-bold" style="font-size: 0.68rem;">${escapeHtml(u.role)}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="small"><i class="fas fa-envelope text-muted mr-1"></i> ${escapeHtml(u.email)}</div>
                <div class="small text-muted"><i class="fas fa-phone mr-1"></i> ${escapeHtml(u.phone || 'N/A')}</div>
              </td>
              <td>${escapeHtml(u.institution || 'Tribhuvan University')}</td>
              <td><span class="badge badge-light border">${escapeHtml(u.academic_level || 'Undergraduate')}</span></td>
              <td><span class="badge badge-light border font-weight-bold">${u.total_projects} Projects</span></td>
              <td><strong class="text-success">${formatCurrency(u.total_spent)}</strong></td>
              <td style="text-align: right;">
                ${u.role !== 'admin' ? `
                  <button class="btn btn-sm btn-outline-danger rounded-pill px-2 py-1" onclick="deleteUser(${u.id}, '${escapeHtml(u.full_name)}')">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                ` : `<span class="badge badge-light text-muted">Admin</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  window.submitAddUser = async function (e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      full_name: form.full_name.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      phone: form.phone.value.trim(),
      institution: form.institution.value.trim(),
      academic_level: form.academic_level.value,
      role: form.role.value
    };

    const res = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('New student registered successfully!', 'success');
      $('#addUserModal').modal('hide');
      form.reset();
      handleRoute();
    } else {
      showToast(res.message || 'Error creating student', 'error');
    }
  };

  window.deleteUser = async function (userId, name) {
    if (!confirm(`Are you sure you want to delete account for "${name}"?`)) return;
    const res = await apiRequest(`/users/${userId}`, { method: 'DELETE' });
    if (res.success) {
      showToast('User account removed.', 'success');
      handleRoute();
    } else {
      showToast(res.message, 'error');
    }
  };

  // ==========================================
  // VIEW 5: EXPERTS & MENTORS
  // ==========================================
  async function renderExperts(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-chalkboard-teacher text-info mr-1"></i> Academic Mentors & Scholars</h3>
            <div class="admin-card-subtitle">Verified subject matter experts assigned to student coursework</div>
          </div>
          <button class="btn btn-sm btn-primary rounded-pill font-weight-bold px-3" onclick="$('#addExpertModal').modal('show')">
            <i class="fas fa-plus mr-1"></i> Add Mentor
          </button>
        </div>
        <div class="p-4" id="expertsGridArea">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/experts');
    const grid = document.getElementById('expertsGridArea');
    if (!grid) return;

    if (!res.success) {
      grid.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
      return;
    }

    cachedExperts = res.experts || [];
    grid.innerHTML = `
      <div class="row">
        ${cachedExperts.map(exp => `
          <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100 border rounded-lg p-3 shadow-sm bg-white" style="border-radius: 16px;">
              <div class="d-flex align-items-center gap-3 mb-3">
                <img src="${exp.avatar_url || 'images/tm.jpg'}" class="rounded-circle border" style="width: 54px; height: 54px; object-fit: cover;">
                <div>
                  <h6 class="font-weight-bold text-dark mb-0">${escapeHtml(exp.full_name)}</h6>
                  <span class="badge badge-light border text-primary small font-weight-bold">${escapeHtml(exp.expertise)}</span>
                </div>
              </div>
              <p class="small text-muted mb-3" style="min-height: 40px; line-height: 1.4;">"${escapeHtml(exp.bio || 'Verified PhD Academic Mentor')}"</p>
              <div class="d-flex justify-content-between align-items-center small text-secondary border-top pt-2 mt-auto">
                <div><i class="fas fa-star text-warning"></i> <strong>${exp.rating}</strong> / 5.0</div>
                <div><i class="fas fa-briefcase text-info"></i> ${exp.experience_years} Years Exp</div>
                <div><span class="badge badge-primary font-weight-bold">${exp.active_projects || 0} Active</span></div>
              </div>
              <div class="mt-3 text-right">
                <button class="btn btn-xs btn-outline-danger rounded-pill px-2 py-1" onclick="deleteExpert(${exp.id}, '${escapeHtml(exp.full_name)}')">
                  <i class="fas fa-trash-alt mr-1"></i> Remove
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.submitAddExpert = async function (e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      full_name: form.full_name.value.trim(),
      expertise: form.expertise.value.trim(),
      rating: parseFloat(form.rating.value),
      experience_years: parseInt(form.experience_years.value),
      bio: form.bio.value.trim(),
      avatar_url: form.avatar_url.value.trim() || 'images/tm.jpg'
    };

    const res = await apiRequest('/experts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('New mentor added to roster!', 'success');
      $('#addExpertModal').modal('hide');
      form.reset();
      handleRoute();
    } else {
      showToast(res.message, 'error');
    }
  };

  window.deleteExpert = async function (id, name) {
    if (!confirm(`Remove mentor "${name}"?`)) return;
    const res = await apiRequest(`/experts/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Mentor profile removed.', 'success');
      handleRoute();
    }
  };

  // ==========================================
  // VIEW 6: PAYMENTS & INVOICES
  // ==========================================
  async function renderPayments(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-credit-card text-success mr-1"></i> Invoices & Payment Ledger</h3>
            <div class="admin-card-subtitle">Real-time payment settlements, gateways, and transaction references</div>
          </div>
        </div>
        <div class="admin-table-wrapper" id="paymentsTableArea">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/payments');
    const tableArea = document.getElementById('paymentsTableArea');
    if (!tableArea) return;

    if (!res.success) {
      tableArea.innerHTML = `<div class="alert alert-danger m-3">${res.message}</div>`;
      return;
    }

    cachedPayments = res.payments || [];
    tableArea.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 14%;">Invoice #</th>
            <th style="width: 22%;">Project & Student</th>
            <th style="width: 14%;">Amount</th>
            <th style="width: 12%;">Method</th>
            <th style="width: 14%;">Transaction Ref</th>
            <th style="width: 12%;">Status</th>
            <th style="width: 12%; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${cachedPayments.length === 0 ? '<tr><td colspan="7" class="text-center py-5 text-muted">No transactions recorded.</td></tr>' : ''}
          ${cachedPayments.map(pm => `
            <tr>
              <td><span class="badge badge-light border font-weight-bold">#${escapeHtml(pm.invoice_number)}</span></td>
              <td>
                <strong class="text-dark d-block text-truncate" style="max-width: 200px;">${escapeHtml(pm.project_title || pm.project_id)}</strong>
                <small class="text-muted">${escapeHtml(pm.client_name)}</small>
              </td>
              <td>
                <div class="font-weight-800 text-dark">${formatCurrency(pm.final_amount)}</div>
                ${pm.discount > 0 ? `<small class="text-success">-${formatCurrency(pm.discount)} disc</small>` : ''}
              </td>
              <td><span class="badge badge-light border">${escapeHtml(pm.payment_method || 'Online')}</span></td>
              <td><code>${escapeHtml(pm.transaction_id || 'PENDING')}</code></td>
              <td><span class="badge badge-${pm.status === 'Paid' ? 'success' : 'warning'} font-weight-bold">${escapeHtml(pm.status)}</span></td>
              <td style="text-align: right;">
                ${pm.status !== 'Paid' ? `
                  <button class="btn btn-sm btn-success rounded-pill px-3 py-1 font-weight-bold" onclick="updatePaymentStatus(${pm.id}, 'Paid')">
                    <i class="fas fa-check mr-1"></i> Verify Paid
                  </button>
                ` : `<span class="text-muted small"><i class="fas fa-check-circle text-success"></i> Settled</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  window.updatePaymentStatus = async function (paymentId, status) {
    const res = await apiRequest(`/payments/${paymentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (res.success) {
      showToast(res.message, 'success');
      handleRoute();
    }
  };

  // ==========================================
  // VIEW 7: SUPPORT TICKETS HELPDESK
  // ==========================================
  async function renderSupport(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-headset text-primary mr-1"></i> Student Support Desk Tickets</h3>
            <div class="admin-card-subtitle">Live queries, assignment revisions, and student help tickets</div>
          </div>
        </div>
        <div class="admin-table-wrapper" id="ticketsTableArea">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/tickets');
    const tableArea = document.getElementById('ticketsTableArea');
    if (!tableArea) return;

    if (!res.success) {
      tableArea.innerHTML = `<div class="alert alert-danger m-3">${res.message}</div>`;
      return;
    }

    cachedTickets = res.tickets || [];
    tableArea.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 10%;">ID</th>
            <th style="width: 30%;">Subject & Category</th>
            <th style="width: 20%;">Student</th>
            <th style="width: 12%;">Priority</th>
            <th style="width: 14%;">Status</th>
            <th style="width: 14%; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${cachedTickets.length === 0 ? '<tr><td colspan="6" class="text-center py-5 text-muted">No tickets found.</td></tr>' : ''}
          ${cachedTickets.map(t => `
            <tr>
              <td><span class="badge badge-light border font-weight-bold">#${escapeHtml(t.id)}</span></td>
              <td>
                <strong class="text-dark d-block">${escapeHtml(t.subject)}</strong>
                <span class="badge badge-light border text-muted">${escapeHtml(t.category)}</span>
              </td>
              <td>
                <div class="font-weight-600 text-dark">${escapeHtml(t.client_name)}</div>
                <small class="text-muted">${escapeHtml(t.client_email)}</small>
              </td>
              <td><span class="badge badge-${t.priority === 'High' ? 'danger' : 'info'} font-weight-bold">${escapeHtml(t.priority)}</span></td>
              <td><span class="badge badge-${t.status === 'Open' ? 'warning' : t.status === 'In Progress' ? 'primary' : 'success'} font-weight-bold">${escapeHtml(t.status)}</span></td>
              <td style="text-align: right;">
                <button class="btn btn-sm btn-primary rounded-pill px-3 font-weight-bold" onclick="openTicketModal('${t.id}')">
                  <i class="fas fa-reply mr-1"></i> Open Ticket
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  window.openTicketModal = async function (ticketId) {
    const modal = document.getElementById('ticketModal');
    const body = document.getElementById('ticketModalBody');
    $(modal).modal('show');
    body.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    const res = await apiRequest(`/tickets/${ticketId}`);
    if (!res.success) {
      body.innerHTML = `<div class="alert alert-danger">${res.message}</div>`;
      return;
    }

    const t = res.ticket;
    const msgs = res.messages || [];

    body.innerHTML = `
      <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
        <div>
          <span class="badge badge-light border font-weight-bold mr-2">#${t.id}</span>
          <strong class="h5 font-weight-bold text-dark mb-0">${escapeHtml(t.subject)}</strong>
        </div>
        <select class="form-control form-control-sm" style="width: 140px;" onchange="updateTicketStatus('${t.id}', this.value)">
          <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>Open</option>
          <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Resolved" ${t.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>

      <p class="small text-muted mb-3">
        Submitted by <strong>${escapeHtml(t.client_name)}</strong> (${escapeHtml(t.client_email)})
      </p>

      <div class="chat-thread p-3 bg-light rounded border mb-3" style="max-height: 280px; overflow-y: auto;">
        ${msgs.map(m => `
          <div class="mb-3 ${m.sender_role === 'admin' ? 'text-right' : ''}">
            <div class="small font-weight-bold text-${m.sender_role === 'admin' ? 'primary' : 'dark'}">
              ${escapeHtml(m.sender_name || (m.sender_role === 'admin' ? 'Assignment Dai Admin' : 'Student'))}
              <span class="text-muted font-weight-normal ml-1">${formatDate(m.created_at)}</span>
            </div>
            <div class="p-2 d-inline-block rounded ${m.sender_role === 'admin' ? 'bg-primary text-white' : 'bg-white text-dark border'}" style="max-width: 80%; text-align: left; border-radius: 12px;">
              ${escapeHtml(m.message)}
            </div>
          </div>
        `).join('')}
      </div>

      <form onsubmit="submitTicketReply(event, '${t.id}')">
        <div class="form-group mb-3">
          <label class="font-weight-bold small">Admin Response Message</label>
          <textarea name="reply_message" class="form-control" rows="3" placeholder="Write support reply to student..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary rounded-pill px-4 font-weight-bold">
          <i class="fas fa-paper-plane mr-1"></i> Send Reply to Student
        </button>
      </form>
    `;
  };

  window.submitTicketReply = async function (e, ticketId) {
    e.preventDefault();
    const msg = e.target.reply_message.value.trim();
    if (!msg) return;

    const res = await apiRequest(`/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message: msg })
    });

    if (res.success) {
      showToast('Reply dispatched to student!', 'success');
      openTicketModal(ticketId);
    } else {
      showToast(res.message, 'error');
    }
  };

  window.updateTicketStatus = async function (ticketId, status) {
    const res = await apiRequest(`/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (res.success) {
      showToast(`Ticket status updated to ${status}.`, 'success');
    }
  };

  // ==========================================
  // VIEW 8: WEBSITE CONTACT LEADS
  // ==========================================
  async function renderInquiries(container) {
    container.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title"><i class="fas fa-envelope-open-text text-danger mr-1"></i> Public Website Contact Inquiries</h3>
            <div class="admin-card-subtitle">Prospective student inquiries from the contact page</div>
          </div>
        </div>
        <div class="admin-table-wrapper" id="inquiriesTableArea">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>
    `;

    const res = await apiRequest('/inquiries');
    const tableArea = document.getElementById('inquiriesTableArea');
    if (!tableArea) return;

    if (!res.success) {
      tableArea.innerHTML = `<div class="alert alert-danger m-3">${res.message}</div>`;
      return;
    }

    cachedInquiries = res.inquiries || [];
    tableArea.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width: 8%;">ID</th>
            <th style="width: 20%;">Student Details</th>
            <th style="width: 18%;">Subject</th>
            <th style="width: 30%;">Message</th>
            <th style="width: 12%;">Status</th>
            <th style="width: 12%; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${cachedInquiries.length === 0 ? '<tr><td colspan="6" class="text-center py-5 text-muted">No contact inquiries recorded yet.</td></tr>' : ''}
          ${cachedInquiries.map(inq => `
            <tr>
              <td><span class="badge badge-light border">#${inq.id}</span></td>
              <td>
                <strong class="text-dark d-block">${escapeHtml(inq.full_name)}</strong>
                <a href="mailto:${escapeHtml(inq.email)}" class="small text-muted">${escapeHtml(inq.email)}</a>
              </td>
              <td><span class="badge badge-light border">${escapeHtml(inq.subject)}</span></td>
              <td>
                <small class="text-secondary text-truncate d-block" style="max-width: 280px;" title="${escapeHtml(inq.message)}">
                  "${escapeHtml(inq.message)}"
                </small>
                <small class="text-muted d-block mt-1">${formatDate(inq.created_at)}</small>
              </td>
              <td>
                <select class="form-control form-control-sm" style="width: 120px;" onchange="updateInquiryStatus(${inq.id}, this.value)">
                  <option value="New" ${inq.status === 'New' ? 'selected' : ''}>New</option>
                  <option value="Contacted" ${inq.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                  <option value="Converted" ${inq.status === 'Converted' ? 'selected' : ''}>Converted</option>
                  <option value="Closed" ${inq.status === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>
              </td>
              <td style="text-align: right;">
                <div class="d-flex justify-content-end gap-1">
                  <a href="https://wa.me/?text=Hello%20${encodeURIComponent(inq.full_name)}%2C%20Assignment%20Dai%20Support%20here" target="_blank" class="btn btn-xs btn-outline-success font-weight-bold px-2 py-1" title="WhatsApp Message">
                    <i class="fab fa-whatsapp"></i>
                  </a>
                  <button class="btn btn-xs btn-outline-danger font-weight-bold px-2 py-1" onclick="deleteInquiry(${inq.id})" title="Delete Lead">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  window.updateInquiryStatus = async function (id, status) {
    const res = await apiRequest(`/inquiries/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (res.success) {
      showToast(`Inquiry status updated to ${status}.`, 'success');
    }
  };

  window.deleteInquiry = async function (id) {
    if (!confirm('Delete this inquiry?')) return;
    const res = await apiRequest(`/inquiries/${id}`, { method: 'DELETE' });
    if (res.success) {
      showToast('Inquiry removed.', 'success');
      handleRoute();
    }
  };

  // Mobile Sidebar Toggle
  window.toggleAdminSidebar = function () {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) {
      sidebar.classList.toggle('sidebar-open');
    }
  };

  // Init Listeners
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginForm').addEventListener('submit', handleLogin);
    window.addEventListener('hashchange', handleRoute);
    initAuth();
  });

})();
