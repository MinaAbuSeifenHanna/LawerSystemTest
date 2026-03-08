import { setupAuthListener } from './auth.js';
import { clearAllListeners } from './db-services.js';
import { hideSpinner, showSpinner } from './ui-utils.js';

// Central App Initialization
export function initApp(onUserAuthenticated) {
    // Show spinner immediately on app start
    showSpinner();

    // Ensure body starts hidden to prevent flicker
    document.body.style.opacity = '0';
    document.body.style.visibility = 'hidden';
    document.body.style.transition = 'opacity 0.3s ease';

    // Set up global auth listener
    setupAuthListener(
        // On Login
        async (user, userData) => {
            try {
                // Execute page-specific logic
                if (onUserAuthenticated) {
                    await onUserAuthenticated(user, userData);
                }

                // Fade in the app
                document.body.style.visibility = 'visible';
                document.body.style.opacity = '1';
            } catch (error) {
                console.error('Error during app initialization:', error);
            } finally {
                hideSpinner();
            }
        },
        // On Logout
        () => {
            // Redirect to login if not already there
            if (!window.location.pathname.endsWith('login.html') && window.location.pathname !== '/') {
                window.location.replace('login.html');
            } else {
                // If on login page, just show the page
                document.body.style.visibility = 'visible';
                document.body.style.opacity = '1';
                hideSpinner();
            }
        }
    );

    // Global listener cleanup on page navigation/unload
    window.addEventListener('beforeunload', () => {
        console.log('App is unloading, clearing all Firebase listeners...');
        clearAllListeners();
    });
}
