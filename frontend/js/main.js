/**
 * ============================================================================
 * MAIN APPLICATION CONTROLLER - main.js
 * ============================================================================
 * 
 * This file handles the USER-FACING pages of the application:
 * 
 * 1. PUBLIC CATALOG (index.html)
 *    - Browse and search books
 *    - Filter and sort books
 *    - Borrow or buy books
 * 
 * 2. PERSONAL LIBRARY (my-books.html)
 *    - View active loans
 *    - View purchased books
 *    - Return borrowed books
 * 
 * 3. AUTHENTICATION (login.html)
 *    - User login
 *    - User registration
 * 
 * 4. SETTINGS (settings.html)
 *    - View and edit profile
 *    - Change password
 *    - Add balance
 * 
 * FILE STRUCTURE:
 * - Uses page detection (checks which page is loaded)
 * - Initializes the appropriate functionality
 * - Exports functions to window for HTML onclick handlers
 * 
 * FOR BEGINNERS:
 * - "Controller" = manages the logic for a view/page
 * - "Event listeners" = code that runs when user interacts
 * - "Debounce" = wait for user to stop typing before searching
 * ============================================================================
 */

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

/**
 * currentLoadController - AbortController for cancelling API requests
 * 
 * WHY DO WE NEED THIS?
 * - When user types fast, multiple search requests fire
 * - If a later request finishes before an earlier one, out-of-order results!
 * - AbortController lets us cancel previous requests
 * 
 * EXAMPLE:
 * 1. User types "d" - fires request A
 * 2. User types "du" - fires request B
 * 3. User types "dun" - fires request C
 * 4. Request C returns first, shows results
 * 5. We cancel A and B so they don't overwrite C's results
 */
let currentLoadController = null;


// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * DOMContentLoaded Event Listener
 * 
 * This runs when the HTML is fully loaded.
 * It checks which page we're on and initializes the appropriate code.
 * 
 * HOW IT WORKS:
 * 1. Check if element with specific ID exists
 * 2. If yes, call the initialization function for that page
 * 
 * EXAMPLE:
 * - If #book-grid exists, we're on index.html → initPublicCatalog()
 * - If #login-form exists, we're on login.html → initAuth()
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. PUBLIC CATALOG (index.html)
    // Check if book grid exists on this page
    if (document.getElementById('book-grid')) {
        initPublicCatalog();
    }

    // 2. MY LIBRARY (my-books.html)
    // Check if loan grid exists on this page
    else if (document.getElementById('loan-grid')) {
        initMyLibrary();
    }

    // 3. AUTH (login.html)
    // Check if login form exists on this page
    else if (document.getElementById('login-form')) {
        initAuth();
    }

    // 4. SETTINGS (settings.html)
    // Check if profile form exists on this page
    else if (document.getElementById('profile-form')) {
        initSettings();
    }
});


// ============================================================================
// SECTION 1: PUBLIC CATALOG (index.html)
// ============================================================================

/**
 * initPublicCatalog - Initialize the book catalog page
 * 
 * WHAT IT DOES:
 * 1. Loads all books on page load
 * 2. Sets up search input listener (with debounce)
 * 3. Sets up sort filter listener
 * 4. Sets up availability filter listener
 */
function initPublicCatalog() {
    // Load books immediately
    loadBooks();

    // Add event listener to search input
    // debounce() waits 300ms after user stops typing
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadBooks, 300));
    }

    // Add event listener to sort dropdown
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', loadBooks);
    }

    // Add event listener to availability checkbox
    const availableFilter = document.getElementById('availableFilter');
    if (availableFilter) {
        availableFilter.addEventListener('change', loadBooks);
    }
}


/**
 * loadBooks - Fetch and display books from the API
 * 
 * WHAT IT DOES:
 * 1. Cancels any previous book request
 * 2. Gets current filter values from the page
 * 3. Fetches books from API
 * 4. Fetches trending books (if on default view)
 * 5. Combines results (trending first, then regular)
 * 6. Calls renderBooks() to display
 * 
 * HOW IT HANDLES CONCURRENT REQUESTS:
 * - Creates new AbortController
 * - Stores it in currentLoadController
 * - Previous request's signal gets aborted
 */
