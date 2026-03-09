// MyShelf - Collection Tracker with Firebase
import { auth, db, onAuthStateChanged, signOut } from './firebase-config.js';
const BASE = window.MYSHELF_BASE || '';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    writeBatch,
    getDocs,
    getDoc,
    limit as firestoreLimit,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'djg82cmbp';
const CLOUDINARY_UPLOAD_PRESET = 'myshelf_items';

// Current user
let currentUser = null;
let collectionData = [];
let boxesData = [];
let bundlesData = [];
let unsubscribeItems = null;
let unsubscribeBoxes = null;
let unsubscribeBundles = null;
let unsubscribeNotifications = null;
let currentOpenBoxId = null;
let notifications = [];

// Item images state
let itemImages = [];
let selectedItemFiles = [];

// Bundle state
let bundleImages = [];
let bundleContents = [];
let bundleLinkedItems = [];
let selectedBundleFiles = [];
let creatingItemForBundle = false;

// Pagination
let currentPage = 1;
let itemsPerPage = 'all';
let displayBoxes = 'show';
let displayBundled = 'show';

// DOM Elements
const collectionGrid = document.getElementById('collection-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const itemModal = document.getElementById('item-modal');
const detailModal = document.getElementById('detail-modal');
const itemForm = document.getElementById('item-form');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('category-filter');
const viewFilter = document.getElementById('view-filter');
const sortFilter = document.getElementById('sort-filter');

// Advanced filters
const toggleAdvancedFilters = document.getElementById('toggle-advanced-filters');
const advancedFiltersPanel = document.getElementById('advanced-filters');
const filterOrigin = document.getElementById('filter-origin');
const filterCondition = document.getElementById('filter-condition');
const filterYearFrom = document.getElementById('filter-year-from');
const filterYearTo = document.getElementById('filter-year-to');
const filterVisibility = document.getElementById('filter-visibility');
const filterHasImages = document.getElementById('filter-has-images');
const filterTags = document.getElementById('filter-tags');
const clearAdvancedFilters = document.getElementById('clear-advanced-filters');
const activeFiltersCount = document.getElementById('active-filters-count');

// Notifications
const notificationTrigger = document.getElementById('notification-trigger');
const notificationDropdown = document.getElementById('notification-dropdown');
const notificationBadge = document.getElementById('notification-badge');
const notificationList = document.getElementById('notification-list');
const markAllReadBtn = document.getElementById('mark-all-read');

const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const headerAvatar = document.getElementById('header-avatar');
const avatarFallback = document.getElementById('avatar-fallback');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const itemCount = document.getElementById('item-count');
const boxCount = document.getElementById('box-count');
const itemImageFile = document.getElementById('item-image-file');
const itemUploadText = document.getElementById('item-upload-text');
const itemUploadProgress = document.getElementById('item-upload-progress');
const itemProgressFill = document.getElementById('item-progress-fill');
const itemProgressText = document.getElementById('item-progress-text');
const itemImagesPreview = document.getElementById('item-images-preview');
const itemOrigin = document.getElementById('item-origin');
const itemBox = document.getElementById('item-box');
const itemTagsInput = document.getElementById('item-tags-input');
const tagsContainer = document.getElementById('tags-container');

// Box modal elements
const boxModal = document.getElementById('box-modal');
const boxForm = document.getElementById('box-form');
const boxContentsModal = document.getElementById('box-contents-modal');
const boxContentsGrid = document.getElementById('box-contents-grid');
const boxEmptyState = document.getElementById('box-empty-state');

// Bulk actions elements
const selectModeBtn = document.getElementById('select-mode-btn');
const bulkToolbar = document.getElementById('bulk-toolbar');
const selectedCountEl = document.getElementById('selected-count');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const bulkMoveBox = document.getElementById('bulk-move-box');
const bulkVisibility = document.getElementById('bulk-visibility');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const cancelSelectBtn = document.getElementById('cancel-select-btn');

// Stats modal elements
const viewStatsBtn = document.getElementById('view-stats-btn');
const statsModal = document.getElementById('stats-modal');
const closeStatsBtn = document.getElementById('close-stats');

// Bundle modal elements
const bundleModal = document.getElementById('bundle-modal');
const bundleForm = document.getElementById('bundle-form');
const bundleDetailModal = document.getElementById('bundle-detail-modal');
const bundleCount = document.getElementById('bundle-count');
const bundleImagesPreview = document.getElementById('bundle-images-preview');
const bundleImageFile = document.getElementById('bundle-image-file');
const bundleUploadProgress = document.getElementById('bundle-upload-progress');
const bundleProgressFill = document.getElementById('bundle-progress-fill');
const bundleProgressText = document.getElementById('bundle-progress-text');
const bundleContentsList = document.getElementById('bundle-contents-list');

// Pagination elements
const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const paginationInfo = document.getElementById('pagination-info');

// Current tags for the item being edited
let currentTags = [];

// Bulk selection state
let selectMode = false;
let selectedItems = new Set();

// Category icons for placeholders
const categoryIcons = {
    cards: '🃏',
    figures: '🎭',
    games: '🎮',
    books: '📚',
    vinyl: '💿',
    other: '📦'
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
        
        // Load settings
        itemsPerPage = localStorage.getItem('myshelf-items-per-page') || 'all';
        displayBoxes = localStorage.getItem('myshelf-display-boxes') || 'show';
        displayBundled = localStorage.getItem('myshelf-display-bundled') || 'show';
        
        // Load sort preference
        const savedSort = localStorage.getItem('myshelf-sort') || 'newest';
        sortFilter.value = savedSort;
        
        // Handle avatar
        if (user.photoURL) {
            headerAvatar.src = user.photoURL;
            headerAvatar.style.display = 'block';
            avatarFallback.style.display = 'none';
        } else {
            headerAvatar.style.display = 'none';
            avatarFallback.style.display = 'flex';
        }
        
        loadBoxes();
        loadBundles();
        loadCollection();
        loadNotifications();
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

// Handle item image file selection (multiple)
itemImageFile.addEventListener('change', (e) => {
    handleItemImageSelection(e.target.files);
});

function handleItemImageSelection(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    
    Array.from(files).forEach(file => {
        if (!validTypes.includes(file.type)) {
            alert(`${file.name}: Invalid file type. Please use JPEG, PNG, GIF, WebP, or AVIF`);
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            alert(`${file.name}: File size must be less than 10MB`);
            return;
        }
        
        // Add to selected files
        selectedItemFiles.push(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            itemImages.push({ url: e.target.result, isNew: true, file: file });
            renderItemImagesPreview();
        };
        reader.readAsDataURL(file);
    });
    
    // Clear the input for re-selection
    itemImageFile.value = '';
}

// Render item images preview
function renderItemImagesPreview() {
    itemImagesPreview.innerHTML = itemImages.map((img, idx) => `
        <div class="item-image-item ${idx === 0 ? 'primary' : ''}" data-index="${idx}">
            <img src="${img.url}" alt="Image ${idx + 1}">
            <button type="button" class="remove-image" onclick="removeItemImage(${idx})">&times;</button>
        </div>
    `).join('');
    
    // Update upload text
    itemUploadText.textContent = itemImages.length > 0 ? `${itemImages.length} image(s)` : 'Add Images';
}

// Remove item image
function removeItemImage(index) {
    const removed = itemImages.splice(index, 1)[0];
    
    // Also remove from selectedItemFiles if it's a new file
    if (removed.isNew && removed.file) {
        const fileIdx = selectedItemFiles.indexOf(removed.file);
        if (fileIdx > -1) {
            selectedItemFiles.splice(fileIdx, 1);
        }
    }
    
    renderItemImagesPreview();
}

// Tags handling
itemTagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(itemTagsInput.value.trim());
        itemTagsInput.value = '';
        renderTagOptions(); // Update available tags
    }
});

itemTagsInput.addEventListener('blur', () => {
    if (itemTagsInput.value.trim()) {
        addTag(itemTagsInput.value.trim());
        itemTagsInput.value = '';
        renderTagOptions(); // Update available tags
    }
});

function addTag(tag) {
    if (!tag || currentTags.includes(tag.toLowerCase())) return;
    
    currentTags.push(tag.toLowerCase());
    renderTags();
}

function removeTag(tag) {
    currentTags = currentTags.filter(t => t !== tag);
    renderTags();
    renderTagOptions(); // Update available tags
}

function renderTags() {
    tagsContainer.innerHTML = currentTags.map(tag => `
        <span class="tag">
            ${tag}
            <button type="button" class="tag-remove" onclick="removeTagHandler('${tag}')">&times;</button>
        </span>
    `).join('');
}

window.removeTagHandler = function(tag) {
    removeTag(tag);
};

function clearTags() {
    currentTags = [];
    tagsContainer.innerHTML = '';
    renderTagOptions(); // Update available tags
}

// Generate custom filename for items
function generateItemFilename(file) {
    const username = (currentUser.displayName || currentUser.email.split('@')[0])
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
    const timestamp = Date.now();
    const extension = file.name.split('.').pop().toLowerCase();
    
    return `${username}_item_${timestamp}.${extension}`;
}

