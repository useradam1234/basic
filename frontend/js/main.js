/* =========================================
   MAIN APP CONTROLLER
   Handles all user-facing pages:
   1. Public Catalog (index.html)
   2. Personal Library (my-books.html)
   3. Auth & Profiles (login.html, settings.html)
   ========================================= */

let currentLoadController = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. PUBLIC CATALOG
    if (document.getElementById('book-grid')) {
        initPublicCatalog();
    }
    // 2. MY LIBRARY
    else if (document.getElementById('loan-grid')) {
        initMyLibrary();
    }
    // 3. AUTH (LOGIN/SIGNUP)
    else if (document.getElementById('login-form')) {
        initAuth();
    }
    // 4. SETTINGS
    else if (document.getElementById('profile-form')) {
        initSettings();
    }
});


/* ==========================================================================
   SECTION 1: PUBLIC CATALOG (index.html)
   ========================================================================== */
function initPublicCatalog() {
    loadBooks();
    document.getElementById('searchInput')?.addEventListener('input', debounce(loadBooks, 300));
    document.getElementById('sortFilter')?.addEventListener('change', loadBooks);
    document.getElementById('availableFilter')?.addEventListener('change', loadBooks);
}

async function loadBooks() {
    if (currentLoadController) currentLoadController.abort();
    currentLoadController = new AbortController();

    const search = document.getElementById('searchInput')?.value;
    const sort = document.getElementById('sortFilter')?.value || 'newest';
    const available = document.getElementById('availableFilter')?.checked;

    try {
        const promises = [API.getBooks({ search, sort, available }, currentLoadController.signal)];
        if (!search && !available && sort === 'newest') promises.push(API.getTrendingBooks());

        const [books, trendingData] = await Promise.all(promises);
        let finalBooks = books || [];

        if (trendingData) {
            const { mostBorrowed, topSelling, latest } = trendingData;
            const trendingList = [];
            if (mostBorrowed) trendingList.push({ ...mostBorrowed, trendingBadge: 'Most Borrowed', badgeColor: 'bg-blue-600' });
            if (topSelling) trendingList.push({ ...topSelling, trendingBadge: 'Best Seller', badgeColor: 'bg-emerald-600' });
            if (latest) trendingList.push({ ...latest, trendingBadge: 'Just Added', badgeColor: 'bg-indigo-600' });

            const trendingIds = new Set(trendingList.map(b => b.id));
            finalBooks = [...trendingList, ...finalBooks.filter(b => !trendingIds.has(b.id))];
        }

        renderBooks(finalBooks);
    } catch (err) {
        if (err.name !== 'AbortError') showToast('Failed to load books', 'error');
    }
}

