const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../library.db');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Initializing database...');

    // Drop tables if they exist (Reverse order of dependencies)
    db.run("DROP TABLE IF EXISTS actions");
    db.run("DROP TABLE IF EXISTS books");
    db.run("DROP TABLE IF EXISTS users");

    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT CHECK(role IN ('student', 'admin')) DEFAULT 'student',
        balance REAL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Books Table (Genre is now just a text field, no foreign key)
    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT,
        year INTEGER,
        isbn TEXT UNIQUE,
        total_copies INTEGER DEFAULT 1,
        available_copies INTEGER DEFAULT 1,
        cover_url TEXT,
        description TEXT,
        price REAL DEFAULT 15.99,
        borrow_count INTEGER DEFAULT 0,
        purchase_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK(available_copies >= 0 AND available_copies <= total_copies)
    )`);

    // Actions Table (Combines Loans and Purchases)
    // Type: 'loan' or 'purchase'
    // Status: 'active', 'returned', 'completed' (for purchases)
    // created_at: Borrow/Purchase date
    // due_date: For loans only
    // return_date: For loans only
    // price: For purchases only
    db.run(`CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('loan', 'purchase')) NOT NULL,
        status TEXT CHECK(status IN ('active', 'returned', 'completed')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        due_date DATETIME,
        return_date DATETIME,
        price INTEGER,
        FOREIGN KEY (book_id) REFERENCES books(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    console.log('Seeding data...');
    const bcrypt = require('bcryptjs');

    // Seed Users
    const seedUsers = async () => {
        const stmtUser = db.prepare("INSERT OR IGNORE INTO users (username, password, full_name, email, role, balance) VALUES (?, ?, ?, ?, ?, ?)");

        const adminPass = await bcrypt.hash("admin123", 10);
        const studentPass = await bcrypt.hash("pass123", 10);

        stmtUser.run("admin", adminPass, "System Administrator", "admin@university.edu", "admin", 50000);
        stmtUser.run("student1", studentPass, "John Doe", "john.doe@student.edu", "student", 10000);
        stmtUser.run("student2", studentPass, "Jane Smith", "jane.smith@student.edu", "student", 2000);
        stmtUser.finalize();
    };

    seedUsers().then(() => {
        // Seed Books
        const stmtBook = db.prepare("INSERT OR IGNORE INTO books (title, author, genre, year, isbn, total_copies, available_copies, description, cover_url, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

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
                available: 2,
                desc: "Comprehensive introduction to the modern study of computer algorithms.",
                cover: "../assets/covers/intro-algorithms.jpg",
                price: 5000
            }
        ];

        books.forEach(b => {
            stmtBook.run(b.title, b.author, b.genre, b.year, b.isbn, b.copies, b.available, b.desc, b.cover, b.price);
        });

        stmtBook.finalize();

        // Seed Loans into Actions
        const borrowDate = new Date().toISOString();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString();

        const stmtAction = db.prepare("INSERT OR IGNORE INTO actions (book_id, user_id, type, status, created_at, due_date) VALUES (?, ?, ?, ?, ?, ?)");

        // Loan 1: Dune (Book ID 4) borrowed by Student 1
        stmtAction.run(4, 2, 'loan', 'active', borrowDate, dueDateStr);
        stmtAction.finalize();

        // Update availability and counts for seeded data to ensure distinct trending sections


        // Strategy: Set EVERY book explicitly to avoid any ambiguity
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

        // Now set the three winners with a delay to ensure resets complete
        setTimeout(() => {
            // 1. Most Borrowed: Dune (ID 3) - HIGH borrow_count ONLY
            db.run("UPDATE books SET borrow_count = 100, purchase_count = 0, created_at = datetime('now', '-60 days'), available_copies = available_copies - 2 WHERE id = 3", function (err) {
                if (err) console.error('Error setting Dune:', err);
            });

            // 2. Best Seller: Atomic Habits (ID 1) - HIGH purchase_count ONLY
            db.run("UPDATE books SET borrow_count = 0, purchase_count = 100, created_at = datetime('now', '-60 days'), available_copies = available_copies - 2 WHERE id = 1", function (err) {
                if (err) console.error('Error setting Atomic Habits:', err);
            });

            // 3. Just Added: Intro to Algorithms (ID 13) - NEWEST date ONLY
            db.run("UPDATE books SET borrow_count = 0, purchase_count = 0, created_at = datetime('now') WHERE id = 13", function (err) {
                if (err) console.error('Error setting Intro Algo:', err);

                // Close database AFTER all updates complete
                setTimeout(() => {
                    console.log('Database initialized and seeded.');
                    db.close();
                }, 200);
            });
        }, 500);
    });
});