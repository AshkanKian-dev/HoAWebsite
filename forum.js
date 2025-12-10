// Forum JavaScript
// Use API_BASE_URL from auth.js if available, otherwise set it
const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
window.API_BASE_URL = API_BASE; // Make sure it's available globally

let currentView = 'categories'; // 'categories', 'topics', 'topic'
let currentCategoryId = null;
let currentTopicId = null;
let categories = [];
// Don't redeclare currentUser - use the one from auth.js via window.getCurrentUser()
let forumCurrentUser = null;

// Initialize forum
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    loadCategories();
    setupEventListeners();
});

// Check authentication state
async function checkAuthState() {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        try {
            // Try to get user from auth.js
            if (window.getCurrentUser) {
                forumCurrentUser = window.getCurrentUser();
            }
            
            // If not available, try API
            if (!forumCurrentUser) {
                const response = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    forumCurrentUser = data.user;
                }
            }
        } catch (error) {
            console.log('Could not get user info:', error);
        }
    }
    
    // Show/hide new topic button (show if user logged in OR dev mode)
    const newTopicBtn = document.getElementById('newTopicBtn');
    if (newTopicBtn) {
        const isDevMode = window.devMode && window.devMode.isEnabled();
        newTopicBtn.style.display = (forumCurrentUser || isDevMode) ? 'block' : 'none';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Back buttons
    const backToCategoriesBtn = document.getElementById('backToCategoriesBtn');
    if (backToCategoriesBtn) {
        backToCategoriesBtn.addEventListener('click', () => {
            showView('categories');
        });
    }

    const backToTopicsBtn = document.getElementById('backToTopicsBtn');
    if (backToTopicsBtn) {
        backToTopicsBtn.addEventListener('click', () => {
            if (currentCategoryId) {
                showView('topics', currentCategoryId);
            }
        });
    }

    // New topic button
    const newTopicBtn = document.getElementById('newTopicBtn');
    if (newTopicBtn) {
        newTopicBtn.addEventListener('click', () => {
            openNewTopicModal();
        });
    }

    // Modal close buttons
    const closeNewTopicModal = document.getElementById('closeNewTopicModal');
    const cancelNewTopicBtn = document.getElementById('cancelNewTopicBtn');
    const newTopicModal = document.getElementById('newTopicModal');
    
    if (closeNewTopicModal) {
        closeNewTopicModal.addEventListener('click', () => {
            newTopicModal.classList.remove('active');
        });
    }
    
    if (cancelNewTopicBtn) {
        cancelNewTopicBtn.addEventListener('click', () => {
            newTopicModal.classList.remove('active');
        });
    }

    if (newTopicModal) {
        const overlay = newTopicModal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                newTopicModal.classList.remove('active');
            });
        }
    }

    // Forms
    const newTopicForm = document.getElementById('newTopicForm');
    if (newTopicForm) {
        newTopicForm.addEventListener('submit', handleNewTopic);
    }

    const replyForm = document.getElementById('replyForm');
    if (replyForm) {
        replyForm.addEventListener('submit', handleReply);
    }
}

// Show specific view
function showView(view, categoryId = null, topicId = null) {
    currentView = view;
    currentCategoryId = categoryId;
    currentTopicId = topicId;

    // Hide all views
    document.getElementById('categoriesView').style.display = 'none';
    document.getElementById('topicsView').style.display = 'none';
    document.getElementById('topicView').style.display = 'none';

    // Show requested view
    if (view === 'categories') {
        document.getElementById('categoriesView').style.display = 'block';
        loadCategories();
    } else if (view === 'topics') {
        document.getElementById('topicsView').style.display = 'block';
        if (categoryId) {
            loadTopics(categoryId);
        }
    } else if (view === 'topic') {
        document.getElementById('topicView').style.display = 'block';
        if (topicId) {
            loadTopic(topicId);
        }
    }
}