function renderBooks(books) {
    const container = document.getElementById('book-grid');
    if (!container) return;

    document.getElementById('resultCount').innerText = `${books.length}`;
    if (books.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center glass-card rounded-2xl"><p class="text-slate-500 font-medium">No resources found.</p></div>`;
        return;
    }

    container.innerHTML = books.map((book, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform duration-300" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 dark:bg-slate-800 overflow-hidden group-hover:shadow-md">
                <img src="${book.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    ${book.trendingBadge ? `<span class="px-2 py-0.5 ${book.badgeColor} backdrop-blur-md text-white text-[9px] font-bold uppercase rounded shadow-lg mb-1">${book.trendingBadge}</span>` : ''}
                    ${book.is_owned ? `<span class="px-2 py-0.5 bg-emerald-500/90 backdrop-blur-md text-white text-[9px] font-bold uppercase rounded shadow-lg">Owned</span>` : ''}
                    <span class="px-2 py-0.5 ${book.available_copies > 0 ? 'bg-white/90 text-slate-800' : 'bg-red-500/90 text-white'} backdrop-blur-md text-[9px] font-bold uppercase rounded shadow-sm">${book.available_copies}</span>
                </div>
            </div>
            <div class="p-3 flex-1 flex flex-col relative z-10">
                <div class="mb-1"><span class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest truncate block">${book.genre}</span></div>
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

function renderBorrowBtn(book) {
    const user = getCurrentUser();
    if (!user) return `<button onclick="window.location.href='login.html'" class="w-full py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg px-2">Login</button>`;
    if (book.is_owned) return `<button disabled class="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg cursor-not-allowed">Owned</button>`;
    if (book.available_copies <= 0) return `<button disabled class="w-full py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg cursor-not-allowed">Waitlist</button>`;
    return `<button onclick="handleBorrow(${book.id})" class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-md active:scale-95">Borrow</button>`;
}

function renderBuyBtn(book) {
    const user = getCurrentUser();
    const price = book.price ? `${Math.floor(book.price)} DZD` : 'N/A';
    if (!user) return `<button onclick="window.location.href='login.html'" class="w-full py-1.5 border border-slate-200 text-slate-500 text-[10px] font-bold rounded-lg">Buy</button>`;
    if (book.is_owned) return `<button disabled class="w-full py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg">Owned</button>`;
    return `<button onclick="handleBuy(${book.id}, '${book.title}')" class="w-full py-1.5 border border-slate-200 hover:border-amber-500 text-slate-600 hover:text-amber-600 text-[10px] font-bold rounded-lg transition-colors">${price}</button>`;
}

async function handleBorrow(bookId) {
    try { await API.borrowBook(bookId); showToast('Borrowed!', 'success'); loadBooks(); } catch (err) { showToast(err.message, 'error'); }
}
async function handleBuy(bookId, title) {
    if (!confirm(`Confirm purchase of "${title}"?`)) return;
    try { await API.buyBook(bookId); showToast('Purchased!', 'success'); loadBooks(); } catch (err) { showToast(err.message, 'error'); }
}


/* ==========================================================================
   SECTION 2: MY LIBRARY (my-books.html)
   ========================================================================== */
async function initMyLibrary() {
    checkLogin();
    try {
        const [loans, purchases] = await Promise.all([API.getMyLoans(), API.getMyPurchases()]);
        renderLoans(loans);
        renderPurchases(purchases);
    } catch (err) { showToast('Failed to load library', 'error'); }
}

function renderLoans(loans) {
    const container = document.getElementById('loan-grid');
    if (!container) return;
    const active = loans.filter(l => l.status === 'active');
    if (active.length === 0) { container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 italic">No active loans.</div>`; return; }

    container.innerHTML = active.map((l, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 overflow-hidden">
                <img src="${l.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover">
                <div class="absolute top-2 right-2">${isOverdue(l.due_date) ? `<span class="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold uppercase rounded">Overdue</span>` : `<span class="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-bold uppercase rounded">Active</span>`}</div>
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">${l.title}</h3>
                <p class="text-[10px] text-slate-500 mb-2 truncate">${l.author}</p>
                <div class="mt-auto">
                    <div class="flex justify-between mb-2"><span class="text-[9px] font-bold text-slate-400">Due</span><span class="text-[10px] font-bold ${isOverdue(l.due_date) ? 'text-red-500' : 'text-slate-700'}">${formatDate(l.due_date)}</span></div>
                    <button onclick="returnBook(${l.id})" class="w-full py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg text-[10px] font-bold">Relinquish</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPurchases(purchases) {
    const container = document.getElementById('purchase-grid');
    if (!container) return;
    if (purchases.length === 0) { container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 italic">No owned books.</div>`; return; }

    container.innerHTML = purchases.map((p, i) => `
        <div class="glass-card rounded-xl overflow-hidden group flex flex-col h-full animate-fade-in hover:-translate-y-1 transition-transform" style="--delay: ${i * 50}ms">
            <div class="relative aspect-[2/3] bg-slate-100 overflow-hidden">
                <img src="${p.cover_url || '../assets/default-cover.jpg'}" class="w-full h-full object-cover">
                <div class="absolute top-2 right-2"><span class="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold uppercase rounded">Owned</span></div>
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">${p.title}</h3>
                <div class="mt-auto"><button class="w-full py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">Read</button></div>
            </div>
        </div>
    `).join('');
}

async function returnBook(id) {
    if (!confirm('Return this book?')) return;
    try { await API.returnBook(id); showToast('Returned!', 'success'); initMyLibrary(); } catch (err) { showToast(err.message, 'error'); }
}


/* ==========================================================================
   SECTION 3: AUTH & ACCOUNT (login.html, settings.html)
   ========================================================================== */
function initAuth() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = await API.login(document.getElementById('username').value, document.getElementById('password').value);
            if (data.success) {
                sessionStorage.setItem('library_user', JSON.stringify(data.user));
                window.location.href = data.user.role === 'admin' ? 'admin.html' : 'index.html';
            }
        } catch (err) { showToast(err.message, 'error'); }
    });

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await API.register({
                username: document.getElementById('reg-username').value,
                password: document.getElementById('reg-password').value,
                full_name: document.getElementById('reg-fullname').value,
                email: document.getElementById('reg-email').value
            });
            if (res.success) { showToast('Registered! Please login.', 'success'); toggleAuth('login'); }
        } catch (err) { showToast(err.message, 'error'); }
    });
}

window.toggleAuth = (type) => {
    const loginForm = document.getElementById('login-container');
    const signupForm = document.getElementById('signup-container');
    const title = document.getElementById('auth-title');
    if (type === 'signup') {
        loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); title.innerText = 'Create Account.';
    } else {
        loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); title.innerText = 'Welcome Back.';
    }
};

