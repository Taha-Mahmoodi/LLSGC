const fs = require('node:fs');
const path = require('node:path');
const { SourceMapConsumer } = require('source-map');

(async () => {
  const mapPath = path.join(__dirname, '..', 'dist/assets/index-BFYFBOUu.js.map');
  const raw = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  const consumer = await new SourceMapConsumer(raw);

  // From the user's report
  const errorFrames = [
    [40, 33783, 'Pt'],
    [38, 19835, 'fv'],
    [38, 19646, 'cv'],
    [40, 24263, 'Da'],
    [40, 42275, 'Wr'],
    [40, 41128, 'JS'],
    [40, 40185, '$n'],
    [40, 36812, 'Fp'],
    [38, 3272,  'On'],
    [40, 34199, '(anon)'],
  ];

  const componentStack = [
    [244, 13790, 'tN'],
    [244, 23109, 'lN'],
    [243, 163477, 'vr'],
    [291, 41144, 'Sr'],
    [243, 115682, 'c'],
    [243, 153935, 'E0'],
    [243, 161278, 'Xj'],
    [291, 39425, 'dA'],
  ];

  const fmt = (line, col, label) => {
    const orig = consumer.originalPositionFor({ line, column: col });
    const src = orig.source ? orig.source.replace(/^.*\/(src|node_modules|electron|shared)\//, '$1/') : '?';
    return `${label.padEnd(6)} (gen ${line}:${col}) → ${src}:${orig.line}:${orig.column}  name=${orig.name || '?'}`;
  };

  console.log('=== Error stack (where the throw happened) ===');
  for (const [l, c, label] of errorFrames) {
    console.log(fmt(l, c, label));
  }
  console.log('');
  console.log('=== Component stack (which components were rendering) ===');
  for (const [l, c, label] of componentStack) {
    console.log(fmt(l, c, label));
  }

  consumer.destroy();
})();
