// Authentication JavaScript
// Handles user authentication state, dropdown menu, and session management

const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';

// Auth state
let currentUser = null;
let authToken = null;

/**
 * Initialize authentication system
 */
function initAuth() {
  // Load token from localStorage
  authToken = localStorage.getItem('authToken');
  
  // Check auth state on page load
  checkAuthState().then(isLoggedIn => {
    if (isLoggedIn) {
      updateAuthUI();
    }
  });
  
  // Setup user icon dropdown
  setupUserDropdown();
}

/**
 * Check if user is logged in
 * @returns {Promise<boolean>}
 */
async function checkAuthState() {
  if (!authToken) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      // Token invalid, clear it
      localStorage.removeItem('authToken');
      authToken = null;
      return false;
    }
    
    const data = await response.json();
    if (data.success && data.user) {
      currentUser = data.user;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking auth state:', error);
    return false;
  }
}

/**
 * Update authentication UI based on login state
 */
function updateAuthUI() {
  const userIconBtn = document.getElementById('userIconBtn');
  const userDropdown = document.getElementById('userDropdown');
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  const loggedInMenu = document.getElementById('loggedInMenu');
  const userDropdownHeader = document.getElementById('userDropdownHeader');
  
  if (!userIconBtn || !userDropdown) return;
  
  if (currentUser) {
    // User is logged in
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
    if (loggedInMenu) loggedInMenu.style.display = 'block';
    if (userDropdownHeader) {
      userDropdownHeader.textContent = currentUser.displayName || currentUser.characterName || currentUser.email;
    }
    
    // Update user icon appearance
    userIconBtn.classList.add('active');
  } else {
    // User is not logged in
    if (loginLink) loginLink.style.display = 'block';
    if (registerLink) registerLink.style.display = 'block';
    if (loggedInMenu) loggedInMenu.style.display = 'none';
    if (userDropdownHeader) {
      userDropdownHeader.textContent = 'Account';
    }
    
    userIconBtn.classList.remove('active');
  }
}

/**
 * Setup user icon dropdown menu
 */
function setupUserDropdown() {
  const userIconBtn = document.getElementById('userIconBtn');
  const userDropdown = document.getElementById('userDropdown');
  const logoutLink = document.getElementById('logoutLink');
  
  if (!userIconBtn || !userDropdown) return;
  
  // Toggle dropdown on icon click
  userIconBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    userDropdown.classList.toggle('active');
    userIconBtn.classList.toggle('active');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!userIconBtn.contains(e.target) && !userDropdown.contains(e.target)) {
      userDropdown.classList.remove('active');
      userIconBtn.classList.remove('active');
    }
  });
  
  // Handle logout
  if (logoutLink) {
    logoutLink.addEventListener('click', async function(e) {
      e.preventDefault();
      await logout();
    });
  }
  
  // Handle Help link
  const helpLink = document.getElementById('helpLink');
  if (helpLink) {
    helpLink.addEventListener('click', function(e) {
      e.preventDefault();
      // Redirect to contact page or show help modal
      window.location.href = 'contact.html';
    });
  }
  
  // Handle Reset Password link
  const resetPasswordLink = document.getElementById('resetPasswordLink');
  if (resetPasswordLink) {
    resetPasswordLink.addEventListener('click', function(e) {
      e.preventDefault();
      // Redirect to reset password page or show reset password modal
      // For now, redirect to contact page with a note, or create a reset password page
      const resetUrl = 'contact.html?subject=Password Reset Request';
      window.location.href = resetUrl;
    });
  }
  
  // Prevent dropdown from closing when clicking inside it
  userDropdown.addEventListener('click', function(e) {
    e.stopPropagation();
  });
}

/**
 * Logout user
 */
async function logout() {
  try {
    if (authToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local state
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberMe');
    authToken = null;
    currentUser = null;
    
    // Update UI
    updateAuthUI();
    
    // Redirect to home page
    if (window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('register.html')) {
      // Already on auth page, just update UI
      return;
    }
    
    window.location.href = 'index.html';
  }
}

/**
 * Get current user
 * @returns {Object|null}
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Get auth token
 * @returns {string|null}
 */
function getAuthToken() {
  return authToken || localStorage.getItem('authToken');
}

/**
 * Set auth token
 * @param {string} token
 */
function setAuthToken(token) {
  authToken = token;
  localStorage.setItem('authToken', token);
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
  return !!currentUser && !!authToken;
}

// Expose functions to window for use in other scripts
window.checkAuthState = checkAuthState;
window.updateAuthState = updateAuthUI;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.isAuthenticated = isAuthenticated;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// Also initialize on window load as fallback
window.addEventListener('load', function() {
  if (!currentUser && authToken) {
    checkAuthState().then(isLoggedIn => {
      if (isLoggedIn) {
        updateAuthUI();
      }
    });
  }
});