async function initSettings() {
    const user = await API.getMe();
    if (!user || !user.user) { window.location.href = 'login.html'; return; }
    initUserProfile(user.user);

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await API.updateProfile({ full_name: document.getElementById('full-name').value, email: document.getElementById('email').value }); showToast('Profile updated', 'success'); initUserProfile((await API.getMe()).user); } catch (err) { showToast(err.message, 'error'); }
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await API.updatePassword({ currentPassword: document.getElementById('current-password').value, newPassword: document.getElementById('new-password').value }); showToast('Password changed', 'success'); e.target.reset(); } catch (err) { showToast(err.message, 'error'); }
    });

    window.submitBalance = async () => {
        try { await API.addBalance(parseInt(document.getElementById('fund-amount').value)); showToast('Balance Updated', 'success'); closeBalanceModal(); initUserProfile((await API.getMe()).user); } catch (err) { showToast(err.message, 'error'); }
    };
}

function initUserProfile(user) {
    document.getElementById('display-name').textContent = user.full_name || user.username;
    if (document.getElementById('display-role')) document.getElementById('display-role').textContent = (user.role || 'student').toUpperCase();
    document.getElementById('user-initials').textContent = (user.full_name || user.username).charAt(0).toUpperCase();
    document.getElementById('display-balance').textContent = `${Math.floor(user.balance || 0)} DZD`;
    document.getElementById('full-name').value = user.full_name;
    document.getElementById('email').value = user.email || '';
    if (user.role === 'admin') document.getElementById('admin-panel-link')?.classList.remove('hidden');
}

window.openBalanceModal = () => { document.getElementById('balance-modal').classList.remove('hidden'); document.getElementById('fund-amount').value = parseInt(document.getElementById('display-balance').textContent) || 0; document.getElementById('fund-amount').focus(); };
window.closeBalanceModal = () => { document.getElementById('balance-modal').classList.add('hidden'); };


/* ==========================================================================
   UTILS
   ========================================================================== */
function debounce(func, wait) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
function toggleFilterMenu() {
    const menu = document.getElementById('filterMenu');
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
        document.addEventListener('click', function close(e) { if (!e.target.closest('#filterMenu') && !e.target.closest('#filterBtn')) { menu.classList.add('hidden'); document.removeEventListener('click', close); } });
    }
}
