// User Public Profile Page
import { auth, db, onAuthStateChanged, signOut } from './firebase-config.js';
const BASE = window.MYSHELF_BASE || '';
import { 
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    addDoc,
    doc,
    updateDoc,
    increment,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'djg82cmbp';
const CLOUDINARY_UPLOAD_PRESET = 'myshelf_profile';

let currentUser = null;
let viewedUserId = null;
let profileData = null;
let publicItems = [];
let publicBoxes = [];
let isOwnProfile = false;
let isEditMode = false;
let selectedAvatarFile = null;

// Social state
let isFollowing = false;
let friendStatus = null; // null, 'pending-sent', 'pending-received', 'friends'
let followDocId = null;
let friendRequestDocId = null;
let friendDocId = null;
let followerCount = 0;
let followingCount = 0;
let friendCount = 0;

// DOM Elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const loadingState = document.getElementById('loading-state');
const privateNotice = document.getElementById('private-notice');
const notFound = document.getElementById('not-found');
const profileContent = document.getElementById('profile-content');
const detailModal = document.getElementById('detail-modal');

// Edit mode elements
const viewModeHeader = document.getElementById('view-mode-header');
const editModeHeader = document.getElementById('edit-mode-header');
const editProfileBtn = document.getElementById('edit-profile-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const editDisplayName = document.getElementById('edit-display-name');
const editBio = document.getElementById('edit-bio');
const editPublic = document.getElementById('edit-public');
const usernamePreview = document.getElementById('username-preview');
const bioCount = document.getElementById('bio-count');
const editSuccess = document.getElementById('edit-success');
const editError = document.getElementById('edit-error');
const avatarFile = document.getElementById('avatar-file');
const avatarUploadText = document.getElementById('avatar-upload-text');
const avatarUploadProgress = document.getElementById('avatar-upload-progress');
const avatarProgressFill = document.getElementById('avatar-progress-fill');
const editAvatarImg = document.getElementById('edit-avatar-img');
const editAvatarPlaceholder = document.getElementById('edit-avatar-placeholder');

// Social elements
const profileActions = document.getElementById('profile-actions');
const followBtn = document.getElementById('follow-btn');
const friendBtn = document.getElementById('friend-btn');
const statFollowers = document.getElementById('stat-followers');
const statFollowing = document.getElementById('stat-following');
const statFriends = document.getElementById('stat-friends');

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
    'fan-made': 'Fan-made',
    'custom-commissioned': 'Commissioned',
    'custom-self-made': 'Self-made'
};

// Get user ID from URL
function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
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
        
        viewedUserId = getUserIdFromUrl();
        if (viewedUserId) {
            loadUserProfile();
        } else {
            showNotFound();
        }
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

// Load user profile
async function loadUserProfile() {
    isOwnProfile = viewedUserId === currentUser.uid;
    
    try {
        const profileRef = doc(db, 'profiles', viewedUserId);
        const profileSnap = await getDoc(profileRef);
        
        // For own profile, create profile doc if it doesn't exist
        if (!profileSnap.exists()) {
            if (isOwnProfile) {
                // Create initial profile
                profileData = {
                    userId: currentUser.uid,
                    displayName: currentUser.displayName || '',
                    photoURL: currentUser.photoURL || '',
                    email: currentUser.email,
                    username: generateUsername(currentUser.displayName || currentUser.email.split('@')[0]),
                    bio: '',
                    isPublic: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await setDoc(profileRef, profileData);
            } else {
                showNotFound();
                return;
            }
        } else {
            profileData = profileSnap.data();
        }
        
        // If not own profile and not public, show private notice
        if (!isOwnProfile && !profileData.isPublic) {
            showPrivate();
            return;
        }
        
        // Load items, boxes, and social data
        await Promise.all([
            loadPublicItems(),
            loadPublicBoxes(),
            loadSocialCounts(),
            checkFollowStatus(),
            checkFriendStatus()
        ]);
        
        renderProfile();
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotFound();
    }
}

// Generate username from display name
function generateUsername(displayName) {
    if (!displayName) return '';
    return displayName
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 20);
}

// Update username preview
function updateUsernamePreview() {
    const name = editDisplayName.value.trim();
    const username = generateUsername(name);
    if (username) {
        usernamePreview.textContent = `@${username}`;
        usernamePreview.style.display = 'block';
    } else {
        usernamePreview.style.display = 'none';
    }
}

// Enter edit mode
function enterEditMode() {
    isEditMode = true;
    viewModeHeader.style.display = 'none';
    editModeHeader.style.display = 'block';
    
    // Populate edit fields
    editDisplayName.value = profileData.displayName || '';
    editBio.value = profileData.bio || '';
    editPublic.checked = profileData.isPublic || false;
    bioCount.textContent = (profileData.bio || '').length;
    updateUsernamePreview();
    
    // Update avatar preview
    if (profileData.photoURL) {
        editAvatarImg.src = profileData.photoURL;
        editAvatarImg.style.display = 'block';
        editAvatarPlaceholder.style.display = 'none';
    } else {
        editAvatarImg.style.display = 'none';
        editAvatarPlaceholder.style.display = 'flex';
    }
    
    // Update stats in edit mode
    document.getElementById('edit-stat-items').textContent = publicItems.length;
    document.getElementById('edit-stat-boxes').textContent = publicBoxes.length;
    
    // Reset file selection
    selectedAvatarFile = null;
    avatarFile.value = '';
    avatarUploadText.textContent = 'Change Photo';
}

// Exit edit mode
function exitEditMode() {
    isEditMode = false;
    viewModeHeader.style.display = 'flex';
    editModeHeader.style.display = 'none';
    editSuccess.textContent = '';
    editError.textContent = '';
}

// Upload avatar to Cloudinary
async function uploadAvatar(file) {
    const username = generateUsername(editDisplayName.value.trim() || currentUser.email.split('@')[0]);
    const date = new Date().toISOString().split('T')[0];
    const extension = file.name.split('.').pop().toLowerCase();
    const publicId = `${username}_profilepicture_${date}`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', publicId);
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                avatarProgressFill.style.width = `${percent}%`;
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url);
            } else {
                reject(new Error('Upload failed'));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
        xhr.send(formData);
    });
}

