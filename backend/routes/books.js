/**
 * ============================================================================
 * BOOKS ROUTES FILE
 * ============================================================================
 * 
 * This file handles ALL book-related API endpoints including:
 * - Browsing and searching books
 * - Getting trending books
 * - Borrowing books (creating loans)
 * - Returning books (ending loans)
 * - Buying books (purchases)
 * - Viewing user's loans and purchases
 * 
 * FILE STRUCTURE:
 * - Each route is a function attached to the Express router
 * - All routes use dependency injection (context object)
 * - Routes that modify data are protected with authMiddleware
 * 
 * REQUEST/RESPONSE PATTERN:
 * 1. Extract data from request (params, body, query)
 * 2. Validate the data
 * 3. Query the database
 * 4. Process results
 * 5. Send JSON response
 * 
 * FOR BEGINNERS:
 * - req.params = URL parameters (e.g., /books/:id)
 * - req.body = JSON data sent in request body
 * - req.query = URL query string (e.g., ?search=test&sort=newest)
 * - res.json() = Send JSON response
 * - res.status() = Set HTTP status code
 * ============================================================================
 */

// ============================================================================
// STEP 1: IMPORT REQUIRED MODULES
// ============================================================================

// express - Web framework for creating routes
const express = require('express');

// Create a new Express router
const router = express.Router();


// ============================================================================
// STEP 2: EXPORT ROUTE FUNCTION (DEPENDENCY INJECTION)
// ============================================================================

/**
 * We export a function that receives our context object.
 * The context contains database helpers and middleware functions.
 * 
 * @param {Object} context - Contains { dbAll, dbGet, dbRun, authMiddleware }
 * @returns {Object} - The configured router
 */
