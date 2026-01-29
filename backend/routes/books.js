const express = require('express');
const router = express.Router();

module.exports = ({ dbAll, dbGet, dbRun, authMiddleware }) => {

    // POST /api/books/buy
    router.post('/buy', authMiddleware, async (req, res) => {
        const { bookId } = req.body;
        const userId = req.session.user.id;

        try {
            // Check for existing purchase
            const existing = await dbGet("SELECT id FROM actions WHERE book_id = ? AND user_id = ? AND type = 'purchase' AND status = 'completed'", [bookId, userId]);
            if (existing) return res.status(400).json({ success: false, message: 'You already own this digital master asset.' });

            // Get book and user balance
            const book = await dbGet("SELECT available_copies, price, title FROM books WHERE id = ?", [bookId]);
            if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

            const user = await dbGet("SELECT balance FROM users WHERE id = ?", [userId]);
            const price = Math.floor(book.price);
            const userBalance = Math.floor(user.balance || 0);

            if (book.available_copies <= 0) {
                return res.status(400).json({ success: false, message: 'Out of stock for purchase. Join the waitlist.' });
            }

            if (userBalance < price) {
                return res.status(400).json({ success: false, message: `Insufficient funds. Balance: ${userBalance} DZD. Required: ${price} DZD.` });
            }

            // Deduct Balance
            await dbRun("UPDATE users SET balance = balance - ? WHERE id = ?", [price, userId]);

            // Record Purchase
            await dbRun(
                "INSERT INTO actions (book_id, user_id, price, type, status) VALUES (?, ?, ?, 'purchase', 'completed')",
                [bookId, userId, price]
            );

            // Update Inventory
            await dbRun("UPDATE books SET available_copies = available_copies - 1, purchase_count = purchase_count + 1 WHERE id = ?", [bookId]);

            // Return new balance to update frontend
            const newBalance = userBalance - price;
            res.json({ success: true, message: `Successfully purchased ${book.title}!`, newBalance });
        } catch (err) {
            console.error('Purchase error:', err);
            res.status(500).json({ success: false, message: 'Server error during purchase' });
        }
    });

    // GET /api/books/my-purchases
    router.get('/my-purchases', authMiddleware, async (req, res) => {
        const userId = req.session.user.id;
        try {
            const purchases = await dbAll(`
            SELECT a.*, b.title, b.author, b.cover_url 
            FROM actions a 
            JOIN books b ON a.book_id = b.id 
            WHERE a.user_id = ? AND a.type = 'purchase'
        `, [userId]);
            res.json(purchases);
        } catch (err) {
            console.error('Fetch purchases error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch your purchases' });
        }
    });

    // GET /api/books/my-loans (previously /api/loans/my-books)
    router.get('/my-loans', authMiddleware, async (req, res) => {
        const userId = req.session.user.id;
        try {
            const loans = await dbAll(`
            SELECT a.*, b.title, b.author, b.cover_url 
            FROM actions a 
            JOIN books b ON a.book_id = b.id 
            WHERE a.user_id = ? AND a.type = 'loan'
        `, [userId]);
            res.json(loans);
        } catch (err) {
            console.error('Fetch my-loans error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch your loans' });
        }
    });

    // GET /api/books/trending - Get featured books (MUST BE BEFORE GET / and GET /:id)
    router.get('/trending', async (req, res) => {
        try {
            const mostBorrowed = await dbGet("SELECT * FROM books ORDER BY borrow_count DESC LIMIT 1");
            const topSelling = await dbGet("SELECT * FROM books ORDER BY purchase_count DESC LIMIT 1");
            const latestInfo = await dbGet("SELECT * FROM books ORDER BY created_at DESC LIMIT 1");

            res.json({
                mostBorrowed,
                topSelling,
                latest: latestInfo
            });
        } catch (err) {
            console.error('Fetch trending error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch trending books' });
        }
    });

    // GET /api/books - Get all books with search/filters
    router.get('/', async (req, res) => {
        const { search, genre, available } = req.query;
        const userId = req.session?.user?.id || 0;

        let query = `
        SELECT b.*, 
        CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as is_owned 
        FROM books b
        LEFT JOIN actions p ON b.id = p.book_id AND p.user_id = ? AND p.type = 'purchase'
        WHERE 1=1
    `;
        const params = [userId];

        if (search) {
            query += " AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)";
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (genre) {
            query += " AND b.genre = ?";
            params.push(genre);
        }

        if (available === 'true') {
            query += " AND b.available_copies > 0";
        }

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
            query += " ORDER BY b.created_at DESC";
        }

        try {
            const books = await dbAll(query, params);
            res.json(books);
        } catch (err) {
            console.error('Fetch books error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch books' });
        }
    });

    // GET /api/books/:id - Get single book details
    router.get('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const book = await dbGet("SELECT * FROM books WHERE id = ?", [id]);
            if (!book) {
                return res.status(404).json({ success: false, message: 'Book not found' });
            }
            res.json(book);
        } catch (err) {
            console.error('Fetch book error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch book details' });
        }
    });


    // --- LOAN ROUTES (Consolidated) ---

    // POST /api/books/borrow (previously /api/loans/borrow)
    router.post('/borrow', authMiddleware, async (req, res) => {
        const { bookId } = req.body;
        const userId = req.session.user.id;

        try {
            // 1. Check if book exists and has copies
            const book = await dbGet("SELECT available_copies, title FROM books WHERE id = ?", [bookId]);
            if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
            if (book.available_copies <= 0) return res.status(400).json({ success: false, message: 'No copies available' });

            // 2. Check if user already has an active loan for this book
            const existingLoan = await dbGet("SELECT id FROM actions WHERE user_id = ? AND book_id = ? AND type = 'loan' AND status = 'active'", [userId, bookId]);
            if (existingLoan) return res.status(400).json({ success: false, message: 'You already have an active loan for this book' });

            // 3. Create loan
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            const dueDateStr = dueDate.toISOString();

            await dbRun("INSERT INTO actions (book_id, user_id, due_date, type, status) VALUES (?, ?, ?, 'loan', 'active')", [bookId, userId, dueDateStr]);
            await dbRun("UPDATE books SET available_copies = available_copies - 1, borrow_count = borrow_count + 1 WHERE id = ?", [bookId]);

            res.json({ success: true, message: 'Book borrowed successfully' });
        } catch (err) {
            console.error('Borrow error:', err);
            res.status(500).json({ success: false, message: 'Server error during borrowing' });
        }
    });

    // POST /api/books/return (previously /api/loans/return)
    router.post('/return', authMiddleware, async (req, res) => {
        const { loanId } = req.body;
        const userId = req.session.user.id;

        try {
            const loan = await dbGet("SELECT book_id FROM actions WHERE id = ? AND user_id = ? AND type = 'loan' AND status != 'returned'", [loanId, userId]);
            if (!loan) return res.status(404).json({ success: false, message: 'Active loan not found' });

            const returnDate = new Date().toISOString();
            await dbRun("UPDATE actions SET status = 'returned', return_date = ? WHERE id = ?", [returnDate, loanId]);
            await dbRun("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [loan.book_id]);

            res.json({ success: true, message: 'Book returned successfully' });
        } catch (err) {
            console.error('Return error:', err);
            res.status(500).json({ success: false, message: 'Server error during return' });
        }
    });



    return router;
};