// Upload item image to Cloudinary
async function uploadItemImage(file) {
    const filename = generateItemFilename(file);
    const publicId = filename.replace(/\.[^/.]+$/, '');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('public_id', publicId);
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                itemProgressFill.style.width = `${percent}%`;
                itemProgressText.textContent = `Uploading... ${percent}%`;
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

// Load boxes from Firestore
function loadBoxes() {
    const q = query(
        collection(db, 'boxes'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );
    
    unsubscribeBoxes = onSnapshot(q, (snapshot) => {
        boxesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateBoxCount();
        updateBoxDropdown();
        renderAll();
        
        // Update box contents modal if open
        if (currentOpenBoxId) {
            const box = boxesData.find(b => b.id === currentOpenBoxId);
            if (box) {
                renderBoxContents(box);
            }
        }
    }, (error) => {
        console.error('Error loading boxes:', error);
        if (error.code === 'failed-precondition') {
            alert('Setting up database indexes for boxes. This may take a few minutes. Please refresh the page shortly.');
        }
    });
}

// Load bundles from Firestore
function loadBundles() {
    const q = query(
        collection(db, 'bundles'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );
    
    unsubscribeBundles = onSnapshot(q, (snapshot) => {
        bundlesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateBundleCount();
        renderAll();
    }, (error) => {
        console.error('Error loading bundles:', error);
        if (error.code === 'failed-precondition') {
            alert('Setting up database indexes for bundles. This may take a few minutes. Please refresh the page shortly.');
        }
    });
}

// Update bundle count display
function updateBundleCount() {
    const count = bundlesData.length;
    bundleCount.textContent = `${count} bundle${count !== 1 ? 's' : ''}`;
}

// Load collection from Firestore
function loadCollection() {
    loadingState.style.display = 'flex';
    collectionGrid.style.display = 'none';
    emptyState.classList.remove('visible');
    
    const q = query(
        collection(db, 'items'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );
    
    unsubscribeItems = onSnapshot(q, (snapshot) => {
        collectionData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        loadingState.style.display = 'none';
        updateItemCount();
        updateCategoryFilter();
        updateSavedCategories();
        updateSavedTags();
        renderAll();
        
        // Update box contents modal if open
        if (currentOpenBoxId) {
            const box = boxesData.find(b => b.id === currentOpenBoxId);
            if (box) {
                renderBoxContents(box);
            }
        }
    }, (error) => {
        console.error('Error loading collection:', error);
        loadingState.style.display = 'none';
        
        if (error.code === 'failed-precondition') {
            alert('Setting up database indexes. Please wait a moment and refresh the page.');
        }
    });
}

// Update item count display
function updateItemCount() {
    const count = collectionData.length;
    itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
}

// Update box count display
function updateBoxCount() {
    const count = boxesData.length;
    boxCount.textContent = `${count} box${count !== 1 ? 'es' : ''}`;
}

// Update box dropdown in item form
function updateBoxDropdown() {
    const currentValue = itemBox.value;
    itemBox.innerHTML = '<option value="">No box (loose on shelf)</option>';
    
    boxesData.forEach(box => {
        const option = document.createElement('option');
        option.value = box.id;
        option.textContent = box.name;
        itemBox.appendChild(option);
    });
    
    if (currentValue) {
        itemBox.value = currentValue;
    }
}

// Saved categories and tags
let savedCategories = [];
let savedTags = [];

// Update saved categories from user's items
function updateSavedCategories() {
    const defaultCategories = ['Cards', 'Figures', 'Games', 'Books', 'Vinyl', 'Comics', 'Movies', 'Music', 'Clothing', 'Art', 'Other'];
    
    // Get unique categories from user's items
    const userCategories = [...new Set(collectionData.map(item => item.category).filter(Boolean))];
    
    // Combine default and user categories, removing duplicates (case-insensitive)
    savedCategories = [...defaultCategories];
    userCategories.forEach(cat => {
        if (!savedCategories.some(c => c.toLowerCase() === cat.toLowerCase())) {
            savedCategories.push(cat);
        }
    });
    
    // Sort alphabetically
    savedCategories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // Update dropdown options
    renderCategoryOptions();
}

// Update saved tags from user's items
function updateSavedTags() {
    // Get all unique tags from user's items
    const allTags = collectionData.flatMap(item => item.tags || []);
    savedTags = [...new Set(allTags)].filter(Boolean);
    
    // Sort alphabetically
    savedTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // Update dropdown options
    renderTagOptions();
}

// Render category dropdown options
function renderCategoryOptions() {
    const container = document.getElementById('category-options');
    if (savedCategories.length === 0) {
        container.innerHTML = '<span class="quick-select-empty">No categories yet</span>';
        return;
    }
    
    container.innerHTML = savedCategories.map(cat => 
        `<button type="button" class="quick-select-option" data-value="${cat}">${cat}</button>`
    ).join('');
    
    // Add click handlers
    container.querySelectorAll('.quick-select-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('item-category').value = btn.dataset.value;
            document.getElementById('category-dropdown').classList.remove('active');
        });
    });
}

// Render tag dropdown options
function renderTagOptions() {
    const container = document.getElementById('tags-options');
    
    // Filter out tags already added
    const availableTags = savedTags.filter(tag => !currentTags.includes(tag));
    
    if (availableTags.length === 0) {
        container.innerHTML = '<span class="quick-select-empty">No saved tags available</span>';
        return;
    }
    
    container.innerHTML = availableTags.map(tag => 
        `<button type="button" class="quick-select-option" data-value="${tag}">${tag}</button>`
    ).join('');
    
    // Add click handlers
    container.querySelectorAll('.quick-select-option').forEach(btn => {
        btn.addEventListener('click', () => {
            addTag(btn.dataset.value);
            renderTagOptions(); // Refresh to remove added tag
        });
    });
}

// Render all (boxes + loose items based on view filter)
function renderAll() {
    const viewMode = viewFilter.value;
    const filteredItems = getFilteredCollection();
    
    collectionGrid.innerHTML = '';
    
    // Determine which items to show based on displayBoxes setting
    let looseItems;
    let boxedItems;
    
    // Get all items linked to bundles
    const bundledItemIds = new Set();
    if (displayBundled === 'hide') {
        bundlesData.forEach(bundle => {
            if (bundle.linkedItems) {
                bundle.linkedItems.forEach(itemId => bundledItemIds.add(itemId));
            }
        });
    }
    
    if (displayBoxes === 'show') {
        // Normal: loose items are items without a box
        looseItems = filteredItems.filter(item => !item.boxId);
        boxedItems = filteredItems.filter(item => item.boxId);
    } else if (displayBoxes === 'items-only') {
        // Show all items as loose (ignore boxId)
        looseItems = filteredItems;
        boxedItems = [];
    } else {
        // hide-all: only show items without a box
        looseItems = filteredItems.filter(item => !item.boxId);
        boxedItems = [];
    }
    
    // Filter out bundled items if setting is 'hide'
    if (displayBundled === 'hide') {
        looseItems = looseItems.filter(item => !bundledItemIds.has(item.id));
    }
    
    const boxedItemIds = new Set(boxedItems.map(item => item.boxId));
    
    // Build list of all renderable elements
    let allElements = [];
    
    // Add boxes (if not in "loose only" mode and displayBoxes is 'show')
    if (viewMode !== 'loose' && displayBoxes === 'show') {
        // Sort boxes using similar criteria
        const sortBy = sortFilter.value;
        const sortedBoxes = [...boxesData].sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
                case 'oldest':
                    return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
                case 'name-asc':
                case 'category':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'year-desc':
                case 'year-asc':
                    return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
                default:
                    return 0;
            }
        });
        
        sortedBoxes.forEach(box => {
            const boxMatchesSearch = matchesBoxSearch(box);
            const boxHasMatchingItems = boxedItemIds.has(box.id);
            
            if (boxMatchesSearch || boxHasMatchingItems || !searchInput.value.trim()) {
                allElements.push({ type: 'box', data: box });
            }
        });
    }
    
    // Add bundles (if showing all or bundles only)
    if (viewMode === 'all' || viewMode === 'bundles') {
        const sortBy = sortFilter.value;
        const filteredBundles = getFilteredBundles();
        const sortedBundles = [...filteredBundles].sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
                case 'oldest':
                    return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'year-desc':
                    return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
                case 'year-asc':
                    return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
                case 'category':
                    return (a.category || '').localeCompare(b.category || '');
                default:
                    return 0;
            }
        });
        
        sortedBundles.forEach(bundle => {
            allElements.push({ type: 'bundle', data: bundle });
        });
    }
    
    // Add loose items (if not in "boxes only" or "bundles only" mode)
    if (viewMode !== 'boxes' && viewMode !== 'bundles') {
        looseItems.forEach(item => {
            allElements.push({ type: 'item', data: item });
        });
    }
    
    // Calculate pagination
    const perPage = itemsPerPage === 'all' ? allElements.length : parseInt(itemsPerPage);
    const totalPages = Math.max(1, Math.ceil(allElements.length / perPage));
    
    // Ensure current page is valid
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    // Get paginated elements
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedElements = allElements.slice(startIndex, endIndex);
    
    // Render paginated elements
    paginatedElements.forEach(element => {
        if (element.type === 'box') {
            const boxCard = createBoxCard(element.data);
            collectionGrid.appendChild(boxCard);
        } else if (element.type === 'bundle') {
            const bundleCard = createBundleCard(element.data);
            collectionGrid.appendChild(bundleCard);
        } else {
            const card = createItemCard(element.data);
            collectionGrid.appendChild(card);
        }
    });
    
    // Update pagination UI
    updatePagination(totalPages, allElements.length);
    
    // Handle empty states
    if (allElements.length === 0) {
        collectionGrid.style.display = 'none';
        pagination.style.display = 'none';
        if (collectionData.length === 0 && boxesData.length === 0 && bundlesData.length === 0) {
            emptyState.classList.add('visible');
        } else {
            emptyState.classList.remove('visible');
            collectionGrid.innerHTML = '<p class="no-results">No items match your filters.</p>';
            collectionGrid.style.display = 'block';
        }
    } else {
        collectionGrid.style.display = 'grid';
        emptyState.classList.remove('visible');
    }
}

// Update pagination UI
function updatePagination(totalPages, totalItems) {
    if (itemsPerPage === 'all' || totalItems <= parseInt(itemsPerPage)) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// Check if box matches search term
function matchesBoxSearch(box) {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) return true;
    
    return box.name.toLowerCase().includes(searchTerm) ||
           (box.description && box.description.toLowerCase().includes(searchTerm));
}

// Get items in a box
function getBoxItems(boxId) {
    return collectionData.filter(item => item.boxId === boxId);
}

// Update category filter with user's categories
function updateCategoryFilter() {
    const currentValue = categoryFilter.value;
    const categories = new Set();
    
    collectionData.forEach(item => {
        if (item.category) {
            categories.add(item.category);
        }
    });
    
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    
    const sortedCategories = Array.from(categories).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    
    if (currentValue && Array.from(categoryFilter.options).some(opt => opt.value === currentValue)) {
        categoryFilter.value = currentValue;
    }
}

