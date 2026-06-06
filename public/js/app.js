/**
 * Shivam Link Protector - URL Shortener Frontend Application
 */

// API Base URL
const API_BASE = '/api';

// DOM Elements
const elements = {
  // Navigation
  navLinks: document.querySelectorAll('.nav-link'),
  sections: document.querySelectorAll('.section'),
  
  // Shortener Form
  shortenForm: document.getElementById('shorten-form'),
  urlInput: document.getElementById('url-input'),
  shortenBtn: document.querySelector('.shorten-btn'),
  
  // Advanced Options
  advancedToggle: document.getElementById('advanced-toggle'),
  advancedOptions: document.getElementById('advanced-options'),
  customAlias: document.getElementById('custom-alias'),
  expiration: document.getElementById('expiration'),
  
  // Result Section
  resultSection: document.getElementById('result-section'),
  resultUrl: document.getElementById('result-url'),
  copyBtn: document.getElementById('copy-btn'),
  statsLink: document.getElementById('stats-link'),
  
  // Dashboard
  searchInput: document.getElementById('search-input'),
  refreshBtn: document.getElementById('refresh-btn'),
  urlsTbody: document.getElementById('urls-tbody'),
  pagination: document.getElementById('pagination'),
  emptyState: document.getElementById('empty-state'),
  loadingState: document.getElementById('loading-state'),
  
  // Modal
  statsModal: document.getElementById('stats-modal'),
  modalClose: document.getElementById('modal-close'),
  modalBody: document.getElementById('modal-body'),
  
  // Toast
  toast: document.getElementById('toast'),
  
  // Auth elements
  userInfo: document.getElementById('user-info'),
  userEmail: document.getElementById('user-email'),
  logoutBtn: document.getElementById('logout-btn'),
  loginLink: document.getElementById('login-link')
};

// State
let currentPage = 1;
let totalPages = 1;
let currentUser = null;

// ========================================
// Authentication
// ========================================

async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success && data.data.user) {
      currentUser = data.data.user;
      updateAuthUI();
      return true;
    } else {
      // Redirect to login if not authenticated
      window.location.href = 'login.html';
      return false;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'login.html';
    return false;
  }
}

function updateAuthUI() {
  if (currentUser) {
    // Update user info display
    if (elements.userInfo) {
      elements.userInfo.style.display = 'flex';
    }
    if (elements.userEmail) {
      elements.userEmail.textContent = currentUser.email;
    }
    if (elements.loginLink) {
      elements.loginLink.style.display = 'none';
    }
  } else {
    if (elements.userInfo) {
      elements.userInfo.style.display = 'none';
    }
    if (elements.loginLink) {
      elements.loginLink.style.display = 'block';
    }
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    showToast('Logged out successfully');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
  } catch (error) {
    console.error('Logout failed:', error);
    showToast('Failed to logout', 'error');
  }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const toast = elements.toast;
  const icon = toast.querySelector('.toast-icon');
  const msg = toast.querySelector('.toast-message');
  
  icon.textContent = type === 'success' ? '✓' : '✕';
  msg.textContent = message;
  
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Truncate URL for display
 */
function truncateUrl(url, maxLength = 50) {
  if (!url) return '';
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

/**
 * Get short URL display
 */
function getShortUrl(code) {
  return `${window.location.origin}/${code}`;
}

// ========================================
// Navigation
// ========================================

function initNavigation() {
  elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      switchTab(tab);
    });
  });
  
  // Handle data-tab links
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = el.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  // Update nav links
  elements.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tab);
  });
  
  // Update sections
  elements.sections.forEach(section => {
    section.classList.toggle('active', section.id === `${tab}-section`);
  });
  
  // Load dashboard data if switching to dashboard
  if (tab === 'dashboard') {
    loadUrls();
  }
}

// ========================================
// URL Shortening
// ========================================

function initShortener() {
  // Form submission
  elements.shortenForm.addEventListener('submit', handleShorten);
  
  // Advanced options toggle
  if (elements.advancedToggle) {
    elements.advancedToggle.addEventListener('click', () => {
      elements.advancedToggle.classList.toggle('active');
      elements.advancedOptions.classList.toggle('show');
    });
  }
  
  // Copy button
  elements.copyBtn.addEventListener('click', handleCopy);
}

