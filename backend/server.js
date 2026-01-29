/**
 * ============================================================================
 * UNIVERSITY LIBRARY SYSTEM - MAIN SERVER FILE
 * ============================================================================
 * 
 * This file is the MAIN ENTRY POINT of the entire application.
 * Think of it as the "front door" of the library system - everything
 * starts here!
 * 
 * WHAT THIS FILE DOES:
 * 1. Sets up the Express.js web server
 * 2. Configures middleware (session, CORS, body parsing)
 * 3. Sets up the database connection (SQLite)
 * 4. Creates helper functions for database operations
 * 5. Defines authentication middleware (guards for protected routes)
 * 6. Routes all API requests to the appropriate handler files
 * 
 * HOW IT WORKS:
 * - When you visit http://localhost:3000, this file runs first
 * - It checks what URL you requested and sends you the right file
 * - For API requests (like /api/books), it calls the right function
 * 
 * FOR BEGINNERS:
 * - "Middleware" = functions that run before your request is processed
 * - "Route" = a URL pattern that maps to a specific function
 * - "db" = database connection
 * ============================================================================
 */

// ============================================================================
// STEP 1: IMPORT REQUIRED MODULES
// ============================================================================

// Express.js - A popular web framework for Node.js
// Think of it as a tool that helps us handle HTTP requests easily
const express = require('express');

// express-session - Manages user sessions (login state)
// This allows users to stay logged in as they navigate the site
const session = require('express-session');

// cors - Cross-Origin Resource Sharing
// This allows other websites to talk to our API (if configured)
const cors = require('cors');

// body-parser - Parses JSON data sent in requests
// Example: When you submit a form, this reads the data for us
const bodyParser = require('body-parser');

// path - Node.js built-in module for file paths
// Helps us find files regardless of operating system
const path = require('path');

// sqlite3 - Database driver for SQLite
// This lets us talk to the SQLite database file
// .verbose() gives us better error messages
const sqlite3 = require('sqlite3').verbose();


// ============================================================================
// STEP 2: DEFINE AUTHENTICATION MIDDLEWARE (THE "GUARDS")
// ============================================================================

/**
 * authMiddleware - The "User Guard"
 * 
 * This is a function that runs BEFORE certain routes are accessed.
 * Think of it like a bouncer at a club - it checks if you're logged in.
 * 
 * HOW IT WORKS:
 * 1. Checks if user session exists (req.session.user)
 * 2. If yes, lets the request through (next())
 * 3. If no, sends a 401 "Unauthorized" error
 * 
 * USED FOR:
 * - Borrowing books (must be logged in)
 * - Viewing your loans (must be logged in)
 * - Buying books (must be logged in)
 */
const authMiddleware = (req, res, next) => {
    // Check if session and user exist
    if (req.session && req.session.user) {
        // User is logged in, let them through
        next();
    } else {
        // User is NOT logged in, return error
        res.status(401).json({
            success: false,
            message: 'Unauthorized: Please login first'
        });
    }
};

/**
 * adminMiddleware - The "Admin Guard"
 * 
 * This is similar to authMiddleware but checks if the user is an ADMIN.
 * Only admins can access admin-only routes.
 * 
 * USED FOR:
 * - Adding new books
 * - Deleting users
 * - Viewing all loans in the system
 * - Managing genres
 */
const adminMiddleware = (req, res, next) => {
    // Check if user exists AND has admin role
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        // User is an admin, let them through
        next();
    } else {
        // User is NOT an admin, return forbidden error
        res.status(403).json({
            success: false,
            message: 'Forbidden: Admin access required'
        });
    }
};


// ============================================================================
// STEP 3: SET UP DATABASE CONNECTION
// ============================================================================

/**
 * DATABASE SETUP
 * 
 * SQLite is a file-based database (no server needed).
 * The data is stored in 'library.db' file.
 * 
 * HOW TO THINK ABOUT IT:
 * - The database is like a digital filing cabinet
 * - Tables are like folders in that cabinet
 * - Each table holds specific types of information
 */

