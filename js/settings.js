// Settings Page Logic
import { auth, db, onAuthStateChanged, signOut, googleProvider, linkWithPopup, unlink, EmailAuthProvider, linkWithCredential } from './firebase-config.js';
const BASE = window.MYSHELF_BASE || '';
import { 
    sendPasswordResetEmail,
    deleteUser
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    deleteDoc,
    doc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;

// DOM Elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const themeSelect = document.getElementById('theme-select');
const defaultCategory = document.getElementById('default-category');
const itemsPerPage = document.getElementById('items-per-page');
const exportBtn = document.getElementById('export-btn');

// Apply saved theme on page load (before auth check to avoid flash)
const savedTheme = localStorage.getItem('myshelf-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

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
        
        // Handle avatar
        if (user.photoURL) {
            headerAvatar.src = user.photoURL;
            headerAvatar.style.display = 'block';
            avatarFallback.style.display = 'none';
        } else {
            headerAvatar.style.display = 'none';
            avatarFallback.style.display = 'flex';
        }
        
        loadSettings();
        renderLinkedAccounts();
    } else {
        window.location.href = `${BASE}/pages/auth.html`;
    }
});

// Load saved settings from localStorage
function loadSettings() {
    // Theme
    const savedTheme = localStorage.getItem('myshelf-theme') || 'dark';
    themeSelect.value = savedTheme;
    
    // Default category
    const savedCategory = localStorage.getItem('myshelf-default-category');
    if (savedCategory) {
        defaultCategory.value = savedCategory;
    }
    
    // Items per page
    const savedItemsPerPage = localStorage.getItem('myshelf-items-per-page') || 'all';
    itemsPerPage.value = savedItemsPerPage;
    
    // Display boxes
    const savedDisplayBoxes = localStorage.getItem('myshelf-display-boxes') || 'show';
    displayBoxes.value = savedDisplayBoxes;
    
    // Display bundled items
    const savedDisplayBundled = localStorage.getItem('myshelf-display-bundled') || 'show';
    displayBundled.value = savedDisplayBundled;
}

// Save theme
themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value;
    localStorage.setItem('myshelf-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
});

// Save default category
defaultCategory.addEventListener('change', () => {
    localStorage.setItem('myshelf-default-category', defaultCategory.value);
});

// Save items per page
itemsPerPage.addEventListener('change', () => {
    localStorage.setItem('myshelf-items-per-page', itemsPerPage.value);
});

// Display boxes setting
const displayBoxes = document.getElementById('display-boxes');

displayBoxes.addEventListener('change', () => {
    localStorage.setItem('myshelf-display-boxes', displayBoxes.value);
});

// Display bundled items setting
const displayBundled = document.getElementById('display-bundled');

displayBundled.addEventListener('change', () => {
    localStorage.setItem('myshelf-display-bundled', displayBundled.value);
});

// Linked Accounts Management
const linkedAccountsList = document.getElementById('linked-accounts-list');
const addPasswordSection = document.getElementById('add-password-section');
const linkSuccess = document.getElementById('link-success');
const linkError = document.getElementById('link-error');
const resetPasswordSection = document.getElementById('reset-password-section');

function getLinkedProviders() {
    if (!currentUser) return [];
    return currentUser.providerData.map(p => p.providerId);
}

function renderLinkedAccounts() {
    if (!currentUser) return;
    
    const providers = getLinkedProviders();
    const hasGoogle = providers.includes('google.com');
    const hasPassword = providers.includes('password');
    const canUnlink = providers.length > 1;
    
    linkedAccountsList.innerHTML = `
        <div class="linked-account-item">
            <div class="linked-account-info">
                <svg class="provider-icon" viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div>
                    <span class="provider-name">Google</span>
                    <span class="provider-status ${hasGoogle ? 'connected' : ''}">${hasGoogle ? 'Connected' : 'Not connected'}</span>
                </div>
            </div>
            ${hasGoogle 
                ? `<button class="btn btn-secondary btn-small unlink-btn" data-provider="google.com" ${!canUnlink ? 'disabled title="Cannot unlink your only sign-in method"' : ''}>Unlink</button>`
                : `<button class="btn btn-primary btn-small link-google-btn">Link Google</button>`
            }
        </div>
        
        <div class="linked-account-item">
            <div class="linked-account-info">
                <svg class="provider-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <div>
                    <span class="provider-name">Email/Password</span>
                    <span class="provider-status ${hasPassword ? 'connected' : ''}">${hasPassword ? currentUser.email : 'Not connected'}</span>
                </div>
            </div>
            ${hasPassword 
                ? `<button class="btn btn-secondary btn-small unlink-btn" data-provider="password" ${!canUnlink ? 'disabled title="Cannot unlink your only sign-in method"' : ''}>Unlink</button>`
                : `<button class="btn btn-primary btn-small add-email-btn">Add Email</button>`
            }
        </div>
    `;
    
    // Show/hide add password section
    addPasswordSection.style.display = hasPassword ? 'none' : 'block';
    
    // Show/hide password reset section (only relevant if user has password auth)
    resetPasswordSection.style.display = hasPassword ? 'flex' : 'none';
    
    // Add event listeners
    const linkGoogleBtn = linkedAccountsList.querySelector('.link-google-btn');
    if (linkGoogleBtn) {
        linkGoogleBtn.addEventListener('click', handleLinkGoogle);
    }
    
    const addEmailBtn = linkedAccountsList.querySelector('.add-email-btn');
    if (addEmailBtn) {
        addEmailBtn.addEventListener('click', () => {
            addPasswordSection.style.display = 'block';
            document.getElementById('new-password').focus();
        });
    }
    
    const unlinkBtns = linkedAccountsList.querySelectorAll('.unlink-btn:not([disabled])');
    unlinkBtns.forEach(btn => {
        btn.addEventListener('click', () => handleUnlink(btn.dataset.provider));
    });
}