// Save profile changes
async function saveProfile() {
    editSuccess.textContent = '';
    editError.textContent = '';
    
    const newDisplayName = editDisplayName.value.trim();
    const newUsername = generateUsername(newDisplayName);
    const newBio = editBio.value.trim();
    const newIsPublic = editPublic.checked;
    
    if (!newDisplayName) {
        editError.textContent = 'Display name is required';
        return;
    }
    
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Saving...';
    
    try {
        let newPhotoURL = profileData.photoURL;
        
        // Upload new avatar if selected
        if (selectedAvatarFile) {
            avatarUploadProgress.style.display = 'block';
            try {
                newPhotoURL = await uploadAvatar(selectedAvatarFile);
            } catch (uploadError) {
                editError.textContent = 'Failed to upload image. Please try again.';
                avatarUploadProgress.style.display = 'none';
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = 'Save Changes';
                return;
            }
            avatarUploadProgress.style.display = 'none';
        }
        
        // Handle username change
        const oldUsername = profileData.username?.toLowerCase();
        if (newUsername && newUsername !== oldUsername) {
            // Check if new username is available
            const usernameRef = doc(db, 'usernames', newUsername);
            const usernameSnap = await getDoc(usernameRef);
            
            if (usernameSnap.exists() && usernameSnap.data().userId !== currentUser.uid) {
                editError.textContent = 'This username is already taken. Try a different display name.';
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = 'Save Changes';
                return;
            }
            
            // Delete old username reservation
            if (oldUsername) {
                await deleteDoc(doc(db, 'usernames', oldUsername));
            }
            
            // Reserve new username
            await setDoc(usernameRef, {
                userId: currentUser.uid,
                createdAt: new Date().toISOString()
            });
        }
        
        // Update Firebase Auth profile
        await updateProfile(currentUser, {
            displayName: newDisplayName,
            photoURL: newPhotoURL
        });
        
        // Update Firestore profile
        const updatedProfile = {
            displayName: newDisplayName,
            username: newUsername,
            bio: newBio,
            photoURL: newPhotoURL,
            isPublic: newIsPublic,
            updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'profiles', currentUser.uid), updatedProfile, { merge: true });
        
        // Update local data
        profileData = { ...profileData, ...updatedProfile };
        
        // Update header
        userName.textContent = newDisplayName;
        if (newPhotoURL) {
            headerAvatar.src = newPhotoURL;
            headerAvatar.style.display = 'block';
            avatarFallback.style.display = 'none';
        }
        
        // Reset file selection
        selectedAvatarFile = null;
        avatarFile.value = '';
        avatarUploadText.textContent = 'Change Photo';
        
        editSuccess.textContent = 'Profile saved!';
        
        // Refresh view
        setTimeout(() => {
            exitEditMode();
            renderProfile();
        }, 1000);
        
    } catch (error) {
        console.error('Error saving profile:', error);
        editError.textContent = 'Failed to save profile. Please try again.';
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Save Changes';
    }
}