// Create the full path to the database file
// __dirname = the directory where this file is located
// We join it with 'library.db' to get the full path
const dbPath = path.resolve(__dirname, './library.db');

// Create a new database connection
// If library.db doesn't exist, it will be created automatically
const db = new sqlite3.Database(dbPath);


// ============================================================================
// STEP 4: CREATE DATABASE HELPER FUNCTIONS
// ============================================================================

/**
 * These helper functions wrap SQLite operations in Promises.
 * This makes them work nicely with async/await syntax.
 * 
 * WHY DO WE NEED THIS?
 * - SQLite operations are "callback-based" (old style)
 * - Promises allow us to use modern async/await syntax
 * - It's cleaner and easier to read
 */

/**
 * dbRun - For INSERT, UPDATE, DELETE operations
 * 
 * @param {string} query - The SQL query to execute
 * @param {Array} params - Parameters to substitute in the query
 * @returns {Promise} - Resolves with { id: lastInsertId, changes: rowsModified }
 */
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        // Execute the SQL query
        db.run(query, params, function (err) {
            if (err) {
                // Something went wrong, reject the promise
                reject(err);
            } else {
                // Success! Return the result
                // this.lastID = the ID of the newly inserted row
                // this.changes = how many rows were affected
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

/**
 * dbGet - For SELECT operations that return ONE row
 * 
 * @param {string} query - The SQL query to execute
 * @param {Array} params - Parameters to substitute in the query
 * @returns {Promise} - Resolves with the first row found, or undefined
 */
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

/**
 * dbAll - For SELECT operations that return MULTIPLE rows
 * 
 * @param {string} query - The SQL query to execute
 * @param {Array} params - Parameters to substitute in the query
 * @returns {Promise} - Resolves with an array of all matching rows
 */
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};


// ============================================================================
// STEP 5: INITIALIZE THE EXPRESS APPLICATION
// ============================================================================

/**
 * WHAT IS EXPRESS?
 * Express.js is a web framework that makes it easy to build web apps.
 * It handles the boring stuff (routing, parsing, error handling)
 * so we can focus on our business logic.
 */

// Create a new Express application
const app = express();

// Define the port number the server will listen on
// 3000 is a common port for development
const PORT = 3000;


// ============================================================================
// STEP 6: CONFIGURE MIDDLEWARE
// ============================================================================

/**
 * MIDDLEWARE = Functions that run on every request
 * They process the request before it reaches our route handlers
 */

// CORS (Cross-Origin Resource Sharing)
// This allows browsers to make requests to our API from different origins
// In production, you would restrict this to your actual frontend URL
app.use(cors({
    origin: 'http://localhost:3000',  // Only allow requests from this origin
    credentials: true                  // Allow cookies to be sent
}));

// body-parser - Parse JSON request bodies
// When a client sends JSON data, this makes it available in req.body
app.use(bodyParser.json());

// Parse URL-encoded bodies (like traditional form submissions)
app.use(bodyParser.urlencoded({ extended: true }));


// ============================================================================
// STEP 7: CONFIGURE SESSION MANAGEMENT
// ============================================================================

/**
 * SESSIONS = How we keep track of logged-in users
 * 
 * When a user logs in:
 * 1. We create a session and store user info in it
 * 2. We send a cookie to the browser containing the session ID
 * 3. On future requests, the browser sends this cookie
 * 4. We look up the session and know who the user is
 */
app.use(session({
    // Secret key used to sign the session cookie
    // IN PRODUCTION: Use a complex environment variable!
    secret: 'fallback-dev-secret',

    // Don't save session if nothing changed
    resave: false,

    // Don't create session for unauthenticated users
    saveUninitialized: false,

    // Cookie settings
    cookie: {
        secure: false,        // Set to true if using HTTPS
        httpOnly: true,       // Prevents JavaScript from reading the cookie (security!)
        maxAge: 1000 * 60 * 60 * 24  // Cookie expires in 24 hours (in milliseconds)
    }
}));


// ============================================================================
// STEP 8: REQUEST LOGGING MIDDLEWARE
// ============================================================================

/**
 * This middleware logs every request that comes in.
 * Great for debugging and monitoring!
 */
app.use((req, res, next) => {
    // Log the current timestamp, HTTP method, and URL
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    // Call next() to pass the request to the next middleware/route
    next();
});


// ============================================================================
// STEP 9: CONFIGURE STATIC FILE SERVING
// ============================================================================

/**
 * STATIC FILES = Files that don't change (HTML, CSS, JS, images)
 * 
 * This tells Express to serve files from the 'frontend' directory.
 * When a browser requests /frontend/pages/index.html,
 * Express will look for ./frontend/pages/index.html
 */
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));


