/**
 * ============================================================================
 * CORE APPLICATION LOGIC - app.js
 * ============================================================================
 * 
 * This file contains the CORE FUNCTIONS used throughout the application:
 * 
 * 1. API CLIENT - Functions to communicate with the backend
 * 2. CONFIG & THEME - Dark/light mode toggle functionality
 * 3. GLOBAL HELPERS - Utility functions used everywhere
 * 4. COMPONENTS - Navbar and other reusable UI parts
 * 5. INITIALIZATION - Code that runs when the page loads
 * 
 * FILE STRUCTURE:
 * - This file is loaded on EVERY page
 * - It provides utilities that other scripts use
 * - It initializes the theme and navbar
 * 
 * FOR BEGINNERS:
 * - API = Application Programming Interface
 *   (how our JavaScript talks to the server)
 * - API Client = A set of functions that make HTTP requests
 * - Theme = The visual appearance (dark/light mode)
 * ============================================================================
 */


/* ============================================================================
   SECTION 1: API CLIENT
   ============================================================================ */

/**
 * WHAT IS THE API CLIENT?
 * 
 * The API client is a set of functions that send requests to the backend.
 * Think of it as a "messenger" that:
 * 1. Takes your request (e.g., "login")
 * 2. Sends it to the server
 * 3. Waits for the response
 * 4. Returns the result to your code
 * 
 * WITHOUT THE API CLIENT:
 * - You'd have to write complex fetch() code everywhere
 * - You'd have to handle errors repeatedly
 * - Your code would be messy
 * 
 * WITH THE API CLIENT:
 * - Just call API.login(username, password)
 * - Clean, simple, reusable!
 */

// The base URL for all API requests
// In this app, all API routes start with /api
const API_BASE = '/api';

/**
 * apiCall - The Core HTTP Request Function
 * 
 * This is the LOW-LEVEL function that all API methods use.
 * It handles the actual fetch() request and error handling.
 * 
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - The JSON response from the server
 * 
 * HOW IT WORKS:
 * 1. Constructs the full URL (API_BASE + endpoint)
 * 2. Creates a fetch() request with options
 * 3. Waits for the response
 * 4. Parses the JSON response
 * 5. Throws an error if response is not OK
 * 6. Returns the parsed data
 */
async function apiCall(endpoint, options = {}) {
    // Destructure to get signal (for AbortController) and other options
    const { signal, ...fetchOptions } = options;

    try {
        // Make the HTTP request
        const response = await fetch(`${API_BASE}${endpoint}`, {
            // Default headers
            headers: {
                'Content-Type': 'application/json',  // Tell server we're sending JSON
                ...fetchOptions.headers              // Merge with any additional headers
            },
            signal,  // For cancelling requests (advanced)
            ...fetchOptions  // Spread remaining options (method, body, etc.)
        });

        // Parse the JSON response
        const data = await response.json();

        // Check if the request was successful
        if (!response.ok) {
            // HTTP status codes 400-599 are errors
            // Throw an error with the server's message
            throw new Error(data.message || 'Something went wrong');
        }

        // Return the successful response data
        return data;
    } catch (error) {
        // Handle request cancellation (AbortController)
        if (error.name === 'AbortError') {
            return null;  // Silent abort, no error
        }

        // Log the error for debugging
        console.error(`API Error (${endpoint}):`, error);

        // Re-throw the error so calling code can handle it
        throw error;
    }
}


/**
 * API - The Organized API Client Object
 * 
 * This object groups all API methods by category:
 * - Auth: Login, register, logout, profile
 * - Books: Getting books, buying, borrowing, returning
 * - Loans: Managing loans
 * - Admin: User and book management
 * 
 * HOW TO USE:
 * API.login(username, password)          // Authentication
 * API.getBooks({ search: 'dune' })       // Get books with filters
 * API.borrowBook(5)                      // Borrow book ID 5
 * API.getUsers()                         // Get all users (admin only)
 */
