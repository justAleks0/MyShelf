// Feed Page
import { auth, db, onAuthStateChanged, signOut } from './firebase-config.js';
const BASE = window.MYSHELF_BASE || '';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    doc,
    orderBy,
    limit,
    startAfter
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;
let currentFilter = 'all';
let feedItems = [];
let lastVisibleDoc = null;
let hasMoreItems = true;
const ITEMS_PER_PAGE = 20;

// User IDs we're connected to
let followingIds = [];
let friendIds = [];
let userProfiles = {}; // Cache for user profiles

// DOM Elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const loadingState = document.getElementById('loading-state');
const feedContent = document.getElementById('feed-content');
const feedList = document.getElementById('feed-list');
const feedEmpty = document.getElementById('feed-empty');
const noConnections = document.getElementById('no-connections');
const loadMoreContainer = document.getElementById('load-more-container');
const loadMoreBtn = document.getElementById('load-more-btn');
const detailModal = document.getElementById('detail-modal');

// Category icons
const categoryIcons = {
    cards: '🃏',
    figures: '🎭',
    games: '🎮',
    books: '📚',
    vinyl: '💿',
    other: '📦'
};

// Origin labels
const originLabels = {
    'official': 'Official',
    'reseller': 'Re-seller',
    'fan-made': 'Fan-made',
    'custom-commissioned': 'Commissioned',
    'custom-self-made': 'Self-made'
};

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName || 'User';
        userEmail.textContent = user.email;
        
        // Set profile link
        const profileLink = document.getElementById('my-profile-link');
        if (profileLink) {
            profileLink.href = `${BASE}/pages/user.html?id=${user.uid}`;
        }
        
        if (user.photoURL) {
            headerAvatar.src = user.photoURL;
            headerAvatar.style.display = 'block';
            avatarFallback.style.display = 'none';
        } else {
            headerAvatar.style.display = 'none';
            avatarFallback.style.display = 'flex';
        }
        
        initializeFeed();
    } else {
        window.location.href = `${BASE}/pages/auth.html`;
    }
});

// Toggle dropdown menu
dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('active');
    dropdownTrigger.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!dropdownTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('active');
        dropdownTrigger.classList.remove('active');
    }
});

// Initialize feed
async function initializeFeed() {
    try {
        // Load connections
        await Promise.all([
            loadFollowing(),
            loadFriends()
        ]);
        
        // Check if user has any connections
        if (followingIds.length === 0 && friendIds.length === 0) {
            loadingState.style.display = 'none';
            noConnections.style.display = 'block';
            return;
        }
        
        // Load initial feed
        await loadFeedItems();
        
        loadingState.style.display = 'none';
        
        if (feedItems.length === 0) {
            feedEmpty.style.display = 'block';
        } else {
            feedContent.style.display = 'block';
            renderFeed();
        }
    } catch (error) {
        console.error('Error initializing feed:', error);
        loadingState.style.display = 'none';
        feedEmpty.style.display = 'block';
    }
}

// Load users we're following
async function loadFollowing() {
    const q = query(
        collection(db, 'follows'),
        where('followerId', '==', currentUser.uid)
    );
    const snapshot = await getDocs(q);
    followingIds = snapshot.docs.map(doc => doc.data().followingId);
}

// Load friends
async function loadFriends() {
    const q = query(
        collection(db, 'friends'),
        where('userId', '==', currentUser.uid)
    );
    const snapshot = await getDocs(q);
    friendIds = snapshot.docs.map(doc => doc.data().friendId);
}

// Get user IDs based on current filter
function getFilteredUserIds() {
    switch (currentFilter) {
        case 'following':
            return followingIds;
        case 'friends':
            return friendIds;
        case 'all':
        default:
            return [...new Set([...followingIds, ...friendIds])];
    }
}

// Load feed items
async function loadFeedItems(loadMore = false) {
    const userIds = getFilteredUserIds();
    
    if (userIds.length === 0) {
        feedItems = [];
        hasMoreItems = false;
        return;
    }
    
    // Firestore 'in' queries are limited to 30 items, so we need to batch if more
    const batchSize = 30;
    let allItems = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
        const batchIds = userIds.slice(i, i + batchSize);
        
        let q = query(
            collection(db, 'items'),
            where('userId', 'in', batchIds),
            where('visibility', '==', 'public'),
            orderBy('createdAt', 'desc'),
            limit(ITEMS_PER_PAGE)
        );
        
        if (loadMore && lastVisibleDoc) {
            q = query(
                collection(db, 'items'),
                where('userId', 'in', batchIds),
                where('visibility', '==', 'public'),
                orderBy('createdAt', 'desc'),
                startAfter(lastVisibleDoc),
                limit(ITEMS_PER_PAGE)
            );
        }
        
        const snapshot = await getDocs(q);
        const batchItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            _doc: doc
        }));
        
        allItems = allItems.concat(batchItems);
    }
    
    // Sort all items by createdAt and limit
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    allItems = allItems.slice(0, ITEMS_PER_PAGE);
    
    if (loadMore) {
        feedItems = feedItems.concat(allItems);
    } else {
        feedItems = allItems;
    }
    
    if (allItems.length > 0) {
        lastVisibleDoc = allItems[allItems.length - 1]._doc;
    }
    
    hasMoreItems = allItems.length === ITEMS_PER_PAGE;
    
    // Load user profiles for these items
    await loadUserProfilesForItems();
}

