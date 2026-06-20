const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const APP_USERNAME  = process.env.APP_USERNAME  || 'admin';
const APP_PASSWORD  = process.env.APP_PASSWORD  || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'orario-sale-secret-2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session?.auth) return next();
  res.status(401).json({ error: 'Non autenticato' });
}

/* ── Auth ── */
app.post('/api/login', express.json(), (req, res) => {
  const { username, password } = req.body || {};
  if (username === APP_USERNAME && password === APP_PASSWORD) {
    req.session.auth = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Credenziali errate' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ ok: !!req.session?.auth });
});

/* ── Data ── */
app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0].data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/state', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
      [req.body]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Frontend ── */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Orario Sale — http://localhost:${PORT}`));
