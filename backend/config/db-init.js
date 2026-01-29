/**
 * ============================================================================
 * DATABASE INITIALIZATION & SEEDING FILE
 * ============================================================================
 * 
 * This file is responsible for:
 * 1. Creating the database tables (schema)
 * 2. Seeding the database with sample data
 * 
 * RUN THIS FILE:
 * - Run 'npm run init-db' in the backend directory
 * - This creates/resets the library.db file
 * 
 * WHAT HAPPENS WHEN YOU RUN IT:
 * 1. Deletes existing tables (if any) - fresh start
 * 2. Creates fresh tables with proper structure
 * 3. Seeds with test users (admin, students)
 * 4. Seeds with sample books
 * 5. Creates some sample loans
 * 
 * FOR BEGINNERS:
 * - "Schema" = the structure of your database (tables, columns)
 * - "Seed data" = sample data to make the app look realistic
 * - "Migrations" = changes to the schema over time
 * ============================================================================
 */

// ============================================================================
// STEP 1: IMPORT REQUIRED MODULES
// ============================================================================

// sqlite3 - Database driver for SQLite
// This lets us create and modify the database file
const sqlite3 = require('sqlite3').verbose();

// path - Node.js built-in module for file paths
// Helps us find the database file location
const path = require('path');

// Resolve the path to the database file
// __dirname = current directory (backend)
// We go up from config/ to backend/ and look for library.db
const dbPath = path.resolve(__dirname, '../library.db');


// ============================================================================
// STEP 2: OPEN DATABASE CONNECTION
// ============================================================================

/**
 * Create a new SQLite database connection.
 * If library.db doesn't exist, SQLite will create it.
 * 
 * THE 'db' OBJECT:
 * - This is our connection to the database
 * - We use it to run SQL commands
 * - Methods: run(), get(), all(), each()
 */
const db = new sqlite3.Database(dbPath);


// ============================================================================
// STEP 3: DEFINE THE SCHEMA (CREATE TABLES)
// ============================================================================

/**
 * db.serialize() - Runs functions in order, one after another
 * This ensures our SQL commands execute in the right order
 */
