'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../js/motion-core.js');

const ROOT = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const declaration = 'const TEXT = ';
const start = appSource.indexOf(declaration);
const end = appSource.indexOf('\n\nfunction byId', start);
assert.ok(start >= 0 && end > start, 'Could not isolate the TEXT dictionary.');
let objectLiteral = appSource.slice(start + declaration.length, end).trim();
assert.ok(objectLiteral.endsWith(';'));
objectLiteral = objectLiteral.slice(0, -1);
const translations = vm.runInNewContext(`(${objectLiteral})`);

assert.deepEqual(Object.keys(translations).sort(), ['de', 'en', 'fr']);

function shape(value) {
  if (typeof value === 'function') return 'function';
  if (!value || typeof value !== 'object') return typeof value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
}

assert.deepEqual(shape(translations.en), shape(translations.de));
assert.deepEqual(shape(translations.fr), shape(translations.de));

function verifyStrings(value, pathParts) {
  if (typeof value === 'string') {
    assert.ok(value.trim().length > 0, `Empty localization at ${pathParts.join('.')}`);
    return;
  }
  if (typeof value === 'function') return;
  for (const [key, nested] of Object.entries(value)) {
    verifyStrings(nested, [...pathParts, key]);
  }
}

for (const language of ['de', 'en', 'fr']) {
  verifyStrings(translations[language], [language]);
  assert.equal(typeof translations[language].feedback.verticalVelocity, 'string');
  assert.equal(typeof translations[language].feedback.verticalPosition, 'string');
  assert.equal(typeof translations[language].feedback.distanceWrong, 'function');
}

const orderedPairTerms = {
  de: 'geordnetes Zahlenpaar',
  en: 'ordered pair of numbers',
  fr: 'couple ordonné de nombres'
};
for (const language of ['de', 'en', 'fr']) {
  const twoDimensions = translations[language].notation.twoDimensions;
  assert.ok(twoDimensions.includes('\\begin{pmatrix}v_x\\\\v_y\\end{pmatrix}'));
  assert.ok(twoDimensions.includes(orderedPairTerms[language]));
}

const fallbackChecks = [
  translations.de.heading,
  translations.de.introLead,
  translations.de.notation.title,
  translations.de.notation.vectors,
  translations.de.notation.oneDimension,
  translations.de.notation.twoDimensions,
  translations.de.notation.footnoteAria,
  translations.de.notation.descriptions,
  translations.de.modes.description.title,
  translations.de.modes.positionToVelocity.title,
  translations.de.modes.velocityToPosition.title,
  translations.de.modes.mixed.title,
  translations.de.drawingInstructions,
  translations.de.distanceLabel,
  translations.de.check,
  translations.de.solution.summary
];
for (const fallback of fallbackChecks) {
  assert.ok(indexSource.includes(fallback), `German fallback is missing: ${fallback}`);
}

const model = core.createMotionModel(0, [
  { duration: 4, velocity: 1 },
  { duration: 2, velocity: 0 },
  { duration: 4, velocity: -1 }
]);
const descriptionWords = {
  de: ['befindet sich', 'bleibt', 'Absolutgeschwindigkeit', 'Orientierung'],
  en: ['object is at', 'remains', 'constant speed', 'orientation'],
  fr: ['se trouve', 'reste', 'vitesse absolue', 'orientation']
};
for (const language of ['de', 'en', 'fr']) {
  const paragraphs = core.describeMotion(
    model,
    language,
    core.DESCRIPTION_STYLES.signedVelocity
  );
  const description = paragraphs.join(' ');
  for (const word of descriptionWords[language]) assert.ok(description.includes(word));
  assert.ok(paragraphs[0].includes('\\vec{x}(0)'));
  assert.ok(paragraphs[1].includes('\\vec{v}=+1'));
  assert.ok(paragraphs[2].includes('\\vec{v}=0'));
  assert.ok(paragraphs[3].includes('\\(v=1'));
  assert.ok(!paragraphs[3].includes('\\vec{v}'));

  const reversed = core.describeMotion(
    model,
    language,
    core.DESCRIPTION_STYLES.absoluteSpeed
  );
  assert.ok(reversed[1].includes('\\(v=1'));
  assert.ok(reversed[3].includes('\\vec{v}=-1'));
}

console.log('German, English, and French translation shapes and static fallbacks verified.');
