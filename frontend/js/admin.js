/**
 * ============================================================================
 * ADMIN DASHBOARD CONTROLLER - admin.js
 * ============================================================================
 * 
 * This file handles the ADMIN DASHBOARD page functionality:
 * 
 * 1. USER MANAGEMENT
 *    - View all users
 *    - View user's active loans
 *    - Promote/demote users (admin/student)
 *    - Delete users
 * 
 * 2. BOOK MANAGEMENT
 *    - View all books
 *    - Add new books
 *    - Edit existing books
 *    - Delete books
 * 
 * 3. CIRCULATION (LOANS)
 *    - View all loans
 *    - See overdue status
 * 
 * 4. GENRE MANAGEMENT
 *    - View all genres
 *    - Add new genres
 *    - Delete genres
 * 
 * FILE STRUCTURE:
 * - Uses initAdmin() as entry point
 * - Loads all data in parallel (Promise.all)
 * - Tab-based navigation system
 * 
 * FOR BEGINNERS:
 * - "Admin" = privileged user who manages the system
 * - "Circulation" = the flow of books in and out (loans/returns)
 * ============================================================================
 */

// ============================================================================
// GLOBAL STATE
// ============================================================================

/**
 * currentBooks - Cached array of all books
 * 
 * WHY CACHE?
 * - Reduces API calls
 * - Can filter/sort locally without refetching
 * - Needed when editing books (to find the right one)
 */
let currentBooks = [];

/**
 * catalogLoans - Cached array of all loans
 * 
 * Used for the Circulation tab.
 */
let catalogLoans = [];


// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * initAdmin - Initialize the admin dashboard
 * 
 * WHAT IT DOES:
 * 1. Checks if user is admin (redirect if not)
 * 2. Loads all data in parallel
 *    - Books
 *    - Loans
 *    - Users
 *    - Genres
 * 
 * PROMISE.ALL BENEFIT:
 * - Loads all data simultaneously
 * - Faster than loading one by one
 * - Waits for ALL to complete before showing page
 */
async function initAdmin() {
    // Check if user is admin (redirects if not)
    checkAdmin();

    // Load all data in parallel
    await Promise.all([
        loadBooks(),
        loadLoans(),
        loadUsers(),
        loadGenres()
    ]);
}


// ============================================================================
// BOOK MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * loadBooks - Fetch and cache all books
 * 
 * WHAT IT DOES:
 * 1. Calls API to get all books
 * 2. Stores in currentBooks array
 * 3. Calls renderBooksTable() to display
 */
async function loadBooks() {
    try {
        // Fetch all books (limit 100 to get all)
        currentBooks = await API.getBooks({ limit: 100 });

        // Display them
        renderBooksTable();
    } catch (err) {
        console.error('Failed to load books', err);
    }
}


/**
 * renderBooksTable - Generate HTML for the books table
 * 
 * WHAT IT DOES:
 * 1. Loops through currentBooks
 * 2. Creates a table row for each book
 * 3. Shows cover, title, author, genre, inventory
 * 4. Shows Edit and Delete action buttons
 */