module.exports = ({ dbAll, dbGet, dbRun, authMiddleware }) => {

    // ========================================================================
    // ROUTE 1: POST /api/books/buy
    // ========================================================================
    /**
     * BUY A BOOK
     * 
     * WHAT IT DOES:
     * Allows a user to purchase a book using their virtual balance.
     * 
     * PROTECTED ROUTE:
     * - User must be logged in
     * 
     * PURCHASE LOGIC:
     * 1. Check if user already owns this book
     * 2. Check if book exists and has stock
     * 3. Check if user has enough balance
     * 4. Deduct balance
     * 5. Record the purchase in 'actions' table
     * 6. Update book inventory (available_copies - 1)
     * 
     * REQUEST BODY (JSON):
     * {
     *   "bookId": 1
     * }
     * 
     * RESPONSE (JSON):
     * {
     *   "success": true,
     *   "message": "Successfully purchased Atomic Habits!",
     *   "newBalance": 6500
     * }
     */
    router.post('/buy', authMiddleware, async (req, res) => {
        // Extract book ID from request body
        const { bookId } = req.body;

        // Get user ID from session (set during login)
        const userId = req.session.user.id;

        try {
            // STEP 1: Check if user already owns this book
            // We look for a COMPLETED purchase of this book by this user
            const existing = await dbGet(
                "SELECT id FROM actions WHERE book_id = ? AND user_id = ? AND type = 'purchase' AND status = 'completed'",
                [bookId, userId]
            );

            // If found, user already owns it
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'You already own this digital master asset.'
                });
            }

            // STEP 2: Get book details
            const book = await dbGet(
                "SELECT available_copies, price, title FROM books WHERE id = ?",
                [bookId]
            );

            // If book doesn't exist
            if (!book) {
                return res.status(404).json({
                    success: false,
                    message: 'Book not found'
                });
            }

            // STEP 3: Get user's balance
            const user = await dbGet(
                "SELECT balance FROM users WHERE id = ?",
                [userId]
            );

            // Parse prices to integers (remove decimals)
            const price = Math.floor(book.price);
            const userBalance = Math.floor(user.balance || 0);

            // STEP 4: Check stock availability
            if (book.available_copies <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Out of stock for purchase. Join the waitlist.'
                });
            }

            // STEP 5: Check user balance
            if (userBalance < price) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient funds. Balance: ${userBalance} DZD. Required: ${price} DZD.`
                });
            }

            // STEP 6: Deduct balance from user's account
            // Uses SQL to subtract from current balance
            await dbRun(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                [price, userId]
            );

            // STEP 7: Record the purchase
            // Insert into 'actions' table with type='purchase'
            await dbRun(
                "INSERT INTO actions (book_id, user_id, price, type, status) VALUES (?, ?, ?, 'purchase', 'completed')",
                [bookId, userId, price]
            );

            // STEP 8: Update book inventory
            // Decrease available copies, increase purchase count
            await dbRun(
                "UPDATE books SET available_copies = available_copies - 1, purchase_count = purchase_count + 1 WHERE id = ?",
                [bookId]
            );

            // STEP 9: Return success with new balance
            const newBalance = userBalance - price;
            res.json({
                success: true,
                message: `Successfully purchased ${book.title}!`,
                newBalance
            });
        } catch (err) {
            // Log error for debugging
            console.error('Purchase error:', err);

            // Send error response
            res.status(500).json({
                success: false,
                message: 'Server error during purchase'
            });
        }
    });


    // ========================================================================
    // ROUTE 2: GET /api/books/my-purchases
    // ========================================================================
    /**
     * GET USER'S PURCHASES
     * 
     * WHAT IT DOES:
     * Returns a list of all books the current user has purchased.
     * 
     * PROTECTED ROUTE:
     * - User must be logged in
     * 
     * DATABASE QUERY:
     * - Joins 'actions' with 'books' to get book details
     * - Filters by user ID and type='purchase'
     * 
     * RESPONSE (JSON):
     * [
     *   { "id": 1, "book_id": 5, "title": "Dune", "author": "Frank Herbert", ... },
     *   { "id": 2, "book_id": 3, "title": "1984", "author": "George Orwell", ... }
     * ]
     */
    router.get('/my-purchases', authMiddleware, async (req, res) => {
        // Get user ID from session
        const userId = req.session.user.id;

        try {
            // Query to get all purchases for this user
            // Joins actions table with books table to get book details
            const purchases = await dbAll(`
                SELECT a.*, b.title, b.author, b.cover_url 
                FROM actions a 
                JOIN books b ON a.book_id = b.id 
                WHERE a.user_id = ? AND a.type = 'purchase'
            `, [userId]);

            // Return the purchases array
            res.json(purchases);
        } catch (err) {
            // Log error
            console.error('Fetch purchases error:', err);

            // Send error response
            res.status(500).json({
                success: false,
                message: 'Failed to fetch your purchases'
            });
        }
    });


    // ========================================================================
    // ROUTE 3: GET /api/books/my-loans
    // ========================================================================
    /**
     * GET USER'S LOANS
     * 
     * WHAT IT DOES:
     * Returns a list of all books the current user has borrowed.
     * 
     * PROTECTED ROUTE:
     * - User must be logged in
     * 
     * NOTE:
     * - Only returns LOANS (borrowed books), not purchases
     * - Used by the "My Books" page
     * 
     * RESPONSE (JSON):
     * [
     *   { "id": 1, "book_id": 4, "title": "Clean Code", "due_date": "2026-02-15", ... },
     *   { "id": 2, "book_id": 7, "title": "Steve Jobs", "due_date": "2026-02-20", ... }
     * ]
     */
    router.get('/my-loans', authMiddleware, async (req, res) => {
        const userId = req.session.user.id;

        try {
            // Query to get all loans for this user
            // Similar to purchases but filters by type='loan'
            const loans = await dbAll(`
                SELECT a.*, b.title, b.author, b.cover_url 
                FROM actions a 
                JOIN books b ON a.book_id = b.id 
                WHERE a.user_id = ? AND a.type = 'loan'
            `, [userId]);

            res.json(loans);
        } catch (err) {
            console.error('Fetch my-loans error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch your loans'
            });
        }
    });


    // ========================================================================
    // ROUTE 4: GET /api/books/trending
    // ========================================================================
    /**
     * GET TRENDING BOOKS
     * 
     * WHAT IT DOES:
     * Returns three "featured" books:
     * 1. Most Borrowed - highest borrow_count
     * 2. Top Selling - highest purchase_count
     * 3. Latest - most recently added (newest created_at)
     * 
     * PUBLIC ROUTE:
     * - No login required
     * - Anyone can see trending books
     * 
     * USAGE:
     * - Displayed at the top of the homepage
     * - Shows special badges on book cards
     * 
     * RESPONSE (JSON):
     * {
     *   "mostBorrowed": { "title": "Dune", "borrow_count": 100, ... },
     *   "topSelling": { "title": "Atomic Habits", "purchase_count": 100, ... },
     *   "latest": { "title": "Intro to Algorithms", "created_at": "2026-01-29", ... }
     * }
     */
    router.get('/trending', async (req, res) => {
        try {
            // Get the most borrowed book (highest borrow_count)
            const mostBorrowed = await dbGet(
                "SELECT * FROM books ORDER BY borrow_count DESC LIMIT 1"
            );

            // Get the best selling book (highest purchase_count)
            const topSelling = await dbGet(
                "SELECT * FROM books ORDER BY purchase_count DESC LIMIT 1"
            );

            // Get the newest book (most recent created_at)
            const latestInfo = await dbGet(
                "SELECT * FROM books ORDER BY created_at DESC LIMIT 1"
            );

            // Return all three as an object
            res.json({
                mostBorrowed,
                topSelling,
                latest: latestInfo
            });
        } catch (err) {
            console.error('Fetch trending error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch trending books'
            });
        }
    });


    // ========================================================================
    // ROUTE 5: GET /api/books
    // ========================================================================
    /**
     * GET ALL BOOKS (With Search & Filters)
     * 
     * WHAT IT DOES:
     * Returns a list of all books with optional search and filters.
     * 
     * PUBLIC ROUTE:
     * - No login required
     * - Anyone can browse the catalog
     * 
     * QUERY PARAMETERS:
     * - search: Search in title, author, or description
     * - genre: Filter by specific genre
     * - available: Filter to only show available books
     * - sort: Sort order (newest, oldest, price_asc, price_desc, title_asc)
     * 
     * EXAMPLE URL:
     * /api/books?search=dune&genre=Sci-Fi&sort=title_asc
     * 
     * RESPONSE (JSON):
     * [
     *   { "id": 1, "title": "Atomic Habits", "author": "James Clear", ... },
     *   { "id": 2, "title": "Clean Code", "author": "Robert C. Martin", ... }
     * ]
     */
    router.get('/', async (req, res) => {
        // Extract query parameters from URL
        const { search, genre, available } = req.query;

        // Get user ID from session if logged in (0 if not)
        // Used to show "owned" status on book cards
        const userId = req.session?.user?.id || 0;

        // ====================================================================
        // BUILD THE SQL QUERY DYNAMICALLY
        // ====================================================================

        // Start with base query
        // SELECT all columns from books table
        // LEFT JOIN with actions to check if user owns the book
        let query = `
            SELECT b.*, 
            CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as is_owned 
            FROM books b
            LEFT JOIN actions p ON b.id = p.book_id AND p.user_id = ? AND p.type = 'purchase'
            WHERE 1=1
        `;

        // Parameters array - starts with userId
        const params = [userId];

        // Add search filter if provided
        // Uses SQL LIKE for partial matching
        if (search) {
            query += " AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)";
            const searchTerm = `%${search}%`;
            // Add search term 3 times (once for each column)
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Add genre filter if provided
        if (genre) {
            query += " AND b.genre = ?";
            params.push(genre);
        }

        // Add availability filter if requested
        // Only show books with available_copies > 0
        if (available === 'true') {
            query += " AND b.available_copies > 0";
        }

        // ====================================================================
        // ADD SORTING
        // ====================================================================

        const { sort } = req.query;

        if (sort) {
            switch (sort) {
                case 'newest':
                    query += " ORDER BY b.created_at DESC";
                    break;
                case 'oldest':
                    query += " ORDER BY b.created_at ASC";
                    break;
                case 'price_asc':
                    query += " ORDER BY b.price ASC";
                    break;
                case 'price_desc':
                    query += " ORDER BY b.price DESC";
                    break;
                case 'title_asc':
                    query += " ORDER BY b.title ASC";
                    break;
                default:
                    query += " ORDER BY b.created_at DESC";
            }
        } else {
            // Default sort: newest first
            query += " ORDER BY b.created_at DESC";
        }

        try {
            // Execute the query
            const books = await dbAll(query, params);

            // Return books array
            res.json(books);
        } catch (err) {
            console.error('Fetch books error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch books'
            });
        }
    });


    // ========================================================================
    // ROUTE 6: GET /api/books/:id
    // ========================================================================
    /**
     * GET SINGLE BOOK DETAILS
     * 
     * WHAT IT DOES:
     * Returns detailed information about one specific book.
     * 
     * URL PARAMETER:
     * - :id = The book's ID in the database
     * 
     * EXAMPLE URL:
     * /api/books/5  (gets details for book with ID 5)
     * 
     * RESPONSE (JSON):
     * {
     *   "id": 5,
     *   "title": "Thinking, Fast and Slow",
     *   "author": "Daniel Kahneman",
     *   "genre": "Psychology",
     *   "year": 2011,
     *   "isbn": "9780374275631",
     *   "available_copies": 5,
     *   "price": 3500,
     *   ...
     * }
     */
    router.get('/:id', async (req, res) => {
        // Extract book ID from URL parameter
        const { id } = req.params;

        try {
            // Query for a single book by ID
            const book = await dbGet(
                "SELECT * FROM books WHERE id = ?",
                [id]
            );

            // Check if book exists
            if (!book) {
                return res.status(404).json({
                    success: false,
                    message: 'Book not found'
                });
            }

            // Return the book data
            res.json(book);
        } catch (err) {
            console.error('Fetch book error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch book details'
            });
        }
    });


    // ========================================================================
    // LOAN ROUTES (Consolidated into Books API)
    // ========================================================================

    // ========================================================================
    // ROUTE 7: POST /api/books/borrow
    // ========================================================================
    /**
     * BORROW A BOOK
     * 
     * WHAT IT DOES:
     * Creates a new loan (borrows a book for 30 days).
     * 
     * PROTECTED ROUTE:
     * - User must be logged in
     * 
     * BORROWING LOGIC:
     * 1. Check if book exists and has copies available
     * 2. Check if user already has this book on loan
     * 3. Create loan record with 30-day due date
     * 4. Update book inventory (available_copies - 1)
     * 5. Increment borrow_count (for trending)
     * 
     * REQUEST BODY (JSON):
     * {
     *   "bookId": 3
     * }
     * 
     * CONSTRAINTS:
     * - User can't borrow same book twice (if already on loan)
     * - Book must have available copies
     * 
     * DUE DATE:
     * - Set to 30 days from now
     * - User should return before this date
     */
    router.post('/borrow', authMiddleware, async (req, res) => {
        // Extract book ID from request body
        const { bookId } = req.body;

        // Get user ID from session
        const userId = req.session.user.id;

        try {
            // STEP 1: Check if book exists and has copies
            const book = await dbGet(
                "SELECT available_copies, title FROM books WHERE id = ?",
                [bookId]
            );

            if (!book) {
                return res.status(404).json({
                    success: false,
                    message: 'Book not found'
                });
            }

            if (book.available_copies <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No copies available'
                });
            }

            // STEP 2: Check if user already has this book on loan
            const existingLoan = await dbGet(
                "SELECT id FROM actions WHERE user_id = ? AND book_id = ? AND type = 'loan' AND status = 'active'",
                [userId, bookId]
            );

            if (existingLoan) {
                return res.status(400).json({
                    success: false,
                    message: 'You already have an active loan for this book'
                });
            }

            // STEP 3: Calculate due date (30 days from now)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            const dueDateStr = dueDate.toISOString();

            // STEP 4: Create loan record
            // Insert into actions table with type='loan', status='active'
            await dbRun(
                "INSERT INTO actions (book_id, user_id, due_date, type, status) VALUES (?, ?, ?, 'loan', 'active')",
                [bookId, userId, dueDateStr]
            );

            // STEP 5: Update book inventory
            // Decrease available copies, increase borrow count
            await dbRun(
                "UPDATE books SET available_copies = available_copies - 1, borrow_count = borrow_count + 1 WHERE id = ?",
                [bookId]
            );

            // Success!
            res.json({
                success: true,
                message: 'Book borrowed successfully'
            });
        } catch (err) {
            console.error('Borrow error:', err);
            res.status(500).json({
                success: false,
                message: 'Server error during borrowing'
            });
        }
    });


    // ========================================================================
    // ROUTE 8: POST /api/books/return
    // ========================================================================
    /**
     * RETURN A BORROWED BOOK
     * 
     * WHAT IT DOES:
     * Marks a loan as returned and restores the book to inventory.
     * 
     * PROTECTED ROUTE:
     * - User must be logged in
     * 
     * RETURN LOGIC:
     * 1. Find the active loan by ID
     * 2. Verify the loan belongs to this user
     * 3. Mark loan as 'returned'
     * 4. Set return_date to now
     * 5. Increase book availability
     * 
     * REQUEST BODY (JSON):
     * {
     *   "loanId": 1
     * }
     * 
     * NOTE:
     * - loanId is the ID in the 'actions' table
     * - Not the book ID
     */
    router.post('/return', authMiddleware, async (req, res) => {
        // Extract loan ID from request body
        const { loanId } = req.body;

        // Get user ID from session
        const userId = req.session.user.id;

        try {
            // STEP 1: Find the active loan
            // Must belong to this user and be a loan (not purchase)
            const loan = await dbGet(
                "SELECT book_id FROM actions WHERE id = ? AND user_id = ? AND type = 'loan' AND status != 'returned'",
                [loanId, userId]
            );

            if (!loan) {
                return res.status(404).json({
                    success: false,
                    message: 'Active loan not found'
                });
            }

            // STEP 2: Mark loan as returned
            const returnDate = new Date().toISOString();

            await dbRun(
                "UPDATE actions SET status = 'returned', return_date = ? WHERE id = ?",
                [returnDate, loanId]
            );

            // STEP 3: Restore book to inventory
            await dbRun(
                "UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
                [loan.book_id]
            );

            // Success!
            res.json({
                success: true,
                message: 'Book returned successfully'
            });
        } catch (err) {
            console.error('Return error:', err);
            res.status(500).json({
                success: false,
                message: 'Server error during return'
            });
        }
    });


    // ========================================================================
    // END OF ROUTES
    // =========================================================================

    // Return the configured router
    return router;
};


/**
 * ============================================================================
 * ROUTE SUMMARY
 * ============================================================================
 * 
 * ENDPOINT                        METHOD  DESCRIPTION
 * ------------------------------------------------------------------------
 * /api/books                      GET     List all books (with search/filter)
 * /api/books/trending             GET     Get trending books (public)
 * /api/books/:id                  GET     Get single book details
 * /api/books/buy                  POST    Purchase a book
 * /api/books/borrow               POST    Borrow a book (30-day loan)
 * /api/books/return               POST    Return a borrowed book
 * /api/books/my-loans             GET     Get user's active loans
 * /api/books/my-purchases         GET     Get user's purchases
 * 
 * PROTECTED ROUTES (require login):
 * - POST /buy, POST /borrow, POST /return
 * - GET /my-loans, GET /my-purchases
 * 
 * PUBLIC ROUTES (anyone can access):
 * - GET /, GET /trending, GET /:id
 * 
 * ============================================================================
 */