async function loadBooks() {
    // Cancel previous request if still running
    if (currentLoadController) {
        currentLoadController.abort();
    }

    // Create new controller for this request
    currentLoadController = new AbortController();

    // Get current filter values
    const search = document.getElementById('searchInput')?.value;
    const sort = document.getElementById('sortFilter')?.value || 'newest';
    const available = document.getElementById('availableFilter')?.checked;

    try {
        // Start building array of API calls
        const promises = [API.getBooks({ search, sort, available }, currentLoadController.signal)];

        // Only fetch trending if no filters are applied
        // (trending doesn't make sense with search/filter)
        if (!search && !available && sort === 'newest') {
            promises.push(API.getTrendingBooks());
        }

        // Wait for all API calls to complete
        const [books, trendingData] = await Promise.all(promises);

        // Start with regular books
        let finalBooks = books || [];

        // If we got trending data, add badges to those books
        if (trendingData) {
            const { mostBorrowed, topSelling, latest } = trendingData;

            // Create array of trending books with badges
            const trendingList = [];

            if (mostBorrowed) {
                trendingList.push({
                    ...mostBorrowed,
                    trendingBadge: 'Most Borrowed',
                    badgeColor: 'bg-blue-600'
                });
            }
            if (topSelling) {
                trendingList.push({
                    ...topSelling,
                    trendingBadge: 'Best Seller',
                    badgeColor: 'bg-emerald-600'
                });
            }
            if (latest) {
                trendingList.push({
                    ...latest,
                    trendingBadge: 'Just Added',
                    badgeColor: 'bg-indigo-600'
                });
            }

            // Get IDs of trending books
            const trendingIds = new Set(trendingList.map(b => b.id));

            // Combine: trending books first, then regular books (excluding duplicates)
            finalBooks = [...trendingList, ...finalBooks.filter(b => !trendingIds.has(b.id))];
        }

        // Display the books
        renderBooks(finalBooks);
    } catch (err) {
        // Ignore errors from aborted requests
        if (err.name !== 'AbortError') {
            showToast('Failed to load books', 'error');
        }
    }
}


/**
 * renderBooks - Generate HTML for book cards
 * 
 * @param {Array} books - Array of book objects
 * 
 * WHAT IT DOES:
 * 1. Updates the result count
 * 2. If no books, shows empty state
 * 3. Otherwise, generates HTML for each book card
 * 4. Injects HTML into the book grid container
 * 
 * BOOK CARD INCLUDES:
 * - Cover image
 * - Trending badge (if applicable)
 * - Ownership badge (if purchased)
 * - Availability indicator
 * - Title, author, genre
 * - Borrow and Buy buttons (with proper state)
 */
function renderBooks(books) {
    const container = document.getElementById('book-grid');
    if (!container) return;

    // Update result count
    document.getElementById('resultCount').innerText = `${books.length}`;

    // Show empty state if no books found
    if (books.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center glass-card rounded-2xl">
                <p class="text-slate-500 font-medium">No resources found.</p>
            </div>
        `;
        return;
    }

    // Generate HTML for each book
    container.innerHTML = books.map((book, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform duration-300" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden group-hover:shadow-md">
                <img src="${book.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    ${book.trendingBadge
            ? `<span class="px-2 py-0.5 ${book.badgeColor} backdrop-blur-md text-white text-[9px] font-bold uppercase rounded shadow-lg mb-1">${book.trendingBadge}</span>`
            : ''
        }
                    ${book.is_owned
            ? `<span class="px-2 py-0.5 bg-emerald-500/90 backdrop-blur-md text-white text-[9px] font-bold uppercase rounded shadow-lg">Owned</span>`
            : ''
        }
                    <span class="px-2 py-0.5 ${book.available_copies > 0 ? 'bg-white/90 text-slate-800' : 'bg-red-500/90 text-white'} backdrop-blur-md text-[9px] font-bold uppercase rounded shadow-sm">${book.available_copies}</span>
                </div>
            </div>
            <div class="p-3 flex-1 flex flex-col relative z-10">
                <div class="mb-1">
                    <span class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest truncate block">${book.genre}</span>
                </div>
                <h3 class="font-bold text-sm text-slate-900 dark:text-white leading-tight mb-0.5 line-clamp-1" title="${book.title}">${book.title}</h3>
                <p class="text-[10px] font-medium text-slate-500 mb-3 truncate">${book.author}</p>
                <div class="mt-auto grid grid-cols-2 gap-2">
                    ${renderBorrowBtn(book)}
                    ${renderBuyBtn(book)}
                </div>
            </div>
        </div>
    `).join('');
}


