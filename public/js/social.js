// Social Page
import { auth, db, onAuthStateChanged, signOut } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    deleteDoc,
    addDoc,
    doc,
    updateDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;
let viewedUserId = null;
let isOwnProfile = false;
let currentTab = 'followers';

// Data arrays
let followers = [];
let following = [];
let friends = [];
let friendRequests = [];

// DOM Elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const loadingState = document.getElementById('loading-state');
const socialContent = document.getElementById('social-content');
const socialList = document.getElementById('social-list');
const socialEmpty = document.getElementById('social-empty');
const pageTitle = document.getElementById('page-title');
const pageDescription = document.getElementById('page-description');
const requestsTab = document.getElementById('requests-tab');

// Get params from URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        tab: params.get('tab') || 'followers'
    };
}

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
        
        const params = getUrlParams();
        viewedUserId = params.id || user.uid;
        isOwnProfile = viewedUserId === user.uid;
        currentTab = params.tab;
        
        // Hide requests tab if viewing someone else's profile
        if (!isOwnProfile) {
            requestsTab.style.display = 'none';
        }
        
        initializePage();
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

// Initialize page
async function initializePage() {
    // Update page title if viewing someone else
    if (!isOwnProfile) {
        try {
            const profileDoc = await getDoc(doc(db, 'profiles', viewedUserId));
            if (profileDoc.exists()) {
                const profile = profileDoc.data();
                pageTitle.textContent = `${profile.displayName}'s Connections`;
                pageDescription.textContent = `View their followers, following, and friends`;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }
    
    await loadAllData();
    setActiveTab(currentTab);
}

// Load all social data
async function loadAllData() {
    try {
        await Promise.all([
            loadFollowers(),
            loadFollowing(),
            loadFriends(),
            isOwnProfile ? loadFriendRequests() : Promise.resolve()
        ]);
        
        // Update tab counts
        document.getElementById('tab-followers-count').textContent = followers.length;
        document.getElementById('tab-following-count').textContent = following.length;
        document.getElementById('tab-friends-count').textContent = friends.length;
        document.getElementById('tab-requests-count').textContent = friendRequests.length;
        
        loadingState.style.display = 'none';
        socialContent.style.display = 'block';
    } catch (error) {
        console.error('Error loading data:', error);
        loadingState.style.display = 'none';
    }
}

// Load followers
async function loadFollowers() {
    const q = query(
        collection(db, 'follows'),
        where('followingId', '==', viewedUserId)
    );
    const snapshot = await getDocs(q);
    
    const followerIds = snapshot.docs.map(doc => doc.data().followerId);
    followers = await loadUserProfiles(followerIds);
    
    // Add follow doc IDs for unfollow functionality
    followers.forEach((follower, index) => {
        follower.followDocId = snapshot.docs[index].id;
    });
}

// Load following
async function loadFollowing() {
    const q = query(
        collection(db, 'follows'),
        where('followerId', '==', viewedUserId)
    );
    const snapshot = await getDocs(q);
    
    const followingIds = snapshot.docs.map(doc => doc.data().followingId);
    following = await loadUserProfiles(followingIds);
    
    // Add follow doc IDs
    following.forEach((user, index) => {
        user.followDocId = snapshot.docs[index].id;
    });
}

// Load friends
async function loadFriends() {
    const q = query(
        collection(db, 'friends'),
        where('userId', '==', viewedUserId)
    );
    const snapshot = await getDocs(q);
    
    const friendIds = snapshot.docs.map(doc => doc.data().friendId);
    friends = await loadUserProfiles(friendIds);
    
    // Add friend doc IDs
    friends.forEach((friend, index) => {
        friend.friendDocId = snapshot.docs[index].id;
    });
}

// Load friend requests (only for own profile)
async function loadFriendRequests() {
    const q = query(
        collection(db, 'friendRequests'),
        where('toUserId', '==', currentUser.uid),
        where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    
    const requestorIds = snapshot.docs.map(doc => doc.data().fromUserId);
    friendRequests = await loadUserProfiles(requestorIds);
    
    // Add request doc IDs
    friendRequests.forEach((request, index) => {
        request.requestDocId = snapshot.docs[index].id;
    });
}

// Load user profiles by IDs
async function loadUserProfiles(userIds) {
    if (userIds.length === 0) return [];
    
    const profiles = [];
    for (const userId of userIds) {
        try {
            const profileDoc = await getDoc(doc(db, 'profiles', userId));
            if (profileDoc.exists()) {
                profiles.push({
                    id: userId,
                    ...profileDoc.data()
                });
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }
    return profiles;
}

// Set active tab
function setActiveTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.social-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
    
    renderList();
}

// Render current list
function renderList() {
    let data = [];
    let emptyIcon = '👥';
    let emptyTitle = 'No connections';
    let emptyMessage = '';
    
    switch (currentTab) {
        case 'followers':
            data = followers;
            emptyIcon = '👥';
            emptyTitle = 'No followers yet';
            emptyMessage = isOwnProfile ? 'Share your profile to gain followers' : 'This user has no followers';
            break;
        case 'following':
            data = following;
            emptyIcon = '👀';
            emptyTitle = 'Not following anyone';
            emptyMessage = isOwnProfile ? 'Explore to find collectors to follow' : 'This user is not following anyone';
            break;
        case 'friends':
            data = friends;
            emptyIcon = '🤝';
            emptyTitle = 'No friends yet';
            emptyMessage = isOwnProfile ? 'Send friend requests to connect' : 'This user has no friends';
            break;
        case 'requests':
            data = friendRequests;
            emptyIcon = '📬';
            emptyTitle = 'No pending requests';
            emptyMessage = 'Friend requests will appear here';
            break;
    }
    
    if (data.length === 0) {
        socialList.innerHTML = '';
        document.getElementById('empty-icon').textContent = emptyIcon;
        document.getElementById('empty-title').textContent = emptyTitle;
        document.getElementById('empty-message').textContent = emptyMessage;
        socialEmpty.style.display = 'block';
    } else {
        socialEmpty.style.display = 'none';
        socialList.innerHTML = data.map(user => createUserCard(user)).join('');
        attachCardEventListeners();
    }
}

// Create user card HTML
function createUserCard(user) {
    const avatarHtml = user.photoURL 
        ? `<img src="${user.photoURL}" alt="${user.displayName}" class="social-card-avatar">`
        : `<div class="social-card-avatar-placeholder">👤</div>`;
    
    let actionButton = '';
    
    if (currentTab === 'requests') {
        actionButton = `
            <div class="social-card-actions">
                <button class="btn btn-primary btn-small accept-btn" data-user-id="${user.id}" data-request-id="${user.requestDocId}">Accept</button>
                <button class="btn btn-secondary btn-small reject-btn" data-user-id="${user.id}" data-request-id="${user.requestDocId}">Reject</button>
            </div>
        `;
    } else if (isOwnProfile) {
        if (currentTab === 'following') {
            actionButton = `
                <button class="btn btn-secondary btn-small unfollow-btn" data-user-id="${user.id}" data-doc-id="${user.followDocId}">Unfollow</button>
            `;
        } else if (currentTab === 'friends') {
            actionButton = `
                <button class="btn btn-secondary btn-small unfriend-btn" data-user-id="${user.id}" data-doc-id="${user.friendDocId}">Unfriend</button>
            `;
        }
    }
    
    return `
        <div class="social-card" data-user-id="${user.id}">
            <div class="social-card-main" onclick="window.location.href='/pages/user.html?id=${user.id}'">
                ${avatarHtml}
                <div class="social-card-info">
                    <h3 class="social-card-name">${user.displayName || 'User'}</h3>
                    ${user.username ? `<p class="social-card-username">@${user.username}</p>` : ''}
                    ${user.bio ? `<p class="social-card-bio">${user.bio.substring(0, 100)}${user.bio.length > 100 ? '...' : ''}</p>` : ''}
                </div>
            </div>
            ${actionButton}
        </div>
    `;
}

// Attach event listeners to card buttons
function attachCardEventListeners() {
    // Accept friend request
    document.querySelectorAll('.accept-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            const requestId = btn.dataset.requestId;
            await acceptFriendRequest(userId, requestId);
        });
    });
    
    // Reject friend request
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const requestId = btn.dataset.requestId;
            await rejectFriendRequest(requestId);
        });
    });
    
    // Unfollow
    document.querySelectorAll('.unfollow-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const docId = btn.dataset.docId;
            await unfollowUser(docId);
        });
    });
    
    // Unfriend
    document.querySelectorAll('.unfriend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            await unfriendUser(userId);
        });
    });
}