// Load public items (or all items if own profile)
async function loadPublicItems() {
    try {
        let q;
        if (isOwnProfile) {
            // For own profile in view mode, only show public items
            q = query(
                collection(db, 'items'),
                where('userId', '==', viewedUserId),
                where('visibility', '==', 'public')
            );
        } else {
            q = query(
                collection(db, 'items'),
                where('userId', '==', viewedUserId),
                where('visibility', '==', 'public')
            );
        }
        
        const snapshot = await getDocs(q);
        publicItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading items:', error);
        publicItems = [];
    }
}

// Load public boxes (or all boxes if own profile)
async function loadPublicBoxes() {
    try {
        let q;
        if (isOwnProfile) {
            // For own profile in view mode, only show public boxes
            q = query(
                collection(db, 'boxes'),
                where('userId', '==', viewedUserId),
                where('visibility', '==', 'public')
            );
        } else {
            q = query(
                collection(db, 'boxes'),
                where('userId', '==', viewedUserId),
                where('visibility', '==', 'public')
            );
        }
        
        const snapshot = await getDocs(q);
        publicBoxes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading boxes:', error);
        publicBoxes = [];
    }
}

// Render profile
function renderProfile() {
    loadingState.style.display = 'none';
    profileContent.style.display = 'block';
    viewModeHeader.style.display = 'flex';
    editModeHeader.style.display = 'none';
    
    // Update title
    document.title = `MyShelf - ${profileData.displayName || 'User'}'s Collection`;
    
    // Profile header
    document.getElementById('profile-name').textContent = profileData.displayName || 'User';
    
    if (profileData.username) {
        document.getElementById('profile-username').textContent = `@${profileData.username}`;
        document.getElementById('profile-username').style.display = 'block';
    } else {
        document.getElementById('profile-username').style.display = 'none';
    }
    
    if (profileData.bio) {
        document.getElementById('profile-bio').textContent = profileData.bio;
        document.getElementById('profile-bio').style.display = 'block';
    } else {
        document.getElementById('profile-bio').style.display = 'none';
    }
    
    // Avatar
    if (profileData.photoURL) {
        document.getElementById('profile-avatar').src = profileData.photoURL;
        document.getElementById('profile-avatar').style.display = 'block';
        document.getElementById('profile-avatar-placeholder').style.display = 'none';
    } else {
        document.getElementById('profile-avatar').style.display = 'none';
        document.getElementById('profile-avatar-placeholder').style.display = 'flex';
    }
    
    // Show edit button for own profile, or follow/friend buttons for others
    if (isOwnProfile) {
        editProfileBtn.style.display = 'inline-block';
        profileActions.style.display = 'none';
    } else {
        editProfileBtn.style.display = 'none';
        profileActions.style.display = 'flex';
        updateFollowButton();
        updateFriendButton();
    }
    
    // Stats
    document.getElementById('stat-items').textContent = publicItems.length;
    document.getElementById('stat-boxes').textContent = publicBoxes.length;
    statFollowers.textContent = followerCount;
    statFollowing.textContent = followingCount;
    statFriends.textContent = friendCount;
    
    // Render boxes
    if (publicBoxes.length > 0) {
        document.getElementById('boxes-section').style.display = 'block';
        const boxesGrid = document.getElementById('boxes-grid');
        boxesGrid.innerHTML = '';
        publicBoxes.forEach(box => {
            const boxCard = createBoxCard(box);
            boxesGrid.appendChild(boxCard);
        });
    }
    
    // Render loose items (items not in any public box)
    const publicBoxIds = publicBoxes.map(b => b.id);
    const looseItems = publicItems.filter(item => !item.boxId || !publicBoxIds.includes(item.boxId));
    
    if (looseItems.length > 0 || publicItems.length > 0) {
        document.getElementById('items-section').style.display = 'block';
        const itemsGrid = document.getElementById('items-grid');
        itemsGrid.innerHTML = '';
        
        // For items in public boxes, show them under the box
        // For loose items, show them directly
        looseItems.forEach(item => {
            const itemCard = createItemCard(item);
            itemsGrid.appendChild(itemCard);
        });
    }
    
    // Empty state
    if (publicItems.length === 0 && publicBoxes.length === 0) {
        document.getElementById('empty-notice').style.display = 'block';
    }
}

