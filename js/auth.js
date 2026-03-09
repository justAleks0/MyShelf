// Authentication Logic
import { auth, onAuthStateChanged, googleProvider, signInWithPopup } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = '/';
    }
});

// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');
const googleSigninBtn = document.getElementById('google-signin');
const googleSignupBtn = document.getElementById('google-signup');

// Toggle between forms
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    loginError.textContent = '';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
    signupError.textContent = '';
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = '/';
    } catch (error) {
        loginError.textContent = getErrorMessage(error.code);
    }
});

// Handle Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (password !== confirm) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        window.location.href = '/';
    } catch (error) {
        signupError.textContent = getErrorMessage(error.code);
    }
});

// Convert Firebase error codes to user-friendly messages
function getErrorMessage(code) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/invalid-credential':
            return 'Invalid email or password';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later';
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled';
        case 'auth/popup-blocked':
            return 'Pop-up blocked. Please allow pop-ups for this site';
        default:
            return 'An error occurred. Please try again';
    }
}

// Handle Google Sign-In
async function handleGoogleSignIn() {
    try {
        await signInWithPopup(auth, googleProvider);
        window.location.href = '/';
    } catch (error) {
        const errorMsg = getErrorMessage(error.code);
        if (loginForm.style.display !== 'none') {
            loginError.textContent = errorMsg;
        } else {
            signupError.textContent = errorMsg;
        }
    }
}

googleSigninBtn.addEventListener('click', handleGoogleSignIn);
googleSignupBtn.addEventListener('click', handleGoogleSignIn);