// Load user profiles for feed items
async function loadUserProfilesForItems() {
    const uniqueUserIds = [...new Set(feedItems.map(item => item.userId))];
    
    for (const userId of uniqueUserIds) {
        if (!userProfiles[userId]) {
            try {
                const profileDoc = await getDoc(doc(db, 'profiles', userId));
                if (profileDoc.exists()) {
                    userProfiles[userId] = profileDoc.data();
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            }
        }
    }
}

// Render feed
function renderFeed() {
    feedList.innerHTML = feedItems.map(item => createFeedItem(item)).join('');
    
    loadMoreContainer.style.display = hasMoreItems ? 'block' : 'none';
    
    // Add click handlers
    document.querySelectorAll('.feed-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.itemId;
            const item = feedItems.find(i => i.id === itemId);
            if (item) showItemDetail(item);
        });
    });
}

// Create feed item HTML
function createFeedItem(item) {
    const user = userProfiles[item.userId] || {};
    const categoryIcon = getCategoryIcon(item.category);
    
    const imageHtml = item.image 
        ? `<img src="${item.image}" alt="${item.name}" class="feed-item-image">`
        : `<div class="feed-item-placeholder">${categoryIcon}</div>`;
    
    const userAvatarHtml = user.photoURL
        ? `<img src="${user.photoURL}" alt="${user.displayName}" class="feed-user-avatar">`
        : `<div class="feed-user-avatar-placeholder">👤</div>`;
    
    const timeAgo = getTimeAgo(item.createdAt);
    
    const originBadge = item.origin 
        ? `<span class="origin-badge origin-${item.origin}">${originLabels[item.origin] || item.origin}</span>` 
        : '';
    
    return `
        <div class="feed-item" data-item-id="${item.id}">
            <div class="feed-item-header">
                <a href="${BASE}/pages/user.html?id=${item.userId}" class="feed-user-link" onclick="event.stopPropagation()">
                    ${userAvatarHtml}
                    <span class="feed-user-name">${user.displayName || 'User'}</span>
                </a>
                <span class="feed-time">${timeAgo}</span>
            </div>
            <div class="feed-item-content">
                ${imageHtml}
                <div class="feed-item-info">
                    <div class="feed-item-badges">
                        <span class="item-category">${item.category}</span>
                        ${originBadge}
                    </div>
                    <h3 class="feed-item-name">${item.name}</h3>
                    ${item.description ? `<p class="feed-item-description">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</p>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Get category icon
function getCategoryIcon(category) {
    const normalizedCategory = category ? category.toLowerCase() : 'other';
    return categoryIcons[normalizedCategory] || '📦';
}

// Get time ago string
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    return date.toLocaleDateString();
}

// Show item detail
function showItemDetail(item) {
    const user = userProfiles[item.userId] || {};
    const categoryIcon = getCategoryIcon(item.category);
    
    const imageHtml = item.image 
        ? `<img src="${item.image}" alt="${item.name}" class="detail-image">`
        : `<div class="detail-placeholder">${categoryIcon}</div>`;
    
    const conditionClass = item.condition ? `condition-${item.condition}` : '';
    const conditionText = item.condition ? item.condition.replace('-', ' ').charAt(0).toUpperCase() + item.condition.replace('-', ' ').slice(1) : 'N/A';
    
    const originText = item.origin ? originLabels[item.origin] || item.origin : 'N/A';
    const originClass = item.origin ? `origin-${item.origin}` : '';
    
    const tagsHtml = item.tags && item.tags.length > 0 
        ? `<div class="detail-tags">
            <div class="meta-label">Tags</div>
            <div class="tags-list">${item.tags.map(tag => `<span class="detail-tag">${tag}</span>`).join('')}</div>
           </div>`
        : '';
    
    const detailContent = document.getElementById('detail-content');
    detailContent.innerHTML = `
        ${imageHtml}
        <div class="detail-info">
            <div class="feed-item-attribution">
                <span>Added by</span>
                <a href="${BASE}/pages/user.html?id=${item.userId}" class="attribution-link">@${user.username || 'user'}</a>
            </div>
            <span class="item-category">${item.category}</span>
            <h2>${item.name}</h2>
            ${item.description ? `<p>${item.description}</p>` : '<p>No description added.</p>'}
            <div class="detail-meta">
                <div class="meta-item">
                    <div class="meta-label">Year</div>
                    <div class="meta-value">${item.year || 'N/A'}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Condition</div>
                    <div class="meta-value ${conditionClass}">${conditionText}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Origin</div>
                    <div class="meta-value ${originClass}">${originText}</div>
                </div>
            </div>
            ${tagsHtml}
        </div>
    `;
    
    detailModal.classList.add('active');
}

// Close modal
function closeModal() {
    detailModal.classList.remove('active');
}

// Filter button handlers
document.querySelectorAll('.feed-filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const filter = btn.dataset.filter;
        if (filter === currentFilter) return;
        
        // Update active state
        document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentFilter = filter;
        lastVisibleDoc = null;
        hasMoreItems = true;
        
        // Reload feed
        feedList.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
        feedEmpty.style.display = 'none';
        loadMoreContainer.style.display = 'none';
        
        await loadFeedItems();
        
        if (feedItems.length === 0) {
            feedList.innerHTML = '';
            feedEmpty.style.display = 'block';
        } else {
            feedEmpty.style.display = 'none';
            renderFeed();
        }
    });
});

// Load more button
loadMoreBtn.addEventListener('click', async () => {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';
    
    await loadFeedItems(true);
    renderFeed();
    
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
});

// Modal event listeners
document.getElementById('close-detail').addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Handle sign out
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = `${BASE}/pages/auth.html`;
    } catch (error) {
        console.error('Error signing out:', error);
    }
});