// Get items in a public box
function getBoxItems(boxId) {
    return publicItems.filter(item => item.boxId === boxId);
}

// Get category icon
function getCategoryIcon(category) {
    const normalizedCategory = category ? category.toLowerCase() : 'other';
    return categoryIcons[normalizedCategory] || '📦';
}

// Create box card
function createBoxCard(box) {
    const card = document.createElement('div');
    card.className = 'box-card';
    
    const items = getBoxItems(box.id);
    const itemCount = items.length;
    
    let previewHtml = '';
    
    if (itemCount === 0) {
        previewHtml = `
            <div class="box-preview items-0">
                <div class="box-placeholder">📭</div>
            </div>
        `;
    } else if (itemCount === 1) {
        previewHtml = `
            <div class="box-preview items-1">
                ${createPreviewItem(items[0])}
            </div>
        `;
    } else if (itemCount === 2) {
        previewHtml = `
            <div class="box-preview items-2">
                ${createPreviewItem(items[0])}
                ${createPreviewItem(items[1])}
            </div>
        `;
    } else {
        const extraCount = itemCount - 3;
        previewHtml = `
            <div class="box-preview items-more">
                ${createPreviewItem(items[0])}
                ${createPreviewItem(items[1])}
                ${createPreviewItem(items[2], extraCount > 0 ? extraCount : 0)}
            </div>
        `;
    }
    
    card.innerHTML = `
        ${previewHtml}
        <div class="box-info">
            <div class="box-header">
                <h3 class="box-name">${box.name}</h3>
            </div>
            <span class="box-item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
            ${box.description ? `<p class="box-description">${box.description}</p>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => showBoxItems(box));
    
    return card;
}

// Create preview item for box
function createPreviewItem(item, overlayCount = 0) {
    const categoryIcon = getCategoryIcon(item.category);
    
    if (item.image) {
        return `
            <div class="box-preview-item">
                <img src="${item.image}" alt="${item.name}">
                ${overlayCount > 0 ? `<div class="box-preview-overlay">+${overlayCount}</div>` : ''}
            </div>
        `;
    } else {
        return `
            <div class="box-preview-item placeholder">
                ${categoryIcon}
                ${overlayCount > 0 ? `<div class="box-preview-overlay">+${overlayCount}</div>` : ''}
            </div>
        `;
    }
}

