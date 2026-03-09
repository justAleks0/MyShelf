// Explore Page Logic
import { auth, db, onAuthStateChanged, signOut } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;

// DOM Elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const userSearch = document.getElementById('user-search');
const searchBtn = document.getElementById('search-btn');
const loadingState = document.getElementById('loading-state');
const exploreResults = document.getElementById('explore-results');
const exploreEmpty = document.getElementById('explore-empty');
const noResults = document.getElementById('no-results');

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName || 'User';
        userEmail.textContent = user.email;
        
        // Set profile link
        const profileLink = document.getElementById('my-profile-link');
        if (profileLink) {
            profileLink.href = `/pages/user.html?id=${user.uid}`;
        }
        
        if (user.photoURL) {
            headerAvatar.src = user.photoURL;
            headerAvatar.style.display = 'block';
            avatarFallback.style.display = 'none';
        } else {
            headerAvatar.style.display = 'none';
            avatarFallback.style.display = 'flex';
        }
        
        loadFeaturedProfiles();
    } else {
        window.location.href = '/pages/auth.html';
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

// Load featured/recent public profiles
async function loadFeaturedProfiles() {
    try {
        loadingState.style.display = 'flex';
        exploreEmpty.style.display = 'none';
        
        const q = query(
            collection(db, 'profiles'),
            where('isPublic', '==', true),
            orderBy('updatedAt', 'desc'),
            limit(20)
        );
        
        const snapshot = await getDocs(q);
        
        loadingState.style.display = 'none';
        
        if (snapshot.empty) {
            exploreEmpty.style.display = 'block';
            return;
        }
        
        const profiles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderProfiles(profiles);
    } catch (error) {
        console.error('Error loading profiles:', error);
        loadingState.style.display = 'none';
        exploreEmpty.style.display = 'block';
    }
}

// Search profiles
async function searchProfiles() {
    const searchTerm = userSearch.value.trim().toLowerCase();
    
    if (!searchTerm) {
        loadFeaturedProfiles();
        return;
    }
    
    loadingState.style.display = 'flex';
    exploreResults.innerHTML = '';
    exploreEmpty.style.display = 'none';
    noResults.style.display = 'none';
    
    try {
        // Get all public profiles and filter client-side
        // Firestore doesn't support case-insensitive contains queries
        const q = query(
            collection(db, 'profiles'),
            where('isPublic', '==', true)
        );
        
        const snapshot = await getDocs(q);
        
        loadingState.style.display = 'none';
        
        const profiles = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(profile => {
                const nameMatch = profile.displayName?.toLowerCase().includes(searchTerm);
                const usernameMatch = profile.username?.toLowerCase().includes(searchTerm);
                return nameMatch || usernameMatch;
            });
        
        if (profiles.length === 0) {
            noResults.style.display = 'block';
            return;
        }
        
        renderProfiles(profiles);
    } catch (error) {
        console.error('Error searching profiles:', error);
        loadingState.style.display = 'none';
        noResults.style.display = 'block';
    }
}

// Render profiles
function renderProfiles(profiles) {
    exploreResults.innerHTML = '';
    exploreEmpty.style.display = 'none';
    noResults.style.display = 'none';
    
    profiles.forEach(profile => {
        // Don't show current user in results
        if (profile.userId === currentUser.uid) return;
        
        const card = createProfileCard(profile);
        exploreResults.appendChild(card);
    });
    
    if (exploreResults.children.length === 0) {
        exploreEmpty.style.display = 'block';
    }
}

// Create profile card
function createProfileCard(profile) {
    const card = document.createElement('div');
    card.className = 'profile-result-card';
    
    const avatarHtml = profile.photoURL 
        ? `<img src="${profile.photoURL}" alt="${profile.displayName}" class="result-avatar">`
        : `<div class="result-avatar-placeholder">👤</div>`;
    
    const usernameHtml = profile.username 
        ? `<span class="result-username">@${profile.username}</span>` 
        : '';
    
    card.innerHTML = `
        <div class="result-avatar-wrapper">
            ${avatarHtml}
        </div>
        <div class="result-info">
            <h3 class="result-name">${profile.displayName || 'User'}</h3>
            ${usernameHtml}
            ${profile.bio ? `<p class="result-bio">${profile.bio}</p>` : ''}
        </div>
        <a href="/pages/user.html?id=${profile.userId}" class="btn btn-primary btn-small">View Collection</a>
    `;
    
    return card;
}

// Event Listeners
searchBtn.addEventListener('click', searchProfiles);

userSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        searchProfiles();
    }
});

// Handle sign out
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '/pages/auth.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});