// Create box card with collage preview
function createBoxCard(box) {
    const card = document.createElement('div');
    card.className = 'box-card';
    card.dataset.id = box.id;
    
    const items = getBoxItems(box.id);
    const itemCount = items.length;
    
    // Create preview HTML based on item count
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
            <div class="box-preview items-${itemCount >= 3 ? 'more' : '3'}">
                ${createPreviewItem(items[0])}
                ${createPreviewItem(items[1])}
                ${createPreviewItem(items[2], extraCount > 0 ? extraCount : 0)}
            </div>
        `;
    }
    
    const boxVisibilityBadge = box.visibility === 'public' ? '<span class="visibility-badge visibility-public">Public</span>' : '';
    
    card.innerHTML = `
        ${previewHtml}
        <div class="box-info">
            <div class="box-header">
                <h3 class="box-name">${box.name}</h3>
                ${boxVisibilityBadge}
            </div>
            <span class="box-item-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
            ${box.description ? `<p class="box-description">${box.description}</p>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => openBoxContents(box));
    
    return card;
}

// Create preview item for box collage
function createPreviewItem(item, overlayCount = 0) {
    const categoryIcon = getCategoryIcon(item.category);
    
    if (item.image) {
        return `
            <div class="box-preview-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.parentElement.classList.add('placeholder'); this.outerHTML='${categoryIcon}';">
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

// Origin display labels
const originLabels = {
    'official': 'Official',
    'fan-made': 'Fan-made',
    'custom-commissioned': 'Commissioned',
    'custom-self-made': 'Self-made'
};

// Get category icon (handles both preset and custom categories)
function getCategoryIcon(category) {
    const normalizedCategory = category ? category.toLowerCase() : 'other';
    return categoryIcons[normalizedCategory] || '📦';
}

// Create item card element
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.id = item.id;
    
    // Add selectable class and selected state if in select mode
    if (selectMode) {
        card.classList.add('selectable');
        if (selectedItems.has(item.id)) {
            card.classList.add('selected');
        }
    }
    
    const categoryIcon = getCategoryIcon(item.category);
    
    // Use first image from images array, fall back to legacy image field
    const primaryImage = (item.images && item.images.length > 0) ? item.images[0] : item.image;
    const hasMultipleImages = item.images && item.images.length > 1;
    
    const imageHtml = primaryImage 
        ? `<img src="${primaryImage}" alt="${item.name}" class="item-image" onerror="this.outerHTML='<div class=\\'item-placeholder\\'>${categoryIcon}</div>'">${hasMultipleImages ? '<span class="multi-image-badge">+' + (item.images.length - 1) + '</span>' : ''}`
        : `<div class="item-placeholder">${categoryIcon}</div>`;
    
    const conditionClass = item.condition ? `condition-${item.condition}` : '';
    const conditionText = item.condition ? item.condition.replace('-', ' ') : '';
    
    const originBadge = item.origin ? `<span class="origin-badge origin-${item.origin}">${originLabels[item.origin] || item.origin}</span>` : '';
    
    const visibilityBadge = item.visibility === 'public' ? '<span class="visibility-badge visibility-public">Public</span>' : '';
    
    const tagsHtml = item.tags && item.tags.length > 0 
        ? `<div class="item-tags">${item.tags.slice(0, 3).map(tag => `<span class="item-tag">${tag}</span>`).join('')}${item.tags.length > 3 ? `<span class="item-tag item-tag-more">+${item.tags.length - 3}</span>` : ''}</div>`
        : '';
    
    const checkboxHtml = `<div class="select-checkbox">${selectedItems.has(item.id) ? '✓' : ''}</div>`;
    
    card.innerHTML = `
        ${checkboxHtml}
        ${imageHtml}
        <div class="item-info">
            <div class="item-header">
                <span class="item-category">${item.category}</span>
                ${visibilityBadge}
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
    
    card.addEventListener('click', (e) => {
        if (selectMode) {
            e.preventDefault();
            toggleItemSelection(item.id);
        } else {
            showItemDetail(item);
        }
    });
    
    return card;
}

// Show item detail modal
function showItemDetail(item) {
    const detailContent = document.getElementById('detail-content');
    
    const categoryIcon = getCategoryIcon(item.category);
    
    // Handle multiple images
    const images = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
    
    let imageHtml;
    if (images.length > 1) {
        // Multiple images - show gallery
        imageHtml = `
            <div class="item-detail-gallery">
                <div class="item-detail-main-image">
                    <img src="${images[0]}" alt="${item.name}" id="item-detail-main-img" onerror="this.outerHTML='<div class=\\'detail-placeholder\\'>${categoryIcon}</div>'">
                </div>
                <div class="item-detail-thumbnails">
                    ${images.map((img, idx) => `
                        <div class="item-detail-thumb ${idx === 0 ? 'active' : ''}" onclick="switchItemDetailImage('${img}', this)">
                            <img src="${img}" alt="Thumbnail ${idx + 1}">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (images.length === 1) {
        // Single image
        imageHtml = `<img src="${images[0]}" alt="${item.name}" class="detail-image" onerror="this.outerHTML='<div class=\\'detail-placeholder\\'>${categoryIcon}</div>'">`;
    } else {
        // No images
        imageHtml = `<div class="detail-placeholder">${categoryIcon}</div>`;
    }
    
    const conditionClass = item.condition ? `condition-${item.condition}` : '';
    const conditionText = item.condition ? item.condition.replace('-', ' ').charAt(0).toUpperCase() + item.condition.replace('-', ' ').slice(1) : 'N/A';
    
    const originText = item.origin ? originLabels[item.origin] || item.origin : 'N/A';
    const originClass = item.origin ? `origin-${item.origin}` : '';
    
    // Get box info
    const box = item.boxId ? boxesData.find(b => b.id === item.boxId) : null;
    const boxText = box ? box.name : 'Loose on shelf';
    
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
                <div class="meta-item">
                    <div class="meta-label">Box</div>
                    <div class="meta-value">${boxText}</div>
                </div>
            </div>
            ${tagsHtml}
            <div class="detail-actions">
                <button class="btn btn-primary" onclick="editItem('${item.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
            </div>
        </div>
    `;
    
    detailModal.classList.add('active');
}

// Switch item detail gallery image
window.switchItemDetailImage = function(imgUrl, thumbEl) {
    const mainImg = document.getElementById('item-detail-main-img');
    if (mainImg) {
        mainImg.src = imgUrl;
    }
    
    // Update active thumbnail
    document.querySelectorAll('.item-detail-thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
}

// Open add item modal
function openAddModal(preselectedBoxId = null, forBundle = false) {
    // Track if creating for bundle
    creatingItemForBundle = forBundle;
    
    document.getElementById('modal-title').textContent = forBundle ? 'Add Item to Bundle' : 'Add New Item';
    document.getElementById('item-id').value = '';
    itemForm.reset();
    
    // Set preselected box if provided
    if (preselectedBoxId) {
        itemBox.value = preselectedBoxId;
    }
    
    // Reset images state
    itemImages = [];
    selectedItemFiles = [];
    renderItemImagesPreview();
    itemUploadProgress.style.display = 'none';
    itemProgressFill.style.width = '0%';
    
    // Reset tags
    clearTags();
    
    // Reset category selection
    document.getElementById('item-category').value = '';
    document.getElementById('category-dropdown').classList.remove('active');
    document.getElementById('tags-dropdown').classList.remove('active');
    
    itemModal.classList.add('active');
}

// Edit item
window.editItem = function(id) {
    const item = collectionData.find(i => i.id === id);
    if (!item) return;
    
    detailModal.classList.remove('active');
    boxContentsModal.classList.remove('active');
    
    document.getElementById('modal-title').textContent = 'Edit Item';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-category').value = item.category || '';
    document.getElementById('item-box').value = item.boxId || '';
    document.getElementById('item-visibility').value = item.visibility || 'private';
    document.getElementById('item-description').value = item.description || '';
    document.getElementById('item-year').value = item.year || '';
    document.getElementById('item-condition').value = item.condition || '';
    document.getElementById('item-origin').value = item.origin || '';
    
    // Close any open dropdowns
    document.getElementById('category-dropdown').classList.remove('active');
    document.getElementById('tags-dropdown').classList.remove('active');
    
    // Load tags
    currentTags = item.tags ? [...item.tags] : [];
    renderTags();
    
    // Reset file upload state and load existing images
    selectedItemFiles = [];
    itemUploadProgress.style.display = 'none';
    itemProgressFill.style.width = '0%';
    
    // Load existing images (support both old single image and new multiple images)
    if (item.images && item.images.length > 0) {
        itemImages = item.images.map(url => ({ url, isNew: false }));
    } else if (item.image) {
        itemImages = [{ url: item.image, isNew: false }];
    } else {
        itemImages = [];
    }
    renderItemImagesPreview();
    
    itemModal.classList.add('active');
}

// Delete item
window.deleteItem = async function(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
        await deleteDoc(doc(db, 'items', id));
        detailModal.classList.remove('active');
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
    }
}

// Close modals
function closeModals() {
    itemModal.classList.remove('active');
    detailModal.classList.remove('active');
    boxModal.classList.remove('active');
    boxContentsModal.classList.remove('active');
    currentOpenBoxId = null;
    creatingItemForBundle = false;
    
    // Hide quick box form if open
    const quickBoxForm = document.getElementById('quick-box-form');
    if (quickBoxForm) {
        quickBoxForm.style.display = 'none';
    }
    
    // Close dropdowns
    document.getElementById('category-dropdown')?.classList.remove('active');
    document.getElementById('tags-dropdown')?.classList.remove('active');
}

// Close only the item detail modal (e.g. when opened from inside box contents)
function closeDetailModal() {
    detailModal.classList.remove('active');
}

// Close box contents (and item detail if open, since it was opened from the box)
function closeBoxContentsModal() {
    detailModal.classList.remove('active');
    boxContentsModal.classList.remove('active');
    currentOpenBoxId = null;
}

// Close the topmost open modal (for Escape and consistent UX)
function closeTopmostModal() {
    if (bundleDetailModal.style.display === 'flex') {
        closeBundleDetailModal();
        return;
    }
    if (bundleModal.style.display === 'flex') {
        closeBundleModal();
        return;
    }
    if (statsModal.style.display === 'flex') {
        closeStatsModal();
        return;
    }
    if (detailModal.classList.contains('active')) {
        closeDetailModal();
        return;
    }
    if (boxContentsModal.classList.contains('active')) {
        closeBoxContentsModal();
        return;
    }
    if (boxModal.classList.contains('active') || itemModal.classList.contains('active')) {
        closeModals();
    }
}

// Open box contents modal
function openBoxContents(box) {
    currentOpenBoxId = box.id;
    document.getElementById('box-contents-title').textContent = box.name;
    document.getElementById('box-contents-description').textContent = box.description || '';
    
    renderBoxContents(box);
    boxContentsModal.classList.add('active');
}

// Render box contents
function renderBoxContents(box) {
    const items = getBoxItems(box.id);
    boxContentsGrid.innerHTML = '';
    
    if (items.length === 0) {
        boxContentsGrid.style.display = 'none';
        boxEmptyState.classList.add('visible');
    } else {
        boxContentsGrid.style.display = 'grid';
        boxEmptyState.classList.remove('visible');
        
        items.forEach(item => {
            const card = createItemCard(item);
            boxContentsGrid.appendChild(card);
        });
    }
}

// Open add box modal
function openAddBoxModal() {
    document.getElementById('box-modal-title').textContent = 'Create New Box';
    document.getElementById('box-id').value = '';
    boxForm.reset();
    boxModal.classList.add('active');
}

// Edit box
function editBox() {
    const box = boxesData.find(b => b.id === currentOpenBoxId);
    if (!box) return;
    
    boxContentsModal.classList.remove('active');
    
    document.getElementById('box-modal-title').textContent = 'Edit Box';
    document.getElementById('box-id').value = box.id;
    document.getElementById('box-name').value = box.name;
    document.getElementById('box-description').value = box.description || '';
    document.getElementById('box-visibility').value = box.visibility || 'private';
    
    boxModal.classList.add('active');
}

// Delete box
async function deleteBox() {
    if (!currentOpenBoxId) return;
    
    const items = getBoxItems(currentOpenBoxId);
    const message = items.length > 0 
        ? `This box contains ${items.length} item(s). They will be moved to loose items on your shelf. Delete this box?`
        : 'Are you sure you want to delete this empty box?';
    
    if (!confirm(message)) return;
    
    try {
        // Move items out of the box
        if (items.length > 0) {
            const batch = writeBatch(db);
            items.forEach(item => {
                const itemRef = doc(db, 'items', item.id);
                batch.update(itemRef, { boxId: null });
            });
            await batch.commit();
        }
        
        // Delete the box
        await deleteDoc(doc(db, 'boxes', currentOpenBoxId));
        closeModals();
    } catch (error) {
        console.error('Error deleting box:', error);
        alert('Failed to delete box. Please try again.');
    }
}

// Handle box form submission
async function handleBoxFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('box-id').value;
    const submitBtn = boxForm.querySelector('button[type="submit"]');
    
    const boxData = {
        name: document.getElementById('box-name').value.trim(),
        description: document.getElementById('box-description').value.trim(),
        visibility: document.getElementById('box-visibility').value || 'private',
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    try {
        if (id) {
            await updateDoc(doc(db, 'boxes', id), boxData);
        } else {
            boxData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'boxes'), boxData);
        }
        
        closeModals();
    } catch (error) {
        console.error('Error saving box:', error);
        alert('Failed to save box. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Box';
    }
}

// Add item to current open box
function addItemToBox() {
    boxContentsModal.classList.remove('active');
    openAddModal(currentOpenBoxId);
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate category
    const category = document.getElementById('item-category').value.trim();
    if (!category) {
        alert('Please select a category');
        return;
    }
    
    const id = document.getElementById('item-id').value;
    const submitBtn = itemForm.querySelector('button[type="submit"]');
    
    // Upload any new images
    const newFilesToUpload = selectedItemFiles.filter(f => f);
    if (newFilesToUpload.length > 0) {
        itemUploadProgress.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.textContent = `Uploading (0/${newFilesToUpload.length})...`;
        
        try {
            for (let i = 0; i < newFilesToUpload.length; i++) {
                submitBtn.textContent = `Uploading (${i + 1}/${newFilesToUpload.length})...`;
                const uploadedUrl = await uploadItemImage(newFilesToUpload[i]);
                
                // Find the image in itemImages and update with uploaded URL
                const imgIndex = itemImages.findIndex(img => img.file === newFilesToUpload[i]);
                if (imgIndex > -1) {
                    itemImages[imgIndex] = { url: uploadedUrl, isNew: false };
                }
            }
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            alert('Failed to upload images. Please try again.');
            itemUploadProgress.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Item';
            return;
        }
        
        itemUploadProgress.style.display = 'none';
        submitBtn.textContent = 'Saving...';
    }
    
    // Collect final image URLs
    const finalImages = itemImages.map(img => img.url);
    
    const itemData = {
        name: document.getElementById('item-name').value.trim(),
        category: document.getElementById('item-category').value.trim(),
        boxId: document.getElementById('item-box').value || null,
        visibility: document.getElementById('item-visibility').value || 'private',
        description: document.getElementById('item-description').value.trim(),
        year: document.getElementById('item-year').value ? parseInt(document.getElementById('item-year').value) : null,
        condition: document.getElementById('item-condition').value || null,
        origin: document.getElementById('item-origin').value || null,
        tags: currentTags.length > 0 ? [...currentTags] : null,
        images: finalImages,
        image: finalImages.length > 0 ? finalImages[0] : null,
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (id) {
            await updateDoc(doc(db, 'items', id), itemData);
            closeModals();
        } else {
            itemData.createdAt = new Date().toISOString();
            const docRef = await addDoc(collection(db, 'items'), itemData);
            
            // If creating item for a bundle, add it to linked items
            if (creatingItemForBundle) {
                bundleLinkedItems.push(docRef.id);
                
                // Wait a moment for collectionData to update via onSnapshot
                setTimeout(() => {
                    renderBundleLinkedList();
                }, 500);
                
                // Close only the item modal, keep bundle modal open
                itemModal.classList.remove('active');
                creatingItemForBundle = false;
            } else {
                closeModals();
            }
        }
        
        // Reset state
        itemImages = [];
        selectedItemFiles = [];
        itemProgressFill.style.width = '0%';
        
        // Reset tags
        clearTags();
        
    } catch (error) {
        console.error('Error saving item:', error);
        alert('Failed to save item. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Item';
    }
}

// Filter collection
function getFilteredCollection() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    const sortBy = sortFilter.value;
    
    // Advanced filter values
    const origin = filterOrigin.value;
    const condition = filterCondition.value;
    const yearFrom = filterYearFrom.value ? parseInt(filterYearFrom.value) : null;
    const yearTo = filterYearTo.value ? parseInt(filterYearTo.value) : null;
    const visibility = filterVisibility.value;
    const hasImages = filterHasImages.value;
    const tagsFilter = filterTags.value.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
    
    let filtered = collectionData.filter(item => {
        // Basic search
        const matchesSearch = !searchTerm || 
            item.name.toLowerCase().includes(searchTerm) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
        
        const matchesCategory = category === 'all' || item.category.toLowerCase() === category.toLowerCase();
        
        // Advanced filters
        const matchesOrigin = origin === 'all' || item.origin === origin;
        const matchesCondition = condition === 'all' || item.condition === condition;
        
        const itemYear = item.year ? parseInt(item.year) : null;
        const matchesYearFrom = !yearFrom || (itemYear && itemYear >= yearFrom);
        const matchesYearTo = !yearTo || (itemYear && itemYear <= yearTo);
        
        const matchesVisibility = visibility === 'all' || item.visibility === visibility;
        
        const itemHasImages = (item.images && item.images.length > 0) || item.image;
        const matchesHasImages = hasImages === 'all' || 
            (hasImages === 'yes' && itemHasImages) || 
            (hasImages === 'no' && !itemHasImages);
        
        const matchesTags = tagsFilter.length === 0 || 
            (item.tags && tagsFilter.some(filterTag => 
                item.tags.some(itemTag => itemTag.toLowerCase().includes(filterTag))
            ));
        
        return matchesSearch && matchesCategory && matchesOrigin && matchesCondition && 
               matchesYearFrom && matchesYearTo && matchesVisibility && matchesHasImages && matchesTags;
    });
    
    // Apply sorting
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
            case 'oldest':
                return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'year-desc':
                return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
            case 'year-asc':
                return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
            case 'category':
                return a.category.localeCompare(b.category);
            default:
                return 0;
        }
    });
    
    return filtered;
}