// Show box items in modal
function showBoxItems(box) {
    const items = getBoxItems(box.id);
    const detailContent = document.getElementById('detail-content');
    
    let itemsHtml = items.map(item => {
        const categoryIcon = getCategoryIcon(item.category);
        const imageHtml = item.image 
            ? `<img src="${item.image}" alt="${item.name}" class="item-image">`
            : `<div class="item-placeholder">${categoryIcon}</div>`;
        
        return `
            <div class="item-card" onclick="showItemDetailFromBox('${item.id}')">
                ${imageHtml}
                <div class="item-info">
                    <span class="item-category">${item.category}</span>
                    <h3 class="item-name">${item.name}</h3>
                </div>
            </div>
        `;
    }).join('');
    
    detailContent.innerHTML = `
        <div class="box-detail-view">
            <h2>${box.name}</h2>
            ${box.description ? `<p class="box-detail-description">${box.description}</p>` : ''}
            <div class="box-detail-grid">${itemsHtml || '<p class="no-items">No items in this box</p>'}</div>
        </div>
    `;
    
    detailModal.classList.add('active');
}

// Create item card
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    const categoryIcon = getCategoryIcon(item.category);
    
    const imageHtml = item.image 
        ? `<img src="${item.image}" alt="${item.name}" class="item-image">`
        : `<div class="item-placeholder">${categoryIcon}</div>`;
    
    const conditionClass = item.condition ? `condition-${item.condition}` : '';
    const conditionText = item.condition ? item.condition.replace('-', ' ') : '';
    
    const originBadge = item.origin ? `<span class="origin-badge origin-${item.origin}">${originLabels[item.origin] || item.origin}</span>` : '';
    
    const tagsHtml = item.tags && item.tags.length > 0 
        ? `<div class="item-tags">${item.tags.slice(0, 3).map(tag => `<span class="item-tag">${tag}</span>`).join('')}${item.tags.length > 3 ? `<span class="item-tag item-tag-more">+${item.tags.length - 3}</span>` : ''}</div>`
        : '';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="item-info">
            <div class="item-header">
                <span class="item-category">${item.category}</span>
                ${originBadge}
            </div>
            <h3 class="item-name">${item.name}</h3>
            ${item.description ? `<p class="item-description">${item.description}</p>` : ''}
            ${tagsHtml}
            <div class="item-meta">
                ${item.year ? `<span>📅 ${item.year}</span>` : ''}
                ${item.condition ? `<span class="${conditionClass}">✨ ${conditionText}</span>` : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => showItemDetail(item));
    
    return card;
}

