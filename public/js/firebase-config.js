// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, linkWithPopup, unlink, EmailAuthProvider, linkWithCredential } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyBiTvGBbuuFaLabmJ-sHmRltSynMFmkNng",
    authDomain: "myshelf-80041.firebaseapp.com",
    projectId: "myshelf-80041",
    storageBucket: "myshelf-80041.firebasestorage.app",
    messagingSenderId: "685768399686",
    appId: "1:685768399686:web:a2f6f1d3cc4208d158a347"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, onAuthStateChanged, signOut, googleProvider, signInWithPopup, linkWithPopup, unlink, EmailAuthProvider, linkWithCredential };
