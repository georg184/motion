'use strict';

const assert = require('node:assert/strict');
const core = require('../js/motion-core.js');

const model = core.createMotionModel(-2, [
  { duration: 3, velocity: 2 },
  { duration: 2, velocity: 0 },
  { duration: 5, velocity: -1 }
]);

const correctPosition = core.positionSegments(model);
const correctVelocity = core.velocitySegments(model);
assert.equal(core.validateGraphSegments(model, core.GRAPH_TYPES.position, correctPosition).correct, true);
assert.equal(core.validateGraphSegments(model, core.GRAPH_TYPES.velocity, correctVelocity).correct, true);

const positionWithExtraCollinearPoints = [
  { t1: 0, value1: -2, t2: 1, value2: 0 },
  { t1: 1, value1: 0, t2: 3, value2: 4 },
  { t1: 3, value1: 4, t2: 4, value2: 4 },
  { t1: 4, value1: 4, t2: 5, value2: 4 },
  { t1: 5, value1: 4, t2: 8, value2: 1 },
  { t1: 8, value1: 1, t2: 10, value2: -1 }
];
assert.equal(
  core.validateGraphSegments(model, core.GRAPH_TYPES.position, positionWithExtraCollinearPoints).correct,
  true,
  'An exact graph split at additional collinear grid points must remain correct.'
);

const velocityWithExtraCollinearPoints = [
  { t1: 0, value1: 2, t2: 1, value2: 2 },
  { t1: 1, value1: 2, t2: 3, value2: 2 },
  { t1: 3, value1: 0, t2: 5, value2: 0 },
  { t1: 5, value1: -1, t2: 7, value2: -1 },
  { t1: 7, value1: -1, t2: 10, value2: -1 }
];
assert.equal(
  core.validateGraphSegments(model, core.GRAPH_TYPES.velocity, velocityWithExtraCollinearPoints).correct,
  true
);

const velocityWithVerticalJump = [
  ...correctVelocity,
  { t1: 3, value1: 2, t2: 3, value2: 0 }
];
const verticalVelocityResult = core.validateGraphSegments(
  model,
  core.GRAPH_TYPES.velocity,
  velocityWithVerticalJump
);
assert.equal(verticalVelocityResult.correct, false);
assert.ok(verticalVelocityResult.issueCodes.includes('vertical-segment'));
assert.ok(verticalVelocityResult.invalidSegmentIndices.includes(3));

const positionWithVerticalLine = [
  ...correctPosition,
  { t1: 3, value1: 4, t2: 3, value2: 2 }
];
const verticalPositionResult = core.validateGraphSegments(
  model,
  core.GRAPH_TYPES.position,
  positionWithVerticalLine
);
assert.equal(verticalPositionResult.correct, false);
assert.ok(verticalPositionResult.issueCodes.includes('vertical-segment'));

const slopedVelocity = [
  { t1: 0, value1: 2, t2: 3, value2: 1 },
  ...correctVelocity.slice(1)
];
const slopedVelocityResult = core.validateGraphSegments(
  model,
  core.GRAPH_TYPES.velocity,
  slopedVelocity
);
assert.equal(slopedVelocityResult.correct, false);
assert.ok(slopedVelocityResult.issueCodes.includes('non-horizontal-velocity'));

const incompletePosition = correctPosition.slice(0, 2);
const incompleteResult = core.validateGraphSegments(
  model,
  core.GRAPH_TYPES.position,
  incompletePosition
);
assert.equal(incompleteResult.correct, false);
assert.ok(incompleteResult.issueCodes.includes('missing-interval'));
assert.deepEqual(incompleteResult.missingIntervals, [5, 6, 7, 8, 9]);

const wrongPosition = correctPosition.map(segment => ({ ...segment }));
wrongPosition[0].value2 = 3;
const wrongPositionResult = core.validateGraphSegments(
  model,
  core.GRAPH_TYPES.position,
  wrongPosition
);
assert.equal(wrongPositionResult.correct, false);
assert.ok(wrongPositionResult.issueCodes.includes('segment-does-not-match'));

const task = {
  model,
  distanceRequired: true,
  requirements: { answers: [core.GRAPH_TYPES.position, core.GRAPH_TYPES.velocity] }
};
const correctEvaluation = core.evaluateTask(task, {
  graphs: {
    position: positionWithExtraCollinearPoints,
    velocity: velocityWithExtraCollinearPoints
  },
  distance: '11'
});
assert.equal(correctEvaluation.correct, true);
assert.equal(core.evaluateTask(task, {
  graphs: { position: correctPosition, velocity: velocityWithVerticalJump },
  distance: '11'
}).correct, false);
assert.equal(core.evaluateTask(task, {
  graphs: { position: correctPosition, velocity: correctVelocity },
  distance: '10'
}).correct, false);

console.log('Exact graph validation, collinear splitting, and strict vertical-line rejection verified.');
