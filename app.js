const express = require('express')
const session = require('express-session')
const bcrypt = require('bcrypt')
const mysql = require('mysql2')
require('dotenv').config()

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
// MYSQL CONNECTION
// ======================
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'moncash',
  port: process.env.DB_PORT || 3306
})

db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed:', err)
    process.exit(1)
  }
  console.log('✅ MySQL connected to database: moncash')
})

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
// REGISTER (DEBUG MODE)
// ======================
app.post('/register', async (req, res) => {
  console.log('📥 REGISTER BODY:', req.body)

  const { name, email, password } = req.body

  if (!name || !email || !password) {
    console.log('❌ Incomplete data')
    return res.send('Incomplete data')
  }

  try {
    const hashed = await bcrypt.hash(password, 10)

    db.query(
      'INSERT INTO users (name, email, password) VALUES (?,?,?)',
      [name, email, hashed],
      (err, result) => {
        if (err) {
          console.log('❌ INSERT ERROR:', err)
          return res.send('Email already exists')
        }

        console.log('✅ USER INSERTED, ID:', result.insertId)
        res.send('OK')
      }
    )
  } catch (e) {
    console.log('❌ HASH ERROR:', e)
    res.send('Server error')
  }
})

// ======================
// GOOGLE OAUTH
// ======================
app.post('/auth/google', async (req, res) => {
  const { credential } = req.body;
  
  if (!credential) {
    return res.status(400).json({ error: 'No credential provided' });
  }
  
  try {
    // Decode JWT token from Google (for production, verify with Google's API)
    const base64Payload = credential.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    const { email, name, sub: googleId } = payload;
    
    // Check if user exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
      if (err) {
        console.log('❌ DB Error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (rows.length > 0) {
        // User exists, log them in
        req.session.userId = rows[0].id;
        console.log('✅ Google login success, existing user:', rows[0].id);
        return res.json({ success: true });
      }
      
      // Create new user with random password (they'll use Google to login)
      const randomPassword = await bcrypt.hash(googleId + Date.now(), 10);
      
      db.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, randomPassword],
        (insertErr, result) => {
          if (insertErr) {
            console.log('❌ Insert error:', insertErr);
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          req.session.userId = result.insertId;
          console.log('✅ Google login success, new user:', result.insertId);
          return res.json({ success: true });
        }
      );
    });
  } catch (e) {
    console.log('❌ Google auth error:', e);
    return res.status(400).json({ error: 'Invalid credential' });
  }
});

// ======================
// LOGIN
// ======================
app.post('/login', (req, res) => {
  console.log('📥 LOGIN BODY:', req.body)

  const { email, password } = req.body

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    async (err, rows) => {
      if (err || rows.length === 0) {
        console.log('❌ USER NOT FOUND')
        return res.send('FAIL')
      }

      const user = rows[0]
      const match = await bcrypt.compare(password, user.password)

      if (!match) {
        console.log('❌ PASSWORD MISMATCH')
        return res.send('FAIL')
      }

      req.session.userId = user.id
      console.log('✅ LOGIN SUCCESS, USER ID:', user.id)
      res.send('OK')
    }
  )
})

// ======================
// LOGOUT
// ======================
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.send('OK'))
})

// ======================
// CHECK USER
// ======================
app.get('/me', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  db.query(
    'SELECT id, name, email, phone FROM users WHERE id = ?',
    [req.session.userId],
    (err, rows) => {
      if (err || rows.length === 0) return res.sendStatus(500)
      res.json(rows[0])
    }
  )
})

// ======================
// UPDATE PROFILE
// ======================
app.put('/profile', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401)

  const { name, email, phone } = req.body

  db.query(
    'UPDATE users SET name=?, email=?, phone=? WHERE id=?',
    [name, email, phone || null, req.session.userId],
    (err) => {
      if (err) return res.sendStatus(500)
      res.send('OK')
    }
  )
})

// ======================
// GET TRANSACTIONS
// ======================
app.get('/transactions', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { start, end } = req.query;
  
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  let params = [req.session.userId];
  
  if (start && end) {
    query += ' AND (date >= ? AND date <= ? OR date IS NULL)';
    params.push(start, end);
  }
  
  query += ' ORDER BY date DESC, id DESC';

  db.query(query, params, (err, rows) => {
    if (err) return res.sendStatus(500);
    res.json(rows);
  });
});

// ======================
// ADD TRANSACTION
// ======================
app.post('/transactions', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { type, amount, description, category, date } = req.body;

  db.query(
    'INSERT INTO transactions (user_id, type, amount, description, category, date) VALUES (?,?,?,?,?,?)',
    [req.session.userId, type, amount, description, category || null, date || new Date().toISOString().split('T')[0]],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// DELETE TRANSACTION
// ======================
app.delete('/transactions/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  db.query(
    'DELETE FROM transactions WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// GET DEBTS
// ======================
app.get('/debts', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  db.query(
    'SELECT * FROM debts WHERE user_id = ? ORDER BY id DESC',
    [req.session.userId],
    (err, rows) => {
      if (err) return res.sendStatus(500);
      res.json(rows);
    }
  );
});

// ======================
// ADD DEBT
// ======================
app.post('/debts', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { type, name, amount, due_date } = req.body;

  db.query(
    'INSERT INTO debts (user_id, type, name, amount, due_date) VALUES (?,?,?,?,?)',
    [req.session.userId, type, name, amount, due_date || null],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// UPDATE DEBT
// ======================
app.put('/debts/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { type, name, amount, due_date } = req.body;

  db.query(
    'UPDATE debts SET type=?, name=?, amount=?, due_date=? WHERE id=? AND user_id=?',
    [type, name, amount, due_date || null, req.params.id, req.session.userId],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// UPDATE DEBT STATUS
// ======================
app.put('/debts/:id/status', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { status } = req.body;

  db.query(
    'UPDATE debts SET status=? WHERE id=? AND user_id=?',
    [status, req.params.id, req.session.userId],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// DELETE DEBT
// ======================
app.delete('/debts/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  db.query(
    'DELETE FROM debts WHERE id=? AND user_id=?',
    [req.params.id, req.session.userId],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// UPDATE TRANSACTION
// ======================
app.put('/transactions/:id', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const { type, amount, description, category, date } = req.body;

  db.query(
    'UPDATE transactions SET type=?, amount=?, description=?, category=?, date=? WHERE id=? AND user_id=?',
    [type, amount, description, category || null, date || null, req.params.id, req.session.userId],
    err => {
      if (err) return res.sendStatus(500);
      res.send('OK');
    }
  );
});

// ======================
// SUMMARY
// ======================
app.get('/summary', (req, res) => {
  if (!req.session.userId) return res.sendStatus(401);

  const userId = req.session.userId;
  const { start, end } = req.query;
  
  let query = "SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income, COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense FROM transactions WHERE user_id = ?";
  let params = [userId];
  
  if (start && end) {
    query += ' AND date >= ? AND date <= ?';
    params.push(start, end);
  }

  db.query(query, params, (err, rows) => {
    if (err) return res.sendStatus(500);
    const income = rows[0].income;
    const expense = rows[0].expense;
    res.json({ income, expense, balance: income - expense });
  });
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