// Accept friend request
async function acceptFriendRequest(fromUserId, requestId) {
    try {
        const batch = writeBatch(db);
        
        // Update request status
        batch.update(doc(db, 'friendRequests', requestId), {
            status: 'accepted',
            updatedAt: new Date().toISOString()
        });
        
        // Create friend documents
        const friendRef1 = doc(collection(db, 'friends'));
        const friendRef2 = doc(collection(db, 'friends'));
        
        batch.set(friendRef1, {
            userId: currentUser.uid,
            friendId: fromUserId,
            createdAt: new Date().toISOString()
        });
        
        batch.set(friendRef2, {
            userId: fromUserId,
            friendId: currentUser.uid,
            createdAt: new Date().toISOString()
        });
        
        await batch.commit();
        
        // Update local data
        const acceptedUser = friendRequests.find(r => r.id === fromUserId);
        if (acceptedUser) {
            friendRequests = friendRequests.filter(r => r.id !== fromUserId);
            friends.push(acceptedUser);
        }
        
        // Update counts
        document.getElementById('tab-requests-count').textContent = friendRequests.length;
        document.getElementById('tab-friends-count').textContent = friends.length;
        
        renderList();
    } catch (error) {
        console.error('Error accepting request:', error);
        alert('Failed to accept request. Please try again.');
    }
}