// ============================================================================
// STEP 10: DEPENDENCY INJECTION
// ============================================================================

/**
 * DEPENDENCY INJECTION = Passing dependencies to functions
 * 
 * Instead of each route file importing the database directly,
 * we pass the database helpers to them.
 * 
 * BENEFITS:
 * - Easier to test (can pass mock databases)
 * - Cleaner code (no circular imports)
 * - More flexible
 * 
 * The 'context' object contains everything our routes need:
 * - db: The raw database connection
 * - dbRun, dbGet, dbAll: Helper functions
 * - authMiddleware: The user guard function
 * - adminMiddleware: The admin guard function
 */
const context = {
    db,                    // The database connection
    dbRun,                 // Helper for running SQL
    dbGet,                 // Helper for getting single rows
    dbAll,                 // Helper for getting multiple rows
    authMiddleware,        // The user authentication guard
    adminMiddleware        // The admin authorization guard
};


// ============================================================================
// STEP 11: ROUTE REGISTRATION
// ============================================================================

/**
 * REQUIRE - Loads a module and returns its exports
 * 
 * When we require a route file, we pass our 'context' to it.
 * The route file uses this context to access the database.
 */

// Load authentication routes and pass the context
const authRoutes = require('./routes/auth')(context);

// Load book routes (includes loans) and pass the context
const bookRoutes = require('./routes/books')(context);

// Load admin routes and pass the context
const adminRoutes = require('./routes/admin')(context);


// ============================================================================
// STEP 12: MOUNT ROUTES
// ============================================================================

/**
 * MOUNTING ROUTES = Telling Express to use these route handlers
 * 
 * All routes defined in these files will be prefixed with:
 * - /api/auth  (for authentication)
 * - /api/books (for book operations)
 * - /api/admin (for admin operations)
 */

// Mount authentication routes at /api/auth
app.use('/api/auth', authRoutes);

// Mount book routes at /api/books
// Note: Loans are now included in books routes
app.use('/api/books', bookRoutes);

// Mount admin routes at /api/admin
app.use('/api/admin', adminRoutes);


// ============================================================================
// STEP 13: ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * GLOBAL ERROR HANDLER
 * 
 * If any route throws an error, it will be caught here.
 * We log the error and send a generic error message to the client.
 */
app.use((err, req, res, next) => {
    // Log the full error stack trace (helpful for debugging)
    console.error(err.stack);

    // Send a generic error response
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server!'
    });
});


// ============================================================================
// STEP 14: START THE SERVER
// ============================================================================

/**
 * FINALLY! Start listening for requests.
 * 
 * app.listen() starts the server on the specified port.
 * The callback function runs once the server is ready.
 */
app.listen(PORT, () => {
    // Log a friendly message to let us know the server is running
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}/frontend/pages/index.html`);

    // Reminder for developers
    console.log('💡 Tip: Use npm run init-db to reset the database with sample data');
});


// ============================================================================
// EXPORTS (for testing purposes)
// ============================================================================

// We export the app so other files can import it if needed
module.exports = app;
