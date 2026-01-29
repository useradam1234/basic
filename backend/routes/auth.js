/**
 * ============================================================================
 * AUTHENTICATION ROUTES FILE
 * ============================================================================
 * 
 * This file handles ALL authentication-related API endpoints.
 * It contains routes for:
 * - User registration
 * - User login
 * - User logout
 * - Getting current user info
 * - Updating profile
 * - Changing password
 * - Adding balance
 * 
 * FILE STRUCTURE:
 * - Each route is a function that takes the Express 'router'
 * - Routes are exported as a function that receives our 'context'
 * - This is called "dependency injection"
 * 
 * REQUEST/RESPONSE CYCLE:
 * 1. Client sends HTTP request (POST, GET, PUT, DELETE)
 * 2. Express matches the URL to a route here
 * 3. Route handler processes the request
 * 4. Handler queries the database
 * 5. Handler sends JSON response
 * 6. Client receives response and updates UI
 * 
 * FOR BEGINNERS:
 * - POST = send data to create something
 * - GET = retrieve data
 * - PUT = update existing data
 * - DELETE = remove something
 * ============================================================================
 */

// ============================================================================
// STEP 1: IMPORT REQUIRED MODULES
// ============================================================================

// express - Web framework for creating routes
const express = require('express');

// bcryptjs - Library for hashing passwords
// NEVER store passwords in plain text!
const bcrypt = require('bcryptjs');

// Create a new Express router
// Think of router as a "mini app" that handles specific routes
const router = express.Router();


// ============================================================================
// STEP 2: EXPORT ROUTE FUNCTION (DEPENDENCY INJECTION)
// ============================================================================

/**
 * We export a function that receives our 'context' object.
 * This is called "dependency injection" - we pass dependencies in.
 * 
 * WHY DO THIS?
 * - Makes the code testable (can pass mock databases)
 * - Avoids circular dependencies
 * - Makes dependencies explicit
 * 
 * @param {Object} context - Contains { dbGet, dbRun } from server.js
 * @returns {Object} - The configured router
 */
