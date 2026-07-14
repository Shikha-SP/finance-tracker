const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend', 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Remove all text-shadow lines
css = css.replace(/text-shadow:\s*[^;}]+;/g, '');
css = css.replace(/text-shadow:\s*[^;}]+!important;/g, '');

// Remove box-shadow lines that use rgba or var(--...-glow) except predefined variables
// Or we can just regex replace box-shadow that contain 'glow' or specific rgba colors
css = css.replace(/box-shadow:\s*[^;]*var\(--[a-z]+-glow\)[^;]*;/g, '');
// For the auth buttons that use box-shadow with multiple lines, we can remove box-shadow completely for them
css = css.replace(/box-shadow:\s*([^;]+);/g, (match, content) => {
  if (content.includes('var(--shadow-glass)') || content.includes('var(--shadow-card)')) return match;
  return '';
});

// Write back
fs.writeFileSync(cssPath, css);
console.log('Cleaned glows from index.css');
