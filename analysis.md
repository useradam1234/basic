# Deep Project Analysis: University Library System

## 1. Executive Summary
The **University Library System** is a monolithic web application designed to simulate a digital library environment. It facilitates user registration, book browsing, purchasing (simulated), borrowing, and administrative management. The architecture is a classic **SSR/SPA Hybrid**: while the backend serves static assets, the frontend functions largely as a Single Page Application (SPA) consuming a JSON REST API.

**Core Statistics:**
-   **Backend**: Node.js v16+ (assumed), Express v4.18
-   **Database**: SQLite3 (Persistent file storage)
-   **Frontend**: Native Browser APIs, Tailwind CSS v3
-   **Lines of Code**: ~500 (Backend), ~700 (Frontend)

---

## 2. Architecture & Data Flow

### 2.1. System Architecture Diagram
```mermaid
graph TD
    Client[Browser (Frontend)] <-->|JSON API| Server[Node.js / Express]
    Server <-->|SQL Queries| DB[(SQLite Database)]
    Server -.->|Serves Static Files| Assets[HTML/CSS/JS]

    subgraph "Backend Layer"
        Middleware[Auth & Admin Middleware]
        Controllers[Route Handlers]
        DB_Interface[SQLite Wrapper]
    end

    subgraph "Frontend Layer"
        UI[HTML Pages]
        Logic[App.js & Main.js]
        State[SessionStorage]
    end
```

### 2.2. Request Lifecycle
1.  **Request**: Client sends `GET /api/books`.
2.  **Entry (`server.js`)**: Express receives request, logs it, and parses body/cookies.
3.  **Routing**: Matches `/api/books`, delegates to `routes/books.js`.
4.  **Controller**:
    *   Extracts query params (search, sort).
    *   Constructs Dynamic SQL.
    *   Calls `dbAll` helper.
5.  **Database**: Executes query against `library.db`.
6.  **Response**: JSON data sent back to client.
7.  **Client**: `main.js` receives JSON, clears existing grid, and injects HTML literal strings.

---

## 3. Backend Deep Dive

### 3.1. Server Entry Point (`server.js`)
*   **Session Management**: Uses `express-session` with a hardcoded secret (`fallback-dev-secret`).
    *   *Security Optimization*: In production, this must use an environment variable.
    *   *Cookie Policy*: `httpOnly: true` (prevents XSS theft), `secure: false` (allows HTTP).
*   **Dependency Injection**: The `db` instance and helper functions (`dbRun`, `dbGet`) are passed to routes. This promotes testability.
*   **Static Serving**: The `/frontend` path is statically served, exposing the entire source code of the frontend.

### 3.2. Database Design (`config/db-init.js`)
The schema uses a Relational model but often relies on application-level logic for integrity (e.g., checking stock before loan).

**Table: `books`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Auto-incrementing ID |
| `total_copies` | INTEGER | Physical/Digital limit |
| `available_copies` | INTEGER | Computed stock (Total - Active Loans) |
| `borrow_count` | INTEGER | Used for "Most Borrowed" trending logic |
| `purchase_count` | INTEGER | Used for "Best Seller" trending logic |

**Table: `actions`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `user_id` | INTEGER FK | Who performed the action |
| `book_id` | INTEGER FK | Target asset |
| `type` | TEXT | Enum: `'loan'`, `'purchase'` |
| `status` | TEXT | Enum: `'active'`, `'returned'`, `'completed'` |

### 3.3. API Route Analysis

#### **Authentication (`routes/auth.js`)**
*   **Security**: Uses `bcryptjs` (salt rounds: 10) for password hashing.
*   **Vulnerability**: No password strength enforcement.
*   **Endpoint `GET /me`**: Crucial for session persistence. It fetches the fresh balance from DB every time, preventing "stale session" issues where the cookie data might be outdated.

#### **Books Logic (`routes/books.js`)**
*   **Borrowing Flow**:
    1.  Atomic-like check: `SELECT available_copies`.
    2.  Validation: Check if `> 0`.
    3.  User Check: prevent duplicate active loans for same book.
    4.  Update: `INSERT INTO actions` AND `UPDATE books SET available_copies = -1`.
    *   *Critique*: These database operations are **not wrapped in a transaction**. If the server crashes between the INSERT and UPDATE, inventory counts will desynchronize.
*   **Purchasing Flow**:
    *   Similar flow but checks `users.balance`.
    *   Deducts user balance and decrements stock.

#### **Admin Management (`routes/admin.js`)**
*   **N+1 Query Issue**: In `GET /loans`, the query performs three JOINs (`actions` -> `books`, `actions` -> `users`). This is efficient (O(1) query).
*   **Efficient Stats**: `GET /users` calculates active loans using a sub-join `COUNT(a.id)`. This is much better than fetching all loans and counting in JS.

---

## 4. Frontend Deep Dive

### 4.1. Application State (`js/app.js`)
*   **Auth State**: Stored in `sessionStorage` (`library_user` key).
    *   *Note*: This is redundant with the `connect.sid` cookie but allows the UI to render "Welcome, Adam" immediately without waiting for an API call.
*   **Theme Engine**: Checks `localStorage` or System Preference (`prefers-color-scheme`). Toggles a `.dark` class on `<html>`, triggering Tailwind's `dark:` variants.

### 4.2. Component Architecture
The frontend uses a **functional, event-driven approach** rather than a component framework (like React).

*   **HTML String Injection**:
    *   Views are built using Template Literals (\` \${variable} \`).
    *   Example: `renderBooks` maps over an array and returns a massive HTML string, then assigns it to `innerHTML`.
    *   *Security Risk*: If `book.title` contained `<script>`, it could execute XSS. (However, book data comes from the database which is generally trusted in this context, but safer practice is `textContent`).
*   **Dynamic Navbar**: `Components.renderNavbar()` regenerates the DOM for the nav on every page load, checking the current URL to interpret "Active" state.

### 4.3. Admin Dashboard (`js/admin.js`)
*   **Parallel Loading**: Uses `Promise.all([loadBooks(), loadLoans(), ...])` to fetch all admin data concurrently, significantly reducing load time.
*   **Tab System**: Pure CSS/JS implementation. Toggles `hidden` class on container `<div>` elements based on button clicks.

---

## 5. Security Audit

### 5.1. Strengths
- [x] **Password Hashing**: Bcrypt is industry standard.
- [x] **Session Cookies**: `HttpOnly` prevents client scripts from stealing the session ID.
- [x] **Role Middleware**: `adminMiddleware` strictly checks `req.session.user.role === 'admin'` before allowing sensitive actions.

### 5.2. Weaknesses & Risks
- [ ] **No Input Sanitization**: Inputs like `book.title` are inserted directly into SQL (though using parameterized queries prevents Injection) and HTML (potentially allowing XSS).
- [ ] **No CSRF Protection**: A malicious site could trigger `POST /api/books/buy` if the user is logged in.
- [ ] **Race Conditions**: Lack of SQL transactions means highly concurrent "Borrow" clicks could theoretically reduce stock below 0.

## 6. Setup & Deployment Guide

### 6.1. Prerequisites
-   Node.js v14+
-   NPM

### 6.2. Installation
1.  Navigate to `backend/`.
2.  Run `npm install`.
3.  Initialize DB: `npm run init-db` (Creates `library.db` and seeds data).
4.  Start Server: `npm start`.

### 6.3. Access
-   Web Interface: `http://localhost:3000/frontend/pages/index.html`
-   API: `http://localhost:3000/api`

---
*Analysis generated by Google Deepmind Agentic Coding Assistant.*
