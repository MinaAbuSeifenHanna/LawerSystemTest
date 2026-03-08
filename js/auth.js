import { auth, db } from './config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export let currentUser = null;

// Check Auth State
export function setupAuthListener(onLogin, onLogout) {
    const authTimeout = setTimeout(() => {
        console.warn("Firebase Auth Check Timed Out.");
        onLogout(new Error("Auth Check Timed Out"));
    }, 10000); // 10 seconds timeout

    onAuthStateChanged(auth, async (user) => {
        clearTimeout(authTimeout);
        if (user) {
            currentUser = user;

            // Verify user document
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                onLogin(user, userData);
            } else {
                // Should handle if user doc somehow doesn't exist
                onLogin(user, null);
            }
        } else {
            currentUser = null;
            onLogout();
        }
    });
}

// Login Function
export async function login(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Register Function
export async function register(email, password, profileData) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create User document with their info (acting as their Office/Profile)
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            email: email,
            lawyerName: profileData.lawyerName || '',
            officeName: profileData.officeName || '',
            taxNumber: profileData.taxNumber || '',
            barNumber: profileData.barNumber || '',
            address: profileData.address || '',
            createdAt: serverTimestamp(),
            role: 'owner',
            ownerId: user.uid // Using their UID as the ownerId
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Update Profile Function
export async function updateProfile(profileData) {
    try {
        if (!currentUser) throw new Error("User not authenticated");

        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
            lawyerName: profileData.lawyerName || '',
            officeName: profileData.officeName || '',
            taxNumber: profileData.taxNumber || '',
            barNumber: profileData.barNumber || '',
            address: profileData.address || '',
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get Profile Function
export async function getProfile() {
    try {
        if (!currentUser) throw new Error("User not authenticated");

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            return { success: true, data: userDoc.data() };
        } else {
            return { success: false, error: "Profile not found" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Logout Function
export async function logout() {
    try {
        // Clear stored data on logout
        sessionStorage.removeItem('lawyerSystem_clients');
        sessionStorage.removeItem('lawyerSystem_cases');
        await signOut(auth);
        location.reload();
    } catch (err) {
        console.error("Logout Error:", err);
    }
}