// Load categories
async function loadCategories() {
    const loadingDiv = document.getElementById('loadingCategories');
    const contentDiv = document.getElementById('categoriesContent');
    const errorDiv = document.getElementById('categoriesError');
    const grid = document.getElementById('categoriesGrid');

    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        // Check for developer mode first
        if (window.devMode && window.devMode.isEnabled()) {
            console.log('Developer mode: Loading mock forum categories');
            categories = window.mockData.getForumCategories();
        } else {
            const response = await fetch(`${API_BASE}/api/forum/categories`);
            
            if (!response.ok) {
                throw new Error('Failed to load categories');
            }

            const data = await response.json();
            categories = data.categories || [];
        }

        if (categories.length === 0) {
            grid.innerHTML = '<p style="text-align: center; opacity: 0.9;">No categories available.</p>';
        } else {
            grid.innerHTML = categories.map(category => `
                <div class="forum-category-card" onclick="showView('topics', '${category.category_id}')">
                    <h3>${escapeHtml(category.name)}</h3>
                    <p>${escapeHtml(category.description || '')}</p>
                    <div class="forum-category-stats">
                        <span>${category.topic_count || 0} Topics</span>
                    </div>
                </div>
            `).join('');
        }

        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

    } catch (error) {
        console.error('Error loading categories:', error);
        loadingDiv.style.display = 'none';
        errorDiv.textContent = 'Failed to load forum categories. Please try again later.';
        errorDiv.style.display = 'block';
    }
}

