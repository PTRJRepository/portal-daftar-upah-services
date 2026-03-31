const fs = require('fs');
const content = fs.readFileSync('full_output.txt', 'utf16le');
fs.writeFileSync('output_utf8.txt', content, 'utf8');
