/* =========================================
   CORE APPLICATION LOGIC
   1. API Client
   2. Configuration & Theme
   3. Global Helpers & Navbar
   ========================================= */

/* =========================================
   1. API CLIENT
   ========================================= */
const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
    const { signal, ...fetchOptions } = options;
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
            signal,
            ...fetchOptions
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    } catch (error) {
        if (error.name === 'AbortError') return null;
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

const API = {
    // Auth
    login: (username, password) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register: (data) => apiCall('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => apiCall('/auth/logout', { method: 'POST' }),
    getMe: () => apiCall('/auth/me'),
    updateProfile: (data) => apiCall('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    updatePassword: (data) => apiCall('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
    addBalance: (amount) => apiCall('/auth/balance', { method: 'POST', body: JSON.stringify({ amount }) }),

    // Books
    getBooks: (filters = {}, signal) => {
        const params = new URLSearchParams(filters);
        return apiCall(`/books?${params.toString()}`, { signal });
    },
    getTrendingBooks: () => apiCall('/books/trending'),
    getBook: (id) => apiCall(`/books/${id}`),
    buyBook: (bookId) => apiCall('/books/buy', { method: 'POST', body: JSON.stringify({ bookId }) }),
    getMyPurchases: () => apiCall('/books/my-purchases'),
    addBook: (data) => apiCall('/admin/books', { method: 'POST', body: JSON.stringify(data) }),
    updateBook: (id, data) => apiCall(`/admin/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBook: (id) => apiCall(`/admin/books/${id}`, { method: 'DELETE' }),

    // Loans
    // Loans (Consolidated into Books API)
    borrowBook: (bookId) => apiCall('/books/borrow', { method: 'POST', body: JSON.stringify({ bookId }) }),
    returnBook: (loanId) => apiCall('/books/return', { method: 'POST', body: JSON.stringify({ loanId }) }),
    getMyLoans: () => apiCall('/books/my-loans'), // Changed endpoint name
    getAllLoans: () => apiCall('/admin/loans'),
    getAllPurchases: () => apiCall('/admin/purchases'),

    // Admin Users
    getUsers: () => apiCall('/admin/users'),
    getUserLoans: (userId) => apiCall(`/admin/users/${userId}/loans`),
    deleteUser: (id) => apiCall(`/admin/users/${id}`, { method: 'DELETE' }),
    updateUserRole: (id, role) => apiCall(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

    // Genres
    getGenres: () => apiCall('/admin/genres'),
    addGenre: (name) => apiCall('/admin/genres', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteGenre: (id) => apiCall(`/admin/genres/${id}`, { method: 'DELETE' })
};


/* =========================================
   2. CONFIG & THEME
   ========================================= */
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: { slate: { 850: '#151e2e', 900: '#0f172a', 950: '#020617' } }
        }
    }
};

const theme = {
    init() {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        if (!document.querySelector('.liquid-bg-container')) {
            const bg = document.createElement('div');
            bg.className = 'liquid-bg-container';
            bg.innerHTML = `<div class="liquid-blob blob-1"></div><div class="liquid-blob blob-2"></div><div class="liquid-blob blob-3"></div>`;
            document.body.prepend(bg);
        }
        this.updateIcon();
    },
    toggle() {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
        this.updateIcon();
    },
    updateIcon() {
        const icon = document.getElementById('theme-icon');
        const miniIcon = document.getElementById('theme-icon-mini');
        const isDark = document.documentElement.classList.contains('dark');
        const moonPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';
        const sunPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />';
        if (icon) icon.innerHTML = isDark ? sunPath : moonPath;
        if (miniIcon) miniIcon.innerHTML = isDark ? sunPath : moonPath;
    }
};


/* =========================================
   3. HELPERS
   ========================================= */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysRemaining(dueDate) {
    return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function isOverdue(dueDate) {
    return new Date() > new Date(dueDate);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg text-white font-bold transition-all transform translate-y-20 opacity-0 z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-20', 'opacity-0'); toast.classList.add('translate-y-0', 'opacity-100'); }, 10);
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); setTimeout(() => toast.remove(), 500); }, 3000);
}

function getCurrentUser() {
    const user = sessionStorage.getItem('library_user');
    return user ? JSON.parse(user) : null;
}

function checkLogin() {
    const user = getCurrentUser();
    if (!user) window.location.href = 'login.html';
    return user;
}

function checkAdmin() {
    const user = checkLogin();
    if (user.role !== 'admin') window.location.href = 'index.html';
}

async function logout() {
    try {
        await API.logout();
        sessionStorage.removeItem('library_user');
        window.location.href = 'index.html';
    } catch (err) {
        showToast('Logout failed', 'error');
    }
}


/* =========================================
   4. COMPONENTS (Navbar)
   ========================================= */
const Components = {
    renderNavbar: () => {
        const user = getCurrentUser();
        const path = window.location.pathname;
        const container = document.getElementById('navbar-placeholder');
        if (!container) return;

        const isActive = (p) => path.includes(p) ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50';
        const adminVisible = user && user.role === 'admin' ? '' : 'hidden';
        const myBooksVisible = user ? '' : 'hidden';

        container.innerHTML = `
            <nav class="fixed top-6 inset-x-0 mx-auto w-fit z-50 animate-fade-in transition-transform duration-300 ease-in-out">
                <div class="glass-panel px-2 py-2 rounded-full shadow-2xl flex items-center gap-1 border border-white/20 backdrop-blur-xl">
                    <div class="flex items-center gap-1 h-6">
                        <a href="index.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('index.html') || isActive('/') ? isActive('index.html') : isActive('')}">Library</a>
                        <a href="my-books.html" class="${myBooksVisible} px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('my-books.html')}">My Books</a>
                        <a href="admin.html" class="${adminVisible} px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('admin.html')}">Admin</a>
                        ${user ? `<a href="settings.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-colors ${isActive('settings.html')}">Account</a>`
                : `<a href="login.html" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full text-slate-500 hover:text-slate-900 transition-colors">Sign In</a>`}
                    </div>
                </div>
            </nav>
        `;

        // Auto-hide
        let lastScrollY = window.scrollY;
        const navEl = container.querySelector('nav');
        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            if (currentY > lastScrollY && currentY > 50) {
                navEl.classList.remove('translate-y-0');
                navEl.classList.add('-translate-y-64');
            } else {
                navEl.classList.remove('-translate-y-64');
                navEl.classList.add('translate-y-0');
            }
            lastScrollY = currentY;
        });
    }
};

/* =========================================
   5. INIT
   ========================================= */
theme.init();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Components.renderNavbar);
} else {
    Components.renderNavbar();
}

// Exports
window.theme = theme;
window.Components = Components;
window.logout = logout;
window.API = API;
