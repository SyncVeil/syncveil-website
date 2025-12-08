const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const file = path.join(dataDir, 'users.json');

// Ensure file exists
if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify([]));
}

function readAll() {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    return [];
  }
}

function writeAll(arr) {
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}

module.exports = { readAll, writeAll };