/* ==========================================================================
   ASSIGNMENT DAI - CREATE NEW ASSIGNMENT MODAL CLIENT CONTROLLER
   Binds to Submit Project triggers, character counters, file dropzone & API
   ========================================================================== */

window.AssignmentDaiCreateModal = (function () {
  'use strict';

  let selectedFiles = [];

  document.addEventListener('DOMContentLoaded', () => {
    initTriggerListeners();
    initModalEvents();
  });

  // Binds any Submit Project button across the webpage
  function initTriggerListeners() {
    // Desktop & Mobile "Submit Project" buttons
    const triggers = document.querySelectorAll(
      '.btn-blue-primary, .aw-btn-primary-action, a[href*="submit-project"], [data-open-create-assignment]'
    );

    triggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // If we are on index.html or contact.html, open modal directly!
        const currentPath = window.location.pathname;
        if (!currentPath.includes('dashboard.html')) {
          e.preventDefault();
          openCreateModal();
        }
      });
    });
  }

  function openCreateModal() {
    // Close mobile drawer if open
    const drawer = document.getElementById('awMobileDrawer');
    if (drawer && drawer.classList.contains('is-active')) {
      drawer.classList.remove('is-active');
      document.body.classList.remove('aw-drawer-open');
    }

    // Reset view to form state
    document.getElementById('createAssignFormView').style.display = 'block';
    document.getElementById('createAssignSuccessView').style.display = 'none';
    hideAlert();

    // Check auth status to show/hide guest contact fields
    checkAuthStatus();

    // Show modal
    $('#createAssignmentModal').modal('show');
  }

  function checkAuthStatus() {
    const token = localStorage.getItem('aw_token');
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('aw_user') || 'null');
    } catch (e) {
      user = null;
    }

    const authBanner = document.getElementById('assignAuthBanner');
    const guestFields = document.getElementById('assignGuestFields');

    if (token && user) {
      if (authBanner) {
        authBanner.style.display = 'flex';
        document.getElementById('assignAuthUserName').textContent = user.full_name || 'Client';
        document.getElementById('assignAuthUserEmail').textContent = user.email || '';
      }
      if (guestFields) {
        guestFields.style.display = 'none';
      }
    } else {
      if (authBanner) authBanner.style.display = 'none';
      if (guestFields) guestFields.style.display = 'block';
    }
  }

  function initModalEvents() {
    const modalEl = document.getElementById('createAssignmentModal');
    if (!modalEl) return;

    // Minimum date: today
    const dueDateInput = document.getElementById('assignDueDate');
    if (dueDateInput) {
      const today = new Date().toISOString().split('T')[0];
      dueDateInput.setAttribute('min', today);
    }

    // Title character counter (0/100)
    const titleInput = document.getElementById('assignTitle');
    const titleCounter = document.getElementById('assignTitleCounter');
    if (titleInput && titleCounter) {
      titleInput.addEventListener('input', () => {
        titleCounter.textContent = `${titleInput.value.length}/100`;
      });
    }

    // Description character counter (0/2000)
    const descInput = document.getElementById('assignDescription');
    const descCounter = document.getElementById('assignDescCounter');
    if (descInput && descCounter) {
      descInput.addEventListener('input', () => {
        descCounter.textContent = `${descInput.value.length}/2000`;
      });
    }

    // File Dropzone
    const dropzone = document.getElementById('assignDropzone');
    const fileInput = document.getElementById('assignFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer && e.dataTransfer.files) {
          addFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files) {
          addFiles(e.target.files);
        }
      });
    }

    // Reset Button
    const resetBtn = document.getElementById('btnAssignReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetForm);
    }

    // Form Submit
    const form = document.getElementById('createAssignmentForm');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  }

  function addFiles(filesList) {
    const newFiles = Array.from(filesList);
    // Combine and prevent duplicates by name & size
    newFiles.forEach(file => {
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        selectedFiles.push(file);
      }
    });
    renderFilesList();
  }

  function renderFilesList() {
    const listEl = document.getElementById('assignFilesList');
    if (!listEl) return;

    if (selectedFiles.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = selectedFiles.map((file, idx) => `
      <div class="assign-file-chip">
        <div class="assign-file-meta">
          <i class="fas fa-file-alt text-primary"></i>
          <span class="assign-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="assign-file-size">(${(file.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button type="button" class="assign-file-remove-btn" onclick="AssignmentDaiCreateModal.removeFile(${idx})" title="Remove file">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join('');
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFilesList();
  }

  function resetForm() {
    const form = document.getElementById('createAssignmentForm');
    if (form) form.reset();
    selectedFiles = [];
    renderFilesList();

    const titleCounter = document.getElementById('assignTitleCounter');
    if (titleCounter) titleCounter.textContent = '0/100';

    const descCounter = document.getElementById('assignDescCounter');
    if (descCounter) descCounter.textContent = '0/2000';

    hideAlert();
  }

  function showAlert(msg, isSuccess = false) {
    const box = document.getElementById('assignAlertBox');
    if (!box) return;
    box.className = `alert alert-${isSuccess ? 'success' : 'danger'} py-2 px-3 small mb-3`;
    box.innerHTML = `<i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-triangle'} mr-1"></i> ${escapeHtml(msg)}`;
    box.style.display = 'block';
  }

  function hideAlert() {
    const box = document.getElementById('assignAlertBox');
    if (box) box.style.display = 'none';
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

  // Submit Handler
  async function handleFormSubmit(e) {
    e.preventDefault();
    hideAlert();

    const title = document.getElementById('assignTitle').value.trim();
    const type = document.getElementById('assignType').value;
    const stream = document.getElementById('assignStream').value;
    const dueDate = document.getElementById('assignDueDate').value;
    const desc = document.getElementById('assignDescription').value.trim();

    // Validation
    if (!title) {
      showAlert('Please enter an assignment title.');
      return;
    }
    if (!type || type === 'Select type') {
      showAlert('Please select an assignment type.');
      return;
    }
    if (!stream || stream === 'Select stream') {
      showAlert('Please select an academic stream.');
      return;
    }
    if (!dueDate) {
      showAlert('Please specify the assignment due date.');
      return;
    }
    if (!desc) {
      showAlert('Please provide assignment requirements and guidelines.');
      return;
    }

    const token = localStorage.getItem('aw_token');
    const guestFields = document.getElementById('assignGuestFields');
    let guestName = '';
    let guestEmail = '';
    let guestPhone = '';

    if (!token && guestFields && guestFields.style.display !== 'none') {
      guestName = document.getElementById('assignGuestName').value.trim();
      guestEmail = document.getElementById('assignGuestEmail').value.trim();
      guestPhone = document.getElementById('assignGuestPhone').value.trim();

      if (!guestName || !guestEmail) {
        showAlert('Please provide your full name and email so we can deliver your completed project.');
        return;
      }
    }

    const submitBtn = document.getElementById('btnAssignSubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Submitting Assignment...';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('type', type);
    formData.append('project_type', type);
    formData.append('stream', stream);
    formData.append('category', stream);
    formData.append('subject', stream);
    formData.append('due_date', dueDate);
    formData.append('deadline', dueDate);
    formData.append('description', desc);

    if (guestName) formData.append('full_name', guestName);
    if (guestEmail) formData.append('email', guestEmail);
    if (guestPhone) formData.append('phone', guestPhone);

    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await res.json();

      if (data.success && data.project_id) {
        // If guest auto-registered and got token, store it
        if (data.token) {
          localStorage.setItem('aw_token', data.token);
          if (data.user) localStorage.setItem('aw_user', JSON.stringify(data.user));
          if (window.AssignmentDaiAuth && window.AssignmentDaiAuth.initAuthNavbar) {
            window.AssignmentDaiAuth.initAuthNavbar();
          }
        }

        // Show Success View in modal
        showSuccessView(data.project_id, title);
        resetForm();
      } else {
        showAlert(data.message || 'Failed to submit assignment. Please try again.');
      }
    } catch (err) {
      showAlert('Network communication error. Please check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Create Assignment';
    }
  }

  function showSuccessView(projectId, title) {
    document.getElementById('createAssignFormView').style.display = 'none';
    const successView = document.getElementById('createAssignSuccessView');
    successView.style.display = 'block';

    document.getElementById('successProjectIdBadge').textContent = projectId;
    document.getElementById('successProjectTitle').textContent = `"${title}"`;
  }

  return {
    openCreateModal,
    resetForm,
    removeFile
  };

})();
