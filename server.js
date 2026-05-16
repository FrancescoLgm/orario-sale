const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const APP_USERNAME  = process.env.APP_USERNAME  || 'admin';
const APP_PASSWORD  = process.env.APP_PASSWORD  || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'orario-sale-secret-2026';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
  const { data, error } = await supabase
    .from('app_state').select('data').eq('id', 1).single();
  if (error?.code === 'PGRST116') return res.json(null);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.data);
});

app.post('/api/state', requireAuth, async (req, res) => {
  const { error } = await supabase.from('app_state').upsert(
    { id: 1, data: req.body, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ── Frontend ── */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Orario Sale — http://localhost:${PORT}`));
