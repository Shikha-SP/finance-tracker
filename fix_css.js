const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend', 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Navbar layout
css = css.replace(
  /margin-left:\s*calc\(var\(--sidebar-w\)\s*\+\s*2rem\);/g,
  'margin-left: var(--sidebar-w);'
);

css = css.replace(
  /\.navbar\s*{\s*position:\s*fixed;\s*top:\s*1\.25rem;\s*left:\s*1\.25rem;\s*bottom:\s*1\.25rem;\s*width:\s*var\(--sidebar-w\);\s*z-index:\s*200;\s*display:\s*flex;\s*flex-direction:\s*column;\s*background:\s*var\(--bg-card\);\s*border:\s*1px\s+solid\s+var\(--border-strong\);\s*border-radius:\s*24px;/g,
  `.navbar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sidebar-w);
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-right: 1px solid var(--border-strong);
  border-radius: 0;`
);

// 2. Remove animations (starsShimmer, authStarsTwinkle, formStarsTwinkle)
css = css.replace(/animation:\s*starsShimmer[^;]+;/g, '/* animation removed */');
css = css.replace(/animation:\s*authStarsTwinkle[^;]+;/g, '/* animation removed */');
css = css.replace(/animation:\s*formStarsTwinkle[^;]+;/g, '/* animation removed */');

css = css.replace(/@keyframes starsShimmer\s*{[^}]+}/g, '');
css = css.replace(/@keyframes authStarsTwinkle\s*{[^}]+}/g, '');
css = css.replace(/@keyframes formStarsTwinkle\s*{[^}]+}/g, '');

// 3. Remove radial-gradients (which are the stars themselves)
css = css.replace(/background-image:\s*(radial-gradient[^;]+);/g, '/* stars removed */');

// 4. Simplify linear-gradients to solid colors
css = css.replace(/background:\s*linear-gradient\([^,]+,\s*(var\(--[a-zA-Z0-9-]+\)|rgba?\([^)]+\)|#[0-9a-fA-F]+)[^;]*\);/g, 'background: $1;');
// Fix the ticker gradients to just display: none
css = css.replace(/\.ticker-container::before\s*{\s*left:\s*0;\s*background:\s*linear-gradient[^;]+;\s*}/g, '.ticker-container::before { display: none; }');
css = css.replace(/\.ticker-container::after\s*{\s*right:\s*0;\s*background:\s*linear-gradient[^;]+;\s*}/g, '.ticker-container::after { display: none; }');

// Specific replacements for some complex gradients
// .masthead::before
css = css.replace(/\.masthead::before\s*{\s*content:\s*'';\s*position:\s*absolute;\s*inset:\s*0;\s*background:[^;]+;/g, ".masthead::before { content: ''; position: absolute; inset: 0; background: rgba(5,9,17,0.7);");
// .masthead-panel::before
css = css.replace(/\.masthead-panel::before\s*{[^}]+}/g, '.masthead-panel::before { display: none; }');


fs.writeFileSync(cssPath, css);
console.log('Done fixing index.css');
