'use strict';

const assert = require('node:assert/strict');
const core = require('../js/motion-core.js');

function seededRandom(seed) {
  let value = seed >>> 0;
  return function() {
    value += 0x6D2B79F5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const model = core.createMotionModel(-2, [
  { duration: 3, velocity: 2 },
  { duration: 2, velocity: 0 },
  { duration: 5, velocity: -1 }
]);

assert.equal(model.initialPosition, -2);
assert.equal(model.finalPosition, -1);
assert.equal(model.totalDuration, 10);
assert.equal(model.totalDistance, 11);
assert.deepEqual(
  model.phases.map(phase => [phase.startTime, phase.endTime, phase.startPosition, phase.endPosition]),
  [[0, 3, -2, 4], [3, 5, 4, 4], [5, 10, 4, -1]]
);
assert.equal(core.positionAt(model, 0), -2);
assert.equal(core.positionAt(model, 2.5), 3);
assert.equal(core.positionAt(model, 4), 4);
assert.equal(core.positionAt(model, 10), -1);
assert.equal(core.velocityAt(model, 0), 2);
assert.equal(core.velocityAt(model, 3), 0);
assert.equal(core.velocityAt(model, 7), -1);

assert.deepEqual(core.positionSegments(model), [
  { t1: 0, value1: -2, t2: 3, value2: 4 },
  { t1: 3, value1: 4, t2: 5, value2: 4 },
  { t1: 5, value1: 4, t2: 10, value2: -1 }
]);
assert.deepEqual(core.velocitySegments(model), [
  { t1: 0, value1: 2, t2: 3, value2: 2 },
  { t1: 3, value1: 0, t2: 5, value2: 0 },
  { t1: 5, value1: -1, t2: 10, value2: -1 }
]);
assert.ok(core.velocitySegments(model).every(segment => segment.value1 === segment.value2));

for (const language of core.SUPPORTED_LANGUAGES) {
  const description = core.describeMotion(model, language);
  assert.equal(description.length, 4);
  assert.ok(description.every(paragraph => paragraph.includes('\\(')));
}

assert.equal(core.parseDistanceAnswer('11'), 11);
assert.equal(core.parseDistanceAnswer('11,0'), 11);
assert.equal(core.parseDistanceAnswer('11 m'), null);
assert.equal(core.validateDistanceAnswer(model, '11').correct, true);
assert.equal(core.validateDistanceAnswer(model, '-11').correct, false);

for (const difficulty of Object.values(core.DIFFICULTIES)) {
  const random = seededRandom(difficulty === core.DIFFICULTIES.basic ? 11 : 29);
  for (let index = 0; index < 500; index += 1) {
    const generated = core.generateMotion(difficulty, random);
    assert.equal(generated.totalDuration, 10);
    assert.equal(generated.phases.length, difficulty === core.DIFFICULTIES.basic ? 2 : 3);
    assert.equal(generated.initialPosition, difficulty === core.DIFFICULTIES.basic ? 0 : generated.initialPosition);
    assert.ok(generated.totalDistance > 0);
    for (const phase of generated.phases) {
      assert.ok(Number.isInteger(phase.duration));
      assert.ok(Number.isInteger(phase.velocity));
      assert.ok(phase.startPosition >= core.GRID.positionMin);
      assert.ok(phase.startPosition <= core.GRID.positionMax);
      assert.ok(phase.endPosition >= core.GRID.positionMin);
      assert.ok(phase.endPosition <= core.GRID.positionMax);
    }
    for (let phase = 1; phase < generated.phases.length; phase += 1) {
      assert.notEqual(generated.phases[phase - 1].velocity, generated.phases[phase].velocity);
    }
  }
}

const modeCases = [
  [core.QUIZ_MODES.description, core.DESCRIPTION_TARGETS.position, core.TASK_TYPES.textToPosition],
  [core.QUIZ_MODES.description, core.DESCRIPTION_TARGETS.velocity, core.TASK_TYPES.textToVelocity],
  [core.QUIZ_MODES.description, core.DESCRIPTION_TARGETS.both, core.TASK_TYPES.textToBoth],
  [core.QUIZ_MODES.positionToVelocity, core.DESCRIPTION_TARGETS.both, core.TASK_TYPES.positionToVelocity],
  [core.QUIZ_MODES.velocityToPosition, core.DESCRIPTION_TARGETS.both, core.TASK_TYPES.velocityToPosition]
];

for (const [mode, target, expectedType] of modeCases) {
  const tasks = core.createRoundTasks({
    mode,
    descriptionTarget: target,
    difficulty: core.DIFFICULTIES.standard,
    count: 10,
    random: seededRandom(37)
  });
  assert.equal(tasks.length, 10);
  assert.equal(tasks.filter(task => task.distanceRequired).length, 5);
  assert.ok(tasks.every(task => task.type === expectedType));
}

const mixedTasks = core.createRoundTasks({
  mode: core.QUIZ_MODES.mixed,
  descriptionTarget: core.DESCRIPTION_TARGETS.both,
  difficulty: core.DIFFICULTIES.standard,
  count: 10,
  random: seededRandom(71)
});
assert.equal(mixedTasks.filter(task => task.distanceRequired).length, 5);
for (const taskType of core.ALL_TASK_TYPES) {
  assert.equal(mixedTasks.filter(task => task.type === taskType).length, 2);
}
for (const task of mixedTasks) {
  const graphs = {};
  if (task.requirements.answers.includes(core.GRAPH_TYPES.position)) {
    graphs.position = core.positionSegments(task.model);
  }
  if (task.requirements.answers.includes(core.GRAPH_TYPES.velocity)) {
    graphs.velocity = core.velocitySegments(task.model);
  }
  assert.equal(core.evaluateTask(task, {
    graphs,
    distance: task.distanceRequired ? String(task.model.totalDistance) : ''
  }).correct, true, `Canonical solution rejected for ${task.type}.`);
}

assert.throws(() => core.createRoundTasks({
  mode: core.QUIZ_MODES.mixed,
  difficulty: core.DIFFICULTIES.basic,
  count: 9,
  random: seededRandom(1)
}), /positive even integer/);

console.log('Motion model, task generation, localization, and exact 50% distance split verified.');