db.serialize(() => {
    // Log to console so we know what's happening
    console.log('Initializing database...');

    // ========================================================================
    // STEP 3a: DROP EXISTING TABLES
    // ========================================================================
    /**
     * DROP TABLE IF EXISTS - Delete old tables if they exist
     * 
     * WHY DO THIS?
     * - When developing, we want a fresh database each time
     * - This ensures no old data conflicts with our schema
     * 
     * ORDER MATTERS!
     * - We must drop tables with FOREIGN KEY dependencies FIRST
     * - 'actions' references 'books' and 'users', so drop it first
     * - Then drop 'books' and 'users'
     */

    // Delete actions table (loans and purchases)
    // This will cascade delete all loan/purchase records
    db.run("DROP TABLE IF EXISTS actions");

    // Delete books table
    db.run("DROP TABLE IF EXISTS books");

    // Delete users table
    db.run("DROP TABLE IF EXISTS users");


    // ========================================================================
    // STEP 3b: CREATE USERS TABLE
    // ========================================================================
    /**
     * CREATE TABLE - Defines a new table in the database
     * 
     * SYNTAX:
     * CREATE TABLE IF NOT EXISTS table_name (
     *     column_name1 data_type constraints,
     *     column_name2 data_type constraints,
     *     ...
     * )
     * 
     * CONSTRAINTS:
     * - PRIMARY KEY = Unique identifier for each row
     * - AUTOINCREMENT = Automatically generates next ID
     * - UNIQUE = No two rows can have the same value
     * - NOT NULL = Value is required (can't be empty)
     * - DEFAULT = Value used if none is provided
     * - CHECK = Validation rule
     */
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,      -- Unique ID (1, 2, 3, ...)
        username TEXT UNIQUE NOT NULL,             -- Login username (must be unique)
        password TEXT NOT NULL,                    -- Hashed password (never store plain text!)
        full_name TEXT NOT NULL,                   -- User's full name
        email TEXT UNIQUE NOT NULL,                -- Email address (must be unique)
        role TEXT CHECK(role IN ('student', 'admin')) DEFAULT 'student',  -- User role
        balance REAL DEFAULT 0.00,                 -- Virtual currency balance
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- When account was created
    )`);


    // ========================================================================
    // STEP 3c: CREATE BOOKS TABLE
    // ========================================================================
    /**
     * BOOKS TABLE - Stores information about each book in the library
     * 
     * KEY COLUMNS:
     * - available_copies: Current stock (for both loans AND purchases)
     * - borrow_count: How many times this book has been borrowed
     * - purchase_count: How many times this book has been purchased
     * 
     * CHECK CONSTRAINT:
     * - Ensures available_copies never goes below 0
     * - Ensures available_copies never exceeds total_copies
     */
    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,              -- Unique book ID
        title TEXT NOT NULL,                               -- Book title
        author TEXT NOT NULL,                              -- Author name
        genre TEXT,                                        -- Book genre (can be null)
        year INTEGER,                                      -- Publication year
        isbn TEXT UNIQUE,                                  -- ISBN (must be unique)
        total_copies INTEGER DEFAULT 1,                    -- Total copies owned by library
        available_copies INTEGER DEFAULT 1,                -- Currently available copies
        cover_url TEXT,                                    -- URL to book cover image
        description TEXT,                                  -- Book description/summary
        price REAL DEFAULT 15.99,                          -- Purchase price in DZD
        borrow_count INTEGER DEFAULT 0,                    -- Times borrowed (for trending)
        purchase_count INTEGER DEFAULT 0,                  -- Times purchased (for trending)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,     -- Date added to library
        CHECK(available_copies >= 0 AND available_copies <= total_copies)  -- Inventory rules
    )`);


    // ========================================================================
    // STEP 3d: CREATE ACTIONS TABLE (LOANS + PURCHASES)
    // ========================================================================
    /**
     * ACTIONS TABLE - Unified table for loans AND purchases
     * 
     * WHY ONE TABLE?
     * - Both loans and purchases have similar fields
     * - Both link a user to a book
     * - Easier to query and manage
     * 
     * TYPE COLUMN:
     * - 'loan' = book borrowed (must return)
     * - 'purchase' = book bought (permanent ownership)
     * 
     * STATUS COLUMN:
     * - 'active' = loan in progress, book not returned yet
     * - 'returned' = loan completed, book returned
     * - 'completed' = purchase finalized
     * 
     * FOREIGN KEYS:
     * - book_id references books(id) - ensures book exists
     * - user_id references users(id) - ensures user exists
     */
    db.run(`CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,      -- Unique action ID
        user_id INTEGER NOT NULL,                  -- Who performed the action
        book_id INTEGER NOT NULL,                  -- Which book
        type TEXT CHECK(type IN ('loan', 'purchase')) NOT NULL,  -- loan or purchase
        status TEXT CHECK(status IN ('active', 'returned', 'completed')) DEFAULT 'active',  -- Current status
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,   -- When action occurred
        due_date DATETIME,                         -- Due date (for loans only)
        return_date DATETIME,                      -- When returned (for loans only)
        price INTEGER,                             -- Purchase price (for purchases only)
        FOREIGN KEY (book_id) REFERENCES books(id),  -- Link to books table
        FOREIGN KEY (user_id) REFERENCES users(id)   -- Link to users table
    )`);

    // Log that tables are created
    console.log('Tables created successfully.');


    // ========================================================================
    // STEP 4: SEED THE DATABASE WITH SAMPLE DATA
    // ========================================================================
    console.log('Seeding data...');

    // Import bcrypt for password hashing
    // We need this to hash passwords before storing them
    const bcrypt = require('bcryptjs');


    // ========================================================================
    // STEP 4a: SEED USERS
    // ========================================================================
    /**
     * SEEDING = Adding sample data to the database
     * 
     * We create:
     * - 1 admin user (for testing admin features)
     * - 2 student users (for testing regular features)
     * 
     * PASSWORD HASHING:
     * - We NEVER store passwords in plain text
     * - bcrypt.hash(password, 10) hashes the password with 10 salt rounds
     * - This makes passwords secure even if the database is leaked
     * 
     * TEST ACCOUNTS:
     * - admin / admin123
     * - student1 / pass123
     * - student2 / pass123
     */
    const seedUsers = async () => {
        // Prepare a statement for inserting users
        // "INSERT OR IGNORE" = Insert if not exists, ignore if exists
        const stmtUser = db.prepare("INSERT OR IGNORE INTO users (username, password, full_name, email, role, balance) VALUES (?, ?, ?, ?, ?, ?)");

        // Hash the passwords (10 rounds of salting)
        const adminPass = await bcrypt.hash("admin123", 10);
        const studentPass = await bcrypt.hash("pass123", 10);

        // Insert admin user (with 50,000 DZD balance for testing)
        stmtUser.run("admin", adminPass, "System Administrator", "admin@university.edu", "admin", 50000);

        // Insert student 1 (with 10,000 DZD balance)
        stmtUser.run("student1", studentPass, "John Doe", "john.doe@student.edu", "student", 10000);

        // Insert student 2 (with 2,000 DZD balance)
        stmtUser.run("student2", studentPass, "Jane Smith", "jane.smith@student.edu", "student", 2000);

        // Finalize the prepared statement (clean up)
        stmtUser.finalize();
    };


    // ========================================================================
    // STEP 4b: SEED BOOKS
    // ========================================================================
    /**
     * BOOK DATA
     * 
     * We add 13 popular books with realistic data:
     * - Real titles and authors
     * - Real genres (Self-Help, Finance, Sci-Fi, etc.)
     * - Real years of publication
     * - Real ISBNs
     * - Sample prices in DZD (Algerian Dinars)
     * - Cover image paths (relative to frontend folder)
     * 
     * WHY SAMPLE DATA?
     * - Makes the app look realistic immediately
     * - Lets testers try all features without manual entry
     * - Shows off the UI with actual content
     */
    seedUsers().then(() => {
        // Prepare statement for inserting books
        const stmtBook = db.prepare("INSERT OR IGNORE INTO books (title, author, genre, year, isbn, total_copies, available_copies, description, cover_url, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        // Array of book objects - this is our sample data
        const books = [
            {
                title: "Atomic Habits",
                author: "James Clear",
                genre: "Self-Help",
                year: 2018,
                isbn: "9780735211292",
                copies: 5,
                available: 5,
                desc: "An Easy & Proven Way to Build Good Habits & Break Bad Ones.",
                cover: "../assets/covers/atomic-habits.jpg",
                price: 3500
            },
            {
                title: "The Psychology of Money",
                author: "Morgan Housel",
                genre: "Finance",
                year: 2020,
                isbn: "9780857197689",
                copies: 6,
                available: 6,
                desc: "Timeless lessons on wealth, greed, and happiness.",
                cover: "../assets/covers/psychology-of-money.jpg",
                price: 3000
            },
            {
                title: "Dune",
                author: "Frank Herbert",
                genre: "Sci-Fi",
                year: 1965,
                isbn: "9780441172719",
                copies: 8,
                available: 8,
                desc: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.",
                cover: "../assets/covers/dune.jpg",
                price: 5000
            },
            {
                title: "Clean Code",
                author: "Robert C. Martin",
                genre: "Computer Science",
                year: 2008,
                isbn: "9780132350884",
                copies: 3,
                available: 3,
                desc: "A Handbook of Agile Software Craftsmanship.",
                cover: "../assets/covers/clean-code.jpg",
                price: 5000
            },
            {
                title: "Thinking, Fast and Slow",
                author: "Daniel Kahneman",
                genre: "Psychology",
                year: 2011,
                isbn: "9780374275631",
                copies: 5,
                available: 5,
                desc: "The two systems that drive the way we think.",
                cover: "../assets/covers/thinking-fast-slow.jpg",
                price: 3500
            },
            {
                title: "1984",
                author: "George Orwell",
                genre: "Fiction",
                year: 1949,
                isbn: "9780451524935",
                copies: 8,
                available: 8,
                desc: "Among the seminal texts of the 20th century.",
                cover: "../assets/covers/1984.jpg",
                price: 2000
            },
            {
                title: "Steve Jobs",
                author: "Walter Isaacson",
                genre: "Biography",
                year: 2011,
                isbn: "9781451648539",
                copies: 4,
                available: 4,
                desc: "The exclusive biography of Steve Jobs.",
                cover: "../assets/covers/steve-jobs.jpg",
                price: 3000
            },
            {
                title: "Sapiens",
                author: "Yuval Noah Harari",
                genre: "History",
                year: 2011,
                isbn: "9780062316097",
                copies: 6,
                available: 6,
                desc: "A brief history of humankind.",
                cover: "../assets/covers/sapiens.jpg",
                price: 3500
            },
            {
                title: "The Alchemist",
                author: "Paulo Coelho",
                genre: "Fiction",
                year: 1988,
                isbn: "9780061122415",
                copies: 7,
                available: 7,
                desc: "A fable about following your dream.",
                cover: "../assets/covers/the-alchemist.jpg",
                price: 2000
            },
            {
                title: "Rich Dad Poor Dad",
                author: "Robert T. Kiyosaki",
                genre: "Finance",
                year: 1997,
                isbn: "9781612680194",
                copies: 6,
                available: 6,
                desc: "What the Rich Teach Their Kids About Money That the Poor and Middle Class Do Not!",
                cover: "../assets/covers/rich-dad-poor-dad.jpg",
                price: 3000
            },
            {
                title: "Zero to One",
                author: "Peter Thiel",
                genre: "Business",
                year: 2014,
                isbn: "9780804139298",
                copies: 5,
                available: 5,
                desc: "Notes on Startups, or How to Build the Future.",
                cover: "../assets/covers/zero-to-one.jpg",
                price: 3500
            },
            {
                title: "The Pragmatic Programmer",
                author: "Andrew Hunt",
                genre: "Computer Science",
                year: 1999,
                isbn: "9780201616224",
                copies: 4,
                available: 4,
                desc: "From Journeyman to Master.",
                cover: "../assets/covers/pragmatic-programmer.jpg",
                price: 5000
            },
            {
                title: "Introduction to Algorithms",
                author: "Thomas H. Cormen",
                genre: "Computer Science",
                year: 2009,
                isbn: "9780262033848",
                copies: 3,
                available: 2,  // One less available (simulates borrowing)
                desc: "Comprehensive introduction to the modern study of computer algorithms.",
                cover: "../assets/covers/intro-algorithms.jpg",
                price: 5000
            }
        ];

        // Loop through the books array and insert each one
        books.forEach(b => {
            stmtBook.run(
                b.title,      // Title
                b.author,     // Author
                b.genre,      // Genre
                b.year,       // Year
                b.isbn,       // ISBN
                b.copies,     // Total copies
                b.available,  // Available copies
                b.desc,       // Description
                b.cover,      // Cover URL
                b.price       // Price
            );
        });

        // Clean up the prepared statement
        stmtBook.finalize();


        // ====================================================================
        // STEP 4c: SEED SAMPLE LOANS
        // ====================================================================
        /**
         * CREATE A SAMPLE LOAN
         * 
         * We create one active loan so the system isn't empty:
         * - User: student1 (John Doe)
         * - Book: Dune (ID 4 - the 4th book we inserted)
         * - Type: loan
         * - Status: active (not returned yet)
         * - Due date: 30 days from now
         */

        const borrowDate = new Date().toISOString();

        // Calculate due date (30 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString();

        // Prepare and run the loan insertion
        const stmtAction = db.prepare("INSERT OR IGNORE INTO actions (book_id, user_id, type, status, created_at, due_date) VALUES (?, ?, ?, ?, ?, ?)");

        // Loan 1: Dune (Book ID 4) borrowed by Student 1
        stmtAction.run(4, 2, 'loan', 'active', borrowDate, dueDateStr);
        stmtAction.finalize();


        // ====================================================================
        // STEP 4d: SETUP TRENDING DATA
        // ====================================================================
        /**
         * TRENDING BOOKS SETUP
         * 
         * The homepage shows three "trending" sections:
         * 1. Most Borrowed - highest borrow_count
         * 2. Best Seller - highest purchase_count
         * 3. Just Added - newest (most recent created_at)
         * 
         * We need to set specific values to make these sections interesting.
         * 
         * STRATEGY:
         * 1. First, reset ALL books to 0 borrow_count, 0 purchase_count
         * 2. Then set specific values for the "winners"
         * 
         * NOTE: We use setTimeout to ensure each UPDATE finishes before the next
         */

        // Reset ALL books to base state
        // datetime('now', '-60 days') sets created_at to 60 days ago
        // This makes them not show up in "Just Added"
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 1");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 2");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 3");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 4");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 5");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 6");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 7");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 8");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 9");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 10");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 11");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 12");
        db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now', '-60 days') WHERE id = 13");

        // Set the "winners" after a short delay to ensure resets complete
        setTimeout(() => {
            // 1. MOST BORROWED: Dune (ID 3) - HIGH borrow_count
            // We also reduce available copies to show it's popular
            db.run("UPDATE books SET borrow_count = 100, purchase_count = 0, created_at = datetime('now', '-60 days'), available_copies = available_copies - 2 WHERE id = 3", function (err) {
                if (err) console.error('Error setting Dune:', err);
            });

            // 2. BEST SELLER: Atomic Habits (ID 1) - HIGH purchase_count
            db.run("UPDATE books SET borrow_count = 0, purchase_count = 100, created_at = datetime('now', '-60 days'), available_copies = available_copies - 2 WHERE id = 1", function (err) {
                if (err) console.error('Error setting Atomic Habits:', err);
            });

            // 3. JUST ADDED: Intro to Algorithms (ID 13) - NEWEST date
            db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now') WHERE id = 13", function (err) {
                if (err) console.error('Error setting Intro Algo:', err);

                // Close database AFTER all updates complete
                setTimeout(() => {
                    console.log('Database initialized and seeded.');
                    console.log('✅ You can now start the server with: npm start');
                    console.log('📚 Test accounts:');
                    console.log('   Admin: admin / admin123');
                    console.log('   Student: student1 / pass123');
                    db.close();
                }, 200);
            });
        }, 500);
    });
});


/**
 * ============================================================================
 * END OF DATABASE INITIALIZATION
 * ============================================================================
 * 
 * SUMMARY OF WHAT THIS FILE DOES:
 * 1. Connects to (or creates) the SQLite database
 * 2. Drops old tables for a fresh start
 * 3. Creates new tables with proper structure
 * 4. Seeds 3 test users (1 admin, 2 students)
 * 5. Seeds 13 sample books with realistic data
 * 6. Creates 1 sample loan
 * 7. Sets up trending data for the homepage
 * 
 * TO RUN THIS FILE:
 * npm run init-db
 * 
 * ============================================================================
 */