// Reject friend request
async function rejectFriendRequest(requestId) {
    try {
        await deleteDoc(doc(db, 'friendRequests', requestId));
        
        friendRequests = friendRequests.filter(r => r.requestDocId !== requestId);
        document.getElementById('tab-requests-count').textContent = friendRequests.length;
        
        renderList();
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Failed to reject request. Please try again.');
    }
}

// Unfollow user
async function unfollowUser(docId) {
    try {
        await deleteDoc(doc(db, 'follows', docId));
        
        following = following.filter(u => u.followDocId !== docId);
        document.getElementById('tab-following-count').textContent = following.length;
        
        renderList();
    } catch (error) {
        console.error('Error unfollowing:', error);
        alert('Failed to unfollow. Please try again.');
    }
}

// Unfriend user
async function unfriendUser(userId) {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    try {
        const batch = writeBatch(db);
        
        // Find and delete both friend documents
        const myFriendQuery = query(
            collection(db, 'friends'),
            where('userId', '==', currentUser.uid),
            where('friendId', '==', userId)
        );
        const theirFriendQuery = query(
            collection(db, 'friends'),
            where('userId', '==', userId),
            where('friendId', '==', currentUser.uid)
        );
        
        const [mySnap, theirSnap] = await Promise.all([
            getDocs(myFriendQuery),
            getDocs(theirFriendQuery)
        ]);
        
        mySnap.docs.forEach(d => batch.delete(d.ref));
        theirSnap.docs.forEach(d => batch.delete(d.ref));
        
        await batch.commit();
        
        friends = friends.filter(f => f.id !== userId);
        document.getElementById('tab-friends-count').textContent = friends.length;
        
        renderList();
    } catch (error) {
        console.error('Error unfriending:', error);
        alert('Failed to remove friend. Please try again.');
    }
}

// Tab click handlers
document.querySelectorAll('.social-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        setActiveTab(tab.dataset.tab);
    });
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
