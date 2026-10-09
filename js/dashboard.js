/* ==========================================================================
   ASSIGNMENTWAALA CLIENT DASHBOARD SPA CLIENT CONTROLLER
   ========================================================================== */

(function () {
  'use strict';

  const API_BASE = '/api';

  // SPA App State
  const AppState = {
    token: localStorage.getItem('aw_token') || null,
    user: JSON.parse(localStorage.getItem('aw_user') || 'null'),
    currentRoute: 'dashboard',
    routeParams: null,
    activeTab: 'All',
    projectsCache: [],
    currentProject: null,
    unreadNotifications: 0
  };

  // DOM Elements
  let mainContentEl;
  let pageTitleEl;
  let userAvatarEl;
  let userNameEl;
  let notifBadgeEl;

  // Initialize Application
  document.addEventListener('DOMContentLoaded', () => {
    initDOMReferences();
    bindGlobalEvents();
    checkAuthAndInit();
  });

  function initDOMReferences() {
    mainContentEl = document.getElementById('dashboard-app-render');
    pageTitleEl = document.getElementById('navbar-page-title');
    userAvatarEl = document.getElementById('user-avatar-img');
    userNameEl = document.getElementById('user-name-span');
    notifBadgeEl = document.getElementById('notif-badge-dot');
  }

  function bindGlobalEvents() {
    window.addEventListener('hashchange', handleRouteHash);

    // Sidebar Mobile Toggle
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('dashboard-sidebar');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
      });
    }

    // Logout Link
    const logoutLink = document.getElementById('sidebar-logout-btn');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
      });
    }

    // Login / Register Form Submits
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const regForm = document.getElementById('auth-register-form');
    if (regForm) {
      regForm.addEventListener('submit', handleRegisterSubmit);
    }
  }

  function checkAuthAndInit() {
    if (!AppState.token || !AppState.user) {
      showAuthModal('login');
    } else {
      updateUserUI();
      fetchUnreadNotificationsCount();
      handleRouteHash();
    }
  }

  function updateUserUI() {
    if (AppState.user) {
      if (userNameEl) userNameEl.textContent = AppState.user.full_name || 'Client';
      if (userAvatarEl) userAvatarEl.src = AppState.user.avatar_url || 'images/fv.png';
    }
  }

  // API Request Helper
  async function apiFetch(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = {};
    if (AppState.token) {
      headers['Authorization'] = `Bearer ${AppState.token}`;
    }
    if (!isFormData && body) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      method,
      headers
    };

    if (body) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        logoutUser();
        return { success: false, message: 'Session expired. Please login again.' };
      }

      return data;
    } catch (err) {
      console.error('API Error:', err);
      return { success: false, message: 'Network or server communication failure.' };
    }
  }

  // Route Hash Router
  function handleRouteHash() {
    const hash = window.location.hash.replace('#/', '').replace('#', '') || 'dashboard';
    const parts = hash.split('/');
    const route = parts[0];
    const param = parts[1] || null;

    AppState.currentRoute = route;
    AppState.routeParams = param;

    // Highlight active nav item
    document.querySelectorAll('.nav-item-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#/${route}`) {
        link.classList.add('active');
      }
    });

    switch (route) {
      case 'dashboard':
        renderDashboardOverview();
        break;
      case 'projects':
        if (param) {
          renderProjectWorkspace(param);
        } else {
          renderProjectsList();
        }
        break;
      case 'submit-project':
        renderSubmitProjectWizard();
        break;
      case 'messages':
        renderMessagesView(param);
        break;
      case 'files':
        renderFileManagementView();
        break;
      case 'payments':
        renderPaymentsView();
        break;
      case 'notifications':
        renderNotificationsView();
        break;
      case 'revisions':
        renderRevisionsView();
        break;
      case 'completed-projects':
        renderCompletedProjectsView();
        break;
      case 'profile':
        renderProfileView();
        break;
      case 'settings':
        renderSettingsView();
        break;
      case 'support':
        renderSupportCenterView(param);
        break;
      default:
        renderDashboardOverview();
        break;
    }
  }

  // ==========================================
  // 1. DASHBOARD OVERVIEW VIEW
  // ==========================================
  async function renderDashboardOverview() {
    if (pageTitleEl) pageTitleEl.textContent = 'Dashboard Overview';
    showLoadingSkeleton();

    const res = await apiFetch('/dashboard/stats');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const { stats, recent_projects, recent_notifications } = res;

    let html = `
      <div class="welcome-banner-card">
        <div class="welcome-banner-text">
          <h2>Welcome back, ${escapeHtml(AppState.user.full_name)}! 👋</h2>
          <p>Track your academic assignments, communicate with assigned experts, and review project milestones.</p>
        </div>
        <div>
          <a href="#/submit-project" class="btn btn-light font-weight-bold shadow-sm rounded-pill px-4">
            <i class="fas fa-plus-circle text-primary mr-2"></i> Submit New Project
          </a>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-blue"><i class="fas fa-layer-group"></i></div>
          <div>
            <div class="stat-number">${stats.total_projects}</div>
            <div class="stat-label">Total Projects</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-purple"><i class="fas fa-spinner fa-spin"></i></div>
          <div>
            <div class="stat-number">${stats.active_projects}</div>
            <div class="stat-label">Active / In Progress</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-yellow"><i class="fas fa-clock"></i></div>
          <div>
            <div class="stat-number">${stats.pending_payment_count}</div>
            <div class="stat-label">Awaiting Payment</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrapper stat-icon-green"><i class="fas fa-check-circle"></i></div>
          <div>
            <div class="stat-number">${stats.completed_projects}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-8">
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-folder-open text-primary mr-2"></i> Active & Recent Projects</h3>
              <a href="#/projects" class="btn btn-sm btn-outline-primary rounded-pill">View All</a>
            </div>
            <div class="card-box-body">
              ${recent_projects.length === 0 ? renderEmptyState('No active projects found. Click Submit New Project to begin!') : ''}
              ${recent_projects.map(p => renderProjectCardHtml(p)).join('')}
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-bell text-warning mr-2"></i> Recent Activity</h3>
              <a href="#/notifications" class="btn btn-sm btn-link">View All</a>
            </div>
            <div class="card-box-body p-0">
              <div class="list-group list-group-flush">
                ${recent_notifications.length === 0 ? '<div class="p-4 text-center text-muted">No recent notifications</div>' : ''}
                ${recent_notifications.map(n => `
                  <div class="list-group-item p-3 ${n.is_read ? '' : 'bg-light'}">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                      <strong class="mb-1 text-dark" style="font-size: 0.9rem;">${escapeHtml(n.title)}</strong>
                      <small class="text-muted">${formatDate(n.created_at)}</small>
                    </div>
                    <p class="mb-1 text-muted small">${escapeHtml(n.message)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;
  }

  // Helper Project Card HTML
  function renderProjectCardHtml(p) {
    const statusClass = getStatusClass(p.status);
    return `
      <div class="project-card-item">
        <div class="project-card-top">
          <div>
            <span class="project-id-tag">${p.id}</span>
            <a href="#/projects/${p.id}" class="project-title-link">${escapeHtml(p.title)}</a>
          </div>
          <span class="status-badge ${statusClass}">
            <i class="fas fa-circle" style="font-size: 0.5rem;"></i> ${p.status}
          </span>
        </div>

        <div class="project-meta-row">
          <div class="project-meta-item"><i class="fas fa-book-open"></i> ${escapeHtml(p.subject)}</div>
          <div class="project-meta-item"><i class="fas fa-user-graduate"></i> Expert: ${p.expert_name ? escapeHtml(p.expert_name) : 'Assigning...'}</div>
          <div class="project-meta-item"><i class="fas fa-calendar-alt"></i> Deadline: ${p.deadline}</div>
          <div class="project-meta-item"><i class="fas fa-credit-card"></i> Payment: <strong>$${p.total_amount}</strong> (${p.payment_status})</div>
        </div>

        <div class="progress-bar-wrapper">
          <div class="progress-info">
            <span>Overall Completion Progress</span>
            <span>${p.progress_percent}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${p.progress_percent}%;"></div>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-3">
          ${p.payment_status === 'Pending' ? `
            <a href="#/projects/${p.id}" class="btn btn-sm btn-warning rounded-pill px-3 mr-2 font-weight-bold">
              <i class="fas fa-credit-card mr-1"></i> Pay Now ($${p.total_amount})
            </a>
          ` : ''}
          <a href="#/projects/${p.id}" class="btn btn-sm btn-primary rounded-pill px-3">
            View Workspace <i class="fas fa-arrow-right ml-1"></i>
          </a>
        </div>
      </div>
    `;
  }

  // ==========================================
  // 2. MY PROJECTS MANAGEMENT VIEW
  // ==========================================
  async function renderProjectsList() {
    if (pageTitleEl) pageTitleEl.textContent = 'My Projects';
    showLoadingSkeleton();

    const res = await apiFetch(`/projects?status=${AppState.activeTab}`);
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const projects = res.projects;
    const tabs = ['All', 'Submitted', 'Payment Pending', 'In Progress', 'Submitted for Review', 'Revision Requested', 'Completed', 'Cancelled'];

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <ul class="nav nav-pills card-header-pills" id="project-status-tabs">
            ${tabs.map(tab => `
              <li class="nav-item">
                <a class="nav-link ${AppState.activeTab === tab ? 'active' : ''}" href="#" onclick="window.setProjectTab('${tab}')">${tab}</a>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="card-box-body">
          <div class="row mb-4">
            <div class="col-md-6">
              <div class="input-group">
                <div class="input-group-prepend"><span class="input-group-text bg-white"><i class="fas fa-search"></i></span></div>
                <input type="text" id="project-search-input" class="form-control border-left-0" placeholder="Search by project ID, title or subject..." onkeyup="window.filterProjectsBySearch(this.value)">
              </div>
            </div>
          </div>

          <div id="projects-list-container">
            ${projects.length === 0 ? renderEmptyState('No projects match your filter query.') : projects.map(p => renderProjectCardHtml(p)).join('')}
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.setProjectTab = (tab) => {
      AppState.activeTab = tab;
      renderProjectsList();
    };

    window.filterProjectsBySearch = (query) => {
      const filtered = projects.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase().includes(query.toLowerCase()));
      const container = document.getElementById('projects-list-container');
      if (container) {
        container.innerHTML = filtered.length === 0 ? renderEmptyState('No matching projects found.') : filtered.map(p => renderProjectCardHtml(p)).join('');
      }
    };
  }

  // ==========================================
  // 3. PROJECT DETAIL WORKSPACE VIEW
  // ==========================================
  async function renderProjectWorkspace(projectId) {
    if (pageTitleEl) pageTitleEl.textContent = `Project Workspace - ${projectId}`;
    showLoadingSkeleton();

    const res = await apiFetch(`/projects/${projectId}`);
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const { project, timeline, quote, payment, attachments, revisions, review } = res;
    AppState.currentProject = project;

    const daysRemaining = calculateDaysRemaining(project.deadline);

    let html = `
      <div class="project-workspace-header">
        <div class="workspace-title-row">
          <div>
            <span class="project-id-tag mr-2">${project.id}</span>
            <span class="status-badge ${getStatusClass(project.status)}">${project.status}</span>
            <h2 class="mt-2 mb-1" style="font-weight: 800; color: var(--secondary-color);">${escapeHtml(project.title)}</h2>
            <div class="text-muted small">Submitted on ${formatDate(project.created_at)} | Academic Level: ${escapeHtml(project.academic_level)}</div>
          </div>

          <div class="d-flex gap-2">
            ${project.payment_status === 'Pending' ? `
              <button class="btn btn-warning rounded-pill px-4 font-weight-bold" onclick="window.triggerPaymentModal('${project.id}', ${project.total_amount})">
                <i class="fas fa-credit-card mr-1"></i> Pay Now ($${project.total_amount})
              </button>
            ` : ''}

            ${project.status === 'Submitted for Review' || project.status === 'In Progress' ? `
              <button class="btn btn-danger rounded-pill px-3" onclick="window.openRevisionModal('${project.id}')">
                <i class="fas fa-edit mr-1"></i> Request Revision
              </button>
              <button class="btn btn-success rounded-pill px-3" onclick="window.approveFinalDelivery('${project.id}')">
                <i class="fas fa-check-circle mr-1"></i> Approve & Complete
              </button>
            ` : ''}

            <a href="#/messages/${project.id}" class="btn btn-primary rounded-pill px-3">
              <i class="fas fa-comments mr-1"></i> Message Expert
            </a>
          </div>
        </div>

        <div class="progress-bar-wrapper my-3">
          <div class="progress-info">
            <span>Project Milestone Progress</span>
            <span>${project.progress_percent}%</span>
          </div>
          <div class="progress-track" style="height: 10px;">
            <div class="progress-fill" style="width: ${project.progress_percent}%;"></div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-8">
          <!-- SPECIFICATIONS CARD -->
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-file-alt text-primary mr-2"></i> Project Requirements & Specifications</h3>
            </div>
            <div class="card-box-body">
              <div class="row mb-3">
                <div class="col-md-6 mb-2"><strong>Category:</strong> ${escapeHtml(project.category)}</div>
                <div class="col-md-6 mb-2"><strong>Subject:</strong> ${escapeHtml(project.subject)}</div>
                <div class="col-md-6 mb-2"><strong>Word Count / Pages:</strong> ${project.word_count} words (${project.page_count} pages)</div>
                <div class="col-md-6 mb-2"><strong>Citation Format:</strong> ${escapeHtml(project.citation_style)}</div>
                <div class="col-md-6 mb-2"><strong>Formatting Spec:</strong> ${escapeHtml(project.formatting)}</div>
                <div class="col-md-6 mb-2"><strong>Deadline:</strong> ${project.deadline} (${daysRemaining} days remaining)</div>
              </div>

              <h5 class="font-weight-bold mt-4 mb-2">Detailed Instructions</h5>
              <div class="p-3 bg-light rounded border">${escapeHtml(project.description || 'No detailed description provided.')}</div>
            </div>
          </div>

          <!-- AUDIT TIMELINE CARD -->
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-stream text-success mr-2"></i> Real-time Project Execution Timeline</h3>
            </div>
            <div class="card-box-body">
              <div class="timeline-stepper">
                ${timeline.map(t => `
                  <div class="timeline-step-item active">
                    <div class="timeline-icon-dot"><i class="fas fa-check"></i></div>
                    <div class="timeline-content">
                      <div class="d-flex justify-content-between">
                        <div class="timeline-step-title">${escapeHtml(t.title)}</div>
                        <small class="text-muted">${formatDate(t.timestamp)}</small>
                      </div>
                      <p class="mb-0 text-muted small">${escapeHtml(t.description)} (By: ${t.responsible_party})</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <!-- ASSIGNED EXPERT CARD -->
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-user-shield text-info mr-2"></i> Assigned Academic Expert</h3>
            </div>
            <div class="card-box-body text-center">
              <img src="${project.expert_avatar || 'images/tm.jpg'}" class="rounded-circle mb-3 border shadow-sm" style="width: 80px; height: 80px; object-fit: cover;">
              <h5 class="font-weight-bold mb-1">${escapeHtml(project.expert_name || 'Dr. Aris Thorne')}</h5>
              <div class="badge badge-primary px-3 py-1 mb-2">${escapeHtml(project.expert_expertise || 'Senior Academic Specialist')}</div>
              <div class="text-warning mb-2"><i class="fas fa-star"></i> 4.95 / 5.0 (Oxford Alumnus)</div>
              <p class="text-muted small">Specialized in empirical research models, thesis dissertations, and advanced statistical analysis.</p>
              <a href="#/messages/${project.id}" class="btn btn-outline-primary btn-block rounded-pill font-weight-bold">
                <i class="fas fa-envelope mr-1"></i> Send Direct Message
              </a>
            </div>
          </div>

          <!-- PAYMENT & QUOTE BREAKDOWN CARD -->
          <div class="card-box">
            <div class="card-box-header">
              <h3 class="card-box-title"><i class="fas fa-calculator text-warning mr-2"></i> Quote & Fee Breakdown</h3>
            </div>
            <div class="card-box-body">
              <div class="d-flex justify-content-between mb-2"><span>Estimated Base Price:</span> <span>$${quote ? quote.estimated_price : project.total_amount}</span></div>
              <div class="d-flex justify-content-between mb-2"><span>Service & Quality Guarantee Fee:</span> <span>$${quote ? quote.service_fee : 5.00}</span></div>
              <div class="d-flex justify-content-between mb-2 text-success"><span>Seasonal Discount:</span> <span>-$${quote ? quote.discount : 10.00}</span></div>
              <hr>
              <div class="d-flex justify-content-between font-weight-bold text-dark h5"><span>Total Final Amount:</span> <span>$${project.total_amount}</span></div>
              <div class="text-muted small mt-2">Payment Status: <span class="badge ${project.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}">${project.payment_status}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Attach global window actions for modals
    window.triggerPaymentModal = (pid, amt) => openPaymentModal(pid, amt);
    window.openRevisionModal = (pid) => openRevisionModal(pid);
    window.approveFinalDelivery = async (pid) => {
      if (confirm('Are you sure you want to approve the final deliverable and complete this project?')) {
        const r = await apiFetch(`/projects/${pid}/approve`, 'POST');
        if (r.success) {
          alert('Project approved and completed successfully!');
          renderProjectWorkspace(pid);
        }
      }
    };
  }

  // ==========================================
  // 4. SUBMIT PROJECT MULTI-STEP WIZARD VIEW
  // ==========================================
  function renderSubmitProjectWizard() {
    if (pageTitleEl) pageTitleEl.textContent = 'Submit New Academic Project';

    let html = `
      <div class="card-box">
        <div class="card-box-body">
          <form id="multi-step-project-form" onsubmit="return false;">
            <div class="wizard-steps-header">
              <div class="wizard-step-tab active" id="step-tab-1"><div class="wizard-step-number">1</div>Basic Info</div>
              <div class="wizard-step-tab" id="step-tab-2"><div class="wizard-step-number">2</div>Requirements</div>
              <div class="wizard-step-tab" id="step-tab-3"><div class="wizard-step-number">3</div>Deadline & Priority</div>
              <div class="wizard-step-tab" id="step-tab-4"><div class="wizard-step-number">4</div>Upload Files</div>
              <div class="wizard-step-tab" id="step-tab-5"><div class="wizard-step-number">5</div>Review & Submit</div>
            </div>

            <!-- STEP 1 -->
            <div class="wizard-step-content" id="step-content-1">
              <h4 class="font-weight-bold mb-4">Step 1: Basic Project Information</h4>
              <div class="form-group">
                <label>Project Title *</label>
                <input type="text" id="wiz-title" class="form-control form-control-lg" placeholder="e.g. Econometric Analysis of Financial Markets" required>
              </div>
              <div class="row">
                <div class="col-md-6 form-group">
                  <label>Category *</label>
                  <select id="wiz-category" class="form-control">
                    <option>Computer Science & IT</option>
                    <option>Business & Management</option>
                    <option>Medicine & Health</option>
                    <option>Engineering</option>
                    <option>Social Sciences</option>
                    <option>Law & Humanities</option>
                  </select>
                </div>
                <div class="col-md-6 form-group">
                  <label>Subject / Field *</label>
                  <input type="text" id="wiz-subject" class="form-control" placeholder="e.g. Machine Learning, Corporate Finance" required>
                </div>
                <div class="col-md-6 form-group">
                  <label>Academic Level</label>
                  <select id="wiz-academic-level" class="form-control">
                    <option>Undergraduate</option>
                    <option>Postgraduate / Masters</option>
                    <option>PhD / Doctorate</option>
                  </select>
                </div>
                <div class="col-md-6 form-group">
                  <label>Project Type</label>
                  <select id="wiz-project-type" class="form-control">
                    <option>Research Paper</option>
                    <option>Essay</option>
                    <option>Thesis Dissertation</option>
                    <option>Case Study</option>
                    <option>Programming Assignment</option>
                  </select>
                </div>
              </div>
              <div class="d-flex justify-content-end mt-4">
                <button type="button" class="btn btn-primary px-5 rounded-pill" onclick="window.nextWizStep(2)">Next: Requirements <i class="fas fa-arrow-right ml-1"></i></button>
              </div>
            </div>

            <!-- STEP 2 -->
            <div class="wizard-step-content d-none" id="step-content-2">
              <h4 class="font-weight-bold mb-4">Step 2: Detailed Requirements</h4>
              <div class="form-group">
                <label>Detailed Guidelines & Instructions *</label>
                <textarea id="wiz-description" class="form-control" rows="5" placeholder="Paste your assignment prompt, guidelines, grading rubric, or research questions here..."></textarea>
              </div>
              <div class="row">
                <div class="col-md-4 form-group">
                  <label>Expected Word Count</label>
                  <input type="number" id="wiz-word-count" class="form-control" value="2500">
                </div>
                <div class="col-md-4 form-group">
                  <label>Citation Style</label>
                  <select id="wiz-citation" class="form-control">
                    <option>APA 7th</option>
                    <option>Harvard</option>
                    <option>IEEE</option>
                    <option>MLA</option>
                    <option>Chicago</option>
                  </select>
                </div>
                <div class="col-md-4 form-group">
                  <label>Formatting</label>
                  <input type="text" id="wiz-formatting" class="form-control" value="Double Spaced, 12pt Times New Roman">
                </div>
              </div>
              <div class="d-flex justify-content-between mt-4">
                <button type="button" class="btn btn-secondary px-4 rounded-pill" onclick="window.nextWizStep(1)">Back</button>
                <button type="button" class="btn btn-primary px-5 rounded-pill" onclick="window.nextWizStep(3)">Next: Deadline <i class="fas fa-arrow-right ml-1"></i></button>
              </div>
            </div>

            <!-- STEP 3 -->
            <div class="wizard-step-content d-none" id="step-content-3">
              <h4 class="font-weight-bold mb-4">Step 3: Deadline & Priority</h4>
              <div class="row">
                <div class="col-md-6 form-group">
                  <label>Target Submission Deadline *</label>
                  <input type="date" id="wiz-deadline" class="form-control" required>
                </div>
                <div class="col-md-6 form-group">
                  <label>Urgency / Priority</label>
                  <select id="wiz-priority" class="form-control">
                    <option>Standard (7+ Days)</option>
                    <option selected>Medium (3-6 Days)</option>
                    <option>Urgent (24-48 Hours)</option>
                  </select>
                </div>
              </div>
              <div class="d-flex justify-content-between mt-4">
                <button type="button" class="btn btn-secondary px-4 rounded-pill" onclick="window.nextWizStep(2)">Back</button>
                <button type="button" class="btn btn-primary px-5 rounded-pill" onclick="window.nextWizStep(4)">Next: Attach Files <i class="fas fa-arrow-right ml-1"></i></button>
              </div>
            </div>

            <!-- STEP 4 -->
            <div class="wizard-step-content d-none" id="step-content-4">
              <h4 class="font-weight-bold mb-4">Step 4: Attach Reference Documents</h4>
              <div class="border-dashed p-5 text-center bg-light rounded mb-3" style="border: 2px dashed #cbd5e1;">
                <i class="fas fa-cloud-upload-alt text-primary display-4 mb-3"></i>
                <h5>Drag & Drop your PDFs, DOCX, ZIP files here</h5>
                <p class="text-muted small">Supported formats: PDF, DOC, DOCX, PPTX, XLSX, ZIP, PNG, JPG (Max 50MB)</p>
                <input type="file" id="wiz-files-input" multiple class="d-none">
                <button type="button" class="btn btn-outline-primary rounded-pill px-4" onclick="document.getElementById('wiz-files-input').click()">Browse Files</button>
              </div>
              <div id="file-list-preview" class="mb-3"></div>
              <div class="d-flex justify-content-between mt-4">
                <button type="button" class="btn btn-secondary px-4 rounded-pill" onclick="window.nextWizStep(3)">Back</button>
                <button type="button" class="btn btn-primary px-5 rounded-pill" onclick="window.nextWizStep(5)">Next: Review Submission <i class="fas fa-arrow-right ml-1"></i></button>
              </div>
            </div>

            <!-- STEP 5 -->
            <div class="wizard-step-content d-none" id="step-content-5">
              <h4 class="font-weight-bold mb-4">Step 5: Review & Confirm Submission</h4>
              <div class="card bg-light border-0 p-4 mb-4">
                <div id="wiz-summary-box"></div>
              </div>
              <div class="d-flex justify-content-between mt-4">
                <button type="button" class="btn btn-secondary px-4 rounded-pill" onclick="window.nextWizStep(4)">Back</button>
                <button type="button" class="btn btn-success px-5 rounded-pill font-weight-bold" id="btn-submit-final-project" onclick="window.submitProjectFinal()">
                  <i class="fas fa-paper-plane mr-2"></i> Submit Project Now
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Set default deadline date (7 days from today)
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const deadlineStr = d.toISOString().split('T')[0];
    document.getElementById('wiz-deadline').value = deadlineStr;

    // File input preview listener
    const fileInput = document.getElementById('wiz-files-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const preview = document.getElementById('file-list-preview');
        preview.innerHTML = Array.from(fileInput.files).map(f => `
          <div class="alert alert-info py-2 px-3 d-flex justify-content-between align-items-center mb-2">
            <span><i class="fas fa-file-alt mr-2"></i>${escapeHtml(f.name)} (${Math.round(f.size/1024)} KB)</span>
            <span class="badge badge-success">Ready</span>
          </div>
        `).join('');
      });
    }

    window.nextWizStep = (step) => {
      document.querySelectorAll('.wizard-step-content').forEach(el => el.classList.add('d-none'));
      document.querySelectorAll('.wizard-step-tab').forEach(el => el.classList.remove('active'));

      document.getElementById(`step-content-${step}`).classList.remove('d-none');
      document.getElementById(`step-tab-${step}`).classList.add('active');

      if (step === 5) {
        // Render summary
        const summaryBox = document.getElementById('wiz-summary-box');
        summaryBox.innerHTML = `
          <h5><strong>Title:</strong> ${escapeHtml(document.getElementById('wiz-title').value || 'Untitled')}</h5>
          <p><strong>Category & Subject:</strong> ${document.getElementById('wiz-category').value} - ${escapeHtml(document.getElementById('wiz-subject').value)}</p>
          <p><strong>Academic Level & Type:</strong> ${document.getElementById('wiz-academic-level').value} (${document.getElementById('wiz-project-type').value})</p>
          <p><strong>Word Count & Citation:</strong> ${document.getElementById('wiz-word-count').value} words | ${document.getElementById('wiz-citation').value}</p>
          <p><strong>Target Deadline:</strong> ${document.getElementById('wiz-deadline').value}</p>
          <p><strong>Uploaded Files:</strong> ${fileInput.files.length} attached document(s)</p>
        `;
      }
    };

    window.submitProjectFinal = async () => {
      const btn = document.getElementById('btn-submit-final-project');
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Creating Project...`;

      const formData = new FormData();
      formData.append('title', document.getElementById('wiz-title').value || 'Academic Project');
      formData.append('category', document.getElementById('wiz-category').value);
      formData.append('subject', document.getElementById('wiz-subject').value || 'General');
      formData.append('academic_level', document.getElementById('wiz-academic-level').value);
      formData.append('project_type', document.getElementById('wiz-project-type').value);
      formData.append('description', document.getElementById('wiz-description').value || '');
      formData.append('word_count', document.getElementById('wiz-word-count').value || 2500);
      formData.append('citation_style', document.getElementById('wiz-citation').value);
      formData.append('formatting', document.getElementById('wiz-formatting').value);
      formData.append('deadline', document.getElementById('wiz-deadline').value);
      formData.append('priority', document.getElementById('wiz-priority').value);

      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('files', fileInput.files[i]);
      }

      const res = await apiFetch('/projects', 'POST', formData, true);
      if (res.success) {
        alert('Project created successfully!');
        window.location.hash = `#/projects/${res.project_id}`;
      } else {
        alert(res.message || 'Failed to submit project.');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane mr-2"></i> Submit Project Now`;
      }
    };
  }

  // ==========================================
  // 5. MESSAGING VIEW
  // ==========================================
  async function renderMessagesView(projectId = null) {
    if (pageTitleEl) pageTitleEl.textContent = 'Project Messages & Academic Chat';
    showLoadingSkeleton();

    const res = await apiFetch('/messages/conversations');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const conversations = res.conversations;
    const activeProject = projectId || (conversations.length > 0 ? conversations[0].project_id : null);

    let html = `
      <div class="chat-container-card">
        <div class="chat-conversations-list">
          <div class="p-3 border-bottom font-weight-bold bg-light">Project Conversations</div>
          ${conversations.length === 0 ? '<div class="p-4 text-center text-muted">No active conversations.</div>' : ''}
          ${conversations.map(c => `
            <div class="conversation-item ${c.project_id === activeProject ? 'active' : ''}" onclick="window.location.hash='#/messages/${c.project_id}'">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <strong class="text-primary">${c.project_id}</strong>
                <small class="text-muted">${formatDate(c.updated_at)}</small>
              </div>
              <div class="font-weight-bold text-dark text-truncate" style="max-width: 220px;">${escapeHtml(c.project_title)}</div>
              <small class="text-muted">Expert: ${escapeHtml(c.expert_name || 'Dr. Aris Thorne')}</small>
            </div>
          `).join('')}
        </div>

        <div class="chat-stream-area" id="chat-stream-panel">
          ${activeProject ? '<div class="p-5 text-center text-muted"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><br>Loading conversation stream...</div>' : '<div class="p-5 text-center text-muted">Select a conversation from the left menu.</div>'}
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    if (activeProject) {
      loadChatMessagesStream(activeProject);
    }
  }

  async function loadChatMessagesStream(projectId) {
    const res = await apiFetch(`/messages/conversation/${projectId}`);
    const streamPanel = document.getElementById('chat-stream-panel');
    if (!streamPanel || !res.success) return;

    const { conversation, messages } = res;

    let chatHtml = `
      <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
        <div>
          <strong class="h6 mb-0 text-dark">${escapeHtml(conversation.project_title)} (${projectId})</strong>
          <div class="small text-muted">Connected with: ${escapeHtml(conversation.expert_name || 'Dr. Aris Thorne')}</div>
        </div>
        <a href="#/projects/${projectId}" class="btn btn-sm btn-outline-primary rounded-pill">View Project Workspace</a>
      </div>

      <div class="chat-messages-body" id="chat-messages-body-el">
        ${messages.map(m => `
          <div class="chat-bubble ${m.sender_role === 'client' ? 'client' : 'expert'}">
            <div class="font-weight-bold mb-1" style="font-size: 0.78rem; opacity: 0.85;">${escapeHtml(m.sender_name)} • ${formatDate(m.created_at)}</div>
            <div>${escapeHtml(m.message)}</div>
            ${m.file_url ? `<div class="mt-2"><a href="${m.file_url}" target="_blank" class="badge badge-light p-2"><i class="fas fa-paperclip mr-1"></i> ${escapeHtml(m.file_name || 'Attachment')}</a></div>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="chat-input-bar">
        <input type="text" id="chat-message-input" class="form-control rounded-pill" placeholder="Type your message to expert..." onkeypress="if(event.key==='Enter') window.sendChatMessage('${projectId}')">
        <button type="button" class="btn btn-primary rounded-circle" style="width: 42px; height: 42px;" onclick="window.sendChatMessage('${projectId}')">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    `;

    streamPanel.innerHTML = chatHtml;

    // Scroll to bottom
    const msgBody = document.getElementById('chat-messages-body-el');
    if (msgBody) msgBody.scrollTop = msgBody.scrollHeight;

    window.sendChatMessage = async (pid) => {
      const input = document.getElementById('chat-message-input');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      await apiFetch(`/messages/conversation/${pid}`, 'POST', { message: text });
      loadChatMessagesStream(pid);
    };
  }

  // ==========================================
  // 6. FILE MANAGEMENT VIEW
  // ==========================================
  async function renderFileManagementView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Project Documents & Reference Files';
    showLoadingSkeleton();

    const res = await apiFetch('/projects');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const projects = res.projects;

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-file-pdf text-danger mr-2"></i> All Project Documents</h3>
        </div>
        <div class="card-box-body">
          ${projects.length === 0 ? renderEmptyState('No projects or documents found.') : `
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="thead-light">
                  <tr>
                    <th>Project ID</th>
                    <th>Project Title</th>
                    <th>Status</th>
                    <th>Documents & Attachments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${projects.map(p => `
                    <tr>
                      <td><span class="project-id-tag">${p.id}</span></td>
                      <td><strong>${escapeHtml(p.title)}</strong></td>
                      <td><span class="status-badge ${getStatusClass(p.status)}">${p.status}</span></td>
                      <td>Client Files & Reference Materials</td>
                      <td>
                        <a href="#/projects/${p.id}" class="btn btn-sm btn-outline-primary rounded-pill">Manage Files</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;
  }

  // ==========================================
  // 7. PAYMENTS VIEW
  // ==========================================
  async function renderPaymentsView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Payments & Invoice Records';
    showLoadingSkeleton();

    const res = await apiFetch('/payments');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const payments = res.payments;

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-credit-card text-success mr-2"></i> Official Financial Statements & Invoices</h3>
        </div>
        <div class="card-box-body">
          ${payments.length === 0 ? renderEmptyState('No payment records or invoices found.') : `
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="thead-light">
                  <tr>
                    <th>Invoice #</th>
                    <th>Project ID</th>
                    <th>Project Title</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment Method</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map(p => `
                    <tr>
                      <td><strong>${p.invoice_number}</strong></td>
                      <td><span class="project-id-tag">${p.project_id}</span></td>
                      <td>${escapeHtml(p.project_title)}</td>
                      <td><strong class="text-dark">$${p.final_amount}</strong></td>
                      <td>
                        <span class="badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'} px-3 py-1">
                          ${p.status}
                        </span>
                      </td>
                      <td>${p.payment_method || 'Credit Card'}</td>
                      <td>${formatDate(p.created_at)}</td>
                      <td>
                        ${p.status === 'Pending' ? `
                          <button class="btn btn-sm btn-warning rounded-pill font-weight-bold mr-1" onclick="window.triggerPaymentModal('${p.project_id}', ${p.final_amount})">
                            Pay Invoice
                          </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="window.viewInvoiceModal('${p.invoice_number}')">
                          View Invoice
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.triggerPaymentModal = (pid, amt) => openPaymentModal(pid, amt);
    window.viewInvoiceModal = async (invId) => {
      const r = await apiFetch(`/payments/invoice/${invId}`);
      if (r.success) {
        alert(`Invoice ${r.invoice.invoice_number}\nAmount: $${r.invoice.final_amount}\nStatus: ${r.invoice.status}\nClient: ${r.invoice.client_name}`);
      }
    };
  }

  // ==========================================
  // 8. NOTIFICATIONS VIEW
  // ==========================================
  async function renderNotificationsView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Notifications & System Alerts';
    showLoadingSkeleton();

    const res = await apiFetch('/notifications');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const { notifications } = res;

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-bell text-warning mr-2"></i> All System Notifications</h3>
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.markAllNotificationsRead()">Mark All as Read</button>
        </div>
        <div class="card-box-body p-0">
          <div class="list-group list-group-flush">
            ${notifications.length === 0 ? '<div class="p-5 text-center text-muted">No notifications found.</div>' : ''}
            ${notifications.map(n => `
              <div class="list-group-item p-4 ${n.is_read ? '' : 'bg-light'}">
                <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                  <h6 class="font-weight-bold mb-0 text-dark">${escapeHtml(n.title)}</h6>
                  <small class="text-muted">${formatDate(n.created_at)}</small>
                </div>
                <p class="mb-0 text-muted">${escapeHtml(n.message)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.markAllNotificationsRead = async () => {
      await apiFetch('/notifications/read', 'PUT', {});
      renderNotificationsView();
      fetchUnreadNotificationsCount();
    };
  }

  // ==========================================
  // 9. PROFILE & SETTINGS VIEWS
  // ==========================================
  async function renderProfileView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Client Account Profile';

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-user-circle text-primary mr-2"></i> Personal Profile Information</h3>
        </div>
        <div class="card-box-body">
          <form id="profile-update-form" onsubmit="window.saveProfileSubmit(event)">
            <div class="row">
              <div class="col-md-6 form-group">
                <label>Full Name *</label>
                <input type="text" id="prof-name" class="form-control" value="${escapeHtml(AppState.user.full_name || '')}" required>
              </div>
              <div class="col-md-6 form-group">
                <label>Email Address (Read-only)</label>
                <input type="email" class="form-control" value="${escapeHtml(AppState.user.email || '')}" readonly>
              </div>
              <div class="col-md-6 form-group">
                <label>Phone Number</label>
                <input type="text" id="prof-phone" class="form-control" value="${escapeHtml(AppState.user.phone || '')}">
              </div>
              <div class="col-md-6 form-group">
                <label>Institution / University</label>
                <input type="text" id="prof-inst" class="form-control" value="${escapeHtml(AppState.user.institution || '')}">
              </div>
              <div class="col-md-6 form-group">
                <label>Academic Level</label>
                <select id="prof-level" class="form-control">
                  <option ${AppState.user.academic_level === 'Undergraduate' ? 'selected' : ''}>Undergraduate</option>
                  <option ${AppState.user.academic_level === 'Postgraduate' ? 'selected' : ''}>Postgraduate</option>
                  <option ${AppState.user.academic_level === 'PhD' ? 'selected' : ''}>PhD</option>
                </select>
              </div>
              <div class="col-md-6 form-group">
                <label>Country</label>
                <input type="text" id="prof-country" class="form-control" value="${escapeHtml(AppState.user.country || '')}">
              </div>
            </div>
            <button type="submit" class="btn btn-primary px-4 rounded-pill mt-3">Save Profile Changes</button>
          </form>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.saveProfileSubmit = async (e) => {
      e.preventDefault();
      const payload = {
        full_name: document.getElementById('prof-name').value,
        phone: document.getElementById('prof-phone').value,
        institution: document.getElementById('prof-inst').value,
        academic_level: document.getElementById('prof-level').value,
        country: document.getElementById('prof-country').value
      };

      const res = await apiFetch('/auth/profile', 'PUT', payload);
      if (res.success) {
        alert('Profile updated successfully!');
        AppState.user.full_name = payload.full_name;
        localStorage.setItem('aw_user', JSON.stringify(AppState.user));
        updateUserUI();
      } else {
        alert(res.message || 'Failed to update profile.');
      }
    };
  }

  function renderSettingsView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Account Security & Preferences';

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-lock text-danger mr-2"></i> Security & Password Management</h3>
        </div>
        <div class="card-box-body">
          <form id="settings-password-form" onsubmit="window.savePasswordSubmit(event)">
            <div class="form-group">
              <label>Current Password *</label>
              <input type="password" id="pass-current" class="form-control" required>
            </div>
            <div class="form-group">
              <label>New Password *</label>
              <input type="password" id="pass-new" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-danger px-4 rounded-pill mt-2">Update Password</button>
          </form>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.savePasswordSubmit = async (e) => {
      e.preventDefault();
      const res = await apiFetch('/auth/settings', 'PUT', {
        current_password: document.getElementById('pass-current').value,
        new_password: document.getElementById('pass-new').value
      });

      if (res.success) {
        alert('Password updated successfully!');
        document.getElementById('pass-current').value = '';
        document.getElementById('pass-new').value = '';
      } else {
        alert(res.message || 'Failed to update password.');
      }
    };
  }

  // ==========================================
  // 10. SUPPORT CENTER VIEW
  // ==========================================
  async function renderSupportCenterView(ticketId = null) {
    if (pageTitleEl) pageTitleEl.textContent = 'Student Support Center & Help Desk';
    showLoadingSkeleton();

    const res = await apiFetch('/support/tickets');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const tickets = res.tickets;

    let html = `
      <div class="card-box">
        <div class="card-box-header">
          <h3 class="card-box-title"><i class="fas fa-life-ring text-info mr-2"></i> Support Tickets & Help Center</h3>
          <button class="btn btn-primary rounded-pill px-4" onclick="window.openNewTicketModal()">
            <i class="fas fa-plus-circle mr-1"></i> Open New Support Ticket
          </button>
        </div>
        <div class="card-box-body">
          ${tickets.length === 0 ? renderEmptyState('No support tickets found.') : `
            <div class="table-responsive">
              <table class="table table-hover">
                <thead class="thead-light">
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${tickets.map(t => `
                    <tr>
                      <td><strong>${t.id}</strong></td>
                      <td><strong>${escapeHtml(t.subject)}</strong></td>
                      <td>${escapeHtml(t.category)}</td>
                      <td><span class="badge badge-secondary">${t.priority}</span></td>
                      <td><span class="badge ${t.status === 'Open' ? 'badge-success' : 'badge-info'}">${t.status}</span></td>
                      <td>${formatDate(t.created_at)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    window.openNewTicketModal = () => {
      const subject = prompt('Enter support ticket subject:');
      const message = prompt('Describe your inquiry or issue:');
      if (subject && message) {
        apiFetch('/support/tickets', 'POST', { subject, category: 'Academic Guidance', initial_message: message }).then(r => {
          if (r.success) {
            alert('Support ticket created!');
            renderSupportCenterView();
          }
        });
      }
    };
  }

  // Payment Modal Helper
  function openPaymentModal(projectId, amount) {
    if (confirm(`Confirm payment of $${amount} for project ${projectId}?`)) {
      apiFetch('/payments/pay', 'POST', { project_id: projectId, payment_method: 'Credit Card (Stripe)' }).then(r => {
        if (r.success) {
          alert(`Payment Successful! Transaction ID: ${r.transaction_id}`);
          window.location.hash = `#/projects/${projectId}`;
        } else {
          alert(r.message || 'Payment failed.');
        }
      });
    }
  }

  // Revision Modal Helper
  function openRevisionModal(projectId) {
    const reason = prompt('Enter primary revision reason:');
    const instructions = prompt('Provide detailed revision instructions for the expert:');
    if (reason && instructions) {
      apiFetch(`/projects/${projectId}/revisions`, 'POST', { revision_reason: reason, detailed_instructions: instructions }).then(r => {
        if (r.success) {
          alert('Revision request submitted!');
          renderProjectWorkspace(projectId);
        }
      });
    }
  }

  // Auth Functions
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const res = await apiFetch('/auth/login', 'POST', { email, password });
    if (res.success) {
      AppState.token = res.token;
      AppState.user = res.user;
      localStorage.setItem('aw_token', res.token);
      localStorage.setItem('aw_user', JSON.stringify(res.user));

      $('#authModal').modal('hide');
      updateUserUI();
      renderDashboardOverview();
    } else {
      alert(res.message || 'Login failed.');
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const full_name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const institution = document.getElementById('reg-institution').value;

    const res = await apiFetch('/auth/register', 'POST', { full_name, email, password, institution });
    if (res.success) {
      AppState.token = res.token;
      AppState.user = res.user;
      localStorage.setItem('aw_token', res.token);
      localStorage.setItem('aw_user', JSON.stringify(res.user));

      $('#authModal').modal('hide');
      updateUserUI();
      renderDashboardOverview();
    } else {
      alert(res.message || 'Registration failed.');
    }
  }

  function showAuthModal(type = 'login') {
    $('#authModal').modal({ backdrop: 'static', keyboard: false, show: true });
    if (type === 'login') {
      $('#auth-login-tab').tab('show');
    } else {
      $('#auth-register-tab').tab('show');
    }
  }

  function logoutUser() {
    localStorage.removeItem('aw_token');
    localStorage.removeItem('aw_user');
    AppState.token = null;
    AppState.user = null;
    showAuthModal('login');
  }

  async function fetchUnreadNotificationsCount() {
    const res = await apiFetch('/notifications');
    if (res.success && notifBadgeEl) {
      notifBadgeEl.style.display = res.unread_count > 0 ? 'block' : 'none';
    }
  }

  // UI Helper States
  function showLoadingSkeleton() {
    mainContentEl.innerHTML = `
      <div class="p-5 text-center">
        <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status">
          <span class="sr-only">Loading workspace data...</span>
        </div>
        <h5 class="text-muted">Loading your client workspace...</h5>
      </div>
    `;
  }

  function showErrorState(msg) {
    mainContentEl.innerHTML = `
      <div class="card-box p-5 text-center text-danger">
        <i class="fas fa-exclamation-triangle display-4 mb-3"></i>
        <h3>Error Loading Workspace</h3>
        <p class="text-muted">${escapeHtml(msg || 'Failed to communicate with server.')}</p>
        <button class="btn btn-primary rounded-pill px-4" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  function renderEmptyState(msg) {
    return `
      <div class="p-5 text-center text-muted">
        <i class="fas fa-folder-open display-4 mb-3 text-secondary" style="opacity: 0.4;"></i>
        <h5>No Records Found</h5>
        <p class="small">${escapeHtml(msg)}</p>
      </div>
    `;
  }

  // Utility Functions
  function getStatusClass(status) {
    switch (status) {
      case 'Submitted': return 'status-submitted';
      case 'In Progress': return 'status-in-progress';
      case 'Payment Pending': return 'status-payment-pending';
      case 'Paid': return 'status-paid';
      case 'Completed': return 'status-completed';
      case 'Revision Requested': return 'status-revision-requested';
      default: return 'status-submitted';
    }
  }

  function calculateDaysRemaining(deadlineStr) {
    if (!deadlineStr) return 0;
    const diff = new Date(deadlineStr) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function formatDate(dStr) {
    if (!dStr) return 'N/A';
    const d = new Date(dStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