const API = {
    // ==================== AUTHENTICATION ====================

    /**
     * Login a user
     * @param {string} username - The username
     * @param {string} password - The password
     * @returns {Promise} - Response with user data
     */
    login: (username, password) =>
        apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        }),

    /**
     * Register a new user
     * @param {Object} data - User registration data
     * @returns {Promise} - Success/failure response
     */
    register: (data) =>
        apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    /**
     * Logout the current user
     * @returns {Promise} - Success/failure response
     */
    logout: () =>
        apiCall('/auth/logout', { method: 'POST' }),

    /**
     * Get current user info
     * @returns {Promise} - User object
     */
    getMe: () =>
        apiCall('/auth/me'),

    /**
     * Update user profile
     * @param {Object} data - Profile data (full_name, email)
     * @returns {Promise} - Success/failure response
     */
    updateProfile: (data) =>
        apiCall('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    /**
     * Change password
     * @param {Object} data - Password data (currentPassword, newPassword)
     * @returns {Promise} - Success/failure response
     */
    updatePassword: (data) =>
        apiCall('/auth/password', {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    /**
     * Add balance to account
     * @param {number} amount - Amount to add
     * @returns {Promise} - Success/failure response
     */
    addBalance: (amount) =>
        apiCall('/auth/balance', {
            method: 'POST',
            body: JSON.stringify({ amount })
        }),


    // ==================== BOOKS ====================

    /**
     * Get books with optional filters
     * @param {Object} filters - Search and filter options
     * @param {AbortSignal} signal - Optional signal to cancel request
     * @returns {Promise} - Array of books
     */
    getBooks: (filters = {}, signal) => {
        // Convert filters object to URL query string
        const params = new URLSearchParams(filters);
        return apiCall(`/books?${params.toString()}`, { signal });
    },

    /**
     * Get trending books (most borrowed, best seller, newest)
     * @returns {Promise} - Object with trending books
     */
    getTrendingBooks: () =>
        apiCall('/books/trending'),

    /**
     * Get a single book by ID
     * @param {number} id - The book ID
     * @returns {Promise} - Book object
     */
    getBook: (id) =>
        apiCall(`/books/${id}`),

    /**
     * Purchase a book
     * @param {number} bookId - The book ID to purchase
     * @returns {Promise} - Response with new balance
     */
    buyBook: (bookId) =>
        apiCall('/books/buy', {
            method: 'POST',
            body: JSON.stringify({ bookId })
        }),

    /**
     * Get user's purchased books
     * @returns {Promise} - Array of purchases
     */
    getMyPurchases: () =>
        apiCall('/books/my-purchases'),

    /**
     * Add a new book (admin)
     * @param {Object} data - Book data
     * @returns {Promise} - Response with new book ID
     */
    addBook: (data) =>
        apiCall('/admin/books', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    /**
     * Update a book (admin)
     * @param {number} id - Book ID to update
     * @param {Object} data - Updated book data
     * @returns {Promise} - Success/failure response
     */
    updateBook: (id, data) =>
        apiCall(`/admin/books/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    /**
     * Delete a book (admin)
     * @param {number} id - Book ID to delete
     * @returns {Promise} - Success/failure response
     */
    deleteBook: (id) =>
        apiCall(`/admin/books/${id}`, { method: 'DELETE' }),


    // ==================== LOANS ====================

    /**
     * Borrow a book
     * @param {number} bookId - The book ID to borrow
     * @returns {Promise} - Success/failure response
     */
    borrowBook: (bookId) =>
        apiCall('/books/borrow', {
            method: 'POST',
            body: JSON.stringify({ bookId })
        }),

    /**
     * Return a borrowed book
     * @param {number} loanId - The loan ID (from actions table)
     * @returns {Promise} - Success/failure response
     */
    returnBook: (loanId) =>
        apiCall('/books/return', {
            method: 'POST',
            body: JSON.stringify({ loanId })
        }),

    /**
     * Get user's active loans
     * @returns {Promise} - Array of active loans
     */
    getMyLoans: () =>
        apiCall('/books/my-loans'),

    /**
     * Get all loans in system (admin)
     * @returns {Promise} - Array of all loans
     */
    getAllLoans: () =>
        apiCall('/admin/loans'),

    /**
     * Get all purchases in system (admin)
     * @returns {Promise} - Array of all purchases
     */
    getAllPurchases: () =>
        apiCall('/admin/purchases'),


    // ==================== ADMIN USERS ====================

    /**
     * Get all users (admin)
     * @returns {Promise} - Array of users
     */
    getUsers: () =>
        apiCall('/admin/users'),

    /**
     * Get specific user's loans (admin)
     * @param {number} userId - The user ID
     * @returns {Promise} - Array of user's loans
     */
    getUserLoans: (userId) =>
        apiCall(`/admin/users/${userId}/loans`),

    /**
     * Delete a user (admin)
     * @param {number} id - User ID to delete
     * @returns {Promise} - Success/failure response
     */
    deleteUser: (id) =>
        apiCall(`/admin/users/${id}`, { method: 'DELETE' }),

    /**
     * Update user role (admin)
     * @param {number} id - User ID
     * @param {string} role - New role ('student' or 'admin')
     * @returns {Promise} - Success/failure response
     */
    updateUserRole: (id, role) =>
        apiCall(`/admin/users/${id}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        }),


    // ==================== GENRES ====================

    /**
     * Get all genres
     * @returns {Promise} - Array of genre names
     */
    getGenres: () =>
        apiCall('/admin/genres'),

    /**
     * Add a new genre
     * @param {string} name - Genre name
     * @returns {Promise} - Success/failure response
     */
    addGenre: (name) =>
        apiCall('/admin/genres', {
            method: 'POST',
            body: JSON.stringify({ name })
        }),

    /**
     * Delete a genre
     * @param {string} name - Genre name to delete
     * @returns {Promise} - Success/failure response
     */
    deleteGenre: (name) =>
        apiCall(`/admin/genres/${name}`, { method: 'DELETE' })
};


/* ============================================================================
   SECTION 2: CONFIGURATION & THEME
   ============================================================================ */

/**
 * TAILWIND CONFIGURATION
 * 
 * Tailwind CSS is configured via JavaScript here.
 * We customize the dark mode and theme colors.
 * 
 * FOR BEGINNERS:
 * - tailwind.config is a special object Tailwind looks for
 * - darkMode: 'class' means we control dark mode with a CSS class
 * - theme.extend lets us add custom colors and fonts
 */
tailwind.config = {
    darkMode: 'class',  // Use .dark class on <html> for dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif']  // Use Inter font
            },
            colors: {
                // Custom slate colors for dark mode
                slate: { 850: '#151e2e', 900: '#0f172a', 950: '#020617' }
            }
        }
    }
};


