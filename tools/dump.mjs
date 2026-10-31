import fs from 'node:fs';
const s = fs.readFileSync('node_modules/postprocessing/build/index.cjs', 'utf8');
for (const key of ['RenderPass', 'class EffectComposer']) {
  const i = s.indexOf(key.startsWith('class') ? key : 'class ' + key);
  console.log('=== ' + key + ' @' + i);
  if (i >= 0) console.log(s.slice(i, i + 1800));
}