// Filter bundles based on search and category
function getFilteredBundles() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    
    return bundlesData.filter(bundle => {
        const matchesSearch = !searchTerm || 
            bundle.name.toLowerCase().includes(searchTerm) ||
            (bundle.description && bundle.description.toLowerCase().includes(searchTerm)) ||
            (bundle.contents && bundle.contents.some(c => c.name.toLowerCase().includes(searchTerm)));
        
        const matchesCategory = category === 'all' || (bundle.category && bundle.category.toLowerCase() === category.toLowerCase());
        
        return matchesSearch && matchesCategory;
    });
}

// Create bundle card element
function createBundleCard(bundle) {
    const card = document.createElement('div');
    card.className = 'bundle-card';
    card.dataset.id = bundle.id;
    
    const categoryIcon = getCategoryIcon(bundle.category);
    const mainImage = bundle.images && bundle.images.length > 0 ? bundle.images[0] : null;
    
    const imageHtml = mainImage
        ? `<img src="${mainImage}" alt="${bundle.name}" class="bundle-image" onerror="this.outerHTML='<div class=\\'bundle-placeholder\\'>${categoryIcon}</div>'">`
        : `<div class="bundle-placeholder">${categoryIcon}</div>`;
    
    // Count linked items + manual contents
    const linkedCount = bundle.linkedItems ? bundle.linkedItems.length : 0;
    const manualCount = bundle.contents ? bundle.contents.reduce((sum, c) => sum + (c.quantity || 1), 0) : 0;
    const totalCount = linkedCount + manualCount;
    
    const visibilityBadge = bundle.visibility === 'public' ? '<span class="visibility-badge visibility-public">Public</span>' : '';
    
    card.innerHTML = `
        <div class="bundle-card-badge">📦 Bundle</div>
        ${imageHtml}
        <div class="bundle-info">
            <div class="bundle-header">
                <span class="bundle-category">${bundle.category || 'Other'}</span>
                ${visibilityBadge}
            </div>
            <h3 class="bundle-name">${bundle.name}</h3>
            <p class="bundle-contents-count">Contains ${totalCount} item${totalCount !== 1 ? 's' : ''}${linkedCount > 0 ? ` (${linkedCount} linked)` : ''}</p>
            <div class="bundle-meta">
                ${bundle.year ? `<span>📅 ${bundle.year}</span>` : ''}
                ${bundle.images && bundle.images.length > 1 ? `<span>🖼️ ${bundle.images.length} photos</span>` : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => showBundleDetail(bundle));
    
    return card;
}

// Show bundle detail modal
function showBundleDetail(bundle) {
    const detailContent = document.getElementById('bundle-detail-content');
    const categoryIcon = getCategoryIcon(bundle.category);
    
    // Build image gallery HTML
    const mainImage = bundle.images && bundle.images.length > 0 ? bundle.images[0] : null;
    const mainImageHtml = mainImage
        ? `<img src="${mainImage}" alt="${bundle.name}" id="bundle-main-image">`
        : `<div class="bundle-detail-main-placeholder">${categoryIcon}</div>`;
    
    const thumbnailsHtml = bundle.images && bundle.images.length > 1
        ? bundle.images.map((img, idx) => `
            <div class="bundle-detail-thumb ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                <img src="${img}" alt="Image ${idx + 1}">
            </div>
        `).join('')
        : '';
    
    // Build linked items HTML
    let linkedItemsHtml = '';
    if (bundle.linkedItems && bundle.linkedItems.length > 0) {
        const linkedItemCards = bundle.linkedItems.map(itemId => {
            const item = collectionData.find(i => i.id === itemId);
            if (!item) return '';
            
            const itemIcon = item.image 
                ? `<img src="${item.image}" alt="${item.name}">`
                : `<div class="bundle-detail-linked-item-placeholder">${getCategoryIcon(item.category)}</div>`;
            
            return `
                <div class="bundle-detail-linked-item" onclick="showItemDetail(collectionData.find(i => i.id === '${item.id}'))">
                    <div class="bundle-detail-linked-item-image">${itemIcon}</div>
                    <div class="bundle-detail-linked-item-info">
                        <div class="bundle-detail-linked-item-name">${item.name}</div>
                        <div class="bundle-detail-linked-item-category">${item.category}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        linkedItemsHtml = `
            <div class="bundle-detail-linked">
                <h3>🔗 Linked Items (${bundle.linkedItems.length})</h3>
                <div class="bundle-detail-linked-grid">
                    ${linkedItemCards}
                </div>
            </div>
        `;
    }
    
    // Build contents list HTML (manual contents)
    const contentsHtml = bundle.contents && bundle.contents.length > 0
        ? bundle.contents.map(item => `
            <div class="bundle-detail-content-row">
                <span class="bundle-detail-content-qty">${item.quantity || 1}x</span>
                <span class="bundle-detail-content-name">${item.name}</span>
            </div>
        `).join('')
        : '';
    
    const conditionText = bundle.condition ? bundle.condition.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
    const originText = bundle.origin ? originLabels[bundle.origin] || bundle.origin : 'N/A';
    
    // Only show additional contents section if there are manual contents
    const additionalContentsHtml = contentsHtml ? `
        <div class="bundle-detail-contents">
            <h3>📝 Additional Contents</h3>
            <div class="bundle-detail-contents-list">
                ${contentsHtml}
            </div>
        </div>
    ` : '';
    
    detailContent.innerHTML = `
        <div class="bundle-detail-content">
            <div class="bundle-detail-gallery">
                <div class="bundle-detail-main-image">
                    ${mainImageHtml}
                </div>
                ${thumbnailsHtml ? `<div class="bundle-detail-thumbnails">${thumbnailsHtml}</div>` : ''}
            </div>
            <div class="bundle-detail-info">
                <div>
                    <h2>${bundle.name}</h2>
                    ${bundle.description ? `<p class="bundle-detail-description">${bundle.description}</p>` : ''}
                </div>
                
                <div class="bundle-detail-badges">
                    <span class="item-category">${bundle.category || 'Other'}</span>
                    ${bundle.visibility === 'public' ? '<span class="visibility-badge visibility-public">Public</span>' : ''}
                    ${bundle.origin ? `<span class="origin-badge origin-${bundle.origin}">${originText}</span>` : ''}
                </div>
                
                ${linkedItemsHtml}
                
                ${additionalContentsHtml}
                
                <div class="bundle-detail-meta">
                    <div class="bundle-detail-meta-item">
                        <span class="bundle-detail-meta-label">Year</span>
                        <span class="bundle-detail-meta-value">${bundle.year || 'N/A'}</span>
                    </div>
                    <div class="bundle-detail-meta-item">
                        <span class="bundle-detail-meta-label">Condition</span>
                        <span class="bundle-detail-meta-value">${conditionText}</span>
                    </div>
                </div>
                
                <div class="bundle-detail-actions">
                    <button class="btn btn-secondary" onclick="editBundle('${bundle.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteBundle('${bundle.id}')">Delete</button>
                </div>
            </div>
        </div>
    `;
    
    // Add thumbnail click handlers
    const thumbnails = detailContent.querySelectorAll('.bundle-detail-thumb');
    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            const idx = parseInt(thumb.dataset.index);
            const mainImg = document.getElementById('bundle-main-image');
            if (mainImg && bundle.images[idx]) {
                mainImg.src = bundle.images[idx];
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            }
        });
    });
    
    bundleDetailModal.style.display = 'flex';
}