async function handleShorten(e) {
  e.preventDefault();
  
  const url = elements.urlInput.value.trim();
  const customAlias = elements.customAlias.value.trim();
  const expiresIn = elements.expiration.value;
  
  if (!url) {
    showToast('Please enter a URL', 'error');
    return;
  }
  
  // Show loading state
  elements.shortenBtn.classList.add('loading');
  elements.shortenBtn.disabled = true;
  
  try {
    const response = await fetch(`${API_BASE}/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        url,
        customAlias: customAlias || undefined,
        expiresIn: expiresIn || undefined
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Show result
      elements.resultUrl.value = data.data.shortUrl;
      elements.resultSection.classList.add('show');
      
      // Update stats link
      elements.statsLink.href = `${API_BASE}/stats/${data.data.shortCode}`;
      
      showToast('URL shortened successfully!');
      
      // Clear form
      elements.urlInput.value = '';
      elements.customAlias.value = '';
      elements.expiration.value = '';
    } else {
      if (data.error === 'Please login to continue') {
        showToast('Please login to continue', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } else {
        showToast(data.error || 'Failed to shorten URL', 'error');
      }
    }
  } catch (error) {
    console.error('Error shortening URL:', error);
    showToast('Failed to connect to server', 'error');
  } finally {
    elements.shortenBtn.classList.remove('loading');
    elements.shortenBtn.disabled = false;
  }
}

async function handleCopy() {
  const url = elements.resultUrl.value;
  
  try {
    await navigator.clipboard.writeText(url);
    
    // Update button state
    const copyText = elements.copyBtn.querySelector('.copy-text');
    const copyIcon = elements.copyBtn.querySelector('.copy-icon');
    
    copyIcon.textContent = '✓';
    copyText.textContent = 'Copied!';
    elements.copyBtn.classList.add('copied');
    
    setTimeout(() => {
      copyIcon.textContent = '📋';
      copyText.textContent = 'Copy';
      elements.copyBtn.classList.remove('copied');
    }, 2000);
    
    showToast('URL copied to clipboard!');
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Failed to copy URL', 'error');
  }
}

// ========================================
// Dashboard
// ========================================

function initDashboard() {
  // Search functionality
  let searchTimeout;
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadUrls();
      }, 300);
    });
  }
  
  // Refresh button
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
      loadUrls();
    });
  }
}

async function loadUrls() {
  // Show loading state
  elements.loadingState.classList.add('show');
  elements.emptyState.classList.remove('show');
  elements.urlsTbody.innerHTML = '';
  
  try {
    const response = await fetch(`${API_BASE}/urls?page=${currentPage}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success) {
      totalPages = data.pagination.pages;
      
      if (data.data.length === 0) {
        elements.emptyState.classList.add('show');
        elements.loadingState.classList.remove('show');
        return;
      }
      
      // Render URLs
      renderUrls(data.data);
      
      // Render pagination
      renderPagination(data.pagination);
      
      elements.loadingState.classList.remove('show');
    } else {
      if (data.error === 'Please login to continue') {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } else {
        showToast(data.error || 'Failed to load URLs', 'error');
      }
      elements.loadingState.classList.remove('show');
    }
  } catch (error) {
    console.error('Error loading URLs:', error);
    showToast('Failed to load URLs', 'error');
    elements.loadingState.classList.remove('show');
  }
}