async function handleLinkGoogle() {
    clearLinkMessages();
    
    try {
        await linkWithPopup(currentUser, googleProvider);
        linkSuccess.textContent = 'Google account linked successfully!';
        renderLinkedAccounts();
    } catch (error) {
        console.error('Error linking Google:', error);
        if (error.code === 'auth/credential-already-in-use') {
            linkError.textContent = 'This Google account is already linked to another user.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            linkError.textContent = 'Sign-in cancelled.';
        } else {
            linkError.textContent = 'Failed to link Google account. Please try again.';
        }
    }
}

async function handleUnlink(providerId) {
    clearLinkMessages();
    
    const providerName = providerId === 'google.com' ? 'Google' : 'Email/Password';
    const confirmed = confirm(`Are you sure you want to unlink ${providerName}? You won't be able to sign in with this method anymore.`);
    
    if (!confirmed) return;
    
    try {
        await unlink(currentUser, providerId);
        linkSuccess.textContent = `${providerName} unlinked successfully.`;
        renderLinkedAccounts();
    } catch (error) {
        console.error('Error unlinking provider:', error);
        linkError.textContent = `Failed to unlink ${providerName}. Please try again.`;
    }
}

document.getElementById('add-password-btn').addEventListener('click', async () => {
    clearLinkMessages();
    
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    
    if (password.length < 6) {
        linkError.textContent = 'Password must be at least 6 characters.';
        return;
    }
    
    if (password !== confirmPassword) {
        linkError.textContent = 'Passwords do not match.';
        return;
    }
    
    const addBtn = document.getElementById('add-password-btn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
    
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await linkWithCredential(currentUser, credential);
        
        linkSuccess.textContent = 'Email/Password sign-in added successfully!';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-new-password').value = '';
        renderLinkedAccounts();
    } catch (error) {
        console.error('Error adding password:', error);
        if (error.code === 'auth/requires-recent-login') {
            linkError.textContent = 'Please sign out and sign back in before adding a password.';
        } else {
            linkError.textContent = 'Failed to add password. Please try again.';
        }
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Password';
    }
});

function clearLinkMessages() {
    linkSuccess.textContent = '';
    linkError.textContent = '';
}

// Export collection
exportBtn.addEventListener('click', async () => {
    try {
        exportBtn.textContent = 'Exporting...';
        exportBtn.disabled = true;
        
        const q = query(
            collection(db, 'items'),
            where('userId', '==', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            user: {
                displayName: currentUser.displayName,
                email: currentUser.email
            },
            itemCount: items.length,
            items: items
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `myshelf-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        exportBtn.textContent = 'Exported!';
        setTimeout(() => {
            exportBtn.textContent = 'Export';
            exportBtn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Error exporting:', error);
        alert('Failed to export collection. Please try again.');
        exportBtn.textContent = 'Export';
        exportBtn.disabled = false;
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

// Handle password reset
document.getElementById('reset-password-btn').addEventListener('click', async () => {
    const passwordSuccess = document.getElementById('password-success');
    const passwordError = document.getElementById('password-error');
    
    passwordSuccess.textContent = '';
    passwordError.textContent = '';
    
    const resetBtn = document.getElementById('reset-password-btn');
    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';
    
    try {
        await sendPasswordResetEmail(auth, currentUser.email);
        passwordSuccess.textContent = `Password reset email sent to ${currentUser.email}`;
    } catch (error) {
        console.error('Error sending password reset:', error);
        passwordError.textContent = 'Failed to send reset email. Please try again.';
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Email';
    }
});

// Handle account deletion
document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const confirmed = confirm(
        'Are you sure you want to delete your account?\n\n' +
        'This will permanently delete:\n' +
        '• Your profile\n' +
        '• All your collection items\n' +
        '• All your boxes\n\n' +
        'This action cannot be undone!'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = confirm('This is your last chance. Delete account permanently?');
    
    if (!doubleConfirm) return;
    
    const deleteBtn = document.getElementById('delete-account-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
    
    try {
        // Get profile data for username cleanup
        const profileRef = doc(db, 'profiles', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        const profileData = profileSnap.exists() ? profileSnap.data() : null;
        
        // Delete all user's items from Firestore
        const itemsQuery = query(
            collection(db, 'items'),
            where('userId', '==', currentUser.uid)
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const deleteItemPromises = itemsSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteItemPromises);
        
        // Delete all user's boxes from Firestore
        const boxesQuery = query(
            collection(db, 'boxes'),
            where('userId', '==', currentUser.uid)
        );
        const boxesSnapshot = await getDocs(boxesQuery);
        const deleteBoxPromises = boxesSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteBoxPromises);
        
        // Delete username reservation if exists
        if (profileData?.username) {
            await deleteDoc(doc(db, 'usernames', profileData.username.toLowerCase()));
        }
        
        // Delete profile document
        await deleteDoc(doc(db, 'profiles', currentUser.uid));
        
        // Delete the user account
        await deleteUser(currentUser);
        
        alert('Your account has been deleted.');
        window.location.href = `${BASE}/pages/auth.html`;
    } catch (error) {
        console.error('Error deleting account:', error);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete Account';
        
        if (error.code === 'auth/requires-recent-login') {
            alert('For security reasons, please sign out and sign back in before deleting your account.');
        } else {
            alert('Failed to delete account. Please try again.');
        }
    }
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