// Close bundle detail modal
function closeBundleDetailModal() {
    bundleDetailModal.style.display = 'none';
}

// Open add bundle modal
function openAddBundleModal() {
    document.getElementById('bundle-modal-title').textContent = 'Create New Bundle';
    bundleForm.reset();
    document.getElementById('bundle-id').value = '';
    bundleImages = [];
    bundleContents = [];
    bundleLinkedItems = [];
    selectedBundleFiles = [];
    renderBundleImagesPreview();
    renderBundleContentsList();
    renderBundleLinkedList();
    
    // Clear search input
    const searchInput = document.getElementById('link-item-search');
    if (searchInput) searchInput.value = '';
    
    bundleModal.style.display = 'flex';
}

// Render bundle images preview
function renderBundleImagesPreview() {
    bundleImagesPreview.innerHTML = bundleImages.map((img, idx) => `
        <div class="bundle-image-item ${idx === 0 ? 'primary' : ''}" data-index="${idx}">
            <img src="${img}" alt="Image ${idx + 1}">
            <button type="button" class="remove-image" onclick="removeBundleImage(${idx})">&times;</button>
        </div>
    `).join('');
}

// Remove bundle image
function removeBundleImage(index) {
    bundleImages.splice(index, 1);
    renderBundleImagesPreview();
}

// Render bundle contents list
function renderBundleContentsList() {
    bundleContentsList.innerHTML = bundleContents.length > 0
        ? bundleContents.map((item, idx) => `
            <div class="bundle-content-item" data-index="${idx}">
                <div class="bundle-content-item-info">
                    <span class="bundle-content-item-qty">${item.quantity}x</span>
                    <span class="bundle-content-item-name">${item.name}</span>
                </div>
                <button type="button" class="remove-content" onclick="removeBundleContent(${idx})">&times;</button>
            </div>
        `).join('')
        : '<p class="stats-empty">No contents added yet</p>';
}

// Add bundle content item
function addBundleContent() {
    const nameInput = document.getElementById('content-item-name');
    const qtyInput = document.getElementById('content-item-qty');
    
    const name = nameInput.value.trim();
    const quantity = parseInt(qtyInput.value) || 1;
    
    if (!name) {
        alert('Please enter an item name');
        return;
    }
    
    bundleContents.push({ name, quantity });
    renderBundleContentsList();
    
    nameInput.value = '';
    qtyInput.value = '1';
    nameInput.focus();
}

// Remove bundle content item
function removeBundleContent(index) {
    bundleContents.splice(index, 1);
    renderBundleContentsList();
}

// Render bundle linked items list
function renderBundleLinkedList() {
    const container = document.getElementById('bundle-linked-list');
    
    if (bundleLinkedItems.length === 0) {
        container.innerHTML = '<div class="bundle-linked-empty">No items linked yet</div>';
        return;
    }
    
    container.innerHTML = bundleLinkedItems.map((itemId, idx) => {
        const item = collectionData.find(i => i.id === itemId);
        if (!item) return '';
        
        const icon = item.image 
            ? `<img src="${item.image}" alt="${item.name}">`
            : `<div class="bundle-linked-item-placeholder">${getCategoryIcon(item.category)}</div>`;
        
        return `
            <div class="bundle-linked-item" data-index="${idx}">
                <div class="bundle-linked-item-image">${icon}</div>
                <div class="bundle-linked-item-info">
                    <div class="bundle-linked-item-name">${item.name}</div>
                    <div class="bundle-linked-item-meta">${item.category}${item.year ? ` • ${item.year}` : ''}</div>
                </div>
                <button type="button" class="remove-linked" onclick="removeBundleLinkedItem(${idx})">&times;</button>
            </div>
        `;
    }).join('');
}

