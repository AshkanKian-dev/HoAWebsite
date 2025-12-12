// Authentication JavaScript
// Handles user authentication state, dropdown menu, and session management

const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';

// Auth state
let currentUser = null;
let authToken = null;

// Check if backend is available (for mock mode)
let USE_MOCK_AUTH = false;

/**
 * Check if backend server is available
 */
async function checkBackendAvailable() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000) // 1 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Mock authentication functions (for when backend is not available)
 */
const mockAuth = {
  /**
   * Create a mock user account
   */
  register: function(email, password, characterName, steamId, displayName) {
    const users = JSON.parse(localStorage.getItem('mockUsers') || '[]');
    
    // Check if user already exists
    if (users.find(u => u.email === email)) {
      throw new Error('Email already registered');
    }
    
    // Create new user
    const newUser = {
      userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      email: email.toLowerCase().trim(),
      password: password, // In real app, this would be hashed
      characterName: characterName.trim(),
      steamId: steamId || null,
      displayName: displayName ? displayName.trim() : null,
      createdAt: new Date().toISOString(),
      emailVerified: false
    };
    
    users.push(newUser);
    localStorage.setItem('mockUsers', JSON.stringify(users));
    
    return {
      success: true,
      message: 'Account created successfully',
      user: {
        userId: newUser.userId,
        email: newUser.email,
        characterName: newUser.characterName,
        steamId: newUser.steamId,
        displayName: newUser.displayName,
        emailVerified: newUser.emailVerified
      }
    };
  },
  
  /**
   * Login with mock credentials
   */
  login: function(email, password) {
    const users = JSON.parse(localStorage.getItem('mockUsers') || '[]');
    const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Generate mock token
    const token = 'mock_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store user session
    localStorage.setItem('mockSession', JSON.stringify({
      token: token,
      userId: user.userId,
      email: user.email
    }));
    
    return {
      success: true,
      token: token,
      user: {
        userId: user.userId,
        email: user.email,
        characterName: user.characterName,
        steamId: user.steamId,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      }
    };
  },
  
  /**
   * Get current user from mock session
   */
  getCurrentUser: function(token) {
    const session = JSON.parse(localStorage.getItem('mockSession') || 'null');
    if (!session || session.token !== token) {
      return null;
    }
    
    const users = JSON.parse(localStorage.getItem('mockUsers') || '[]');
    const user = users.find(u => u.userId === session.userId);
    
    if (!user) {
      return null;
    }
    
    return {
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        characterName: user.characterName,
        steamId: user.steamId,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLogin: new Date().toISOString()
      }
    };
  }
};

/**
 * Initialize authentication system
 */
async function initAuth() {
  // Check if backend is available
  USE_MOCK_AUTH = !(await checkBackendAvailable());
  
  if (USE_MOCK_AUTH) {
    console.log('Backend not available, using mock authentication');
  }
  
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
  
  // Use mock auth if backend is not available
  if (USE_MOCK_AUTH) {
    const userData = mockAuth.getCurrentUser(authToken);
    if (userData && userData.success && userData.user) {
      currentUser = userData.user;
      return true;
    }
    // Token invalid, clear it
    localStorage.removeItem('authToken');
    authToken = null;
    return false;
  }
  
  // Try real backend
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
    // If backend fails, try mock auth as fallback
    console.warn('Backend unavailable, trying mock auth:', error);
    const userData = mockAuth.getCurrentUser(authToken);
    if (userData && userData.success && userData.user) {
      currentUser = userData.user;
      USE_MOCK_AUTH = true;
      return true;
    }
    // Token invalid, clear it
    localStorage.removeItem('authToken');
    authToken = null;
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

  // Handle Profile link
  const profileLink = document.getElementById('profileLink');
  if (profileLink) {
    profileLink.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.href = 'profile.html';
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
    if (authToken && !USE_MOCK_AUTH) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        // Backend might not be available, that's okay
        console.warn('Backend logout failed, clearing local session:', error);
      }
    }
    
    // Clear mock session if using mock auth
    if (USE_MOCK_AUTH) {
      localStorage.removeItem('mockSession');
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

/**
 * Mock login function (for developer/testing)
 */
async function mockLogin(email, password, characterName) {
  try {
    // Try to register first (will fail if exists, that's okay)
    try {
      mockAuth.register(email, password, characterName || 'TestCharacter', null, null);
    } catch (e) {
      // User might already exist, try login
    }
    
    // Login
    const result = mockAuth.login(email, password);
    
    if (result.success && result.token) {
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem('authToken', result.token);
      USE_MOCK_AUTH = true;
      updateAuthUI();
      return result;
    }
    
    throw new Error('Login failed');
  } catch (error) {
    throw error;
  }
}

// Expose functions to window for use in other scripts
window.checkAuthState = checkAuthState;
window.updateAuthState = updateAuthUI;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.isAuthenticated = isAuthenticated;
window.mockLogin = mockLogin;
window.USE_MOCK_AUTH = () => USE_MOCK_AUTH;
window.mockAuth = mockAuth;

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

