const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

module.exports = ({ dbGet, dbRun }) => {
    router.post('/register', async (req, res) => {
        const { username, password, full_name, email } = req.body;

        if (!username || !password || !full_name || !email) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            await dbRun(
                "INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, 'student')",
                [username, hashedPassword, full_name, email]
            );
            res.json({ success: true, message: 'Registration successful! Please login.' });
        } catch (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ success: false, message: 'Username or email already exists' });
            }
            res.status(500).json({ success: false, message: 'Server error during registration' });
        }
    });

    // POST /api/auth/login
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const user = await dbGet("SELECT id, username, role, full_name, password FROM users WHERE username = ?", [username]);

            if (user && (await bcrypt.compare(password, user.password))) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    full_name: user.full_name
                };
                res.json({ success: true, user: req.session.user });
            } else {
                res.status(401).json({ success: false, message: 'Invalid username or password' });
            }
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ success: false, message: 'Server error during login' });
        }
    });

    // POST /api/auth/logout
    router.post('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Could not log out' });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });

    // PUT /api/auth/profile
    router.put('/profile', async (req, res) => {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { full_name, email } = req.body;
        try {
            await dbRun("UPDATE users SET full_name = ?, email = ? WHERE id = ?", [full_name, email, req.session.user.id]);

            // Update session
            req.session.user.full_name = full_name;
            // email is not stored in session currently but good to update if we did

            res.json({ success: true, message: 'Profile updated' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Failed to update profile' });
        }
    });

    // PUT /api/auth/password
    router.put('/password', async (req, res) => {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { currentPassword, newPassword } = req.body;
        try {
            const user = await dbGet("SELECT password FROM users WHERE id = ?", [req.session.user.id]);
            const valid = await bcrypt.compare(currentPassword, user.password);

            if (!valid) {
                return res.status(400).json({ success: false, message: 'Current password is incorrect' });
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await dbRun("UPDATE users SET password = ? WHERE id = ?", [hashed, req.session.user.id]);

            res.json({ success: true, message: 'Password changed successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Failed to update password' });
        }
    });

    // POST /api/auth/balance
    router.post('/balance', async (req, res) => {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { amount } = req.body; // Amount to ADD
        const intAmount = parseInt(amount);
        if (isNaN(intAmount) || intAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        try {
            await dbRun("UPDATE users SET balance = ? WHERE id = ?", [intAmount, req.session.user.id]);
            res.json({ success: true, message: 'Balance updated' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Failed to update balance' });
        }
    });

    // GET /api/auth/me
    router.get('/me', async (req, res) => {
        if (req.session.user) {
            // Refresh balance from DB
            try {
                const user = await dbGet("SELECT balance, email FROM users WHERE id = ?", [req.session.user.id]);
                const userData = { ...req.session.user, balance: user ? user.balance : 0, email: user ? user.email : '' };
                res.json({ user: userData });
            } catch (err) {
                res.json({ user: req.session.user }); // Fallback
            }
        } else {
            res.status(401).json({ success: false, message: 'Not authenticated' });
        }
    });

    return router;
};