/**
 * renderBorrowBtn - Generate the Borrow button HTML
 * 
 * @param {Object} book - Book object
 * @returns {string} - HTML for the button
 * 
 * BUTTON STATES:
 * 1. Not logged in → "Login" button (redirects to login)
 * 2. Already owned → Disabled "Owned" button
 * 3. No copies available → Disabled "Waitlist" button
 * 4. Available → Active "Borrow" button
 */
function renderBorrowBtn(book) {
    const user = getCurrentUser();

    if (!user) {
        // Not logged in
        return `<button onclick="window.location.href='login.html'" class="w-full py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg px-2">Login</button>`;
    }

    if (book.is_owned) {
        // Already owned (can read, no need to borrow)
        return `<button disabled class="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg cursor-not-allowed">Owned</button>`;
    }

    if (book.available_copies <= 0) {
        // No copies available
        return `<button disabled class="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg cursor-not-allowed">Waitlist</button>`;
    }

    // Available to borrow
    return `<button onclick="handleBorrow(${book.id})" class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-md active:scale-95">Borrow</button>`;
}


/**
 * renderBuyBtn - Generate the Buy button HTML
 * 
 * @param {Object} book - Book object
 * @returns {string} - HTML for the button
 * 
 * BUTTON STATES:
 * 1. Not logged in → "Buy" button (redirects to login)
 * 2. Already owned → Disabled "Owned" button
 * 3. Available → Active "Buy" button with price
 */
function renderBuyBtn(book) {
    const user = getCurrentUser();
    const price = book.price ? `${Math.floor(book.price)} DZD` : 'N/A';

    if (!user) {
        // Not logged in
        return `<button onclick="window.location.href='login.html'" class="w-full py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold rounded-lg">Buy</button>`;
    }

    if (book.is_owned) {
        // Already purchased
        return `<button disabled class="w-full py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg">Owned</button>`;
    }

    // Available to purchase
    return `<button onclick="handleBuy(${book.id}, '${book.title}')" class="w-full py-1.5 border border-slate-200 hover:border-amber-500 text-slate-600 hover:text-amber-600 text-[10px] font-bold rounded-lg transition-colors">${price}</button>`;
}


/**
 * handleBorrow - Borrow a book
 * 
 * @param {number} bookId - ID of book to borrow
 * 
 * WHAT IT DOES:
 * 1. Calls API.borrowBook()
 * 2. Shows success toast
 * 3. Reloads the book list
 */
async function handleBorrow(bookId) {
    try {
        await API.borrowBook(bookId);
        showToast('Borrowed!', 'success');
        loadBooks();  // Refresh the display
    } catch (err) {
        showToast(err.message, 'error');
    }
}


/**
 * handleBuy - Purchase a book
 * 
 * @param {number} bookId - ID of book to purchase
 * @param {string} title - Book title (for confirmation dialog)
 * 
 * WHAT IT DOES:
 * 1. Shows confirmation dialog
 * 2. If confirmed, calls API.buyBook()
 * 3. Shows success toast
 * 4. Reloads the book list
 */