// Load topics in a category
async function loadTopics(categoryId) {
    const loadingDiv = document.getElementById('loadingTopics');
    const contentDiv = document.getElementById('topicsContent');
    const errorDiv = document.getElementById('topicsError');
    const list = document.getElementById('topicsList');
    const categoryTitle = document.getElementById('categoryTitle');

    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        const category = categories.find(c => c.category_id === categoryId);
        if (category) {
            categoryTitle.textContent = category.name;
        }

        let topics = [];
        
        // Check for developer mode first
        if (window.devMode && window.devMode.isEnabled()) {
            console.log('Developer mode: Loading mock forum topics');
            topics = window.mockData.getForumTopics(categoryId);
        } else {
        const authToken = localStorage.getItem('authToken');
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

            const response = await fetch(`${API_BASE}/api/forum/topics/${categoryId}`, {
                headers
            });

            if (!response.ok) {
                throw new Error('Failed to load topics');
            }

            const data = await response.json();
            topics = data.topics || [];
        }

        if (topics.length === 0) {
            list.innerHTML = '<div class="server-info-card" style="text-align: center; padding: 3rem;"><p style="opacity: 0.9;">No topics yet. Be the first to create one!</p></div>';
        } else {
            list.innerHTML = topics.map(topic => {
                const pinnedClass = topic.pinned === 1 ? 'forum-topic-pinned' : '';
                const lockedIcon = topic.locked === 1 ? '🔒 ' : '';
                const lastReply = topic.last_reply_at 
                    ? new Date(topic.last_reply_at).toLocaleString()
                    : 'No replies';
                
                return `
                    <div class="forum-topic-item ${pinnedClass}" onclick="showView('topic', null, '${topic.topic_id}')">
                        <div class="forum-topic-main">
                            <h4>${lockedIcon}${escapeHtml(topic.title)}</h4>
                            <p>by ${escapeHtml(topic.character_name || topic.display_name || 'Unknown')}</p>
                        </div>
                        <div class="forum-topic-stats">
                            <span>${topic.replies_count || 0} replies</span>
                            <span>${topic.views || 0} views</span>
                            <span class="forum-topic-date">${lastReply}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

    } catch (error) {
        console.error('Error loading topics:', error);
        loadingDiv.style.display = 'none';
        errorDiv.textContent = 'Failed to load topics. Please try again later.';
        errorDiv.style.display = 'block';
    }
}

// Load a single topic with posts
async function loadTopic(topicId) {
    const loadingDiv = document.getElementById('loadingTopic');
    const contentDiv = document.getElementById('topicContent');
    const errorDiv = document.getElementById('topicError');
    const header = document.getElementById('topicHeader');
    const postsList = document.getElementById('postsList');
    const replySection = document.getElementById('replySection');

    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        let topic = null;
        let posts = [];
        
        // Check for developer mode first
        if (window.devMode && window.devMode.isEnabled()) {
            console.log('Developer mode: Loading mock forum topic');
            // Find topic in mock data
            const allTopics = window.mockData.getForumTopics(currentCategoryId || 'general');
            topic = allTopics.find(t => t.topic_id === topicId);
            if (topic) {
                posts = window.mockData.getForumPosts(topicId);
                // Increment views
                topic.views = (topic.views || 0) + 1;
            }
        } else {
            const authToken = localStorage.getItem('authToken');
            const headers = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch(`${API_BASE}/api/forum/topic/${topicId}`, {
                headers
            });

            if (!response.ok) {
                throw new Error('Failed to load topic');
            }

            const data = await response.json();
            topic = data.topic;
            posts = data.posts || [];
        }
        
        if (!topic) {
            throw new Error('Topic not found');
        }

        // Display topic header
        const topicDate = new Date(topic.created_at).toLocaleString();
        header.innerHTML = `
            <div class="server-info-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h2 style="color: var(--secondary-color); margin-bottom: 0.5rem;">${escapeHtml(topic.title)}</h2>
                        <p style="opacity: 0.8; font-size: 0.9rem;">
                            by ${escapeHtml(topic.character_name || topic.display_name || 'Unknown')} • ${topicDate}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span style="opacity: 0.8; font-size: 0.9rem;">${topic.views || 0} views</span>
                        ${topic.locked === 1 ? '<div style="margin-top: 0.5rem;">🔒 Locked</div>' : ''}
                    </div>
                </div>
                <div style="padding-top: 1rem; border-top: 1px solid var(--border-glow);">
                    <p style="white-space: pre-wrap; line-height: 1.8;">${escapeHtml(topic.content)}</p>
                </div>
            </div>
        `;

        // Display posts
        if (posts.length === 0) {
            postsList.innerHTML = '<div class="server-info-card" style="text-align: center; padding: 2rem;"><p style="opacity: 0.9;">No replies yet. Be the first to reply!</p></div>';
        } else {
            postsList.innerHTML = posts.map(post => {
                const postDate = new Date(post.created_at).toLocaleString();
                const editedNote = post.edited_at ? ` (edited ${new Date(post.edited_at).toLocaleString()})` : '';
                const isOwnPost = forumCurrentUser && post.user_id === forumCurrentUser.userId;
                
                return `
                    <div class="forum-post-item" data-post-id="${post.post_id}">
                        <div class="server-info-card">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                <div>
                                    <strong style="color: var(--secondary-color);">${escapeHtml(post.character_name || post.display_name || 'Unknown')}</strong>
                                    <span style="opacity: 0.8; font-size: 0.9rem; margin-left: 1rem;">${postDate}${editedNote}</span>
                                </div>
                                ${isOwnPost ? `
                                    <div>
                                        <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.85rem;" onclick="editPost('${post.post_id}')">Edit</button>
                                        <button class="btn btn-danger" style="padding: 5px 10px; font-size: 0.85rem; margin-left: 0.5rem;" onclick="deletePost('${post.post_id}')">Delete</button>
                                    </div>
                                ` : ''}
                            </div>
                            <div style="white-space: pre-wrap; line-height: 1.8;">${escapeHtml(post.content)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Show reply section if not locked and (user is logged in OR dev mode)
        const isDevMode = window.devMode && window.devMode.isEnabled();
        if (topic.locked !== 1 && (forumCurrentUser || isDevMode)) {
            replySection.style.display = 'block';
        } else {
            replySection.style.display = 'none';
        }

        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

    } catch (error) {
        console.error('Error loading topic:', error);
        loadingDiv.style.display = 'none';
        errorDiv.textContent = 'Failed to load topic. Please try again later.';
        errorDiv.style.display = 'block';
    }
}

// Open new topic modal
function openNewTopicModal() {
    const isDevMode = window.devMode && window.devMode.isEnabled();
    if (!forumCurrentUser && !isDevMode) {
        alert('Please log in to create a topic');
        window.location.href = 'login.html?return=forum.html';
        return;
    }

    const modal = document.getElementById('newTopicModal');
    const categorySelect = document.getElementById('topicCategory');
    
    // Populate categories
    categorySelect.innerHTML = '<option value="">Select a category...</option>' +
        categories.map(cat => `<option value="${cat.category_id}">${escapeHtml(cat.name)}</option>`).join('');

    // Reset form
    document.getElementById('newTopicForm').reset();
    modal.classList.add('active');
}

// Handle new topic submission
async function handleNewTopic(e) {
    e.preventDefault();

    const categoryId = document.getElementById('topicCategory').value;
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();

    if (!categoryId || !title || !content) {
        alert('Please fill in all fields');
        return;
    }

    const isDevMode = window.devMode && window.devMode.isEnabled();
    
    if (!isDevMode) {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('Please log in to create a topic');
            window.location.href = 'login.html?return=forum.html';
            return;
        }
    }

    try {
        let topicData = null;
        
        if (isDevMode) {
            // Use mock data
            console.log('Developer mode: Creating mock topic');
            topicData = window.mockData.addForumTopic({
                category_id: categoryId,
                user_id: 'mock_user_12345',
                title: title,
                content: content
            });
        } else {
            const response = await fetch(`${API_BASE}/api/forum/topic`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    category_id: categoryId,
                    title: title,
                    content: content
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create topic');
            }

            const data = await response.json();
            topicData = data.topic;
        }
        
        // Close modal
        document.getElementById('newTopicModal').classList.remove('active');
        
        // Show the new topic
        showView('topic', null, topicData.topic_id);

    } catch (error) {
        console.error('Error creating topic:', error);
        alert('Failed to create topic: ' + error.message);
    }
}

// Handle reply submission
async function handleReply(e) {
    e.preventDefault();

    const content = document.getElementById('replyContent').value.trim();

    if (!content) {
        alert('Please enter a reply');
        return;
    }

    const isDevMode = window.devMode && window.devMode.isEnabled();
    
    if (!isDevMode) {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('Please log in to post a reply');
            window.location.href = 'login.html?return=forum.html';
            return;
        }
    }

    try {
        if (isDevMode) {
            // Use mock data
            console.log('Developer mode: Creating mock post');
            window.mockData.addForumPost({
                topic_id: currentTopicId,
                user_id: 'mock_user_12345',
                content: content,
                category_id: currentCategoryId || 'general'
            });
        } else {
            const response = await fetch(`${API_BASE}/api/forum/post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    topic_id: currentTopicId,
                    content: content
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to post reply');
            }
        }

        // Clear form and reload topic
        document.getElementById('replyContent').value = '';
        loadTopic(currentTopicId);

    } catch (error) {
        console.error('Error posting reply:', error);
        alert('Failed to post reply: ' + error.message);
    }
}

// Edit post
async function editPost(postId) {
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postElement) return;

    const contentDiv = postElement.querySelector('div[style*="white-space"]');
    const currentContent = contentDiv.textContent;

    const newContent = prompt('Edit your post:', currentContent);
    if (!newContent || newContent.trim() === currentContent.trim()) {
        return;
    }

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Please log in to edit posts');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/forum/post/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                content: newContent.trim()
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to edit post');
        }

        // Reload topic
        loadTopic(currentTopicId);

    } catch (error) {
        console.error('Error editing post:', error);
        alert('Failed to edit post: ' + error.message);
    }
}

// Delete post
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Please log in to delete posts');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/forum/post/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete post');
        }

        // Reload topic
        loadTopic(currentTopicId);

    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post: ' + error.message);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions to window for onclick handlers
window.showView = showView;
window.editPost = editPost;
window.deletePost = deletePost;

