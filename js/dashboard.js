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
      case 'referral':
        renderReferralView();
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
    if (pageTitleEl) pageTitleEl.textContent = 'Dashboard';
    showLoadingSkeleton();

    const res = await apiFetch('/dashboard/stats');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const { stats, recent_projects, recent_notifications } = res;

    let html = `
      <div style="max-width: 1400px; margin: 0 auto;">
        <!-- Welcome Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h1 style="font-size: 1.75rem; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">
              Good afternoon, <span style="color: #2563eb;">${escapeHtml(AppState.user.full_name)}!</span>
            </h1>
            <p style="color: #6b7280; margin: 0; font-size: 0.95rem;">Your assignment dashboard is ready. Here's an overview of your current activities.</p>
          </div>
          <a href="#/submit-project" class="btn btn-primary" style="background: #2563eb; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
            <i class="fas fa-plus" style="font-size: 0.85rem;"></i> New Assignment
          </a>
        </div>

        <!-- Stats Cards Row -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;">
          <!-- Your Assignments Card -->
          <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
            <div style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Your Assignments</div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 16px;">${stats.total_projects}</div>
            <div style="height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
              <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
              <span style="color: #6b7280;"><strong style="color: #1a1a1a;">${stats.completed_projects}</strong> completed • <strong style="color: #1a1a1a;">0</strong> pending</span>
              <a href="#/projects" style="color: #2563eb; text-decoration: none; font-weight: 500;">Details →</a>
            </div>
          </div>

          <!-- Your Downloads Card -->
          <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
            <div style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Your Downloads</div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 16px;">0</div>
            <div style="height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
              <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
              <span style="color: #6b7280;">0/0 accessed</span>
              <a href="#/files" style="color: #2563eb; text-decoration: none; font-weight: 500;">Details →</a>
            </div>
          </div>

          <!-- Invite Friends Card -->
          <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
            <div style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Invite Friends</div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 16px;">0</div>
            <div style="height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
              <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
              <span style="color: #6b7280;">Rs. ₹13,500 target</span>
              <a href="#/referral" style="color: #2563eb; text-decoration: none; font-weight: 500;">Details →</a>
            </div>
          </div>
        </div>

        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- Track your Assignment Card -->
          <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; min-height: 360px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 4px 0;">Track your Assignment</h3>
                <p style="color: #6b7280; margin: 0; font-size: 0.85rem;">Your most recent assignment activities</p>
              </div>
              <a href="#/projects" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 0.9rem;">Browse →</a>
            </div>

            ${stats.total_projects === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <i class="fas fa-file-alt" style="font-size: 28px; color: #2563eb;"></i>
              </div>
              <h4 style="font-size: 1rem; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">No assignments yet</h4>
              <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 0.9rem; max-width: 280px;">Start your academic journey by creating your first assignment</p>
              <a href="#/submit-project" class="btn btn-primary" style="background: #2563eb; border: none; padding: 10px 28px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: white;">
                <i class="fas fa-plus" style="font-size: 0.8rem;"></i> New Assignment
              </a>
            </div>
            ` : `
            <div style="padding: 20px 0;">
              ${recent_projects.slice(0, 3).map(p => `
                <div style="padding: 16px; border-bottom: 1px solid #f3f4f6; cursor: pointer;" onclick="window.location.hash='#/projects/${p.id}'">
                  <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                      <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${escapeHtml(p.title)}</div>
                      <div style="font-size: 0.8rem; color: #6b7280;">${escapeHtml(p.subject)} • Due: ${p.deadline}</div>
                    </div>
                    <span style="padding: 4px 12px; background: ${p.payment_status === 'Paid' ? '#d1fae5' : '#fef3c7'}; color: ${p.payment_status === 'Paid' ? '#059669' : '#d97706'}; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;">${p.status}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            `}
          </div>

          <!-- Pending Payments Card -->
          <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; min-height: 360px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 4px 0;">Pending Payments</h3>
                <p style="color: #6b7280; margin: 0; font-size: 0.85rem;">Your outstanding payment obligations</p>
              </div>
              <a href="#/payments" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 0.9rem;">View History →</a>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center;">
              <div style="width: 64px; height: 64px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <i class="fas fa-check-circle" style="font-size: 28px; color: #10b981;"></i>
              </div>
              <h4 style="font-size: 1rem; font-weight: 600; color: #1a1a1a; margin: 0 0 8px 0;">All payments up to date</h4>
              <p style="color: #6b7280; margin: 0; font-size: 0.9rem; max-width: 280px;">You have no pending payments at the moment</p>
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
    if (pageTitleEl) pageTitleEl.textContent = 'Assignments';
    showLoadingSkeleton();

    const res = await apiFetch(`/projects?status=${AppState.activeTab === 'All' ? '' : AppState.activeTab}`);
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const projects = res.projects || [];
    
    // Calculate stats
    const totalAssignments = projects.length;
    const pendingCount = projects.filter(p => p.status === 'Submitted' || p.status === 'Payment Pending').length;
    const inProgressCount = projects.filter(p => p.status === 'In Progress').length;
    const completedCount = projects.filter(p => p.status === 'Completed').length;

    let html = `
      <div style="max-width: 1400px; margin: 0 auto;">
        <!-- Page Header -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <i class="fas fa-file-alt" style="color: #2563eb; font-size: 1.4rem;"></i>
            <h1 style="font-size: 1.75rem; font-weight: 700; color: #1a1a1a; margin: 0;">My Assignments</h1>
          </div>
          <p style="color: #6b7280; margin: 0; font-size: 0.95rem;">Manage and track all your assignment submissions</p>
        </div>

        <!-- Stats Cards Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
          <!-- Total Assignments -->
          <div style="background: #eff6ff; border-radius: 12px; padding: 20px; border: 1px solid #dbeafe; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="color: #1e40af; font-size: 0.8rem; font-weight: 600; margin-bottom: 8px;">Total Assignments</div>
                <div style="font-size: 2rem; font-weight: 700; color: #1e3a8a;">${totalAssignments}</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-file-alt" style="color: #2563eb; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>

          <!-- Pending -->
          <div style="background: #fef3c7; border-radius: 12px; padding: 20px; border: 1px solid #fde68a; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="color: #b45309; font-size: 0.8rem; font-weight: 600; margin-bottom: 8px;">Pending</div>
                <div style="font-size: 2rem; font-weight: 700; color: #92400e;">${pendingCount}</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-clock" style="color: #f59e0b; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>

          <!-- In Progress -->
          <div style="background: #f3e8ff; border-radius: 12px; padding: 20px; border: 1px solid #e9d5ff; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="color: #7e22ce; font-size: 0.8rem; font-weight: 600; margin-bottom: 8px;">In Progress</div>
                <div style="font-size: 2rem; font-weight: 700; color: #6b21a8;">${inProgressCount}</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-spinner" style="color: #a855f7; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>

          <!-- Completed -->
          <div style="background: #d1fae5; border-radius: 12px; padding: 20px; border: 1px solid #a7f3d0; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="color: #065f46; font-size: 0.8rem; font-weight: 600; margin-bottom: 8px;">Completed</div>
                <div style="font-size: 2rem; font-weight: 700; color: #047857;">${completedCount}</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-check-circle" style="color: #10b981; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Card -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
          <!-- Tabs Header -->
          <div style="border-bottom: 1px solid #e5e7eb; padding: 16px 24px; display: flex; gap: 0;">
            ${['All', 'Pending', 'In Progress', 'Under Review', 'Completed', 'Cancelled'].map(tab => `
              <button 
                onclick="window.setProjectTab('${tab}')" 
                style="background: ${AppState.activeTab === tab ? '#2563eb' : 'transparent'}; 
                       color: ${AppState.activeTab === tab ? 'white' : '#6b7280'}; 
                       border: none; 
                       padding: 8px 18px; 
                       border-radius: 6px; 
                       font-size: 0.85rem; 
                       font-weight: 600; 
                       cursor: pointer; 
                       transition: all 0.2s;
                       margin-right: 8px;">
                ${tab}
              </button>
            `).join('')}
          </div>

          <!-- Search and Actions Bar -->
          <div style="padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
            <div style="position: relative; flex: 1; max-width: 400px;">
              <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 0.9rem;"></i>
              <input 
                type="text" 
                id="project-search-input" 
                placeholder="Search assignments..." 
                onkeyup="window.filterProjectsBySearch(this.value)"
                style="width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none;">
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <button style="background: white; border: 1px solid #e5e7eb; padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-redo" style="font-size: 0.8rem;"></i> Refresh
              </button>
              <a href="#/submit-project" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; text-decoration: none;">
                <i class="fas fa-plus" style="font-size: 0.8rem;"></i> New Request
              </a>
            </div>
          </div>

          <!-- Table Header -->
          <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr 1.5fr 1.5fr 1fr; padding: 16px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              Assignment <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Status <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Experts <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Due Date <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Price <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div>Actions</div>
          </div>

          <!-- Table Body / Empty State -->
          <div id="projects-list-container">
            ${projects.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center;">
              <div style="width: 80px; height: 80px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <i class="fas fa-file-alt" style="font-size: 36px; color: #2563eb;"></i>
              </div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">No Assignments found</h3>
              <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 0.95rem; max-width: 380px;">You haven't created any assignment requests yet. Get started by creating your first assignment request.</p>
              <a href="#/submit-project" style="background: #2563eb; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
                <i class="fas fa-plus" style="font-size: 0.85rem;"></i> New Request
              </a>
            </div>
            ` : projects.map(p => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr 1.5fr 1.5fr 1fr; padding: 20px 24px; border-bottom: 1px solid #f3f4f6; align-items: center; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" onclick="window.location.hash='#/projects/${p.id}'">
              <div>
                <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${escapeHtml(p.title)}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">${escapeHtml(p.subject)}</div>
              </div>
              <div>
                <span style="padding: 5px 12px; background: ${getStatusBgColor(p.status)}; color: ${getStatusTextColor(p.status)}; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; display: inline-block;">
                  ${p.status}
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #374151;">
                ${p.expert_name ? escapeHtml(p.expert_name) : 'Assigning...'}
              </div>
              <div style="font-size: 0.85rem; color: #374151;">
                ${p.deadline || 'N/A'}
              </div>
              <div style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">
                $${p.total_amount}
              </div>
              <div>
                <button onclick="event.stopPropagation(); window.location.hash='#/projects/${p.id}'" style="background: transparent; border: none; color: #6b7280; cursor: pointer; padding: 6px; font-size: 1rem;">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Global functions
    window.setProjectTab = (tab) => {
      AppState.activeTab = tab;
      renderProjectsList();
    };

    window.filterProjectsBySearch = (query) => {
      const filtered = projects.filter(p => 
        p.title.toLowerCase().includes(query.toLowerCase()) || 
        p.id.toLowerCase().includes(query.toLowerCase()) ||
        p.subject.toLowerCase().includes(query.toLowerCase())
      );
      const container = document.getElementById('projects-list-container');
      if (container) {
        if (filtered.length === 0) {
          container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center;">
              <div style="width: 80px; height: 80px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <i class="fas fa-search" style="font-size: 36px; color: #2563eb;"></i>
              </div>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">No matching assignments</h3>
              <p style="color: #6b7280; margin: 0; font-size: 0.95rem;">Try adjusting your search terms</p>
            </div>
          `;
        } else {
          container.innerHTML = filtered.map(p => `
            <div style="display: grid; grid-template-columns: 3fr 1.5fr 1.5fr 1.5fr 1.5fr 1fr; padding: 20px 24px; border-bottom: 1px solid #f3f4f6; align-items: center; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" onclick="window.location.hash='#/projects/${p.id}'">
              <div>
                <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${escapeHtml(p.title)}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">${escapeHtml(p.subject)}</div>
              </div>
              <div>
                <span style="padding: 5px 12px; background: ${getStatusBgColor(p.status)}; color: ${getStatusTextColor(p.status)}; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; display: inline-block;">
                  ${p.status}
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #374151;">
                ${p.expert_name ? escapeHtml(p.expert_name) : 'Assigning...'}
              </div>
              <div style="font-size: 0.85rem; color: #374151;">
                ${p.deadline || 'N/A'}
              </div>
              <div style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">
                $${p.total_amount}
              </div>
              <div>
                <button onclick="event.stopPropagation(); window.location.hash='#/projects/${p.id}'" style="background: transparent; border: none; color: #6b7280; cursor: pointer; padding: 6px; font-size: 1rem;">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>
          `).join('');
        }
      }
    };
  }

  // Helper functions for status colors
  function getStatusBgColor(status) {
    const colorMap = {
      'Submitted': '#fef3c7',
      'Payment Pending': '#fef3c7',
      'In Progress': '#f3e8ff',
      'Submitted for Review': '#dbeafe',
      'Revision Requested': '#fee2e2',
      'Completed': '#d1fae5',
      'Cancelled': '#f3f4f6'
    };
    return colorMap[status] || '#f3f4f6';
  }

  function getStatusTextColor(status) {
    const colorMap = {
      'Submitted': '#92400e',
      'Payment Pending': '#92400e',
      'In Progress': '#6b21a8',
      'Submitted for Review': '#1e40af',
      'Revision Requested': '#991b1b',
      'Completed': '#065f46',
      'Cancelled': '#6b7280'
    };
    return colorMap[status] || '#6b7280';
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
    if (pageTitleEl) pageTitleEl.textContent = 'Create New Assignment';

    let html = `
      <div style="background: white; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 32px;">
          <div>
            <h2 style="font-size: 28px; font-weight: 700; color: #1f2937; margin: 0 0 8px 0;">Create New Assignment</h2>
            <p style="font-size: 15px; color: #6b7280; margin: 0;">Submit your assignment for expert help</p>
          </div>
          <button type="button" onclick="window.location.hash='#/assignments'" style="background: transparent; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 16px; font-size: 14px; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>

        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 400px; gap: 32px;">
          <!-- Left Column: Form -->
          <div>
            <form id="assignment-form" onsubmit="return false;">
              <!-- Assignment Title -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Assignment Title *</label>
                <div style="position: relative;">
                  <input type="text" id="assignment-title" maxlength="100" placeholder="Enter assignment title" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1f2937;" required>
                  <span id="title-counter" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #9ca3af;">0/100</span>
                </div>
              </div>

              <!-- Assignment Type -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Assignment Type *</label>
                <select id="assignment-type" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1f2937; background: white;" required>
                  <option value="">Select type</option>
                  <option value="Essay">Essay</option>
                  <option value="Research Paper">Research Paper</option>
                  <option value="Case Study">Case Study</option>
                  <option value="Thesis">Thesis</option>
                  <option value="Programming">Programming Assignment</option>
                  <option value="Report">Report</option>
                  <option value="Presentation">Presentation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <!-- Academic Stream -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Academic Stream *</label>
                <select id="academic-stream" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1f2937; background: white;" required>
                  <option value="">Select stream</option>
                  <option value="Computer Science & IT">Computer Science & IT</option>
                  <option value="Business & Management">Business & Management</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Medical & Health">Medical & Health</option>
                  <option value="Social Sciences">Social Sciences</option>
                  <option value="Law & Humanities">Law & Humanities</option>
                  <option value="Natural Sciences">Natural Sciences</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <!-- Due Date -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Due Date *</label>
                <input type="date" id="due-date" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1f2937;" required>
              </div>

              <!-- Assignment Description -->
              <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Assignment Description *</label>
                <div style="position: relative;">
                  <textarea id="assignment-description" maxlength="2000" rows="6" placeholder="Provide detailed requirements, instructions, and any specific guidelines..." style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1f2937; resize: vertical; font-family: inherit;" required></textarea>
                  <span id="description-counter" style="position: absolute; right: 12px; bottom: 12px; font-size: 12px; color: #9ca3af;">0/2000</span>
                </div>
              </div>

              <!-- Supporting Documents -->
              <div style="margin-bottom: 32px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Supporting Documents</label>
                <div id="upload-area" style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 32px; text-align: center; background: #f9fafb; cursor: pointer;">
                  <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
                  <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;"><strong>Drag & drop files here or click to browse</strong></p>
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">Supported formats: PDF, DOC, DOCX, PPT, XLS, ZIP, PNG, JPG (Max 50MB)</p>
                  <input type="file" id="file-input" multiple style="display: none;" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg">
                </div>
                <div id="file-list" style="margin-top: 12px;"></div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" onclick="window.location.hash='#/assignments'" style="background: white; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 24px; font-size: 14px; font-weight: 500; color: #6b7280; cursor: pointer;">
                  Cancel
                </button>
                <button type="button" onclick="window.resetAssignmentForm()" style="background: white; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 24px; font-size: 14px; font-weight: 500; color: #6b7280; cursor: pointer;">
                  Reset
                </button>
                <button type="submit" id="submit-btn" style="background: #2563eb; border: none; border-radius: 6px; padding: 10px 32px; font-size: 14px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-paper-plane"></i> Create Assignment
                </button>
              </div>
            </form>
          </div>

          <!-- Right Column: Tips & Process -->
          <div>
            <!-- Tips for Success -->
            <div style="background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="font-size: 16px; font-weight: 700; color: #166534; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-lightbulb"></i> Tips for Success
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #166534; font-size: 13px; line-height: 1.8;">
                <li>Be specific about your requirements</li>
                <li>Include all relevant materials and guidelines</li>
                <li>Set realistic deadlines for quality work</li>
                <li>Mention citation style and formatting preferences</li>
                <li>Upload sample documents if available</li>
              </ul>
            </div>

            <!-- How It Works -->
            <div style="background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 8px; padding: 20px;">
              <h3 style="font-size: 16px; font-weight: 700; color: #6b21a8; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-info-circle"></i> How It Works
              </h3>
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- Step 1 -->
                <div style="display: flex; gap: 12px;">
                  <div style="flex-shrink: 0; width: 32px; height: 32px; background: #6b21a8; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">1</div>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #6b21a8; margin: 0 0 4px 0;">Submit Assignment</h4>
                    <p style="font-size: 12px; color: #7c3aed; margin: 0; line-height: 1.6;">Fill out the form with all assignment details and requirements</p>
                  </div>
                </div>
                <!-- Step 2 -->
                <div style="display: flex; gap: 12px;">
                  <div style="flex-shrink: 0; width: 32px; height: 32px; background: #6b21a8; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">2</div>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #6b21a8; margin: 0 0 4px 0;">Expert Review</h4>
                    <p style="font-size: 12px; color: #7c3aed; margin: 0; line-height: 1.6;">Our experts will review and start working on your assignment</p>
                  </div>
                </div>
                <!-- Step 3 -->
                <div style="display: flex; gap: 12px;">
                  <div style="flex-shrink: 0; width: 32px; height: 32px; background: #6b21a8; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">3</div>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #6b21a8; margin: 0 0 4px 0;">Track Progress</h4>
                    <p style="font-size: 12px; color: #7c3aed; margin: 0; line-height: 1.6;">Monitor the status and communicate via messages</p>
                  </div>
                </div>
                <!-- Step 4 -->
                <div style="display: flex; gap: 12px;">
                  <div style="flex-shrink: 0; width: 32px; height: 32px; background: #6b21a8; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;">4</div>
                  <div>
                    <h4 style="font-size: 14px; font-weight: 600; color: #6b21a8; margin: 0 0 4px 0;">Receive & Review</h4>
                    <p style="font-size: 12px; color: #7c3aed; margin: 0; line-height: 1.6;">Get your completed assignment and request revisions if needed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('due-date').setAttribute('min', today);

    // Character counters
    const titleInput = document.getElementById('assignment-title');
    const titleCounter = document.getElementById('title-counter');
    const descInput = document.getElementById('assignment-description');
    const descCounter = document.getElementById('description-counter');

    titleInput.addEventListener('input', () => {
      titleCounter.textContent = `${titleInput.value.length}/100`;
    });

    descInput.addEventListener('input', () => {
      descCounter.textContent = `${descInput.value.length}/2000`;
    });

    // File upload functionality
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    let selectedFiles = [];

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#2563eb';
      uploadArea.style.background = '#eff6ff';
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#d1d5db';
      uploadArea.style.background = '#f9fafb';
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#d1d5db';
      uploadArea.style.background = '#f9fafb';
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    function handleFiles(files) {
      selectedFiles = Array.from(files);
      displayFiles();
    }

    function displayFiles() {
      if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
      }

      fileList.innerHTML = selectedFiles.map((file, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <i class="fas fa-file-alt" style="color: #6b7280;"></i>
            <span style="font-size: 13px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.name)}</span>
            <span style="font-size: 12px; color: #9ca3af;">(${(file.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button type="button" onclick="window.removeFile(${index})" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px;">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
    }

    window.removeFile = (index) => {
      selectedFiles.splice(index, 1);
      displayFiles();
    };

    window.resetAssignmentForm = () => {
      document.getElementById('assignment-form').reset();
      selectedFiles = [];
      displayFiles();
      titleCounter.textContent = '0/100';
      descCounter.textContent = '0/2000';
    };

    // Form submission
    document.getElementById('assignment-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('submit-btn');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

      const formData = new FormData();
      formData.append('title', titleInput.value);
      formData.append('type', document.getElementById('assignment-type').value);
      formData.append('stream', document.getElementById('academic-stream').value);
      formData.append('due_date', document.getElementById('due-date').value);
      formData.append('description', descInput.value);

      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      try {
        const res = await apiFetch('/projects', 'POST', formData, true);
        if (res.success) {
          alert('Assignment created successfully!');
          window.location.hash = '#/assignments';
        } else {
          alert(res.message || 'Failed to create assignment.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      } catch (error) {
        alert('Error creating assignment. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
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
    if (pageTitleEl) pageTitleEl.textContent = 'Payments & Invoices';
    showLoadingSkeleton();

    const res = await apiFetch('/payments');
    if (!res.success) {
      showErrorState(res.message);
      return;
    }

    const payments = res.payments || [];
    
    // Calculate stats
    const pendingCount = payments.filter(p => p.status === 'Pending').length;
    const completedCount = payments.filter(p => p.status === 'Paid').length;
    const totalAmount = payments.reduce((sum, p) => sum + (p.final_amount || 0), 0);

    let html = `
      <div style="max-width: 1400px; margin: 0 auto;">
        <!-- Page Header -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <i class="fas fa-credit-card" style="color: #2563eb; font-size: 1.4rem;"></i>
            <h1 style="font-size: 1.75rem; font-weight: 700; color: #1a1a1a; margin: 0;">Payments & Invoices</h1>
          </div>
          <p style="color: #6b7280; margin: 0; font-size: 0.95rem;">Manage your payments and track your history</p>
        </div>

        <!-- Stats Cards Row -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <!-- Pending -->
          <div style="background: #fef3c7; border-radius: 12px; padding: 20px; border: 1px solid #fde68a; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                  <i class="fas fa-clock" style="color: #b45309; font-size: 0.9rem;"></i>
                  <div style="color: #b45309; font-size: 0.8rem; font-weight: 600;">Pending</div>
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: #92400e;">₹${pendingCount}</div>
                <div style="color: #b45309; font-size: 0.75rem; margin-top: 4px;">0 pending payments</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-exclamation-circle" style="color: #f59e0b; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>

          <!-- Completed -->
          <div style="background: #d1fae5; border-radius: 12px; padding: 20px; border: 1px solid #a7f3d0; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                  <i class="fas fa-check-circle" style="color: #065f46; font-size: 0.9rem;"></i>
                  <div style="color: #065f46; font-size: 0.8rem; font-weight: 600;">Completed</div>
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: #047857;">₹${completedCount}</div>
                <div style="color: #065f46; font-size: 0.75rem; margin-top: 4px;">0 completed</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-check-circle" style="color: #10b981; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>

          <!-- Total -->
          <div style="background: #eff6ff; border-radius: 12px; padding: 20px; border: 1px solid #dbeafe; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                  <i class="fas fa-receipt" style="color: #1e40af; font-size: 0.9rem;"></i>
                  <div style="color: #1e40af; font-size: 0.8rem; font-weight: 600;">Total</div>
                </div>
                <div style="font-size: 2rem; font-weight: 700; color: #1e3a8a;">₹0</div>
                <div style="color: #1e40af; font-size: 0.75rem; margin-top: 4px;">0 total transactions</div>
              </div>
              <div style="background: white; width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-rupee-sign" style="color: #2563eb; font-size: 1.3rem;"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Card -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
          <!-- Tabs Header -->
          <div style="border-bottom: 1px solid #e5e7eb; padding: 16px 24px; display: flex; gap: 0;">
            ${['All', 'Pending', 'Paid', 'Failed'].map(tab => `
              <button 
                onclick="window.setPaymentTab('${tab}')" 
                style="background: ${AppState.activeTab === tab ? '#2563eb' : 'transparent'}; 
                       color: ${AppState.activeTab === tab ? 'white' : '#6b7280'}; 
                       border: none; 
                       padding: 8px 18px; 
                       border-radius: 6px; 
                       font-size: 0.85rem; 
                       font-weight: 600; 
                       cursor: pointer; 
                       transition: all 0.2s;
                       margin-right: 8px;">
                ${tab}
              </button>
            `).join('')}
          </div>

          <!-- Search and Actions Bar -->
          <div style="padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
            <div style="position: relative; flex: 1; max-width: 400px;">
              <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 0.9rem;"></i>
              <input 
                type="text" 
                id="payment-search-input" 
                placeholder="Search payments..." 
                style="width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none;">
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <select style="padding: 10px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #374151; cursor: pointer; outline: none;">
                <option>All Assignments</option>
              </select>
              <button style="background: white; border: 1px solid #e5e7eb; padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-redo" style="font-size: 0.8rem;"></i> Refresh
              </button>
            </div>
          </div>

          <!-- Table Header -->
          <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr 1fr; padding: 16px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              Assignment <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Status <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Amount <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Date <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div>Actions</div>
          </div>

          <!-- Table Body / Empty State -->
          <div id="payments-list-container">
            ${payments.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center;">
              <div style="width: 80px; height: 80px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <i class="fas fa-rupee-sign" style="font-size: 36px; color: #6b7280;"></i>
              </div>
              <h3 style="font-size: 1rem; font-weight: 600; color: #6b7280; margin: 0 0 8px 0;">No payments yet</h3>
            </div>
            ` : payments.map(p => `
            <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr 1fr; padding: 20px 24px; border-bottom: 1px solid #f3f4f6; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
              <div>
                <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${p.invoice_number}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">${escapeHtml(p.project_title)}</div>
              </div>
              <div>
                <span style="padding: 5px 12px; background: ${p.status === 'Paid' ? '#d1fae5' : '#fef3c7'}; color: ${p.status === 'Paid' ? '#065f46' : '#92400e'}; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; display: inline-block;">
                  ${p.status}
                </span>
              </div>
              <div style="font-size: 0.9rem; font-weight: 600; color: #1a1a1a;">
                ₹${p.final_amount}
              </div>
              <div style="font-size: 0.85rem; color: #374151;">
                ${formatDate(p.created_at)}
              </div>
              <div>
                <button onclick="window.viewInvoiceModal('${p.invoice_number}')" style="background: transparent; border: none; color: #6b7280; cursor: pointer; padding: 6px; font-size: 1rem;">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Global functions
    window.setPaymentTab = (tab) => {
      AppState.activeTab = tab;
      renderPaymentsView();
    };

    window.viewInvoiceModal = async (invId) => {
      const r = await apiFetch(`/payments/invoice/${invId}`);
      if (r.success) {
        alert(`Invoice ${r.invoice.invoice_number}\nAmount: ₹${r.invoice.final_amount}\nStatus: ${r.invoice.status}\nClient: ${r.invoice.client_name}`);
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
  // 10. SUPPORT CENTER VIEW
  // ==========================================
  async function renderSupportCenterView(ticketId = null) {
    if (pageTitleEl) pageTitleEl.textContent = 'Support Center';
    showLoadingSkeleton();

    let issues = [];
    try {
      const ticketsRes = await apiFetch('/support/tickets');
      if (ticketsRes && ticketsRes.success && Array.isArray(ticketsRes.tickets)) {
        issues = ticketsRes.tickets;
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    }

    const totalIssues = issues.length;
    const activeIssues = issues.filter(t => t.status !== 'Resolved').length;
    const resolvedIssues = issues.filter(t => t.status === 'Resolved').length;
    const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) + '%' : '0%';

    let html = `
      <div style="max-width: 1400px; margin: 0 auto;">
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; position: relative; overflow: hidden;">
          <div style="position: relative; z-index: 1;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
              <div style="background: white; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-life-ring" style="color: #2563eb; font-size: 1.5rem;"></i>
              </div>
              <h1 style="font-size: 1.75rem; font-weight: 700; color: #1e3a8a; margin: 0;">Support Center</h1>
            </div>
            <p style="color: #1e40af; margin: 0 0 20px 0; font-size: 1rem;">Get help with your assignments</p>
            <p style="color: #3b82f6; margin: 0; font-size: 0.9rem; max-width: 600px;">Need assistance? Report issues, track progress, and get quick support for all your assignment needs.</p>
          </div>
          <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 12px;">
            <button onclick="window.openNewIssueModal()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              <i class="fas fa-plus" style="font-size: 0.85rem;"></i> Report Issue
            </button>
            <button style="background: white; color: #2563eb; border: 1px solid #dbeafe; padding: 12px 24px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-comments" style="font-size: 0.85rem;"></i> Live Chat
            </button>
          </div>
        </div>

        <!-- Stats Cards Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
          <!-- Total Issues -->
          <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-file-alt" style="color: #2563eb; font-size: 0.9rem;"></i>
              <div style="color: #6b7280; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Issues</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${totalIssues}</div>
            <div style="color: #6b7280; font-size: 0.8rem;">All time issues reported</div>
          </div>

          <!-- Active Issues -->
          <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-exclamation-circle" style="color: #f59e0b; font-size: 0.9rem;"></i>
              <div style="color: #6b7280; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Active Issues</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${activeIssues}</div>
            <div style="color: #6b7280; font-size: 0.8rem;">Pending resolution</div>
          </div>

          <!-- Resolved Issues -->
          <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-check-circle" style="color: #10b981; font-size: 0.9rem;"></i>
              <div style="color: #6b7280; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolved Issues</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${resolvedIssues}</div>
            <div style="color: #6b7280; font-size: 0.8rem;">Successfully resolved</div>
          </div>

          <!-- Resolution Rate -->
          <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-percentage" style="color: #8b5cf6; font-size: 0.9rem;"></i>
              <div style="color: #6b7280; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolution Rate</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${resolutionRate}</div>
            <div style="color: #6b7280; font-size: 0.8rem;">Resolution success rate</div>
          </div>
        </div>

        <!-- Main Content Card -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
          <!-- Search and Filters Bar -->
          <div style="padding: 20px 24px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
            <div style="position: relative; flex: 1; max-width: 400px;">
              <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 0.9rem;"></i>
              <input 
                type="text" 
                id="issue-search-input" 
                placeholder="Search your issues..." 
                style="width: 100%; padding: 10px 12px 10px 38px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none;">
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <select style="padding: 10px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; font-weight: 500; color: #374151; cursor: pointer; outline: none;">
                <option>All Types</option>
                <option>Technical</option>
                <option>Payment</option>
                <option>Academic</option>
              </select>
              <select style="padding: 10px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; font-weight: 500; color: #374151; cursor: pointer; outline: none;">
                <option>All Priorities</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <select style="padding: 10px 16px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 0.85rem; font-weight: 500; color: #374151; cursor: pointer; outline: none;">
                <option>All Status</option>
                <option>Open</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
              <button onclick="window.renderSupportCenterView()" style="background: white; border: 1px solid #e5e7eb; padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-redo" style="font-size: 0.8rem;"></i> Refresh
              </button>
            </div>
          </div>

          <!-- Tabs -->
          <div style="border-bottom: 1px solid #e5e7eb; padding: 0 24px; display: flex; gap: 0;">
            <button style="background: transparent; color: #2563eb; border: none; border-bottom: 2px solid #2563eb; padding: 16px 20px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-circle-notch" style="font-size: 0.8rem;"></i> Active (${activeIssues})
            </button>
            <button style="background: transparent; color: #6b7280; border: none; border-bottom: 2px solid transparent; padding: 16px 20px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-check-circle" style="font-size: 0.8rem;"></i> Resolved (${resolvedIssues})
            </button>
          </div>

          <!-- Table Header -->
          <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 1fr; padding: 16px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 0.8rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              Assignment <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Status <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Issue Type <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              Date <i class="fas fa-sort" style="font-size: 0.7rem;"></i>
            </div>
            <div>Priority</div>
            <div>Actions</div>
          </div>

          <!-- Content: Empty State or Issues List -->
          ${issues.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center;">
              <div style="width: 120px; height: 120px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; position: relative;">
                <div style="position: absolute; inset: 10px; background: rgba(255, 255, 255, 0.5); border-radius: 50%;"></div>
                <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981; position: relative; z-index: 1;"></i>
              </div>
              <h3 style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">All Clear! 🎉</h3>
              <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 0.95rem; max-width: 420px;">You don't have any active issues. Everything looks great!</p>
              <button onclick="window.openNewIssueModal()" style="background: white; color: #6b7280; border: 1px solid #e5e7eb; padding: 10px 24px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-plus" style="font-size: 0.75rem;"></i> Report New Issue
              </button>
            </div>
          ` : `
            <div>
              ${issues.map(t => `
                <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 1fr; padding: 16px 24px; border-bottom: 1px solid #f3f4f6; align-items: center; font-size: 0.9rem;">
                  <div>
                    <strong style="color: #111827; display: block; font-size: 0.95rem;">${escapeHtml(t.subject)}</strong>
                    <span style="color: #6b7280; font-size: 0.8rem;">#${escapeHtml(t.id)}${t.project_id ? ` &bull; ${escapeHtml(t.project_id)}` : ''}</span>
                  </div>
                  <div>
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; ${t.status === 'Resolved' ? 'background: #d1fae5; color: #065f46;' : (t.status === 'In Progress' ? 'background: #dbeafe; color: #1e40af;' : 'background: #fef3c7; color: #92400e;')}">
                      ${escapeHtml(t.status)}
                    </span>
                  </div>
                  <div style="color: #4b5563; font-size: 0.85rem;">
                    ${escapeHtml(t.category || 'General')}
                  </div>
                  <div style="color: #6b7280; font-size: 0.85rem;">
                    ${new Date(t.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div>
                    <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #4b5563;">
                      ${escapeHtml(t.priority || 'Medium')}
                    </span>
                  </div>
                  <div>
                    <button onclick="window.openNewIssueModal()" style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; color: #2563eb; cursor: pointer;">
                      Report
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;
    window.renderSupportCenterView = renderSupportCenterView;
  }

  // Global function for creating new issue - Matches Reference Images 100%
  window.openNewIssueModal = async () => {
    // Remove existing modal if already open
    const existing = document.getElementById('issue-report-modal-backdrop');
    if (existing) existing.remove();

    // Create Modal Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'issue-report-modal-backdrop';
    backdrop.className = 'issue-modal-backdrop';

    // Populate assignments dropdown if available
    let projects = AppState.projectsCache || [];
    if (!projects || projects.length === 0) {
      try {
        const projRes = await apiFetch('/projects');
        if (projRes && projRes.success && Array.isArray(projRes.projects)) {
          projects = projRes.projects;
          AppState.projectsCache = projects;
        }
      } catch (err) {
        console.warn('Projects not loaded for issue modal', err);
      }
    }

    const assignmentOptionsHtml = (projects || []).map(p =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title || p.id)} (${escapeHtml(p.id)})</option>`
    ).join('');

    backdrop.innerHTML = `
      <div class="issue-modal-card" id="issue-modal-card" role="dialog" aria-modal="true" aria-labelledby="issue-modal-title">
        <!-- Header -->
        <div class="issue-modal-header">
          <div>
            <h2 class="issue-modal-title" id="issue-modal-title">Report New Issue</h2>
            <p class="issue-modal-subtitle">Describe your concern and we'll help resolve it quickly</p>
          </div>
          <button type="button" class="issue-modal-close-btn" id="close-issue-modal-btn" aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form id="issue-report-form" novalidate autocomplete="off">
          <!-- Issue Type -->
          <div class="issue-form-group">
            <label class="issue-field-label" for="issue-type-select">
              Issue Type <span class="issue-required">*</span>
            </label>
            <div class="issue-select-wrapper">
              <select id="issue-type-select" name="issue_type" required class="issue-custom-select is-placeholder">
                <option value="" disabled selected hidden>Select issue type</option>
                <option value="Assignment Quality">Assignment Quality</option>
                <option value="Deadline Concern">Deadline Concern</option>
                <option value="Payment Issue">Payment Issue</option>
                <option value="Technical Problem">Technical Problem</option>
                <option value="Revision Request">Revision Request</option>
                <option value="Communication Issue">Communication Issue</option>
                <option value="Other">Other</option>
              </select>
              <div class="issue-select-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <div class="issue-field-error-msg" id="issue-type-error">Please select an issue type.</div>
          </div>

          <!-- Related Assignment -->
          <div class="issue-form-group">
            <label class="issue-field-label" for="issue-assignment-select">
              Related Assignment <span class="issue-optional">(Optional)</span>
            </label>
            <div class="issue-select-wrapper">
              <select id="issue-assignment-select" name="related_assignment" class="issue-custom-select">
                <option value="">No specific assignment</option>
                ${assignmentOptionsHtml}
              </select>
              <div class="issue-select-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>

          <!-- Issue Title -->
          <div class="issue-form-group">
            <label class="issue-field-label" for="issue-title-input">
              Issue Title <span class="issue-required">*</span>
            </label>
            <input 
              type="text" 
              id="issue-title-input" 
              name="issue_title" 
              class="issue-custom-input" 
              placeholder="Brief description of the issue" 
              required 
              maxlength="200"
            >
            <div class="issue-field-error-msg" id="issue-title-error">Please provide a brief description of the issue.</div>
          </div>

          <!-- Detailed Description -->
          <div class="issue-form-group">
            <label class="issue-field-label" for="issue-description-input">
              Detailed Description <span class="issue-required">*</span>
            </label>
            <textarea 
              id="issue-description-input" 
              name="detailed_description" 
              class="issue-custom-textarea" 
              placeholder="Provide detailed information about the issue..." 
              rows="5" 
              maxlength="2000" 
              required
            ></textarea>
            <div class="issue-char-count" id="issue-char-counter">0/2000 characters</div>
            <div class="issue-field-error-msg" id="issue-desc-error">Please provide detailed information about the issue.</div>
          </div>

          <!-- Attachments -->
          <div class="issue-form-group" style="margin-bottom: 0;">
            <label class="issue-field-label">
              Attachments <span class="issue-optional">(Optional)</span>
            </label>
            <button type="button" class="issue-add-files-btn" id="issue-add-files-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <span>Add Files</span>
            </button>
            <input 
              type="file" 
              id="issue-hidden-file-input" 
              multiple 
              style="display: none;" 
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx"
            >
            <p class="issue-file-info">Max 50MB per file • Supports: Images, PDF, Word documents</p>
            <div class="issue-attached-files-list" id="issue-attached-files-list"></div>
          </div>

          <!-- Footer with Submit Button -->
          <div class="issue-modal-footer">
            <button type="submit" class="issue-modal-submit-btn" id="issue-modal-submit-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <span>Submit Issue</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Modal elements
    const cardEl = backdrop.querySelector('.issue-modal-card');
    const closeBtn = document.getElementById('close-issue-modal-btn');
    const form = document.getElementById('issue-report-form');
    const typeSelect = document.getElementById('issue-type-select');
    const assignmentSelect = document.getElementById('issue-assignment-select');
    const titleInput = document.getElementById('issue-title-input');
    const descTextarea = document.getElementById('issue-description-input');
    const charCounter = document.getElementById('issue-char-counter');
    const addFilesBtn = document.getElementById('issue-add-files-btn');
    const fileInput = document.getElementById('issue-hidden-file-input');
    const filesList = document.getElementById('issue-attached-files-list');
    const submitBtn = document.getElementById('issue-modal-submit-btn');

    let attachedFiles = [];

    // Close logic
    function closeModal() {
      backdrop.style.opacity = '0';
      if (cardEl) {
        cardEl.style.transform = 'scale(0.96) translateY(8px)';
        cardEl.style.opacity = '0';
        cardEl.style.transition = 'all 0.15s ease';
      }
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.remove();
        document.removeEventListener('keydown', handleEscKey);
      }, 150);
    }
    window.closeIssueModal = closeModal;

    function handleEscKey(e) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', handleEscKey);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    closeBtn.addEventListener('click', closeModal);

    // Dynamic Select styling
    typeSelect.addEventListener('change', () => {
      if (typeSelect.value) {
        typeSelect.classList.remove('is-placeholder');
      } else {
        typeSelect.classList.add('is-placeholder');
      }
      clearError('issue-type');
    });

    // Character counter
    descTextarea.addEventListener('input', () => {
      charCounter.textContent = `${descTextarea.value.length}/2000 characters`;
      clearError('issue-desc');
    });

    titleInput.addEventListener('input', () => {
      clearError('issue-title');
    });

    function clearError(fieldPrefix) {
      const err = document.getElementById(`${fieldPrefix}-error`);
      if (err) err.classList.remove('visible');
      const input = document.getElementById(`${fieldPrefix}-input`) || document.getElementById(`${fieldPrefix}-select`);
      if (input) input.classList.remove('issue-input-error');
    }

    function showError(fieldPrefix, msg) {
      const err = document.getElementById(`${fieldPrefix}-error`);
      if (err) {
        if (msg) err.textContent = msg;
        err.classList.add('visible');
      }
      const input = document.getElementById(`${fieldPrefix}-input`) || document.getElementById(`${fieldPrefix}-select`);
      if (input) {
        input.classList.add('issue-input-error');
        input.focus();
      }
    }

    // File attachments handling
    addFilesBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      const maxSizeBytes = 50 * 1024 * 1024; // 50MB
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx'];

      for (const file of files) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) {
          alert(`File "${file.name}" has an unsupported format.\nSupported: Images, PDF, Word documents`);
          continue;
        }
        if (file.size > maxSizeBytes) {
          alert(`File "${file.name}" exceeds the 50MB maximum size limit.`);
          continue;
        }
        if (!attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
          attachedFiles.push(file);
        }
      }

      renderFilesList();
      fileInput.value = '';
    });

    function renderFilesList() {
      if (attachedFiles.length === 0) {
        filesList.innerHTML = '';
        return;
      }

      filesList.innerHTML = attachedFiles.map((f, i) => `
        <div class="issue-file-item">
          <div class="issue-file-item-left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="issue-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
            <span class="issue-file-size">(${formatFileSize(f.size)})</span>
          </div>
          <button type="button" class="issue-file-remove-btn" data-index="${i}" title="Remove file">&times;</button>
        </div>
      `).join('');

      filesList.querySelectorAll('.issue-file-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          attachedFiles.splice(idx, 1);
          renderFilesList();
        });
      });
    }

    function formatFileSize(bytes) {
      if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }
      return (bytes / 1024).toFixed(1) + ' KB';
    }

    // Submit Issue Handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      let valid = true;
      const type = typeSelect.value.trim();
      const title = titleInput.value.trim();
      const desc = descTextarea.value.trim();
      const related = assignmentSelect.value.trim();

      if (!type) {
        showError('issue-type', 'Please select an issue type.');
        valid = false;
      }
      if (!title) {
        showError('issue-title', 'Please provide a brief title for the issue.');
        if (valid) valid = false;
      }
      if (!desc) {
        showError('issue-desc', 'Please provide detailed information about the issue.');
        if (valid) valid = false;
      }

      if (!valid) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="fa-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        <span>Submitting...</span>
      `;

      const formData = new FormData();
      formData.append('subject', title);
      formData.append('category', type);
      formData.append('initial_message', desc);
      if (related) {
        formData.append('related_assignment', related);
      }

      attachedFiles.forEach(file => {
        formData.append('files', file);
      });

      try {
        const res = await apiFetch('/support/tickets', 'POST', formData, true);
        if (res && res.success) {
          closeModal();
          alert('Issue reported successfully! Our support team will assist you shortly.');
          renderSupportCenterView();
        } else {
          alert(res.message || 'Failed to submit issue. Please check the information and try again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>Submit Issue</span>
          `;
        }
      } catch (err) {
        console.error('Error submitting issue:', err);
        alert('An unexpected error occurred while submitting your issue.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>Submit Issue</span>
        `;
      }
    });
  };

  window.closeIssueModal = () => {
    const backdrop = document.getElementById('issue-report-modal-backdrop');
    if (backdrop) backdrop.remove();
  };

  // ==========================================
  // 11. REFERRAL VIEW
  // ==========================================
  function renderReferralView() {
    if (pageTitleEl) pageTitleEl.textContent = 'Refer & Earn';

    const referralCode = 'REF-3C3FM';
    const walletBalance = 0;
    const totalInvites = 0;
    const signedUp = 0;
    const completed = 0;
    const totalEarned = 0;

    let html = `
      <div style="max-width: 1400px; margin: 0 auto;">
        <!-- Page Header -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <i class="fas fa-gift" style="color: #2563eb; font-size: 1.4rem;"></i>
            <h1 style="font-size: 1.75rem; font-weight: 700; color: #1a1a1a; margin: 0;">Refer & Earn ₹200</h1>
          </div>
          <p style="color: #6b7280; margin: 0; font-size: 0.95rem;">Invite friends and earn cashback when they complete their first assignment</p>
        </div>

        <!-- Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px;">
          <button style="background: white; color: #1a1a1a; border: 1px solid #e5e7eb; padding: 10px 20px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-gift" style="font-size: 0.85rem;"></i> Refer & Earn
          </button>
          <button style="background: transparent; color: #6b7280; border: 1px solid transparent; padding: 10px 20px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-clock" style="font-size: 0.85rem;"></i> Withdrawals
          </button>
        </div>

        <!-- Referral Code Card -->
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); border-radius: 12px; padding: 28px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <i class="fas fa-qrcode" style="color: #2563eb; font-size: 1rem;"></i>
            <h3 style="font-size: 1rem; font-weight: 700; color: #1e3a8a; margin: 0;">Your Referral Code</h3>
          </div>
          
          <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 2rem; font-weight: 800; color: #1a1a1a; letter-spacing: 2px; font-family: 'Courier New', monospace;">${referralCode}</div>
              <div style="display: flex; gap: 8px;">
                <button onclick="window.copyReferralCode('${referralCode}')" style="background: #f3f4f6; color: #374151; border: none; padding: 10px 20px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <i class="fas fa-copy" style="font-size: 0.8rem;"></i> Edit
                </button>
                <button onclick="window.shareReferralCode('${referralCode}')" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                  <i class="fas fa-share-alt" style="font-size: 0.8rem;"></i> Share
                </button>
              </div>
            </div>
          </div>

          <p style="color: #3b82f6; margin: 0; font-size: 0.9rem;">Share this code with friends. They get help with their assignments and you earn ₹200 when they complete their first order!</p>
        </div>

        <!-- Wallet Balance Card -->
        <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <i class="fas fa-wallet" style="color: #10b981; font-size: 0.9rem;"></i>
              <div style="color: #6b7280; font-size: 0.8rem; font-weight: 600;">Wallet Balance</div>
            </div>
            <div style="font-size: 2.5rem; font-weight: 800; color: #1a1a1a;">₹${walletBalance}</div>
            <div style="color: #6b7280; font-size: 0.85rem; margin-top: 4px;">Total cashback earned</div>
          </div>
          <div style="text-align: right;">
            <button style="background: white; color: #6b7280; border: 1px solid #e5e7eb; padding: 10px 24px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; margin-bottom: 8px; display: block; width: 100%;">
              View History
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
          <!-- Total Invites -->
          <div style="background: #eff6ff; border-radius: 12px; padding: 20px; border: 1px solid #dbeafe;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-users" style="color: #2563eb; font-size: 0.9rem;"></i>
              <div style="color: #1e40af; font-size: 0.75rem; font-weight: 600;">Total Invites</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #1e3a8a; margin-bottom: 4px;">${totalInvites}</div>
          </div>

          <!-- Signed Up -->
          <div style="background: #fef3c7; border-radius: 12px; padding: 20px; border: 1px solid #fde68a;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-user-plus" style="color: #f59e0b; font-size: 0.9rem;"></i>
              <div style="color: #b45309; font-size: 0.75rem; font-weight: 600;">Signed Up</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #92400e; margin-bottom: 4px;">${signedUp}</div>
          </div>

          <!-- Completed -->
          <div style="background: #d1fae5; border-radius: 12px; padding: 20px; border: 1px solid #a7f3d0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-check-circle" style="color: #10b981; font-size: 0.9rem;"></i>
              <div style="color: #065f46; font-size: 0.75rem; font-weight: 600;">Completed</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #047857; margin-bottom: 4px;">${completed}</div>
          </div>

          <!-- Total Earned -->
          <div style="background: #f3e8ff; border-radius: 12px; padding: 20px; border: 1px solid #e9d5ff;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <i class="fas fa-rupee-sign" style="color: #8b5cf6; font-size: 0.9rem;"></i>
              <div style="color: #7e22ce; font-size: 0.75rem; font-weight: 600;">Total Earned</div>
            </div>
            <div style="font-size: 2rem; font-weight: 700; color: #6b21a8; margin-bottom: 4px;">₹${totalEarned}</div>
          </div>
        </div>

        <!-- Referral History -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
          <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 0;">Referral History</h3>
            <button onclick="window.openSendInviteModal()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
              <i class="fas fa-paper-plane" style="font-size: 0.8rem;"></i> Send Invite
            </button>
          </div>

          <!-- Empty State -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center;">
            <div style="width: 80px; height: 80px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
              <i class="fas fa-user-friends" style="font-size: 36px; color: #2563eb;"></i>
            </div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">No referrals yet</h3>
            <p style="color: #2563eb; margin: 0 0 24px 0; font-size: 0.95rem; max-width: 420px;">Start inviting friends to earn ₹200 for each successful referral!</p>
            <button onclick="window.openSendInviteModal()" style="background: #2563eb; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
              <i class="fas fa-paper-plane" style="font-size: 0.85rem;"></i> Send Your First Invite
            </button>
          </div>
        </div>
      </div>
    `;

    mainContentEl.innerHTML = html;

    // Global functions
    window.copyReferralCode = (code) => {
      navigator.clipboard.writeText(code).then(() => {
        alert('Referral code copied to clipboard: ' + code);
      });
    };

    window.shareReferralCode = (code) => {
      const text = `Hey! Use my referral code ${code} on AssignmentWaala and get help with your assignments. You'll get great support and I'll earn ₹200!`;
      if (navigator.share) {
        navigator.share({
          title: 'AssignmentWaala Referral',
          text: text
        });
      } else {
        prompt('Share this message:', text);
      }
    };

    // Send Invite Modal
    window.openSendInviteModal = () => {
      // Create modal overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'invite-modal-overlay';
      modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;';

      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.style.cssText = 'background: white; border-radius: 12px; width: 100%; max-width: 560px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); padding: 32px;';

      modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-paper-plane" style="color: #2563eb; font-size: 24px;"></i>
            <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0;">Send Referral Invite</h2>
          </div>
          <button onclick="window.closeSendInviteModal()" style="background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 28px; line-height: 1; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-top: -4px;">
            ×
          </button>
        </div>

        <p style="font-size: 15px; color: #6b7280; margin: 0 0 28px 0;">Enter your friend's email to send them an invitation to join Assignment Waala.</p>

        <form id="invite-form" onsubmit="return false;">
          <!-- Email Address -->
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 15px; font-weight: 600; color: #1f2937; margin-bottom: 10px;">
              Email Address
            </label>
            <input 
              type="email" 
              id="invite-email" 
              required 
              placeholder="friend@example.com" 
              style="width: 100%; padding: 14px 16px; border: 2px solid #60a5fa; border-radius: 10px; font-size: 15px; color: #1f2937; background: white; outline: none;">
          </div>

          <!-- Info Box -->
          <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 28px; display: flex; gap: 12px;">
            <i class="fas fa-info-circle" style="color: #3b82f6; font-size: 20px; flex-shrink: 0; margin-top: 2px;"></i>
            <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.6;">
              They'll receive an email with your referral link. You earn <strong style="color: #2563eb;">₹200</strong> when they complete their first assignment!
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" onclick="window.closeSendInviteModal()" style="background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 24px; font-size: 15px; font-weight: 600; color: #6b7280; cursor: pointer;">
              Cancel
            </button>
            <button type="submit" id="send-invite-btn" style="background: #5b8def; color: white; border: none; border-radius: 8px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(91, 141, 239, 0.35);">
              <i class="fas fa-paper-plane" style="font-size: 14px;"></i> Send Invite
            </button>
          </div>
        </form>
      `;

      modalOverlay.appendChild(modalContent);
      document.body.appendChild(modalOverlay);

      // Form submission
      document.getElementById('invite-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('invite-email').value;
        if (!email) {
          alert('Please enter an email address.');
          return;
        }

        const submitBtn = document.getElementById('send-invite-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
          // Simulate API call - replace with actual endpoint
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          alert(`Referral invite sent successfully to ${email}!`);
          window.closeSendInviteModal();
          renderReferralView();
        } catch (error) {
          alert('Error sending invite. Please try again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invite';
        }
      });

      // Close on overlay click
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          window.closeSendInviteModal();
        }
      });
    };

    // Close invite modal
    window.closeSendInviteModal = () => {
      const modal = document.getElementById('invite-modal-overlay');
      if (modal) {
        modal.remove();
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

// ==========================================
// THEME TOGGLE FUNCTIONALITY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sidebarToggle = document.getElementById('mobile-sidebar-toggle');
  const dashboardSidebar = document.getElementById('dashboard-sidebar');
  const dashboardMain = document.querySelector('.dashboard-main');
  
  // Theme toggle (for future dark mode implementation)
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      // Placeholder for theme toggle functionality
      const icon = themeToggleBtn.querySelector('i');
      if (icon.classList.contains('fa-sun')) {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
      } else {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      }
    });
  }

  // Sidebar toggle functionality
  if (sidebarToggle && dashboardSidebar) {
    sidebarToggle.addEventListener('click', () => {
      dashboardSidebar.classList.toggle('sidebar-collapsed');
      
      // Adjust main content margin
      if (dashboardMain) {
        if (dashboardSidebar.classList.contains('sidebar-collapsed')) {
          dashboardMain.style.marginLeft = '80px';
        } else {
          dashboardMain.style.marginLeft = 'var(--sidebar-width)';
        }
      }
      
      // Keep the slider icon - no icon change needed
      // The slider icon represents settings/control, so it stays the same
    });
  }
});