module.exports = ({ dbGet, dbRun }) => {

    // ========================================================================
    // ROUTE 1: POST /api/auth/register
    // ========================================================================
    /**
     * REGISTER A NEW USER
     * 
     * WHAT IT DOES:
     * Creates a new user account in the database
     * 
     * REQUEST BODY (JSON):
     * {
     *   "username": "john123",
     *   "password": "mypassword",
     *   "full_name": "John Doe",
     *   "email": "john@email.com"
     * }
     * 
     * STEPS:
     * 1. Validate that all required fields are present
     * 2. Hash the password (security!)
     * 3. Insert user into database
     * 4. Return success message
     * 
     * ERROR HANDLING:
     * - If fields are missing: 400 Bad Request
     * - If username/email exists: 400 Bad Request
     * - If database error: 500 Internal Server Error
     */
    router.post('/register', async (req, res) => {
        // Extract data from request body
        const { username, password, full_name, email } = req.body;

        // VALIDATION: Check that all required fields are provided
        if (!username || !password || !full_name || !email) {
            // Return 400 status with error message
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        try {
            // SECURITY: Hash the password before storing it
            // bcrypt.hash(password, saltRounds)
            // 10 salt rounds is a good balance of security and performance
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert the new user into the database
            // We hash the password instead of storing it plain text!
            await dbRun(
                "INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, 'student')",
                [username, hashedPassword, full_name, email]
            );

            // Success! Send positive response
            res.json({ success: true, message: 'Registration successful! Please login.' });
        } catch (err) {
            // ERROR HANDLING: Check what kind of error occurred
            if (err.message.includes('UNIQUE')) {
                // Username or email already exists in database
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }

            // Database or other server error
            res.status(500).json({
                success: false,
                message: 'Server error during registration'
            });
        }
    });


    // ========================================================================
    // ROUTE 2: POST /api/auth/login
    // ========================================================================
    /**
     * LOGIN USER
     * 
     * WHAT IT DOES:
     * Verifies user credentials and creates a session
     * 
     * REQUEST BODY (JSON):
     * {
     *   "username": "admin",
     *   "password": "admin123"
     * }
     * 
     * STEPS:
     * 1. Find user by username in database
     * 2. Compare provided password with stored hash
     * 3. If match, create session with user info
     * 4. Return user info to client
     * 
     * SESSION STORAGE:
     * - User info is stored in req.session.user
     * - This persists across requests (cookies!)
     * - Client can access this info without logging in again
     */
    router.post('/login', async (req, res) => {
        // Extract credentials from request body
        const { username, password } = req.body;

        try {
            // STEP 1: Find the user in the database
            // We select: id, username, role, full_name, password
            // We need password to verify it, but don't select email
            const user = await dbGet(
                "SELECT id, username, role, full_name, password FROM users WHERE username = ?",
                [username]
            );

            // STEP 2: Verify password
            // bcrypt.compare(inputPassword, hashedPassword)
            // Returns true if they match, false otherwise
            if (user && (await bcrypt.compare(password, user.password))) {
                // STEP 3: Password is correct! Create session.
                // Store user info in session (will persist via cookie)
                req.session.user = {
                    id: user.id,                    // User's database ID
                    username: user.username,        // Login username
                    role: user.role,                // 'admin' or 'student'
                    full_name: user.full_name       // Display name
                };

                // STEP 4: Send success response with user data
                res.json({ success: true, user: req.session.user });
            } else {
                // Invalid username or password
                res.status(401).json({
                    success: false,
                    message: 'Invalid username or password'
                });
            }
        } catch (err) {
            // Log error for debugging
            console.error('Login error:', err);

            // Send generic error to client (don't leak details)
            res.status(500).json({
                success: false,
                message: 'Server error during login'
            });
        }
    });


    // ========================================================================
    // ROUTE 3: POST /api/auth/logout
    // ========================================================================
    /**
     * LOGOUT USER
     * 
     * WHAT IT DOES:
     * Destroys the user's session, logging them out
     * 
     * STEPS:
     * 1. Call req.session.destroy()
     * 2. Clear the session cookie
     * 3. Return success message
     */
    router.post('/logout', (req, res) => {
        // Destroy the session
        req.session.destroy(err => {
            if (err) {
                // Something went wrong destroying the session
                return res.status(500).json({
                    success: false,
                    message: 'Could not log out'
                });
            }

            // Clear the session cookie from the browser
            res.clearCookie('connect.sid');

            // Send success response
            res.json({ success: true });
        });
    });


    // ========================================================================
    // ROUTE 4: PUT /api/auth/profile
    // ========================================================================
    /**
     * UPDATE USER PROFILE
     * 
     * WHAT IT DOES:
     * Updates the user's full name and email
     * 
     * PROTECTED ROUTE:
     * - Requires authentication (must be logged in)
     * - Uses authMiddleware from server.js
     * 
     * REQUEST BODY (JSON):
     * {
     *   "full_name": "John Smith",
     *   "email": "john.smith@newemail.com"
     * }
     */
    router.put('/profile', async (req, res) => {
        // Check if user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Extract new profile data
        const { full_name, email } = req.body;

        try {
            // Update user's profile in database
            // Uses user's ID from session to identify which record to update
            await dbRun(
                "UPDATE users SET full_name = ?, email = ? WHERE id = ?",
                [full_name, email, req.session.user.id]
            );

            // Update session data so the change is reflected immediately
            req.session.user.full_name = full_name;

            // Send success response
            res.json({ success: true, message: 'Profile updated' });
        } catch (err) {
            // Log for debugging
            console.error(err);

            // Send error response
            res.status(500).json({
                success: false,
                message: 'Failed to update profile'
            });
        }
    });


    // ========================================================================
    // ROUTE 5: PUT /api/auth/password
    // ========================================================================
    /**
     * CHANGE PASSWORD
     * 
     * WHAT IT DOES:
     * Updates the user's password after verifying current password
     * 
     * PROTECTED ROUTE:
     * - Requires authentication
     * 
     * SECURITY STEPS:
     * 1. Get user's current password hash from database
     * 2. Verify current password is correct
     * 3. Hash the new password
     * 4. Update the database
     * 
     * REQUEST BODY (JSON):
     * {
     *   "currentPassword": "oldpassword",
     *   "newPassword": "newpassword"
     * }
     */
    router.put('/password', async (req, res) => {
        // Check authentication
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Extract passwords from request
        const { currentPassword, newPassword } = req.body;

        try {
            // STEP 1: Get current password hash from database
            const user = await dbGet(
                "SELECT password FROM users WHERE id = ?",
                [req.session.user.id]
            );

            // STEP 2: Verify current password is correct
            const valid = await bcrypt.compare(currentPassword, user.password);

            if (!valid) {
                // Current password is wrong!
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // STEP 3: Hash the new password
            const hashed = await bcrypt.hash(newPassword, 10);

            // STEP 4: Update password in database
            await dbRun(
                "UPDATE users SET password = ? WHERE id = ?",
                [hashed, req.session.user.id]
            );

            // Success!
            res.json({ success: true, message: 'Password changed successfully' });
        } catch (err) {
            // Log error
            console.error(err);

            // Send error response
            res.status(500).json({
                success: false,
                message: 'Failed to update password'
            });
        }
    });


    // ========================================================================
    // ROUTE 6: POST /api/auth/balance
    // ========================================================================
    /**
     * ADD BALANCE (Simulated)
     * 
     * WHAT IT DOES:
     * Adds virtual currency to the user's account
     * 
     * PROTECTED ROUTE:
     * - Requires authentication
     * 
     * WHY SIMULATED?
     * - This is a demo app, not a real payment system
     * - We just increment the balance number
     * - In a real app, you'd integrate Stripe, PayPal, etc.
     * 
     * REQUEST BODY (JSON):
     * {
     *   "amount": 5000
     * }
     * 
     * RESPONSE:
     * New balance = Old balance + amount
     */
    router.post('/balance', async (req, res) => {
        // Check authentication
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Extract amount from request
        const { amount } = req.body;

        // Convert to integer and validate
        const intAmount = parseInt(amount);
        if (isNaN(intAmount) || intAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        try {
            // Update user's balance in database
            // balance = balance + amount (simple addition)
            await dbRun(
                "UPDATE users SET balance = ? WHERE id = ?",
                [intAmount, req.session.user.id]
            );

            res.json({ success: true, message: 'Balance updated' });
        } catch (err) {
            // Log error
            console.error(err);

            res.status(500).json({
                success: false,
                message: 'Failed to update balance'
            });
        }
    });


    // ========================================================================
    // ROUTE 7: GET /api/auth/me
    // ========================================================================
    /**
     * GET CURRENT USER INFO
     * 
     * WHAT IT DOES:
     * Returns the currently logged-in user's information
     * 
     * STEPS:
     * 1. Check if session exists
     * 2. Fetch fresh data from database (especially balance!)
     * 3. Return user object
     * 
     * WHY FETCH FROM DATABASE?
     * - Session data might be stale
     * - Balance might have changed since login
     * - Always get the latest data for accuracy
     * 
     * RESPONSE (JSON):
     * {
     *   "user": {
     *     "id": 1,
     *     "username": "admin",
     *     "role": "admin",
     *     "full_name": "System Administrator",
     *     "balance": 50000,
     *     "email": "admin@university.edu"
     *   }
     * }
     */
    router.get('/me', async (req, res) => {
        // Check if user has a session
        if (req.session.user) {
            try {
                // Fetch fresh user data from database
                // We need balance and email which might not be in session
                const user = await dbGet(
                    "SELECT balance, email FROM users WHERE id = ?",
                    [req.session.user.id]
                );

                // Combine session data with fresh database data
                const userData = {
                    ...req.session.user,              // Spread existing session data
                    balance: user ? user.balance : 0, // Add fresh balance
                    email: user ? user.email : ''     // Add email
                };

                // Return the combined user object
                res.json({ user: userData });
            } catch (err) {
                // If database fetch fails, fall back to session data
                res.json({ user: req.session.user });
            }
        } else {
            // No session - user is not logged in
            res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }
    });


    // ========================================================================
    // END OF ROUTES
    // =========================================================================

    // Return the configured router
    // This is what makes all these routes available
    return router;
};


/**
 * ============================================================================
 * ROUTE SUMMARY
 * ============================================================================
 * 
 * ENDPOINT                  METHOD  DESCRIPTION
 * ------------------------------------------------------------------------
 * /api/auth/register        POST    Create new user account
 * /api/auth/login           POST    Log in and create session
 * /api/auth/logout          POST    Log out and destroy session
 * /api/auth/profile         PUT     Update user profile (name, email)
 * /api/auth/password        PUT     Change password
 * /api/auth/balance         POST    Add virtual currency
 * /api/auth/me              GET     Get current user info
 * 
 * ============================================================================
 */