// Show item detail
function showItemDetail(item) {
    const detailContent = document.getElementById('detail-content');
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
    
    detailContent.innerHTML = `
        ${imageHtml}
        <div class="detail-info">
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

// Global function for onclick
window.showItemDetailFromBox = function(itemId) {
    const item = publicItems.find(i => i.id === itemId);
    if (item) {
        showItemDetail(item);
    }
};

// ==================== SOCIAL FUNCTIONS ====================

// Load social counts for a user
async function loadSocialCounts() {
    try {
        // Get follower count
        const followersQuery = query(
            collection(db, 'follows'),
            where('followingId', '==', viewedUserId)
        );
        const followersSnap = await getDocs(followersQuery);
        followerCount = followersSnap.size;

        // Get following count
        const followingQuery = query(
            collection(db, 'follows'),
            where('followerId', '==', viewedUserId)
        );
        const followingSnap = await getDocs(followingQuery);
        followingCount = followingSnap.size;

        // Get friends count
        const friendsQuery = query(
            collection(db, 'friends'),
            where('userId', '==', viewedUserId)
        );
        const friendsSnap = await getDocs(friendsQuery);
        friendCount = friendsSnap.size;
    } catch (error) {
        console.error('Error loading social counts:', error);
    }
}

// Check if current user follows viewed user
async function checkFollowStatus() {
    if (isOwnProfile) return;
    
    try {
        const q = query(
            collection(db, 'follows'),
            where('followerId', '==', currentUser.uid),
            where('followingId', '==', viewedUserId)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            isFollowing = true;
            followDocId = snapshot.docs[0].id;
        } else {
            isFollowing = false;
            followDocId = null;
        }
    } catch (error) {
        console.error('Error checking follow status:', error);
    }
}

// Check friend request status
async function checkFriendStatus() {
    if (isOwnProfile) return;
    
    try {
        // Check if already friends
        const friendsQuery = query(
            collection(db, 'friends'),
            where('userId', '==', currentUser.uid),
            where('friendId', '==', viewedUserId)
        );
        const friendsSnap = await getDocs(friendsQuery);
        
        if (!friendsSnap.empty) {
            friendStatus = 'friends';
            friendDocId = friendsSnap.docs[0].id;
            return;
        }

        // Check for pending request sent by current user
        const sentQuery = query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', currentUser.uid),
            where('toUserId', '==', viewedUserId),
            where('status', '==', 'pending')
        );
        const sentSnap = await getDocs(sentQuery);
        
        if (!sentSnap.empty) {
            friendStatus = 'pending-sent';
            friendRequestDocId = sentSnap.docs[0].id;
            return;
        }

        // Check for pending request received from viewed user
        const receivedQuery = query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', viewedUserId),
            where('toUserId', '==', currentUser.uid),
            where('status', '==', 'pending')
        );
        const receivedSnap = await getDocs(receivedQuery);
        
        if (!receivedSnap.empty) {
            friendStatus = 'pending-received';
            friendRequestDocId = receivedSnap.docs[0].id;
            return;
        }

        friendStatus = null;
        friendRequestDocId = null;
        friendDocId = null;
    } catch (error) {
        console.error('Error checking friend status:', error);
    }
}

// Toggle follow
async function toggleFollow() {
    followBtn.disabled = true;
    
    try {
        if (isFollowing) {
            // Unfollow
            await deleteDoc(doc(db, 'follows', followDocId));
            isFollowing = false;
            followDocId = null;
            followerCount--;
        } else {
            // Follow
            const followData = {
                followerId: currentUser.uid,
                followingId: viewedUserId,
                createdAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'follows'), followData);
            isFollowing = true;
            followDocId = docRef.id;
            followerCount++;
        }
        
        updateFollowButton();
        statFollowers.textContent = followerCount;
    } catch (error) {
        console.error('Error toggling follow:', error);
        alert('Failed to update follow status. Please try again.');
    } finally {
        followBtn.disabled = false;
    }
}

// Handle friend button click
async function handleFriendAction() {
    friendBtn.disabled = true;
    
    try {
        if (friendStatus === 'friends') {
            // Unfriend
            if (confirm('Are you sure you want to remove this friend?')) {
                const batch = writeBatch(db);
                
                // Delete both friend documents
                const myFriendQuery = query(
                    collection(db, 'friends'),
                    where('userId', '==', currentUser.uid),
                    where('friendId', '==', viewedUserId)
                );
                const theirFriendQuery = query(
                    collection(db, 'friends'),
                    where('userId', '==', viewedUserId),
                    where('friendId', '==', currentUser.uid)
                );
                
                const [mySnap, theirSnap] = await Promise.all([
                    getDocs(myFriendQuery),
                    getDocs(theirFriendQuery)
                ]);
                
                mySnap.docs.forEach(doc => batch.delete(doc.ref));
                theirSnap.docs.forEach(doc => batch.delete(doc.ref));
                
                await batch.commit();
                
                friendStatus = null;
                friendDocId = null;
                friendCount--;
            }
        } else if (friendStatus === 'pending-sent') {
            // Cancel request
            await deleteDoc(doc(db, 'friendRequests', friendRequestDocId));
            friendStatus = null;
            friendRequestDocId = null;
        } else if (friendStatus === 'pending-received') {
            // Accept request
            const batch = writeBatch(db);
            
            // Update request status
            batch.update(doc(db, 'friendRequests', friendRequestDocId), {
                status: 'accepted',
                updatedAt: new Date().toISOString()
            });
            
            // Create friend documents for both users
            const friendData1 = {
                userId: currentUser.uid,
                friendId: viewedUserId,
                createdAt: new Date().toISOString()
            };
            const friendData2 = {
                userId: viewedUserId,
                friendId: currentUser.uid,
                createdAt: new Date().toISOString()
            };
            
            batch.set(doc(collection(db, 'friends')), friendData1);
            batch.set(doc(collection(db, 'friends')), friendData2);
            
            await batch.commit();
            
            friendStatus = 'friends';
            friendCount++;
        } else {
            // Send friend request
            const requestData = {
                fromUserId: currentUser.uid,
                toUserId: viewedUserId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'friendRequests'), requestData);
            friendStatus = 'pending-sent';
            friendRequestDocId = docRef.id;
        }
        
        updateFriendButton();
        statFriends.textContent = friendCount;
    } catch (error) {
        console.error('Error with friend action:', error);
        alert('Failed to update friend status. Please try again.');
    } finally {
        friendBtn.disabled = false;
    }
}

// Update follow button state
function updateFollowButton() {
    if (isFollowing) {
        followBtn.textContent = 'Following';
        followBtn.classList.remove('btn-primary');
        followBtn.classList.add('btn-secondary');
    } else {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('btn-secondary');
        followBtn.classList.add('btn-primary');
    }
}

// Update friend button state
function updateFriendButton() {
    switch (friendStatus) {
        case 'friends':
            friendBtn.textContent = 'Friends ✓';
            friendBtn.classList.remove('btn-secondary');
            friendBtn.classList.add('btn-success');
            break;
        case 'pending-sent':
            friendBtn.textContent = 'Pending';
            friendBtn.classList.remove('btn-success');
            friendBtn.classList.add('btn-secondary');
            break;
        case 'pending-received':
            friendBtn.textContent = 'Accept Request';
            friendBtn.classList.remove('btn-secondary');
            friendBtn.classList.add('btn-primary');
            break;
        default:
            friendBtn.textContent = 'Add Friend';
            friendBtn.classList.remove('btn-success');
            friendBtn.classList.add('btn-secondary');
    }
}

// ==================== END SOCIAL FUNCTIONS ====================

// Show states
function showNotFound() {
    loadingState.style.display = 'none';
    notFound.style.display = 'block';
}

function showPrivate() {
    loadingState.style.display = 'none';
    privateNotice.style.display = 'block';
}

// Close modal
function closeModal() {
    detailModal.classList.remove('active');
}

// Event Listeners
document.getElementById('close-detail').addEventListener('click', closeModal);

detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Edit mode event listeners
editProfileBtn.addEventListener('click', enterEditMode);
cancelEditBtn.addEventListener('click', exitEditMode);
saveProfileBtn.addEventListener('click', saveProfile);

// Social event listeners
followBtn.addEventListener('click', toggleFollow);
friendBtn.addEventListener('click', handleFriendAction);

// Social stat click handlers (navigate to social page)
document.getElementById('stat-followers-container').addEventListener('click', () => {
    window.location.href = `${BASE}/pages/social.html?id=${viewedUserId}&tab=followers`;
});
document.getElementById('stat-following-container').addEventListener('click', () => {
    window.location.href = `${BASE}/pages/social.html?id=${viewedUserId}&tab=following`;
});
document.getElementById('stat-friends-container').addEventListener('click', () => {
    window.location.href = `${BASE}/pages/social.html?id=${viewedUserId}&tab=friends`;
});

editDisplayName.addEventListener('input', updateUsernamePreview);

editBio.addEventListener('input', () => {
    bioCount.textContent = editBio.value.length;
});

avatarFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
        editError.textContent = 'Please select a JPG, PNG, GIF, WebP, or AVIF image';
        avatarFile.value = '';
        return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        editError.textContent = 'Image must be less than 5MB';
        avatarFile.value = '';
        return;
    }
    
    selectedAvatarFile = file;
    avatarUploadText.textContent = file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name;
    editError.textContent = '';
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
        editAvatarImg.src = e.target.result;
        editAvatarImg.style.display = 'block';
        editAvatarPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
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