async function handleBuy(bookId, title) {
    if (!confirm(`Confirm purchase of "${title}"?`)) return;

    try {
        await API.buyBook(bookId);
        showToast('Purchased!', 'success');
        loadBooks();  // Refresh the display
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ============================================================================
// SECTION 2: MY LIBRARY (my-books.html)
// ============================================================================

/**
 * initMyLibrary - Initialize the My Books page
 * 
 * WHAT IT DOES:
 * 1. Checks if user is logged in
 * 2. Fetches user's loans and purchases
 * 3. Displays them on the page
 */
async function initMyLibrary() {
    // Ensure user is logged in
    checkLogin();

    try {
        // Fetch loans and purchases in parallel
        const [loans, purchases] = await Promise.all([
            API.getMyLoans(),
            API.getMyPurchases()
        ]);

        // Display them
        renderLoans(loans);
        renderPurchases(purchases);
    } catch (err) {
        showToast('Failed to load library', 'error');
    }
}


/**
 * renderLoans - Display borrowed books
 * 
 * @param {Array} loans - Array of loan objects
 * 
 * WHAT IT DOES:
 * 1. Filters to only show active loans
 * 2. Generates HTML for each loan card
 * 3. Shows overdue badge if past due date
 * 4. Shows "Relinquish" (return) button
 */
function renderLoans(loans) {
    const container = document.getElementById('loan-grid');
    if (!container) return;

    // Filter to only active loans
    const active = loans.filter(l => l.status === 'active');

    // Show empty state if no loans
    if (active.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 italic">No active loans.</div>`;
        return;
    }

    // Generate HTML for each loan
    container.innerHTML = active.map((l, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 overflow-hidden">
                <img src="${l.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover">
                <div class="absolute top-2 right-2">
                    ${isOverdue(l.due_date)
            ? `<span class="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold uppercase rounded">Overdue</span>`
            : `<span class="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-bold uppercase rounded">Active</span>`
        }
                </div>
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">${l.title}</h3>
                <p class="text-[10px] text-slate-500 mb-2 truncate">${l.author}</p>
                <div class="mt-auto">
                    <div class="flex justify-between mb-2">
                        <span class="text-[9px] font-bold text-slate-400">Due</span>
                        <span class="text-[10px] font-bold ${isOverdue(l.due_date) ? 'text-red-500' : 'text-slate-700'}">${formatDate(l.due_date)}</span>
                    </div>
                    <button onclick="returnBook(${l.id})" class="w-full py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg text-[10px] font-bold">Relinquish</button>
                </div>
            </div>
        </div>
    `).join('');
}


/**
 * renderPurchases - Display purchased books
 * 
 * @param {Array} purchases - Array of purchase objects
 * 
 * WHAT IT DOES:
 * 1. Generates HTML for each purchased book
 * 2. Shows "Owned" badge
 * 3. Shows "Read" button (placeholder for future feature)
 */
function renderPurchases(purchases) {
    const container = document.getElementById('purchase-grid');
    if (!container) return;

    // Show empty state if no purchases
    if (purchases.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 italic">No owned books.</div>`;
        return;
    }

    // Generate HTML for each purchase
    container.innerHTML = purchases.map((p, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 overflow-hidden">
                <img src="${p.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover">
                <div class="absolute top-2 right-2">
                    <span class="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold uppercase rounded">Owned</span>
                </div>
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">${p.title}</h3>
                <div class="mt-auto">
                    <button class="w-full py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">Read</button>
                </div>
            </div>
        </div>
    `).join('');
}


/**
 * returnBook - Return a borrowed book
 * 
 * @param {number} loanId - ID of the loan to return
 * 
 * WHAT IT DOES:
 * 1. Shows confirmation dialog
 * 2. If confirmed, calls API.returnBook()
 * 3. Shows success toast
 * 4. Reloads the library page
 */
async function returnBook(id) {
    if (!confirm('Return this book?')) return;

    try {
        await API.returnBook(id);
        showToast('Returned!', 'success');
        initMyLibrary();  // Refresh the page
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ============================================================================
// SECTION 3: AUTHENTICATION (login.html)
// ============================================================================

/**
 * initAuth - Initialize the login page
 * 
 * WHAT IT DOES:
 * 1. Sets up login form submission handler
 * 2. Sets up registration form submission handler
 */
function initAuth() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();  // Prevent page refresh

            try {
                const data = await API.login(
                    document.getElementById('username').value,
                    document.getElementById('password').value
                );

                if (data.success) {
                    // Store user in sessionStorage
                    sessionStorage.setItem('library_user', JSON.stringify(data.user));

                    // Redirect based on role
                    window.location.href = data.user.role === 'admin'
                        ? 'admin.html'
                        : 'index.html';
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Registration form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();  // Prevent page refresh

            try {
                const res = await API.register({
                    username: document.getElementById('reg-username').value,
                    password: document.getElementById('reg-password').value,
                    full_name: document.getElementById('reg-fullname').value,
                    email: document.getElementById('reg-email').value
                });

                if (res.success) {
                    showToast('Registered! Please login.', 'success');
                    // Switch to login view
                    toggleAuth('login');
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }
}


/**
 * toggleAuth - Switch between login and signup forms
 * 
 * @param {string} type - 'login' or 'signup'
 * 
 * WHAT IT DOES:
 * 1. Hides/shows the login form
 * 2. Hides/shows the signup form
 * 3. Updates the title
 */
window.toggleAuth = (type) => {
    const loginForm = document.getElementById('login-container');
    const signupForm = document.getElementById('signup-container');
    const title = document.getElementById('auth-title');

    if (type === 'signup') {
        // Show signup, hide login
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        title.innerText = 'Create Account.';
    } else {
        // Show login, hide signup
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        title.innerText = 'Welcome Back.';
    }
};


// ============================================================================
// SECTION 4: SETTINGS (settings.html)
// ============================================================================

/**
 * initSettings - Initialize the settings page
 * 
 * WHAT IT DOES:
 * 1. Fetches current user data
 * 2. Populates the profile form
 * 3. Sets up form submission handlers
 * 4. Sets up balance management
 */
async function initSettings() {
    // Fetch user data
    const user = await API.getMe();

    // Redirect to login if not authenticated
    if (!user || !user.user) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize the profile display
    initUserProfile(user.user);

    // Profile form submission
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            await API.updateProfile({
                full_name: document.getElementById('full-name').value,
                email: document.getElementById('email').value
            });
            showToast('Profile updated', 'success');

            // Refresh profile data
            initUserProfile((await API.getMe()).user);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Password form submission
    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            await API.updatePassword({
                currentPassword: document.getElementById('current-password').value,
                newPassword: document.getElementById('new-password').value
            });
            showToast('Password changed', 'success');
            e.target.reset();  // Clear form
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Balance submission (exposed globally for onclick)
    window.submitBalance = async () => {
        try {
            await API.addBalance(parseInt(document.getElementById('fund-amount').value));
            showToast('Balance Updated', 'success');
            closeBalanceModal();
            initUserProfile((await API.getMe()).user);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };
}


/**
 * initUserProfile - Populate user profile on the page
 * 
 * @param {Object} user - User object with data
 * 
 * WHAT IT DOES:
 * 1. Updates name display
 * 2. Updates role badge
 * 3. Updates initials avatar
 * 4. Updates balance display
 * 5. Populates form inputs
 * 6. Shows admin link if user is admin
 */
function initUserProfile(user) {
    // Display name
    document.getElementById('display-name').textContent = user.full_name || user.username;

    // Role badge
    const roleElement = document.getElementById('display-role');
    if (roleElement) {
        roleElement.textContent = (user.role || 'student').toUpperCase();
    }

    // Initials avatar
    document.getElementById('user-initials').textContent =
        (user.full_name || user.username).charAt(0).toUpperCase();

    // Balance
    document.getElementById('display-balance').textContent =
        `${Math.floor(user.balance || 0)} DZD`;

    // Form fields
    document.getElementById('full-name').value = user.full_name;
    document.getElementById('email').value = user.email || '';

    // Admin panel link
    if (user.role === 'admin') {
        document.getElementById('admin-panel-link')?.classList.remove('hidden');
    }
}


// ============================================================================
// SECTION 5: UTILITY FUNCTIONS
// ============================================================================

/**
 * debounce - Wait for user to stop typing before running function
 * 
 * @param {Function} func - Function to run
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} - Debounced function
 * 
 * EXAMPLE:
 * input.addEventListener('input', debounce(myFunction, 300));
 * 
 * WHAT HAPPENS:
 * 1. User types character 1 → starts timer (300ms)
 * 2. User types character 2 → resets timer
 * 3. User types character 3 → resets timer
 * 4. User stops typing → timer reaches 300ms → function runs
 * 
 * BENEFIT:
 * - Prevents excessive API calls while typing
 * - Only searches when user pauses
 */
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}


/**
 * toggleFilterMenu - Show/hide the filter dropdown
 * 
 * WHAT IT DOES:
 * 1. Toggles the 'hidden' class on the filter menu
 * 2. Adds click listener to close menu when clicking outside
 */
function toggleFilterMenu() {
    const menu = document.getElementById('filterMenu');
    menu.classList.toggle('hidden');

    if (!menu.classList.contains('hidden')) {
        // Menu is now visible, add click-outside listener
        document.addEventListener('click', function close(e) {
            if (!e.target.closest('#filterMenu') && !e.target.closest('#filterBtn')) {
                menu.classList.add('hidden');
                document.removeEventListener('click', close);
            }
        });
    }
}


/* ============================================================================
   END OF main.js
   ============================================================================
 */