function renderBooksTable() {
    const tbody = document.getElementById('books-table-body');
    if (!tbody) return;

    // Generate HTML for each book
    tbody.innerHTML = currentBooks.map(book => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td class="px-6 py-5">
                <img src="${book.cover_url || '../assets/default-cover.jpg'}" class="w-10 h-14 object-cover rounded shadow-md border border-white/10">
            </td>
            <td class="px-8 py-5">
                <div>
                    <div class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">${book.title}</div>
                    <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">${book.isbn}</div>
                </div>
            </td>
            <td class="px-8 py-5 text-sm font-bold text-slate-600 dark:text-slate-400">${book.author}</td>
            <td class="px-8 py-5">
                <span class="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-[10px] font-black uppercase tracking-widest">${book.genre || 'Uncategorized'}</span>
            </td>
            <td class="px-8 py-5">
                <div class="text-sm font-black text-slate-900 dark:text-white">
                    ${book.available_copies} <span class="text-[10px] text-slate-400 dark:text-slate-500">/ ${book.total_copies}</span>
                </div>
            </td>
            <td class="px-8 py-5 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="openEditModal(${book.id})" class="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteBook(${book.id})" class="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 00-2-2m-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * loadUsers - Fetch and display all users
 * 
 * WHAT IT DOES:
 * 1. Calls API to get all users
 * 2. Passes to renderUsersTable()
 */
async function loadUsers() {
    try {
        const users = await API.getUsers();
        renderUsersTable(users);
    } catch (err) {
        console.error('Failed to load users', err);
    }
}


/**
 * renderUsersTable - Generate HTML for the users table
 * 
 * DISPLAYS:
 * - User avatar with initials
 * - Name and email
 * - Role badge (admin/student)
 * - Balance
 * - Active loans count
 * - Action buttons (view loans, promote/demote, delete)
 */
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td class="px-8 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
                        ${user.full_name.charAt(0)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-slate-900 dark:text-white">${user.full_name}</div>
                        <div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-8 py-5">
                <span class="px-2 py-1 ${user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-500/10 text-slate-500'} rounded text-[10px] font-black uppercase tracking-widest">
                    ${user.role}
                </span>
            </td>
            <td class="px-8 py-5 text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono text-right border-r border-slate-100 dark:border-slate-800/50">
                ${Math.floor(user.balance || 0)} DZD
            </td>
            <td class="px-8 py-5 text-sm font-bold text-slate-900 dark:text-white font-mono text-center">${user.active_loans}</td>
            <td class="px-8 py-5 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="viewUserDetails(${user.id})" class="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="View Loans">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </button>
                    ${user.role !== 'admin' ? `
                    <button onclick="toggleUserRole(${user.id}, 'admin')" class="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Promote to Admin">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                        </svg>
                    </button>` : `
                    <button onclick="toggleUserRole(${user.id}, 'student')" class="p-2 text-slate-500 hover:bg-slate-500/10 rounded-lg transition-colors" title="Demote to Student">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </button>`}
                    <button onclick="deleteUser(${user.id})" class="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete User">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 00-2-2m-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


/**
 * deleteUser - Delete a user
 * 
 * @param {number} id - User ID to delete
 * 
 * CONFIRMATION:
 * - Shows confirmation dialog before deleting
 * - Warns that all loans/history will be deleted
 */
async function deleteUser(id) {
    if (!confirm('Are you sure? This will delete the user and all their loans/history.')) return;

    try {
        await API.deleteUser(id);
        showToast('User deleted successfully', 'success');
        loadUsers();  // Refresh the table
    } catch (err) {
        showToast('Failed to delete user', 'error');
    }
}


/**
 * toggleUserRole - Change user's role
 * 
 * @param {number} id - User ID
 * @param {string} role - New role ('admin' or 'student')
 */
async function toggleUserRole(id, role) {
    if (!confirm(`Change user role to ${role}?`)) return;

    try {
        await API.updateUserRole(id, role);
        showToast('User role updated', 'success');
        loadUsers();  // Refresh the table
    } catch (err) {
        showToast('Failed to update role', 'error');
    }
}


/**
 * viewUserDetails - Show a user's active loans in a modal
 * 
 * @param {number} userId - User ID to view
 */
async function viewUserDetails(userId) {
    // Show the modal
    const modal = document.getElementById('user-modal');
    modal.classList.remove('hidden');

    // Show loading state
    const listContainer = document.getElementById('user-loans-list');
    listContainer.innerHTML = '<div class="text-center py-8 text-slate-500">Loading loans...</div>';

    try {
        // Fetch user's loans
        const loans = await API.getUserLoans(userId);

        if (loans.length === 0) {
            listContainer.innerHTML = '<div class="text-center py-8 text-slate-500 italic">No active loans found for this user.</div>';
            return;
        }

        // Generate HTML for loans
        listContainer.innerHTML = loans.map(loan => `
            <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <img src="${loan.cover_url || '../assets/default-cover.jpg'}" class="w-12 h-16 object-cover rounded shadow-md">
                <div class="flex-1">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-1">${loan.title}</h4>
                    <p class="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">${loan.author}</p>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-mono text-slate-400">Due: ${formatDate(loan.due_date)}</span>
                        ${isOverdue(loan.due_date)
                ? '<span class="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">OVERDUE</span>'
                : ''
            }
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        listContainer.innerHTML = '<div class="text-center py-8 text-rose-500">Failed to load user loans.</div>';
    }
}


/**
 * closeUserModal - Hide the user details modal
 */
function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}


// ============================================================================
// GENRE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * loadGenres - Fetch all genres and update dropdown
 * 
 * @returns {Array} - Array of genre objects
 */
async function loadGenres() {
    try {
        const genres = await API.getGenres();
        const safeGenres = Array.isArray(genres) ? genres : [];

        // Populate the genre dropdown in add/edit book modal
        const select = document.getElementById('genre');
        if (select) {
            const currentVal = select.value;
            select.innerHTML = safeGenres.map(g =>
                `<option value="${g.name}">${g.name}</option>`
            ).join('');
            if (currentVal) select.value = currentVal;
        }
        return safeGenres;
    } catch (err) {
        console.error('Failed to load genres', err);
        return [];
    }
}


/**
 * openGenreModal - Show the genre management modal
 */
function openGenreModal() {
    const modal = document.getElementById('genre-modal');
    if (modal) {
        modal.classList.remove('hidden');
        renderGenreList();
    }
}


/**
 * closeGenreModal - Hide the genre management modal
 */
function closeGenreModal() {
    const modal = document.getElementById('genre-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}


/**
 * renderGenreList - Display all genres in the modal
 */
async function renderGenreList() {
    const list = document.getElementById('genre-list');
    if (!list) return;

    // Show loading state
    list.innerHTML = '<div class="text-center py-4 text-slate-500">Loading...</div>';

    const genres = await loadGenres();

    if (genres.length === 0) {
        list.innerHTML = '<div class="text-center py-4 text-slate-500 italic">No genres found.</div>';
        return;
    }

    // Generate HTML for each genre
    list.innerHTML = genres.map(g => `
        <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">${g.name}</span>
            <button onclick="deleteGenre('${g.name}')" class="text-rose-500 hover:text-rose-600 p-1" title="Delete">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 00-2-2m-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `).join('');
}


/**
 * addNewGenre - Create a new genre
 */
async function addNewGenre() {
    const input = document.getElementById('new-genre-name');
    const name = input.value.trim();
    if (!name) return;

    try {
        await API.addGenre(name);
        showToast('Genre added successfully', 'success');
        input.value = '';
        await renderGenreList();
    } catch (err) {
        showToast('Failed to add genre', 'error');
    }
}


/**
 * deleteGenre - Remove a genre
 * 
 * @param {string} name - Genre name to delete
 */
async function deleteGenre(name) {
    try {
        await API.deleteGenre(name);
        showToast('Genre deleted', 'success');
        await renderGenreList();
        loadBooks();  // Refresh books to show updated genres
    } catch (err) {
        showToast('Failed to delete genre', 'error');
    }
}


// ============================================================================
// LOAN MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * loadLoans - Fetch all loans and display them
 */
async function loadLoans() {
    try {
        catalogLoans = await API.getAllLoans();
        renderLoansTable();
    } catch (err) {
        console.error('Failed to load loans', err);
    }
}


/**
 * renderLoansTable - Generate HTML for the loans table
 */
function renderLoansTable() {
    const tbody = document.getElementById('loans-table-body');
    if (!tbody) return;

    tbody.innerHTML = catalogLoans.map(loan => {
        // Check if overdue
        const overdue = isOverdue(loan.due_date) && loan.status === 'active';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td class="px-8 py-5 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight font-mono">${loan.user_name || 'ID: ' + loan.user_id}</td>
                <td class="px-8 py-5 text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">${loan.book_title}</td>
                <td class="px-8 py-5 text-sm font-bold ${overdue ? 'text-rose-500' : 'text-slate-500'} font-mono">${formatDate(loan.due_date)}</td>
                <td class="px-8 py-5">
                    <span class="px-2 py-1 ${loan.status === 'returned'
                ? 'bg-green-500/10 text-green-500'
                : (overdue
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-blue-500/10 text-blue-500')} rounded text-[10px] font-black uppercase tracking-widest">
                        ${loan.status === 'returned'
                ? 'Archive'
                : (overdue
                    ? 'Critical'
                    : 'Active')}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}


// ============================================================================
// TAB NAVIGATION
// ============================================================================

/**
 * switchTab - Switch between admin dashboard tabs
 * 
 * @param {string} tabId - The tab to show (books, loans, users, genres)
 * 
 * WHAT IT DOES:
 * 1. Hides all tab content divs
 * 2. Shows the requested tab content
 * 3. Updates button styling (active state)
 */
function switchTab(tabId) {
    // Hide all tab content
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));

    // Show requested tab
    const targeted = document.getElementById(`${tabId}-tab`);
    if (targeted) targeted.classList.remove('hidden');

    // Reset all tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-slate-900', 'text-white', 'shadow-sm', 'dark:bg-white', 'dark:text-slate-900');
        b.classList.add('text-slate-500', 'dark:text-slate-400');
    });

    // Find and highlight the active button
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b =>
        b.textContent.toLowerCase().includes(
            tabId === 'books' ? 'books' :
                (tabId === 'loans' ? 'circulation' :
                    (tabId === 'users' ? 'users' : 'genres'))
        ));

    if (activeBtn) {
        activeBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-sm', 'dark:bg-white', 'dark:text-slate-900');
    }
}


// ============================================================================
// BOOK FORM MODAL FUNCTIONS
// ============================================================================

/**
 * openAddModal - Open the add book modal
 * 
 * WHAT IT DOES:
 * 1. Clears the form
 * 2. Sets the hidden book ID field to empty
 * 3. Updates the modal title
 * 4. Shows the modal
 */
function openAddModal() {
    document.getElementById('book-id').value = '';
    document.getElementById('book-form').reset();
    document.getElementById('modal-title').innerHTML = '<span class="w-1 h-6 bg-blue-600 rounded-full"></span>Add New Book';
    document.getElementById('book-modal').classList.remove('hidden');
}


/**
 * openEditModal - Open the edit book modal
 * 
 * @param {number} id - Book ID to edit
 * 
 * WHAT IT DOES:
 * 1. Finds the book in currentBooks
 * 2. Populates form fields with book data
 * 3. Sets the hidden book ID field
 * 4. Updates the modal title
 * 5. Shows the modal
 */
function openEditModal(id) {
    const book = currentBooks.find(b => b.id === id);
    if (!book) return;

    // Populate form fields
    document.getElementById('book-id').value = book.id;
    document.getElementById('title').value = book.title;
    document.getElementById('author').value = book.author;
    document.getElementById('genre').value = book.genre;
    document.getElementById('year').value = book.year;
    document.getElementById('isbn').value = book.isbn;
    document.getElementById('total_copies').value = book.total_copies;
    document.getElementById('price').value = book.price;
    document.getElementById('cover_url').value = book.cover_url || '';
    document.getElementById('description').value = book.description || '';

    // Update title and show modal
    document.getElementById('modal-title').innerHTML = '<span class="w-1 h-6 bg-blue-600 rounded-full"></span>Edit Book Configuration';
    document.getElementById('book-modal').classList.remove('hidden');
}


/**
 * closeModal - Hide the book form modal
 */
function closeModal() {
    document.getElementById('book-modal').classList.add('hidden');
}


/**
 * handleBookSubmit - Process the add/edit book form
 * 
 * @param {Event} e - Form submit event
 * 
 * LOGIC:
 * 1. Prevent default form submission
 * 2. Get form data
 * 3. Check if editing (has ID) or adding (no ID)
 * 4. Call appropriate API method
 * 5. Show toast and refresh data
 */
async function handleBookSubmit(e) {
    e.preventDefault();

    // Get the book ID (empty if adding new)
    const id = document.getElementById('book-id').value;

    // Collect form data
    const data = {
        title: document.getElementById('title').value,
        author: document.getElementById('author').value,
        genre: document.getElementById('genre').value,
        year: parseInt(document.getElementById('year').value),
        isbn: document.getElementById('isbn').value,
        total_copies: parseInt(document.getElementById('total_copies').value),
        price: parseInt(document.getElementById('price').value),
        cover_url: document.getElementById('cover_url').value,
        description: document.getElementById('description').value
    };

    try {
        if (id) {
            // Editing existing book
            await API.updateBook(id, data);
            showToast('Book updated successfully', 'success');
        } else {
            // Adding new book
            await API.addBook(data);
            showToast('Book added successfully', 'success');
        }

        closeModal();
        loadBooks();  // Refresh the table
    } catch (err) {
        showToast(err.message || 'Operation failed', 'error');
    }
}


/**
 * deleteBook - Delete a book
 * 
 * @param {number} id - Book ID to delete
 */
async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) return;

    try {
        await API.deleteBook(id);
        showToast('Book deleted successfully', 'success');
        loadBooks();  // Refresh the table
    } catch (err) {
        showToast(err.message || 'Failed to delete book', 'error');
    }
}


// ============================================================================
// DOMContentLoaded INITIALIZATION
// ============================================================================

/**
 * Set up event listeners when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Get the book form
    const bookForm = document.getElementById('book-form');
    if (bookForm) {
        bookForm.addEventListener('submit', handleBookSubmit);
    }

    // Initialize the admin dashboard
    initAdmin();
});


/* ============================================================================
   END OF admin.js
   ============================================================================
 */
