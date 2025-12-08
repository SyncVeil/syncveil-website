require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const { readAll, writeAll } = require('./simpleStore');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'syncveilsecret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/signup', async (req, res) => {
  const { name, age, email, mobile, gender, address, password } = req.body;
  const users = readAll();
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });
  const password_hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), name, age, email, mobile, gender, address, password_hash };
  users.push(user);
  writeAll(users);
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readAll();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  req.session.userId = user.id;
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const users = readAll();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  const { password_hash, ...info } = user;
  res.json({ user: info });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`SyncVeil running on ${BASE_URL}`));