// Update the link item selector dropdown
// Get available items for linking (not already linked)
function getAvailableItemsForLinking() {
    return collectionData.filter(item => !bundleLinkedItems.includes(item.id));
}

// Render search results for item linking
function renderLinkItemResults(searchTerm = '') {
    const resultsContainer = document.getElementById('link-item-results');
    const dropdown = document.getElementById('link-item-dropdown');
    const availableItems = getAvailableItemsForLinking();
    
    if (searchTerm.length === 0) {
        // Show hint when empty
        resultsContainer.innerHTML = '<div class="item-search-hint">Type to search your collection...</div>';
        return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const filtered = availableItems.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.category && item.category.toLowerCase().includes(searchLower)) ||
        (item.description && item.description.toLowerCase().includes(searchLower)) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)))
    );
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div class="item-search-empty">No matching items found</div>';
        return;
    }
    
    resultsContainer.innerHTML = filtered.slice(0, 20).map(item => {
        const icon = item.image 
            ? `<img src="${item.image}" alt="${item.name}">`
            : `<div class="item-search-result-placeholder">${getCategoryIcon(item.category)}</div>`;
        
        return `
            <div class="item-search-result" data-item-id="${item.id}">
                <div class="item-search-result-image">${icon}</div>
                <div class="item-search-result-info">
                    <div class="item-search-result-name">${item.name}</div>
                    <div class="item-search-result-meta">${item.category}${item.year ? ` • ${item.year}` : ''}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers to results
    resultsContainer.querySelectorAll('.item-search-result').forEach(result => {
        result.addEventListener('click', () => {
            const itemId = result.dataset.itemId;
            addLinkedItemById(itemId);
        });
    });
}

// Add linked item by ID
function addLinkedItemById(itemId) {
    if (!bundleLinkedItems.includes(itemId)) {
        bundleLinkedItems.push(itemId);
        renderBundleLinkedList();
    }
    
    // Clear search and close dropdown
    const searchInput = document.getElementById('link-item-search');
    const dropdown = document.getElementById('link-item-dropdown');
    searchInput.value = '';
    dropdown.classList.remove('active');
}

// Initialize item search dropdown
function initItemSearchDropdown() {
    const searchInput = document.getElementById('link-item-search');
    const dropdown = document.getElementById('link-item-dropdown');
    
    // Show dropdown and render results on focus
    searchInput.addEventListener('focus', () => {
        dropdown.classList.add('active');
        renderLinkItemResults(searchInput.value);
    });
    
    // Filter results on input
    searchInput.addEventListener('input', () => {
        renderLinkItemResults(searchInput.value);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.item-search-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
}

// Legacy function name for compatibility
function updateLinkItemSelector() {
    // No longer needed with search-based approach
}

// Remove linked item
function removeBundleLinkedItem(index) {
    bundleLinkedItems.splice(index, 1);
    renderBundleLinkedList();
    updateLinkItemSelector();
}

// Make removeBundleLinkedItem available globally
window.removeBundleLinkedItem = removeBundleLinkedItem;

// Upload bundle image to Cloudinary
async function uploadBundleImage(file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `bundle_${currentUser.uid}_${timestamp}_${randomStr}`;
        formData.append('public_id', `myshelf/bundle-images/${fileName}`);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                bundleProgressFill.style.width = percent + '%';
                bundleProgressText.textContent = percent + '%';
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
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
        xhr.send(formData);
    });
}

// Handle bundle image file selection
async function handleBundleImageSelection(files) {
    if (files.length === 0) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    
    bundleUploadProgress.style.display = 'flex';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!validTypes.includes(file.type)) {
            alert(`${file.name} is not a valid image type`);
            continue;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            alert(`${file.name} is too large (max 10MB)`);
            continue;
        }
        
        try {
            bundleProgressText.textContent = `Uploading ${i + 1}/${files.length}...`;
            const url = await uploadBundleImage(file);
            bundleImages.push(url);
            renderBundleImagesPreview();
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(`Failed to upload ${file.name}`);
        }
    }
    
    bundleUploadProgress.style.display = 'none';
    bundleImageFile.value = '';
}

// Save bundle to Firestore
async function saveBundle(e) {
    e.preventDefault();
    
    const bundleId = document.getElementById('bundle-id').value;
    const name = document.getElementById('bundle-name').value.trim();
    const description = document.getElementById('bundle-description').value.trim();
    const year = document.getElementById('bundle-year').value;
    const category = document.getElementById('bundle-category').value;
    const condition = document.getElementById('bundle-condition').value;
    const origin = document.getElementById('bundle-origin').value;
    const visibility = document.getElementById('bundle-visibility').value;
    
    if (!name) {
        alert('Please enter a bundle name');
        return;
    }
    
    const bundleData = {
        name,
        description,
        year: year || null,
        category,
        condition: condition || null,
        origin: origin || null,
        visibility,
        images: bundleImages,
        contents: bundleContents,
        linkedItems: bundleLinkedItems,
        userId: currentUser.uid,
        updatedAt: new Date()
    };
    
    try {
        if (bundleId) {
            // Update existing bundle
            await updateDoc(doc(db, 'bundles', bundleId), bundleData);
        } else {
            // Create new bundle
            bundleData.createdAt = new Date();
            await addDoc(collection(db, 'bundles'), bundleData);
        }
        
        closeBundleModal();
    } catch (error) {
        console.error('Error saving bundle:', error);
        alert('Failed to save bundle. Please try again.');
    }
}

// Edit bundle
window.editBundle = async function(bundleId) {
    const bundle = bundlesData.find(b => b.id === bundleId);
    if (!bundle) return;
    
    closeBundleDetailModal();
    
    document.getElementById('bundle-modal-title').textContent = 'Edit Bundle';
    document.getElementById('bundle-id').value = bundleId;
    document.getElementById('bundle-name').value = bundle.name || '';
    document.getElementById('bundle-description').value = bundle.description || '';
    document.getElementById('bundle-year').value = bundle.year || '';
    document.getElementById('bundle-category').value = bundle.category || 'other';
    document.getElementById('bundle-condition').value = bundle.condition || '';
    document.getElementById('bundle-origin').value = bundle.origin || '';
    document.getElementById('bundle-visibility').value = bundle.visibility || 'private';
    
    bundleImages = bundle.images ? [...bundle.images] : [];
    bundleContents = bundle.contents ? [...bundle.contents] : [];
    bundleLinkedItems = bundle.linkedItems ? [...bundle.linkedItems] : [];
    
    renderBundleImagesPreview();
    renderBundleContentsList();
    renderBundleLinkedList();
    updateLinkItemSelector();
    
    bundleModal.style.display = 'flex';
};

// Delete bundle
window.deleteBundle = async function(bundleId) {
    if (!confirm('Are you sure you want to delete this bundle? This cannot be undone.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'bundles', bundleId));
        closeBundleDetailModal();
    } catch (error) {
        console.error('Error deleting bundle:', error);
        alert('Failed to delete bundle. Please try again.');
    }
};

// Close bundle modal
function closeBundleModal() {
    bundleModal.style.display = 'none';
    bundleForm.reset();
    bundleImages = [];
    bundleContents = [];
    bundleLinkedItems = [];
    selectedBundleFiles = [];
    renderBundleImagesPreview();
    renderBundleContentsList();
    renderBundleLinkedList();
}

// ==================== STATISTICS ====================

// Open statistics modal
function openStatsModal() {
    calculateAndDisplayStats();
    statsModal.style.display = 'flex';
}

// Close statistics modal
function closeStatsModal() {
    statsModal.style.display = 'none';
}

// Calculate and display all statistics
function calculateAndDisplayStats() {
    // Overview stats
    const totalItems = collectionData.length + bundlesData.length;
    document.getElementById('stats-total-items').textContent = totalItems;
    document.getElementById('stats-total-boxes').textContent = boxesData.length;
    
    const publicItems = collectionData.filter(item => item.visibility === 'public').length;
    const publicBundles = bundlesData.filter(bundle => bundle.visibility === 'public').length;
    const publicCount = publicItems + publicBundles;
    const privateCount = totalItems - publicCount;
    document.getElementById('stats-public').textContent = publicCount;
    document.getElementById('stats-private').textContent = privateCount;
    
    // Category breakdown (items + bundles)
    const categoryStats = {};
    collectionData.forEach(item => {
        const cat = item.category || 'other';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    bundlesData.forEach(bundle => {
        const cat = bundle.category || 'other';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });
    renderStatsBars('stats-by-category', categoryStats, 'category');
    
    // Origin breakdown (items + bundles)
    const originStats = {};
    collectionData.forEach(item => {
        if (item.origin) {
            originStats[item.origin] = (originStats[item.origin] || 0) + 1;
        }
    });
    bundlesData.forEach(bundle => {
        if (bundle.origin) {
            originStats[bundle.origin] = (originStats[bundle.origin] || 0) + 1;
        }
    });
    renderStatsBars('stats-by-origin', originStats, 'origin');
    
    // Condition breakdown (items + bundles)
    const conditionStats = {};
    collectionData.forEach(item => {
        if (item.condition) {
            conditionStats[item.condition] = (conditionStats[item.condition] || 0) + 1;
        }
    });
    bundlesData.forEach(bundle => {
        if (bundle.condition) {
            conditionStats[bundle.condition] = (conditionStats[bundle.condition] || 0) + 1;
        }
    });
    renderStatsBars('stats-by-condition', conditionStats, 'condition');
    
    // Recent activity (last 5 items + bundles)
    renderRecentActivity();
}

// Render bar charts for stats
function renderStatsBars(containerId, data, type) {
    const container = document.getElementById(containerId);
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
        container.innerHTML = '<div class="stats-empty">No data yet</div>';
        return;
    }
    
    // Sort by count descending
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    const labelMap = {
        // Categories
        'cards': 'Cards',
        'figures': 'Figures',
        'games': 'Games',
        'books': 'Books',
        'vinyl': 'Vinyl',
        'other': 'Other',
        // Origins
        'official': 'Official',
        'fan-made': 'Fan-made',
        'custom-commissioned': 'Custom Commissioned',
        'custom-self-made': 'Custom Self-made',
        'reseller': 'Re-seller/Dropshipper',
        // Conditions
        'mint': 'Mint',
        'near-mint': 'Near Mint',
        'excellent': 'Excellent',
        'good': 'Good',
        'fair': 'Fair',
        'poor': 'Poor'
    };
    
    container.innerHTML = sorted.map(([key, count]) => {
        const percentage = (count / total) * 100;
        const label = labelMap[key] || key;
        const colorClass = `${type}-${key}`;
        
        return `
            <div class="stats-bar-item">
                <div class="stats-bar-header">
                    <span class="stats-bar-label">${label}</span>
                    <span class="stats-bar-value">${count} (${percentage.toFixed(0)}%)</span>
                </div>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill ${colorClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Render recent activity
function renderRecentActivity() {
    const container = document.getElementById('stats-recent');
    
    // Combine items and bundles, sorted by createdAt
    const allItems = [
        ...collectionData.map(item => ({ ...item, type: 'item' })),
        ...bundlesData.map(bundle => ({ ...bundle, type: 'bundle' }))
    ];
    
    const recentItems = allItems
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 5);
    
    if (recentItems.length === 0) {
        container.innerHTML = '<div class="stats-empty">No items yet</div>';
        return;
    }
    
    container.innerHTML = recentItems.map(item => {
        const mainImage = item.type === 'bundle' 
            ? (item.images && item.images[0]) 
            : item.image;
        const icon = mainImage
            ? `<img src="${mainImage}" alt="${item.name}">`
            : getCategoryIcon(item.category);
        
        const timeAgo = getTimeAgo(item.createdAt);
        const typeLabel = item.type === 'bundle' ? '📦 Bundle' : item.category;
        
        return `
            <div class="stats-recent-item">
                <div class="stats-recent-icon">${icon}</div>
                <div class="stats-recent-info">
                    <div class="stats-recent-name">${item.name}</div>
                    <div class="stats-recent-meta">${typeLabel} • Added ${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Get time ago string
function getTimeAgo(timestamp) {
    if (!timestamp) return 'unknown';
    
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
    
    return date.toLocaleDateString();
}

// ==================== BULK ACTIONS ====================

// Toggle select mode
function toggleSelectMode() {
    selectMode = !selectMode;
    
    if (selectMode) {
        selectModeBtn.classList.add('active');
        selectModeBtn.textContent = 'Selecting...';
        bulkToolbar.classList.add('active');
        updateBulkBoxDropdown();
    } else {
        exitSelectMode();
    }
    
    renderAll();
}

// Exit select mode
function exitSelectMode() {
    selectMode = false;
    selectedItems.clear();
    selectModeBtn.classList.remove('active');
    selectModeBtn.textContent = 'Select';
    bulkToolbar.classList.remove('active');
    bulkMoveBox.value = '';
    bulkVisibility.value = '';
    updateSelectedCount();
    renderAll();
}

// Toggle individual item selection
function toggleItemSelection(itemId) {
    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }
    updateSelectedCount();
    renderAll();
}

// Update selected count display
function updateSelectedCount() {
    selectedCountEl.textContent = `${selectedItems.size} selected`;
}

// Update bulk move box dropdown
function updateBulkBoxDropdown() {
    // Remove existing box options (keep first two: placeholder and "Remove from Box")
    while (bulkMoveBox.options.length > 2) {
        bulkMoveBox.remove(2);
    }
    
    // Add current boxes
    boxesData.forEach(box => {
        const option = document.createElement('option');
        option.value = box.id;
        option.textContent = box.name;
        bulkMoveBox.appendChild(option);
    });
}

// Select all visible items
function selectAllItems() {
    const filteredItems = getFilteredCollection();
    filteredItems.forEach(item => {
        if (!item.boxId || displayBoxes !== 'show') {
            selectedItems.add(item.id);
        }
    });
    updateSelectedCount();
    renderAll();
}

// Deselect all items
function deselectAllItems() {
    selectedItems.clear();
    updateSelectedCount();
    renderAll();
}

// Bulk delete items
async function bulkDelete() {
    if (selectedItems.size === 0) {
        alert('No items selected');
        return;
    }
    
    const confirmDelete = confirm(`Are you sure you want to delete ${selectedItems.size} item(s)? This cannot be undone.`);
    if (!confirmDelete) return;
    
    try {
        const batch = writeBatch(db);
        
        selectedItems.forEach(itemId => {
            const itemRef = doc(db, 'items', itemId);
            batch.delete(itemRef);
        });
        
        await batch.commit();
        
        exitSelectMode();
    } catch (error) {
        console.error('Error deleting items:', error);
        alert('Failed to delete some items. Please try again.');
    }
}

// Bulk move to box
async function bulkMoveToBox(boxId) {
    if (selectedItems.size === 0) {
        alert('No items selected');
        bulkMoveBox.value = '';
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const newBoxId = boxId === 'none' ? null : boxId;
        
        selectedItems.forEach(itemId => {
            const itemRef = doc(db, 'items', itemId);
            batch.update(itemRef, { boxId: newBoxId });
        });
        
        await batch.commit();
        
        const boxName = boxId === 'none' ? 'removed from boxes' : `moved to box`;
        alert(`${selectedItems.size} item(s) ${boxName} successfully!`);
        
        bulkMoveBox.value = '';
        exitSelectMode();
    } catch (error) {
        console.error('Error moving items:', error);
        alert('Failed to move some items. Please try again.');
    }
}

// Bulk set visibility
async function bulkSetVisibility(visibility) {
    if (selectedItems.size === 0) {
        alert('No items selected');
        bulkVisibility.value = '';
        return;
    }
    
    try {
        const batch = writeBatch(db);
        
        selectedItems.forEach(itemId => {
            const itemRef = doc(db, 'items', itemId);
            batch.update(itemRef, { visibility: visibility });
        });
        
        await batch.commit();
        
        alert(`${selectedItems.size} item(s) set to ${visibility}!`);
        
        bulkVisibility.value = '';
        exitSelectMode();
    } catch (error) {
        console.error('Error updating visibility:', error);
        alert('Failed to update some items. Please try again.');
    }
}

// Handle sign out
async function handleSignOut() {
    try {
        if (unsubscribeItems) unsubscribeItems();
        if (unsubscribeBoxes) unsubscribeBoxes();
        if (unsubscribeBundles) unsubscribeBundles();
        await signOut(auth);
        window.location.href = `${BASE}/pages/auth.html`;
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Notifications System
async function loadNotifications() {
    if (!currentUser) return;
    
    // Get users we follow
    const followsQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', currentUser.uid)
    );
    
    const followsSnapshot = await getDocs(followsQuery);
    const followedUserIds = followsSnapshot.docs.map(doc => doc.data().followingId);
    
    // Get our friends
    const friendsQuery = query(
        collection(db, 'friends'),
        where('userId', '==', currentUser.uid)
    );
    
    const friendsSnapshot = await getDocs(friendsQuery);
    const friendIds = friendsSnapshot.docs.map(doc => doc.data().friendId);
    
    // Combine unique user IDs
    const watchedUserIds = [...new Set([...followedUserIds, ...friendIds])];
    
    if (watchedUserIds.length === 0) {
        renderNotifications([]);
        return;
    }
    
    // Listen for notifications (items added by watched users in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // We need to query in batches due to Firestore 'in' limit of 10
    const batches = [];
    for (let i = 0; i < watchedUserIds.length; i += 10) {
        batches.push(watchedUserIds.slice(i, i + 10));
    }
    
    notifications = [];
    
    for (const batch of batches) {
        const notifQuery = query(
            collection(db, 'items'),
            where('userId', 'in', batch),
            where('visibility', '==', 'public'),
            orderBy('createdAt', 'desc'),
            firestoreLimit(20)
        );
        
        try {
            const snapshot = await getDocs(notifQuery);
            for (const docSnap of snapshot.docs) {
                const item = { id: docSnap.id, ...docSnap.data() };
                
                // Get user profile
                const profileDoc = await getDoc(doc(db, 'profiles', item.userId));
                const profile = profileDoc.exists() ? profileDoc.data() : {};
                
                notifications.push({
                    id: item.id,
                    type: 'new_item',
                    item: item,
                    user: {
                        id: item.userId,
                        displayName: profile.displayName || 'User',
                        photoURL: profile.photoURL || null
                    },
                    createdAt: item.createdAt,
                    read: isNotificationRead(item.id)
                });
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }
    
    // Sort by date
    notifications.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
    });
    
    // Limit to 20 most recent
    notifications = notifications.slice(0, 20);
    
    renderNotifications(notifications);
}

function isNotificationRead(itemId) {
    const readNotifications = JSON.parse(localStorage.getItem('myshelf-read-notifications') || '[]');
    return readNotifications.includes(itemId);
}

function markNotificationRead(itemId) {
    const readNotifications = JSON.parse(localStorage.getItem('myshelf-read-notifications') || '[]');
    if (!readNotifications.includes(itemId)) {
        readNotifications.push(itemId);
        // Keep only last 100 read IDs
        if (readNotifications.length > 100) {
            readNotifications.splice(0, readNotifications.length - 100);
        }
        localStorage.setItem('myshelf-read-notifications', JSON.stringify(readNotifications));
    }
}

function markAllNotificationsRead() {
    const readNotifications = JSON.parse(localStorage.getItem('myshelf-read-notifications') || '[]');
    notifications.forEach(n => {
        if (!readNotifications.includes(n.id)) {
            readNotifications.push(n.id);
        }
    });
    // Keep only last 100
    if (readNotifications.length > 100) {
        readNotifications.splice(0, readNotifications.length - 100);
    }
    localStorage.setItem('myshelf-read-notifications', JSON.stringify(readNotifications));
    
    // Update UI
    notifications = notifications.map(n => ({ ...n, read: true }));
    renderNotifications(notifications);
}

function renderNotifications(notifs) {
    const unreadCount = notifs.filter(n => !n.read).length;
    
    // Update badge
    if (unreadCount > 0) {
        notificationBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        notificationBadge.style.display = 'flex';
    } else {
        notificationBadge.style.display = 'none';
    }
    
    // Render list
    if (notifs.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No new notifications</div>';
        return;
    }
    
    notificationList.innerHTML = notifs.map(n => {
        const timeAgo = getNotificationTimeAgo(n.createdAt);
        const avatar = n.user.photoURL 
            ? `<img src="${n.user.photoURL}" alt="${n.user.displayName}" class="notification-avatar">`
            : `<div class="notification-avatar-fallback">👤</div>`;
        
        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-user-id="${n.user.id}">
                ${avatar}
                <div class="notification-content">
                    <div class="notification-text">
                        <strong>${n.user.displayName}</strong> added "${n.item.name}" to their collection
                    </div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    notificationList.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const itemId = item.dataset.id;
            const userId = item.dataset.userId;
            markNotificationRead(itemId);
            item.classList.remove('unread');
            
            // Update badge count
            const newUnreadCount = document.querySelectorAll('.notification-item.unread').length;
            if (newUnreadCount > 0) {
                notificationBadge.textContent = newUnreadCount > 9 ? '9+' : newUnreadCount;
                notificationBadge.style.display = 'flex';
            } else {
                notificationBadge.style.display = 'none';
            }
            
            // Navigate to user's profile
            window.location.href = `${BASE}/pages/user.html?id=${userId}`;
        });
    });
}

function getNotificationTimeAgo(timestamp) {
    const date = timestamp?.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Mark all read button handler
markAllReadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    markAllNotificationsRead();
});

// Event Listeners
document.getElementById('add-item-btn').addEventListener('click', () => openAddModal());
document.getElementById('add-box-btn').addEventListener('click', openAddBoxModal);
document.getElementById('add-bundle-btn').addEventListener('click', openAddBundleModal);
document.getElementById('close-modal').addEventListener('click', () => {
    if (creatingItemForBundle) {
        itemModal.classList.remove('active');
        creatingItemForBundle = false;
    } else {
        closeModals();
    }
});
document.getElementById('close-detail').addEventListener('click', closeDetailModal);
document.getElementById('close-bundle-modal').addEventListener('click', closeBundleModal);
document.getElementById('close-bundle-detail').addEventListener('click', closeBundleDetailModal);
document.getElementById('cancel-bundle-btn').addEventListener('click', closeBundleModal);
document.getElementById('add-content-btn').addEventListener('click', addBundleContent);

// Initialize searchable item dropdown
initItemSearchDropdown();

// Create new item for bundle button
document.getElementById('create-item-for-bundle-btn').addEventListener('click', () => {
    openAddModal(null, true);
});

bundleForm.addEventListener('submit', saveBundle);
bundleImageFile.addEventListener('change', (e) => handleBundleImageSelection(e.target.files));
document.getElementById('cancel-btn').addEventListener('click', () => {
    if (creatingItemForBundle) {
        itemModal.classList.remove('active');
        creatingItemForBundle = false;
    } else {
        closeModals();
    }
});
document.getElementById('logout-btn').addEventListener('click', handleSignOut);
itemForm.addEventListener('submit', handleFormSubmit);

// Box modal event listeners
document.getElementById('close-box-modal').addEventListener('click', closeModals);
document.getElementById('cancel-box-btn').addEventListener('click', closeModals);
boxForm.addEventListener('submit', handleBoxFormSubmit);

// Quick box creation from item form
const quickBoxForm = document.getElementById('quick-box-form');
const quickBoxName = document.getElementById('quick-box-name');

document.getElementById('quick-add-box-btn').addEventListener('click', () => {
    quickBoxForm.style.display = 'block';
    quickBoxName.value = '';
    quickBoxName.focus();
});

document.getElementById('cancel-quick-box').addEventListener('click', () => {
    quickBoxForm.style.display = 'none';
    quickBoxName.value = '';
});

document.getElementById('save-quick-box').addEventListener('click', async () => {
    const name = quickBoxName.value.trim();
    if (!name) {
        alert('Please enter a box name');
        return;
    }
    
    const saveBtn = document.getElementById('save-quick-box');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Creating...';
    
    try {
        const boxData = {
            name: name,
            description: '',
            visibility: 'private',
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, 'boxes'), boxData);
        
        // Hide quick form and select the new box
        quickBoxForm.style.display = 'none';
        quickBoxName.value = '';
        
        // The onSnapshot will update the dropdown, but we need to select the new box
        setTimeout(() => {
            itemBox.value = docRef.id;
        }, 500);
        
    } catch (error) {
        console.error('Error creating box:', error);
        alert('Failed to create box. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create Box';
    }
});

// Box contents modal event listeners
document.getElementById('close-box-contents').addEventListener('click', closeBoxContentsModal);
document.getElementById('edit-box-btn').addEventListener('click', editBox);
document.getElementById('delete-box-btn').addEventListener('click', deleteBox);
document.getElementById('add-to-box-btn').addEventListener('click', addItemToBox);

searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderAll();
});

categoryFilter.addEventListener('change', () => {
    currentPage = 1;
    renderAll();
});

viewFilter.addEventListener('change', () => {
    currentPage = 1;
    renderAll();
});

sortFilter.addEventListener('change', () => {
    localStorage.setItem('myshelf-sort', sortFilter.value);
    currentPage = 1;
    renderAll();
});

// Advanced filters toggle
toggleAdvancedFilters.addEventListener('click', () => {
    const isVisible = advancedFiltersPanel.style.display !== 'none';
    advancedFiltersPanel.style.display = isVisible ? 'none' : 'block';
    toggleAdvancedFilters.classList.toggle('active', !isVisible);
});

// Advanced filter change listeners
[filterOrigin, filterCondition, filterYearFrom, filterYearTo, filterVisibility, filterHasImages].forEach(el => {
    el.addEventListener('change', () => {
        currentPage = 1;
        updateActiveFiltersCount();
        renderAll();
    });
});

filterTags.addEventListener('input', debounce(() => {
    currentPage = 1;
    updateActiveFiltersCount();
    renderAll();
}, 300));

// Clear advanced filters
clearAdvancedFilters.addEventListener('click', () => {
    filterOrigin.value = 'all';
    filterCondition.value = 'all';
    filterYearFrom.value = '';
    filterYearTo.value = '';
    filterVisibility.value = 'all';
    filterHasImages.value = 'all';
    filterTags.value = '';
    currentPage = 1;
    updateActiveFiltersCount();
    renderAll();
});

// Update active filters count
function updateActiveFiltersCount() {
    let count = 0;
    if (filterOrigin.value !== 'all') count++;
    if (filterCondition.value !== 'all') count++;
    if (filterYearFrom.value) count++;
    if (filterYearTo.value) count++;
    if (filterVisibility.value !== 'all') count++;
    if (filterHasImages.value !== 'all') count++;
    if (filterTags.value.trim()) count++;
    
    activeFiltersCount.textContent = count > 0 ? `${count} filter${count > 1 ? 's' : ''} active` : '';
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Notification toggle
notificationTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationDropdown.classList.toggle('active');
    // Close user dropdown if open
    dropdownMenu.classList.remove('active');
});

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.notification-bell')) {
        notificationDropdown.classList.remove('active');
    }
});

// Bulk actions event listeners
selectModeBtn.addEventListener('click', toggleSelectMode);
cancelSelectBtn.addEventListener('click', exitSelectMode);
selectAllBtn.addEventListener('click', selectAllItems);
deselectAllBtn.addEventListener('click', deselectAllItems);
bulkDeleteBtn.addEventListener('click', bulkDelete);

bulkMoveBox.addEventListener('change', (e) => {
    if (e.target.value) {
        bulkMoveToBox(e.target.value);
    }
});

bulkVisibility.addEventListener('change', (e) => {
    if (e.target.value) {
        bulkSetVisibility(e.target.value);
    }
});

// Stats modal event listeners
viewStatsBtn.addEventListener('click', openStatsModal);
closeStatsBtn.addEventListener('click', closeStatsModal);
statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) closeStatsModal();
});

bundleModal.addEventListener('click', (e) => {
    if (e.target === bundleModal) closeBundleModal();
});

bundleDetailModal.addEventListener('click', (e) => {
    if (e.target === bundleDetailModal) closeBundleDetailModal();
});

// Pagination event listeners
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

nextPageBtn.addEventListener('click', () => {
    currentPage++;
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Close modal when clicking outside
itemModal.addEventListener('click', (e) => {
    if (e.target === itemModal) closeModals();
});

detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
});

boxModal.addEventListener('click', (e) => {
    if (e.target === boxModal) closeModals();
});

boxContentsModal.addEventListener('click', (e) => {
    if (e.target === boxContentsModal) closeBoxContentsModal();
});

// Keyboard shortcut to close topmost modal only
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopmostModal();
});

// Category dropdown toggle
document.getElementById('category-toggle').addEventListener('click', () => {
    const dropdown = document.getElementById('category-dropdown');
    dropdown.classList.toggle('active');
    // Close tags dropdown
    document.getElementById('tags-dropdown').classList.remove('active');
});

// Tags dropdown toggle
document.getElementById('tags-toggle').addEventListener('click', () => {
    const dropdown = document.getElementById('tags-dropdown');
    dropdown.classList.toggle('active');
    renderTagOptions(); // Refresh available tags
    // Close category dropdown
    document.getElementById('category-dropdown').classList.remove('active');
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const categoryDropdown = document.getElementById('category-dropdown');
    const tagsDropdown = document.getElementById('tags-dropdown');
    const categoryToggle = document.getElementById('category-toggle');
    const tagsToggle = document.getElementById('tags-toggle');
    
    if (!e.target.closest('.quick-select-wrapper') && !e.target.closest('.quick-select-dropdown')) {
        categoryDropdown.classList.remove('active');
        tagsDropdown.classList.remove('active');
    }
});
