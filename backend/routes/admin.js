const express = require('express');
const router = express.Router();

module.exports = ({ dbRun, dbAll, dbGet, authMiddleware, adminMiddleware }) => {
    // Apply admin protection to all routes in this file
    router.use(authMiddleware, adminMiddleware);

    // GET /api/admin/loans - Get all loans in the system
    router.get('/loans', async (req, res) => {
        try {
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
            res.status(500).json({ success: false, message: 'Failed to fetch all loans' });
        }
    });

    // GET /api/admin/purchases - Get all purchases in the system
    router.get('/purchases', async (req, res) => {
        try {
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
            res.status(500).json({ success: false, message: 'Failed to fetch all purchases' });
        }
    });

    // GET /api/admin/users - Get all users with loan counts
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
            res.status(500).json({ success: false, message: 'Failed to fetch users' });
        }
    });

    // GET /api/admin/users/:id/loans - Get active loans for a specific user
    router.get('/users/:id/loans', async (req, res) => {
        const { id } = req.params;
        try {
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
            res.status(500).json({ success: false, message: 'Failed to fetch user loans' });
        }
    });

    // GET /api/admin/genres - Get all genres
    router.get('/genres', async (req, res) => {
        try {
            const genres = await dbAll("SELECT DISTINCT genre as name FROM books WHERE genre IS NOT NULL ORDER BY genre ASC");
            res.json(genres);
        } catch (err) {
            console.error('Fetch genres error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch genres' });
        }
    });

    // DELETE /api/admin/genres/:name - Delete a genre (set to NULL in books)
    router.delete('/genres/:name', async (req, res) => {
        const { name } = req.params;
        try {
            await dbRun("UPDATE books SET genre = NULL WHERE genre = ?", [name]);
            res.json({ success: true, message: 'Genre deleted successfully' });
        } catch (err) {
            console.error('Delete genre error:', err);
            res.status(500).json({ success: false, message: 'Failed to delete genre' });
        }
    });



    // DELETE /api/admin/users/:id - Delete a user
    router.delete('/users/:id', async (req, res) => {
        const userId = req.params.id;
        try {
            // Cascade: delete actions (loans and purchases)
            await dbRun("DELETE FROM actions WHERE user_id = ?", [userId]);
            await dbRun("DELETE FROM users WHERE id = ?", [userId]);
            res.json({ success: true, message: 'User deleted successfully' });
        } catch (err) {
            console.error('Delete user error:', err);
            res.status(500).json({ success: false, message: 'Failed to delete user' });
        }
    });

    // PUT /api/admin/users/:id/role - Update user role
    router.put('/users/:id/role', async (req, res) => {
        const { role } = req.body;
        if (!['student', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        try {
            await dbRun("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
            res.json({ success: true, message: 'User role updated successfully' });
        } catch (err) {
            console.error('Update role error:', err);
            res.status(500).json({ success: false, message: 'Failed to update user role' });
        }
    });

    // POST /api/admin/books - Add new book
    router.post('/books', async (req, res) => {
        const { title, author, genre, year, isbn, total_copies, description, cover_url, price } = req.body;
        try {
            const result = await dbRun(`
            INSERT INTO books (title, author, genre, year, isbn, total_copies, available_copies, description, cover_url, price) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, author, genre, year, isbn, total_copies, total_copies, description, cover_url, price]);
            res.json({ success: true, bookId: result.id });
        } catch (err) {
            console.error('Admin Add book error:', err);
            res.status(500).json({ success: false, message: 'Failed to add book. ISBN might be duplicate.' });
        }
    });

    // PUT /api/admin/books/:id - Update book
    router.put('/books/:id', async (req, res) => {
        const { id } = req.params;
        const { title, author, genre, year, isbn, total_copies, description, cover_url, price } = req.body;

        try {
            // We need to adjust available_copies if total_copies changes
            const oldBook = await dbGet("SELECT total_copies, available_copies FROM books WHERE id = ?", [id]);
            if (!oldBook) return res.status(404).json({ success: false, message: 'Book not found' });

            const diff = total_copies - oldBook.total_copies;
            const newAvailable = oldBook.available_copies + diff;

            if (newAvailable < 0) {
                return res.status(400).json({ success: false, message: 'Cannot reduce total copies below currently borrowed count' });
            }

            await dbRun(`
            UPDATE books 
            SET title = ?, author = ?, genre = ?, year = ?, isbn = ?, total_copies = ?, available_copies = ?, description = ?, cover_url = ?, price = ? 
            WHERE id = ?
        `, [title, author, genre, year, isbn, total_copies, newAvailable, description, cover_url, price, id]);

            res.json({ success: true });
        } catch (err) {
            console.error('Admin Update book error:', err);
            res.status(500).json({ success: false, message: 'Failed to update book' });
        }
    });

    // DELETE /books/:id - Delete book
    // GET delete route removed for security check analysis.md

    // Dedicated DELETE route
    router.delete('/books/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const activeLoans = await dbGet("SELECT id FROM actions WHERE book_id = ? AND type = 'loan' AND status = 'active'", [id]);
            if (activeLoans) {
                return res.status(400).json({ success: false, message: 'Cannot delete book with active loans' });
            }
            await dbRun("DELETE FROM books WHERE id = ?", [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, message: 'Failed to delete book' });
        }
    });

    return router;
};

