const express = require('express')
const session = require('express-session')
const bcrypt = require('bcrypt')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()

// ======================
// MIDDLEWARE
// ======================
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'MONCASH_SECRET',
    resave: false,
    saveUninitialized: false,
  })
)

// ======================
// SQLITE DATABASE
// ======================
const db = new Database(path.join(__dirname, 'moncash.db'))

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT CHECK(type IN ('income','expense')),
    amount REAL,
    description TEXT,
    category TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT CHECK(type IN ('debt','receivable')),
    name TEXT,
    amount REAL,
    due_date TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid'))
  );
`)

console.log('✅ SQLite database ready')

// ======================
// ROUTES
// ======================

// ROOT
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard.html')
  } else {
    res.redirect('/login.html')
  }
})

// ======================
// REGISTER
// ======================
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.json({ error: 'Incomplete data' })
  }

  try {
    const hashed = await bcrypt.hash(password, 10)
    const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    stmt.run(name, email, hashed)
    res.json({ success: true })
  } catch (e) {
    res.json({ error: 'Email already exists' })
  }
})

// ======================
// GOOGLE OAUTH
// ======================
app.post('/auth/google', async (req, res) => {
  const { credential } = req.body
  
  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' })
  }
  
  try {
    const base64Payload = credential.split('.')[1]
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())
    const { email, name, sub: googleId } = payload

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    
    if (user) {
      req.session.userId = user.id
      return res.json({ success: true })
    }
    
    const randomPassword = await bcrypt.hash(googleId + Date.now(), 10)
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, randomPassword)
    req.session.userId = result.lastInsertRowid
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: 'Invalid credential' })
  }
})

// ======================
// LOGIN
// ======================
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  
  if (!user) {
    return res.json({ error: 'User not found' })
  }

  const match = await bcrypt.compare(password, user.password)
  
  if (!match) {
    return res.json({ error: 'Wrong password' })
  }

  req.session.userId = user.id
  res.json({ success: true })
})

// ======================
// LOGOUT
// ======================
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }))
})

// ======================
// CHECK USER
// ======================
app.get('/me', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const user = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(req.session.userId)
  if (!user) return res.sendStatus(500)
  res.json(user)
})

// ======================
// UPDATE PROFILE
// ======================
app.put('/profile', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { name, email, phone } = req.body
  db.prepare('UPDATE users SET name=?, email=?, phone=? WHERE id=?').run(name, email, phone || null, req.session.userId)
  res.json({ success: true })
})

// ======================
// GET TRANSACTIONS
// ======================
app.get('/transactions', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { start, end } = req.query
  
  let query = 'SELECT * FROM transactions WHERE user_id = ?'
  let params = [req.session.userId]
  
  if (start && end) {
    query += ' AND (date >= ? AND date <= ? OR date IS NULL)'
    params.push(start, end)
  }
  
  query += ' ORDER BY date DESC, id DESC'

  const rows = db.prepare(query).all(...params)
  res.json(rows)
})

// ======================
// ADD TRANSACTION
// ======================
app.post('/transactions', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { type, amount, description, category, date } = req.body
  const dateVal = date || new Date().toISOString().split('T')[0]

  db.prepare('INSERT INTO transactions (user_id, type, amount, description, category, date) VALUES (?,?,?,?,?,?)')
    .run(req.session.userId, type, amount, description, category || null, dateVal)
  res.json({ success: true })
})

// ======================
// UPDATE TRANSACTION
// ======================
app.put('/transactions/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { type, amount, description, category, date } = req.body

  db.prepare('UPDATE transactions SET type=?, amount=?, description=?, category=?, date=? WHERE id=? AND user_id=?')
    .run(type, amount, description, category || null, date || null, req.params.id, req.session.userId)
  res.json({ success: true })
})

// ======================
// DELETE TRANSACTION
// ======================
app.delete('/transactions/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId)
  res.json({ success: true })
})

// ======================
// GET DEBTS
// ======================
app.get('/debts', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const rows = db.prepare('SELECT * FROM debts WHERE user_id = ? ORDER BY id DESC').all(req.session.userId)
  res.json(rows)
})

// ======================
// ADD DEBT
// ======================
app.post('/debts', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { type, name, amount, due_date } = req.body

  db.prepare('INSERT INTO debts (user_id, type, name, amount, due_date) VALUES (?,?,?,?,?)')
    .run(req.session.userId, type, name, amount, due_date || null)
  res.json({ success: true })
})

// ======================
// UPDATE DEBT
// ======================
app.put('/debts/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { type, name, amount, due_date } = req.body

  db.prepare('UPDATE debts SET type=?, name=?, amount=?, due_date=? WHERE id=? AND user_id=?')
    .run(type, name, amount, due_date || null, req.params.id, req.session.userId)
  res.json({ success: true })
})

// ======================
// UPDATE DEBT STATUS
// ======================
app.put('/debts/:id/status', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { status } = req.body

  db.prepare('UPDATE debts SET status=? WHERE id=? AND user_id=?')
    .run(status, req.params.id, req.session.userId)
  res.json({ success: true })
})

// ======================
// DELETE DEBT
// ======================
app.delete('/debts/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  db.prepare('DELETE FROM debts WHERE id=? AND user_id=?').run(req.params.id, req.session.userId)
  res.json({ success: true })
})

// ======================
// SUMMARY
// ======================
app.get('/summary', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { start, end } = req.query
  
  let query = "SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income, COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense FROM transactions WHERE user_id = ?"
  let params = [req.session.userId]
  
  if (start && end) {
    query += ' AND date >= ? AND date <= ?'
    params.push(start, end)
  }

  const row = db.prepare(query).get(...params)
  res.json({ income: row.income, expense: row.expense, balance: row.income - row.expense })
})

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
