'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const indexSource = read('index.html');
const appSource = read('js/app.js');
const coreSource = read('js/motion-core.js');
const editorSource = read('js/graph-editor.js');
const mathJaxSource = read('js/mathjax-config.js');
const cssSource = read('css/styles.css');
const workflowSource = read('.github/workflows/deploy-pages.yml');

const versionMatch = indexSource.match(/window\.GG_APP_VERSION = '([^']+)'/);
assert.ok(versionMatch, 'index.html does not declare GG_APP_VERSION.');
const version = versionMatch[1];
const escapedVersion = version.replace(/\./g, '\\.');
assert.match(appSource, new RegExp(`const APP_VERSION = '${escapedVersion}'`));
assert.match(coreSource, new RegExp(`const VERSION = '${escapedVersion}'`));
assert.match(editorSource, new RegExp(`const VERSION = '${escapedVersion}'`));
const visibleVersion = version.replace(/^(\d{4})(\d{2})(\d{2})\./, '$1.$2.$3.');
assert.ok(indexSource.includes(`>v${visibleVersion}</span>`), 'Visible version badge is stale.');

const localAssetPattern = /(?:href|src)="((?:css|js)\/[^"?]+)(?:\?v=([^"&]+))?"/g;
const assets = Array.from(indexSource.matchAll(localAssetPattern), match => ({
  path: match[1],
  version: match[2] || null
}));
assert.deepEqual(
  assets.map(asset => asset.path).sort(),
  [
    'css/styles.css',
    'js/app.js',
    'js/graph-editor.js',
    'js/mathjax-config.js',
    'js/motion-core.js'
  ].sort()
);
for (const asset of assets) {
  assert.equal(asset.version, version, `${asset.path} has a stale cache token.`);
  assert.ok(fs.existsSync(path.join(ROOT, asset.path)), `Missing local asset ${asset.path}.`);
}

assert.match(indexSource, /mathjax@3\.2\.2\/es5\/tex-mml-chtml\.js/);
assert.match(mathJaxSource, /matchFontHeight: false/);
assert.match(cssSource, /\.graph-axis-label mjx-container,[\s\S]*background: transparent !important/);
assert.doesNotMatch(cssSource, /\.graph-axis-label[^}]*text-shadow/s);
assert.doesNotMatch(indexSource + appSource, /serviceWorker\.register/);
assert.doesNotMatch(indexSource, /<canvas/i);
assert.doesNotMatch(indexSource + appSource, /\.\.\/shared\//);

for (const id of [
  'introScreen',
  'notationNote',
  'notationTitle',
  'notationVectors',
  'notationDimensions',
  'notationOneDimension',
  'dimensionFootnote',
  'dimensionFootnoteTrigger',
  'dimensionFootnoteTooltip',
  'notationDescriptions',
  'quizScreen',
  'resultScreen',
  'modeDescriptionButton',
  'modePositionToVelocityButton',
  'modeVelocityToPositionButton',
  'modeMixedButton',
  'positionGraph',
  'velocityGraph',
  'distanceInput',
  'checkAnswerButton',
  'nextButton'
]) {
  assert.match(indexSource, new RegExp(`id="${id}"`), `Missing #${id}.`);
}

assert.match(editorSource, /addEventListener\('pointerdown'/);
assert.match(editorSource, /addEventListener\('pointermove'/);
assert.match(editorSource, /addEventListener\('pointerup'/);
assert.match(editorSource, /Math\.round\(time\)/);
assert.match(editorSource, /Math\.round\(value\)/);
assert.match(editorSource, /event\.key === 'ArrowLeft'/);
assert.match(editorSource, /event\.key === ' ' \|\| event\.key === 'Enter'/);
assert.match(cssSource, /touch-action: none/);
assert.match(indexSource, /aria-describedby="dimensionFootnoteTooltip"/);
assert.match(indexSource, /id="dimensionFootnoteTooltip"[^>]*role="tooltip"/);
assert.match(cssSource, /\.footnote-trigger:focus-visible \+ \.footnote-tooltip/);
assert.match(cssSource, /\.dimension-footnote\.is-open \.footnote-tooltip/);
assert.match(appSource, /footnoteTrigger\.addEventListener\('click'/);
assert.match(appSource, /event\.key !== 'Escape'/);

assert.match(coreSource, /'vertical-segment'/);
assert.match(coreSource, /code: 'non-horizontal-velocity'/);
assert.match(coreSource, /Array\(count \/ 2\)\.fill\(true\)/);
assert.match(coreSource, /Array\(count \/ 2\)\.fill\(false\)/);
assert.match(coreSource, /signedVelocity: 'signed-velocity'/);
assert.match(coreSource, /absoluteSpeed: 'absolute-speed'/);
assert.match(appSource, /Ein Geschwindigkeitssprung wird nicht durch eine senkrechte Linie verbunden/);
assert.match(appSource, /A velocity jump is not connected by a vertical line/);
assert.match(appSource, /Un saut de vitesse n’est pas relié par une ligne verticale/);
assert.match(appSource, /Im Eindimensionalen lassen sich/);
assert.match(appSource, /Im Zweidimensionalen ist/);
assert.match(appSource, /Die Texte zur Beschreibung der Bewegung verwenden beide Formen/);
assert.doesNotMatch(indexSource + appSource, /Bewegungstexte/);
assert.ok(indexSource.includes('\\(v=\\lvert\\vec{v}\\rvert\\)'));
assert.match(appSource, /\\\\vec\{v\}=\\\\frac\{\\\\Delta\\\\vec\{x\}\}\{\\\\Delta t\}/);
assert.match(appSource, /\\\\vec\{x\}_\{i\+1\}=\\\\vec\{x\}_i\+\\\\vec\{v\}_i/);
assert.ok(appSource.includes("'\\\\(\\\\vec{x}(t)"));
assert.ok(appSource.includes("'\\\\(\\\\vec{v}(t)"));
assert.equal(appSource.includes("'\\\\(x(t)"), false);
assert.equal(appSource.includes("'\\\\(v(t)"), false);

for (const script of [
  'verify-javascript-syntax.js',
  'verify-motion-core.js',
  'verify-graph-validation.js',
  'verify-localization.js',
  'verify-static-contract.js'
]) {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', script)), `Missing scripts/${script}.`);
  assert.ok(workflowSource.includes(`node scripts/${script}`), `Workflow does not run ${script}.`);
}
assert.match(workflowSource, /actions\/configure-pages@v5/);
assert.match(workflowSource, /actions\/upload-pages-artifact@v3/);
assert.match(workflowSource, /actions\/deploy-pages@v4/);

console.log(`Static app, cache, drawing, localization, and Pages contracts verified for ${version}.`);