/**
 * THEME OBJECT - Manages Dark/Light Mode
 * 
 * This object handles:
 * - Initializing the theme based on user preference or system setting
 * - Toggling between dark and light mode
 * - Updating the theme toggle icons (sun/moon)
 * - Saving preference to localStorage
 */
const theme = {
    /**
     * Initialize the theme on page load
     * 
     * LOGIC:
     * 1. Check localStorage for saved preference
     * 2. If nothing saved, check system preference (OS-level dark mode)
     * 3. Apply the appropriate class to <html>
     * 4. Create the animated background blobs
     */
    init() {
        // Check localStorage or system preference
        if (localStorage.theme === 'dark' ||
            (!('theme' in localStorage) &&
                window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            // User prefers dark mode
            document.documentElement.classList.add('dark');
        } else {
            // User prefers light mode
            document.documentElement.classList.remove('dark');
        }

        // Create animated background blobs if they don't exist
        if (!document.querySelector('.liquid-bg-container')) {
            const bg = document.createElement('div');
            bg.className = 'liquid-bg-container';
            // Add three colored blobs for the animated background
            bg.innerHTML = `
                <div class="liquid-blob blob-1"></div>
                <div class="liquid-blob blob-2"></div>
                <div class="liquid-blob blob-3"></div>
            `;
            document.body.prepend(bg);  // Add to the page
        }

        // Set up the correct toggle icon
        this.updateIcon();
    },

    /**
     * Toggle between dark and light mode
     * 
     * WHAT HAPPENS:
     * 1. Check if .dark class exists
     * 2. If yes, remove it (switch to light)
     * 3. If no, add it (switch to dark)
     * 4. Save preference to localStorage
     * 5. Update the toggle icon
     */
    toggle() {
        if (document.documentElement.classList.contains('dark')) {
            // Currently dark, switch to light
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            // Currently light, switch to dark
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
        this.updateIcon();
    },

    /**
     * Update the sun/moon toggle icon
     * 
     * WHAT THIS DOES:
     * - Finds the toggle buttons (there might be two on some pages)
     * - Changes the SVG icon based on current mode
     * - Moon icon for light mode, Sun icon for dark mode
     */
    updateIcon() {
        const icon = document.getElementById('theme-icon');
        const miniIcon = document.getElementById('theme-icon-mini');
        const isDark = document.documentElement.classList.contains('dark');

        // SVG path for moon icon
        const moonPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';

        // SVG path for sun icon
        const sunPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />';

        // Update both icons if they exist
        if (icon) icon.innerHTML = isDark ? sunPath : moonPath;
        if (miniIcon) miniIcon.innerHTML = isDark ? sunPath : moonPath;
    }
};


/* ============================================================================
   SECTION 3: GLOBAL HELPER FUNCTIONS
   ============================================================================ */

/**
 * formatDate - Format a date string for display
 * 
 * @param {string} dateString - ISO date string from database
 * @returns {string} - Formatted date like "January 15, 2026"
 * 
 * EXAMPLE:
 * formatDate('2026-01-15T10:30:00.000Z')
 * // Returns: "January 15, 2026"
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';  // Handle empty dates
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}


/**
 * daysRemaining - Calculate days until due date
 * 
 * @param {string} dueDate - The due date string
 * @returns {number} - Days remaining (can be negative if overdue)
 * 
 * EXAMPLE:
 * daysRemaining('2026-02-15')  // If today is Jan 15, returns 31
 */
function daysRemaining(dueDate) {
    // Convert to Date, subtract now, convert ms to days
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}


/**
 * isOverdue - Check if a loan is overdue
 * 
 * @param {string} dueDate - The due date string
 * @returns {boolean} - True if overdue, false otherwise
 */
function isOverdue(dueDate) {
    return new Date() > new Date(dueDate);
}


/**
 * showToast - Display a temporary notification message
 * 
 * @param {string} message - The message to show
 * @param {string} type - 'success' (green) or 'error' (red)
 * 
 * WHAT IT DOES:
 * 1. Creates a new div element
 * 2. Styles it based on type (success=green, error=red)
 * 3. Adds it to the page
 * 4. Animates it in
 * 5. Waits 3 seconds, then animates it out
 * 6. Removes the element from DOM
 * 
 * VISUAL:
 * - Fixed position at bottom-right of screen
 * - Toast notification slides in
 * - Disappears automatically
 */
function showToast(message, type = 'success') {
    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg text-white font-bold transition-all transform translate-y-20 opacity-0 z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`;
    toast.innerText = message;

    // Add to page
    document.body.appendChild(toast);

    // Animate in (slide up + fade in)
    setTimeout(() => {
        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    // Wait 3 seconds, then animate out
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        setTimeout(() => toast.remove(), 500);  // Remove from DOM after fade out
    }, 3000);
}


/**
 * getCurrentUser - Get the logged-in user from sessionStorage
 * 
 * @returns {Object|null} - User object or null if not logged in
 * 
 * SESSION STORAGE:
 * - When user logs in, we store their info in sessionStorage
 * - This persists across page navigation
 * - But clears when browser is closed
 * 
 * DATA STORED:
 * - id, username, role, full_name
 * - (Balance is fetched fresh from API)
 */
function getCurrentUser() {
    const user = sessionStorage.getItem('library_user');
    return user ? JSON.parse(user) : null;
}


/**
 * checkLogin - Verify user is logged in, redirect if not
 * 
 * @returns {Object} - The user object if logged in
 * @redirects - Redirects to login.html if not logged in
 * 
 * USAGE:
 * - Call this at the start of protected pages
 * - If not logged in, user is sent to login page
 * - If logged in, returns the user object
 */
function checkLogin() {
    const user = getCurrentUser();
    if (!user) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
    }
    return user;
}


/**
 * checkAdmin - Verify user is an admin, redirect if not
 * 
 * @returns {Object} - The user object if admin
 * @redirects - Redirects to index.html if not admin
 * 
 * USAGE:
 * - Call this at the start of admin pages
 * - Ensures only admins can access admin features
 */
function checkAdmin() {
    const user = checkLogin();  // First check if logged in
    if (user.role !== 'admin') {
        // Logged in but not admin, send to home
        window.location.href = 'index.html';
    }
    return user;
}


/**
 * logout - Log out the current user
 * 
 * WHAT IT DOES:
 * 1. Calls API to destroy session on server
 * 2. Clears user data from sessionStorage
 * 3. Redirects to home page
 * 
 * USAGE:
 * <button onclick="logout()">Sign Out</button>
 */
async function logout() {
    try {
        // Call logout API
        await API.logout();

        // Clear user data from storage
        sessionStorage.removeItem('library_user');

        // Redirect to home
        window.location.href = 'index.html';
    } catch (err) {
        // If logout API fails, still clear local data
        sessionStorage.removeItem('library_user');
        showToast('Logout failed', 'error');
    }
}


/* ============================================================================
   SECTION 4: COMPONENTS (Reusable UI Parts)
   ============================================================================ */

/**
 * Components - Reusable UI Components
 * 
 * This object contains functions that generate HTML for UI parts.
 * Currently includes the navigation bar.
 * 
 * FOR BEGINNERS:
 * - "Component" = a reusable piece of UI
 * - We use template literals to create HTML
 * - We inject the HTML into the page using innerHTML
 */
const Components = {
    /**
     * renderNavbar - Generate and insert the navigation bar
     * 
     * WHAT IT DOES:
     * 1. Checks if user is logged in
     * 2. Checks if user is admin
     * 3. Generates HTML for the navbar
     * 4. Injects it into the page
     * 5. Adds scroll behavior (hide on scroll down, show on scroll up)
     * 
     * NAVBAR ITEMS:
     * - Library (home) - Visible to everyone
     * - My Books - Only visible when logged in
     * - Admin - Only visible to admins
     * - Account/Sign In - Depends on login status
     */
    renderNavbar: () => {
        const user = getCurrentUser();
        const path = window.location.pathname;
        const container = document.getElementById('navbar-placeholder');

        // If no placeholder found, nothing to do
        if (!container) return;

        // Determine which items to show
        const adminVisible = user && user.role === 'admin' ? '' : 'hidden';
        const myBooksVisible = user ? '' : 'hidden';

        // Helper to check if a link is active (current page)
        const isActive = (p) => path.includes(p)
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50';

        // Generate the navbar HTML
        container.innerHTML = `
            <nav class="fixed top-6 inset-x-0 mx-auto w-fit z-50 animate-fade-in transition-transform duration-300 ease-in-out">
                <div class="glass-panel px-2 py-2 rounded-full shadow-2xl flex items-center gap-1 border border-white/20 backdrop-blur-xl">
                    <div class="flex items-center gap-1 h-6">
                        <a href="index.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('index.html') || isActive('/') ? isActive('index.html') : isActive('')}">Library</a>
                        <a href="my-books.html" class="${myBooksVisible} px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('my-books.html')}">My Books</a>
                        <a href="admin.html" class="${adminVisible} px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('admin.html')}">Admin</a>
                        ${user
                ? `<a href="settings.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('settings.html')}">Account</a>`
                : `<a href="login.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full text-slate-500 hover:text-slate-900 transition-colors">Sign In</a>`
            }
                    </div>
                </div>
            </nav>
        `;

        // Add auto-hide behavior on scroll
        let lastScrollY = window.scrollY;
        const navEl = container.querySelector('nav');

        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            if (currentY > lastScrollY && currentY > 50) {
                // Scrolling down, hide navbar
                navEl.classList.remove('translate-y-0');
                navEl.classList.add('-translate-y-64');
            } else {
                // Scrolling up, show navbar
                navEl.classList.remove('-translate-y-64');
                navEl.classList.add('translate-y-0');
            }
            lastScrollY = currentY;
        });
    }
};


/* ============================================================================
   SECTION 5: INITIALIZATION
   ============================================================================ */

/**
 * INITIALIZATION CODE
 * 
 * This code runs automatically when the script loads.
 * It sets up the theme and renders the navbar.
 * 
 * LOGIC:
 * 1. Initialize the theme
 * 2. Wait for DOM to be ready
 * 3. Render the navbar
 */

// Initialize theme immediately
theme.init();

// Wait for DOM to be ready, then render navbar
if (document.readyState === 'loading') {
    // DOM not ready yet, wait for DOMContentLoaded event
    document.addEventListener('DOMContentLoaded', Components.renderNavbar);
} else {
    // DOM already ready
    Components.renderNavbar();
}


/* ============================================================================
   EXPORTS (Make functions available globally)
   ============================================================================ */

// Export these functions to the window object
// This makes them available in the global scope
// Other scripts can use: window.theme, window.logout(), etc.
window.theme = theme;
window.Components = Components;
window.logout = logout;
window.API = API;


/* ============================================================================
   END OF app.js
   ============================================================================
 */
