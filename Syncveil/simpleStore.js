const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'data', 'users.json');
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify([]));

function readAll() {
  return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
}
function writeAll(arr) {
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}
module.exports = { readAll, writeAll };
