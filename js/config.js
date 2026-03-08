import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyAlVHV4PH2OZSJnAzN9igOXG7ORwf2lzys",
    authDomain: "lawyer-system-eb097.firebaseapp.com",
    projectId: "lawyer-system-eb097",
    storageBucket: "lawyer-system-eb097.firebasestorage.app",
    messagingSenderId: "830930922746",
    appId: "1:830930922746:web:27ae07512661043391ad43",
    measurementId: "G-FVN9499MZC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, auth, db };