function renderUrls(urls) {
  elements.urlsTbody.innerHTML = urls.map(url => `
    <tr>
      <td>
        <a href="/${url.shortCode}" class="short-url" target="_blank">
          ${getShortUrl(url.shortCode)}
        </a>
      </td>
      <td class="url-cell" title="${url.originalUrl}">
        ${truncateUrl(url.originalUrl)}
      </td>
      <td>
        <span class="clicks-badge">
          🖱️ ${url.clicks}
        </span>
      </td>
      <td>${formatDate(url.createdAt)}</td>
      <td>${url.expiresAt ? formatDate(url.expiresAt) : 'Never'}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" onclick="copyShortUrl('${url.shortCode}')" title="Copy URL">
            📋
          </button>
          <button class="action-btn" onclick="showStats('${url.shortCode}')" title="View Stats">
            📊
          </button>
          <button class="action-btn delete" onclick="deleteUrl('${url._id}')" title="Delete">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination(pagination) {
  if (pagination.pages <= 1) {
    elements.pagination.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // Previous button
  html += `<button class="page-btn" ${pagination.page === 1 ? 'disabled' : ''} onclick="goToPage(${pagination.page - 1})">
    ← Prev
  </button>`;
  
  // Page numbers
  for (let i = 1; i <= pagination.pages; i++) {
    if (i === 1 || i === pagination.pages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">
        ${i}
      </button>`;
    } else if (i === pagination.page - 2 || i === pagination.page + 2) {
      html += `<span class="page-btn">...</span>`;
    }
  }
  
  // Next button
  html += `<button class="page-btn" ${pagination.page === pagination.pages ? 'disabled' : ''} onclick="goToPage(${pagination.page + 1})">
    Next →
  </button>`;
  
  elements.pagination.innerHTML = html;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadUrls();
}

async function copyShortUrl(code) {
  const url = getShortUrl(code);
  try {
    await navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy URL', 'error');
  }
}

async function showStats(code) {
  try {
    const response = await fetch(`${API_BASE}/stats/${code}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.success) {
      const stats = data.data;
      
      elements.modalBody.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.clicks}</div>
            <div class="stat-label">Total Clicks</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.shortCode}</div>
            <div class="stat-label">Short Code</div>
          </div>
        </div>
        
        <div class="stats-url">
          <div class="stats-url-label">Original URL</div>
          <div class="stats-url-value">${stats.originalUrl}</div>
        </div>
        
        <div class="stats-url">
          <div class="stats-url-label">Created</div>
          <div class="stats-url-value">${formatDate(stats.createdAt)}</div>
        </div>
        
        ${stats.lastAccessedAt ? `
        <div class="stats-url">
          <div class="stats-url-label">Last Accessed</div>
          <div class="stats-url-value">${formatDate(stats.lastAccessedAt)}</div>
        </div>
        ` : ''}
        
        ${stats.expiresAt ? `
        <div class="stats-url">
          <div class="stats-url-label">Expires</div>
          <div class="stats-url-value">${formatDate(stats.expiresAt)}</div>
        </div>
        ` : ''}
      `;
      
      elements.statsModal.classList.add('show');
    } else {
      showToast(data.error || 'Failed to load stats', 'error');
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    showToast('Failed to load stats', 'error');
  }
}

async function deleteUrl(id) {
  if (!confirm('Are you sure you want to delete this URL?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/urls/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('URL deleted successfully');
      loadUrls();
    } else {
      if (data.error === 'Please login to continue') {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
      } else {
        showToast(data.error || 'Failed to delete URL', 'error');
      }
    }
  } catch (error) {
    console.error('Error deleting URL:', error);
    showToast('Failed to delete URL', 'error');
  }
}

// ========================================
// Modal
// ========================================

function initModal() {
  if (elements.modalClose) {
    elements.modalClose.addEventListener('click', () => {
      elements.statsModal.classList.remove('show');
    });
  }
  
  if (elements.statsModal) {
    elements.statsModal.addEventListener('click', (e) => {
      if (e.target === elements.statsModal) {
        elements.statsModal.classList.remove('show');
      }
    });
  }
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.statsModal) {
      elements.statsModal.classList.remove('show');
    }
  });
}

// ========================================
// Initialize Application
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication first
  const isAuthed = await checkAuth();
  
  if (isAuthed) {
    initNavigation();
    initShortener();
    initDashboard();
    initModal();
    
    // Focus URL input on load
    if (elements.urlInput) {
      elements.urlInput.focus();
    }
    
    // Setup logout button
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', logout);
    }
  }
});
