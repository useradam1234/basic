/**
 * ============================================================================
 * ADMIN ROUTES FILE
 * ============================================================================
 * 
 * This file handles ALL administrative API endpoints:
 * - Managing books (CRUD operations)
 * - Managing users (view, delete, change role)
 * - Viewing all loans and purchases
 * - Managing genres
 * 
 * PROTECTION:
 * - ALL routes in this file require BOTH:
 *   1. Authentication (logged in)
 *   2. Admin role (user.role === 'admin')
 * 
 * FILE STRUCTURE:
 * - Routes are protected by authMiddleware AND adminMiddleware
 * - Uses dependency injection (context object)
 * - Returns detailed data for admin dashboard
 * 
 * FOR BEGINNERS:
 * - "Admin" = privileged user who can manage the system
 * - "CRUD" = Create, Read, Update, Delete operations
 * - Middleware = functions that run before the route handler
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
 * @param {Object} context - Contains { dbRun, dbAll, dbGet, authMiddleware, adminMiddleware }
 * @returns {Object} - The configured router
 */
module.exports = ({ dbRun, dbAll, dbGet, authMiddleware, adminMiddleware }) => {

    // ========================================================================
    // STEP 3: APPLY ADMIN MIDDLEWARE TO ALL ROUTES
    // ========================================================================

    /**
     * router.use(authMiddleware, adminMiddleware)
     * 
     * This line means:
     * - EVERY route in this file first runs authMiddleware
     * - THEN runs adminMiddleware
     * - ONLY then does it reach the actual route handler
     * 
     * This is a "mounting point" - all routes below are protected.
     */
    router.use(authMiddleware, adminMiddleware);


    // ========================================================================
    // ROUTE 1: GET /api/admin/loans
    // ========================================================================
    /**
     * GET ALL LOANS (Admin View)
     * 
     * WHAT IT DOES:
     * Returns a list of ALL loans in the system, regardless of user.
     * Includes user names and book titles for display.
     * 
     * DATABASE QUERY:
     * - Joins actions with books (for title)
     * - Joins actions with users (for name)
     * - Filters by type='loan'
     * - Orders by created date (newest first)
     * 
     * RESPONSE (JSON):
     * [
     *   {
     *     "id": 1,
     *     "user_id": 2,
     *     "user_name": "John Doe",
     *     "book_id": 5,
     *     "book_title": "Dune",
     *     "status": "active",
     *     "due_date": "2026-02-15",
     *     ...
     *   },
     *   ...
     * ]
     */
    router.get('/loans', async (req, res) => {
        try {
            // Query to get all loans with user and book details
            const loans = await dbAll(`
                SELECT a.*, b.title as book_title, u.full_name as user_name 
                FROM actions a 
                JOIN books b ON a.book_id = b.id 
                JOIN users u ON a.user_id = u.id
                WHERE a.type = 'loan'
                ORDER BY a.created_at DESC
            `);

            res.json(loans);
        } catch (err) {
            console.error('Admin Fetch loans error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch all loans'
            });
        }
    });


    // ========================================================================
    // ROUTE 2: GET /api/admin/purchases
    // ========================================================================
    /**
     * GET ALL PURCHASES (Admin View)
     * 
     * WHAT IT DOES:
     * Returns a list of ALL purchases in the system.
     * Shows who bought what and when.
     * 
     * SIMILAR TO:
     * - The loans route, but for purchases
     * 
     * USAGE:
     * - Admin dashboard sales tracking
     * - Revenue reports
     * - User purchase history for support
     */
    router.get('/purchases', async (req, res) => {
        try {
            // Query to get all purchases with user and book details
            const purchases = await dbAll(`
                SELECT a.*, b.title as book_title, u.full_name as user_name 
                FROM actions a 
                JOIN books b ON a.book_id = b.id 
                JOIN users u ON a.user_id = u.id
                WHERE a.type = 'purchase'
                ORDER BY a.created_at DESC
            `);

            res.json(purchases);
        } catch (err) {
            console.error('Admin Fetch purchases error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch all purchases'
            });
        }
    });


    // ========================================================================
    // ROUTE 3: GET /api/admin/users
    // ========================================================================
    /**
     * GET ALL USERS (Admin View)
     * 
     * WHAT IT DOES:
     * Returns a list of all users with their stats.
     * 
     * DATABASE QUERY:
     * - Selects all users
     * - LEFT JOIN with actions to count active loans
     * - GROUP BY user to aggregate results
     * 
     * INCLUDES:
     * - User profile info (name, email, role)
     * - Current balance
     * - Count of active loans
     * 
     * WHY LEFT JOIN?
     * - We want ALL users, even those with 0 loans
     * - LEFT JOIN keeps users even if no matching loans exist
     */
    router.get('/users', async (req, res) => {
        try {
            const users = await dbAll(`
                SELECT u.id, u.username, u.full_name, u.email, u.role, u.balance, u.created_at,
                COUNT(a.id) as active_loans 
                FROM users u 
                LEFT JOIN actions a ON u.id = a.user_id AND a.type = 'loan' AND a.status = 'active' 
                GROUP BY u.id
                ORDER BY u.created_at DESC
            `);

            res.json(users);
        } catch (err) {
            console.error('Admin Fetch users error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch users'
            });
        }
    });


    // ========================================================================
    // ROUTE 4: GET /api/admin/users/:id/loans
    // ========================================================================
    /**
     * GET SPECIFIC USER'S LOANS (Admin View)
     * 
     * WHAT IT DOES:
     * Returns all active loans for a specific user.
     * 
     * URL PARAMETER:
     * - :id = The user's ID
     * 
     * USAGE:
     * - When admin clicks on a user in the dashboard
     * - Shows what books that user currently has
     * 
     * EXAMPLE URL:
     * /api/admin/users/5/loans  (get loans for user ID 5)
     */
    router.get('/users/:id/loans', async (req, res) => {
        // Extract user ID from URL parameter
        const { id } = req.params;

        try {
            // Query for this user's active loans
            const loans = await dbAll(`
                SELECT a.*, b.title, b.cover_url, b.author 
                FROM actions a 
                JOIN books b ON a.book_id = b.id 
                WHERE a.user_id = ? AND a.type = 'loan' AND a.status = 'active'
                ORDER BY a.due_date ASC
            `, [id]);

            res.json(loans);
        } catch (err) {
            console.error('Admin Fetch user loans error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user loans'
            });
        }
    });


    // ========================================================================
    // ROUTE 5: GET /api/admin/genres
    // ========================================================================
    /**
     * GET ALL GENRES
     * 
     * WHAT IT DOES:
     * Returns a list of all unique genres in the database.
     * 
     * USAGE:
     * - Populate the genre dropdown in add/edit book form
     * - Show genre management in admin panel
     * 
     * RESPONSE (JSON):
     * [
     *   { "name": "Computer Science" },
     *   { "name": "Finance" },
     *   { "name": "Sci-Fi" },
     *   ...
     * ]
     */
    router.get('/genres', async (req, res) => {
        try {
            // Get distinct genres, ordered alphabetically
            const genres = await dbAll(
                "SELECT DISTINCT genre as name FROM books WHERE genre IS NOT NULL ORDER BY genre ASC"
            );

            res.json(genres);
        } catch (err) {
            console.error('Fetch genres error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch genres'
            });
        }
    });


    // ========================================================================
    // ROUTE 6: DELETE /api/admin/genres/:name
    // ========================================================================
    /**
     * DELETE A GENRE
     * 
     * WHAT IT DOES:
     * Removes a genre from all books (sets to NULL).
     * 
     * URL PARAMETER:
     * - :name = The genre name to delete
     * 
     * EXAMPLE URL:
     * /api/admin/genres/Sci-Fi
     * 
     * NOTE:
     * - This doesn't delete books, just removes their genre
     * - Books with this genre will have genre = NULL after this
     */
    router.delete('/genres/:name', async (req, res) => {
        // Extract genre name from URL parameter
        const { name } = req.params;

        try {
            // Update all books with this genre to NULL
            await dbRun(
                "UPDATE books SET genre = NULL WHERE genre = ?",
                [name]
            );

            res.json({ success: true, message: 'Genre deleted successfully' });
        } catch (err) {
            console.error('Delete genre error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to delete genre'
            });
        }
    });


    // ========================================================================
    // ROUTE 7: DELETE /api/admin/users/:id
    // ========================================================================
    /**
     * DELETE A USER
     * 
     * WHAT IT DOES:
     * Removes a user from the system completely.
     * 
     * CASCADE DELETE:
     * - First deletes all actions (loans/purchases) for this user
     * - Then deletes the user
     * 
     * URL PARAMETER:
     * - :id = The user's ID to delete
     * 
     * SAFETY:
     * - Cannot delete yourself (you're logged in as admin)
     * - This is a permanent action - cannot undo!
     * 
     * EXAMPLE URL:
     * DELETE /api/admin/users/5
     */
    router.delete('/users/:id', async (req, res) => {
        // Extract user ID from URL parameter
        const userId = req.params.id;

        try {
            // CASCADE: Delete user's actions first
            // This prevents foreign key errors
            await dbRun(
                "DELETE FROM actions WHERE user_id = ?",
                [userId]
            );

            // Then delete the user
            await dbRun(
                "DELETE FROM users WHERE id = ?",
                [userId]
            );

            res.json({ success: true, message: 'User deleted successfully' });
        } catch (err) {
            console.error('Delete user error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user'
            });
        }
    });


    // ========================================================================
    // ROUTE 8: PUT /api/admin/users/:id/role
    // ========================================================================
    /**
     * UPDATE USER ROLE
     * 
     * WHAT IT DOES:
     * Changes a user's role (student ↔ admin).
     * 
     * REQUEST BODY (JSON):
     * {
     *   "role": "admin"  // or "student"
     * }
     * 
     * SECURITY:
     * - Validates role is either 'student' or 'admin'
     * - Prevents invalid roles from being set
     * 
     * USE CASES:
     * - Promoting a trusted student to admin
     * - Demoting an admin who should be a regular user
     */
    router.put('/users/:id/role', async (req, res) => {
        // Extract new role from request body
        const { role } = req.body;

        // Validate role is allowed
        if (!['student', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        try {
            // Update user's role
            await dbRun(
                "UPDATE users SET role = ? WHERE id = ?",
                [role, req.params.id]
            );

            res.json({ success: true, message: 'User role updated successfully' });
        } catch (err) {
            console.error('Update role error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to update user role'
            });
        }
    });


    // ========================================================================
    // ROUTE 9: POST /api/admin/books
    // ========================================================================
    /**
     * ADD NEW BOOK
     * 
     * WHAT IT DOES:
     * Creates a new book in the library catalog.
     * 
     * REQUEST BODY (JSON):
     * {
     *   "title": "New Book",
     *   "author": "Author Name",
     *   "genre": "Fiction",
     *   "year": 2024,
     *   "isbn": "9780000000000",
     *   "total_copies": 5,
     *   "description": "Book description...",
     *   "cover_url": "path/to/cover.jpg",
     *   "price": 2500
     * }
     * 
     * DATABASE LOGIC:
     * - available_copies defaults to total_copies (all copies available)
     * - borrow_count and purchase_count default to 0
     * 
     * VALIDATION:
     * - ISBN must be unique (database constraint)
     * - All fields except genre and description are required
     */
    router.post('/books', async (req, res) => {
        // Extract all fields from request body
        const { title, author, genre, year, isbn, total_copies, description, cover_url, price } = req.body;

        try {
            // Insert the new book
            const result = await dbRun(`
                INSERT INTO books (title, author, genre, year, isbn, total_copies, available_copies, description, cover_url, price) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [title, author, genre, year, isbn, total_copies, total_copies, description, cover_url, price]);

            // Return the new book's ID
            res.json({ success: true, bookId: result.id });
        } catch (err) {
            console.error('Admin Add book error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to add book. ISBN might be duplicate.'
            });
        }
    });


    // ========================================================================
    // ROUTE 10: PUT /api/admin/books/:id
    // ========================================================================
    /**
     * UPDATE BOOK
     * 
     * WHAT IT DOES:
     * Modifies an existing book's details.
     * 
     * URL PARAMETER:
     * - :id = The book's ID to update
     * 
     * REQUEST BODY (JSON):
     * Same as POST /books, but includes the book data to update.
     * 
     * SPECIAL LOGIC:
     * - If total_copies changes, we adjust available_copies
     * - Example: Increasing total_copies by 3 means available increases by 3
     * - Example: Decreasing total_copies must not go below borrowed count
     * 
     * VALIDATION:
     * - Cannot reduce total_copies below (total_copies - available_copies)
     * - This prevents "losing" books that are currently borrowed
     */
    router.put('/books/:id', async (req, res) => {
        // Extract book ID from URL
        const { id } = req.params;

        // Extract updated fields from request body
        const { title, author, genre, year, isbn, total_copies, description, cover_url, price } = req.body;

        try {
            // Get current book state first
            const oldBook = await dbGet(
                "SELECT total_copies, available_copies FROM books WHERE id = ?",
                [id]
            );

            if (!oldBook) {
                return res.status(404).json({
                    success: false,
                    message: 'Book not found'
                });
            }

            // Calculate new available_copies
            // If we add 5 more copies, available increases by 5
            const diff = total_copies - oldBook.total_copies;
            const newAvailable = oldBook.available_copies + diff;

            // Validate: cannot reduce below 0
            if (newAvailable < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot reduce total copies below currently borrowed count'
                });
            }

            // Update the book
            await dbRun(`
                UPDATE books 
                SET title = ?, author = ?, genre = ?, year = ?, isbn = ?, total_copies = ?, available_copies = ?, description = ?, cover_url = ?, price = ? 
                WHERE id = ?
            `, [title, author, genre, year, isbn, total_copies, newAvailable, description, cover_url, price, id]);

            res.json({ success: true });
        } catch (err) {
            console.error('Admin Update book error:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to update book'
            });
        }
    });


    // ========================================================================
    // ROUTE 11: DELETE /api/admin/books/:id
    // ========================================================================
    /**
     * DELETE BOOK
     * 
     * WHAT IT DOES:
     * Removes a book from the library catalog.
     * 
     * URL PARAMETER:
     * - :id = The book's ID to delete
     * 
     * SAFETY CHECKS:
     * - Cannot delete if book has active loans
     * - This prevents orphaned loan records
     * 
     * WHAT HAPPENS:
     * - If no active loans: Book is deleted
     * - If active loans exist: Error returned, delete blocked
     * 
     * CASCADE:
     * - The database has no foreign key cascade
     * - But we check for active loans before deleting
     * - Purchases remain in actions table (orphan records)
     */
    router.delete('/books/:id', async (req, res) => {
        // Extract book ID from URL
        const { id } = req.params;

        try {
            // Check for active loans
            const activeLoans = await dbGet(
                "SELECT id FROM actions WHERE book_id = ? AND type = 'loan' AND status = 'active'",
                [id]
            );

            if (activeLoans) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete book with active loans'
                });
            }

            // Delete the book
            await dbRun(
                "DELETE FROM books WHERE id = ?",
                [id]
            );

            res.json({ success: true });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete book'
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
 * /api/admin/loans               GET     All loans in system
 * /api/admin/purchases           GET     All purchases in system
 * /api/admin/users               GET     All users with stats
 * /api/admin/users/:id/loans     GET     Specific user's loans
 * /api/admin/genres              GET     All unique genres
 * /api/admin/genres/:name        DELETE  Remove a genre
 * /api/admin/users/:id           DELETE  Delete a user
 * /api/admin/users/:id/role      PUT     Update user role
 * /api/admin/books               POST    Add new book
 * /api/admin/books/:id           PUT     Update book
 * /api/admin/books/:id           DELETE  Delete book
 * 
 * ALL ROUTES REQUIRE:
 * 1. Authentication (logged in)
 * 2. Admin role (user.role === 'admin')
 * 
 * ============================================================================
 */
