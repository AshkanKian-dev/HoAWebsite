// Developer Mode - Core Functionality
// Provides mock data and testing capabilities when backend is unavailable

const DEV_MODE_KEY = 'hoa_dev_mode';
const DEV_MODE_ENABLED_KEY = 'hoa_dev_mode_enabled';

let devModeEnabled = false;

// Initialize immediately (don't wait for DOM)
devModeEnabled = localStorage.getItem(DEV_MODE_ENABLED_KEY) === 'true';

/**
 * Initialize developer mode
 */
function initDevMode() {
    // Check if dev mode is enabled (already set above, but refresh)
    devModeEnabled = localStorage.getItem(DEV_MODE_ENABLED_KEY) === 'true';
    
    // Update UI
    updateDevModeUI();
    
    // Log status
    if (devModeEnabled) {
        console.log('%c🔧 DEVELOPER MODE ENABLED', 'color: #FFD700; font-weight: bold; font-size: 14px;');
        console.log('Mock data will be used for all features');
    }
}

/**
 * Toggle developer mode on/off
 */
function toggleDevMode() {
    devModeEnabled = !devModeEnabled;
    localStorage.setItem(DEV_MODE_ENABLED_KEY, devModeEnabled ? 'true' : 'false');
    
    updateDevModeUI();
    
    // Show notification
    const message = devModeEnabled ? 'Developer mode enabled' : 'Developer mode disabled';
    showDevModeNotification(message);
    
    // Reload page to apply changes
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

/**
 * Check if developer mode is enabled
 */
function isDevModeEnabled() {
    return devModeEnabled || localStorage.getItem(DEV_MODE_ENABLED_KEY) === 'true';
}

/**
 * Update developer mode UI indicators
 */
function updateDevModeUI() {
    const indicator = document.getElementById('devModeIndicator');
    const toggleBtn = document.getElementById('devModeToggle');
    
    if (indicator) {
        if (devModeEnabled) {
            indicator.style.display = 'block';
            indicator.textContent = 'DEV MODE';
        } else {
            indicator.style.display = 'none';
        }
    }
    
    if (toggleBtn) {
        toggleBtn.textContent = devModeEnabled ? 'Disable Dev Mode' : 'Enable Dev Mode';
        toggleBtn.classList.toggle('active', devModeEnabled);
    }
    
    // Add class to body for styling
    if (devModeEnabled) {
        document.body.classList.add('dev-mode-active');
    } else {
        document.body.classList.remove('dev-mode-active');
    }
}

/**
 * Show developer mode notification
 */
function showDevModeNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'dev-mode-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, rgba(212, 175, 55, 0.95), rgba(107, 44, 145, 0.95));
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(212, 175, 55, 0.5);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

/**
 * Create developer mode toggle button
 */
function createDevModeToggle() {
    // Check if already exists
    if (document.getElementById('devModeToggle')) {
        return;
    }
    
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'devModeToggle';
    toggleBtn.className = 'dev-mode-toggle';
    toggleBtn.textContent = devModeEnabled ? 'Disable Dev Mode' : 'Enable Dev Mode';
    toggleBtn.onclick = toggleDevMode;
    
    // Add to header or create container
    const header = document.querySelector('.header');
    if (header) {
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
        container.appendChild(toggleBtn);
        document.body.appendChild(container);
    }
}

/**
 * Create developer mode indicator
 */
function createDevModeIndicator() {
    // Check if already exists
    if (document.getElementById('devModeIndicator')) {
        return;
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'devModeIndicator';
    indicator.className = 'dev-mode-indicator';
    indicator.textContent = 'DEV MODE';
    indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, rgba(212, 175, 55, 0.9), rgba(107, 44, 145, 0.9));
        color: white;
        text-align: center;
        padding: 8px;
        font-weight: bold;
        font-size: 0.85rem;
        letter-spacing: 2px;
        z-index: 10001;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        display: ${devModeEnabled ? 'block' : 'none'};
    `;
    
    document.body.insertBefore(indicator, document.body.firstChild);
}

/**
 * Initialize developer mode UI elements
 */
function initDevModeUI() {
    createDevModeToggle();
    createDevModeIndicator();
    updateDevModeUI();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initDevMode();
        initDevModeUI();
    });
} else {
    initDevMode();
    initDevModeUI();
}

// Expose to window for global access
window.devMode = {
    isEnabled: isDevModeEnabled,
    toggle: toggleDevMode,
    enabled: () => devModeEnabled
};

