'use strict';

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GGMotionCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const VERSION = '20260820.2';
  const EPSILON = 1e-9;

  const GRAPH_TYPES = Object.freeze({
    position: 'position',
    velocity: 'velocity'
  });

  const TASK_TYPES = Object.freeze({
    textToPosition: 'text-to-position',
    textToVelocity: 'text-to-velocity',
    textToBoth: 'text-to-both',
    positionToVelocity: 'position-to-velocity',
    velocityToPosition: 'velocity-to-position'
  });

  const QUIZ_MODES = Object.freeze({
    description: 'description',
    positionToVelocity: 'position-to-velocity',
    velocityToPosition: 'velocity-to-position',
    mixed: 'mixed'
  });

  const DESCRIPTION_TARGETS = Object.freeze({
    position: 'position',
    velocity: 'velocity',
    both: 'both'
  });

  const DESCRIPTION_STYLES = Object.freeze({
    signedVelocity: 'signed-velocity',
    absoluteSpeed: 'absolute-speed'
  });

  const DIFFICULTIES = Object.freeze({
    basic: 'basic',
    standard: 'standard'
  });

  const GRID = Object.freeze({
    timeMin: 0,
    timeMax: 10,
    timeStep: 1,
    positionMin: -10,
    positionMax: 10,
    positionStep: 1,
    velocityMin: -3,
    velocityMax: 3,
    velocityStep: 1
  });

  const ALL_TASK_TYPES = Object.freeze(Object.values(TASK_TYPES));
  const SUPPORTED_LANGUAGES = Object.freeze(['de', 'en', 'fr']);

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
    return value;
  }

  function assertFiniteNumber(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${name} must be a finite number.`);
    }
  }

  function assertInteger(value, name) {
    assertFiniteNumber(value, name);
    if (!Number.isInteger(value)) {
      throw new RangeError(`${name} must be an integer.`);
    }
  }

  function normalizedRandom(random) {
    const value = random();
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError('random() must return a finite number.');
    }
    return Math.max(0, Math.min(1 - Number.EPSILON, value));
  }

  function randomInteger(min, max, random) {
    return min + Math.floor(normalizedRandom(random) * (max - min + 1));
  }

  function choose(values, random) {
    return values[randomInteger(0, values.length - 1, random)];
  }

  function shuffled(values, random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const replacement = randomInteger(0, index, random);
      [result[index], result[replacement]] = [result[replacement], result[index]];
    }
    return result;
  }

  function partitionDuration(totalDuration, partCount, random) {
    const possibleBreaks = [];
    for (let time = 1; time < totalDuration; time += 1) possibleBreaks.push(time);
    const breaks = shuffled(possibleBreaks, random)
      .slice(0, partCount - 1)
      .sort((left, right) => left - right);
    const boundaries = [0, ...breaks, totalDuration];
    return boundaries.slice(1).map((boundary, index) => boundary - boundaries[index]);
  }

  function createMotionModel(initialPosition, phaseInputs) {
    assertInteger(initialPosition, 'initialPosition');
    if (initialPosition < GRID.positionMin || initialPosition > GRID.positionMax) {
      throw new RangeError('initialPosition lies outside the position grid.');
    }
    if (!Array.isArray(phaseInputs) || phaseInputs.length < 1) {
      throw new TypeError('phaseInputs must be a non-empty array.');
    }

    let time = GRID.timeMin;
    let position = initialPosition;
    let totalDistance = 0;
    const phases = [];

    phaseInputs.forEach((input, index) => {
      if (!input || typeof input !== 'object') {
        throw new TypeError(`phaseInputs[${index}] must be an object.`);
      }
      assertInteger(input.duration, `phaseInputs[${index}].duration`);
      assertInteger(input.velocity, `phaseInputs[${index}].velocity`);
      if (input.duration <= 0) {
        throw new RangeError('Every phase duration must be positive.');
      }
      if (input.velocity < GRID.velocityMin || input.velocity > GRID.velocityMax) {
        throw new RangeError('A velocity lies outside the velocity grid.');
      }
      if (index > 0 && input.velocity === phaseInputs[index - 1].velocity) {
        throw new RangeError('Adjacent phases must have different velocities.');
      }

      const endTime = time + input.duration;
      const endPosition = position + input.velocity * input.duration;
      if (endTime > GRID.timeMax) {
        throw new RangeError('The motion exceeds the time grid.');
      }
      if (endPosition < GRID.positionMin || endPosition > GRID.positionMax) {
        throw new RangeError('The motion exceeds the position grid.');
      }

      phases.push({
        index,
        startTime: time,
        endTime,
        duration: input.duration,
        velocity: input.velocity,
        startPosition: position,
        endPosition,
        distance: Math.abs(input.velocity) * input.duration
      });
      totalDistance += Math.abs(input.velocity) * input.duration;
      time = endTime;
      position = endPosition;
    });

    if (time !== GRID.timeMax) {
      throw new RangeError(`The phase durations must total ${GRID.timeMax} seconds.`);
    }
    if (!phases.some(phase => phase.velocity !== 0)) {
      throw new RangeError('A generated motion must contain movement.');
    }

    return deepFreeze({
      initialPosition,
      finalPosition: position,
      totalDuration: time,
      totalDistance,
      phases
    });
  }

  function generateMotion(difficulty, random) {
    if (!Object.values(DIFFICULTIES).includes(difficulty)) {
      throw new RangeError(`Unknown difficulty: ${difficulty}`);
    }
    const phaseCount = difficulty === DIFFICULTIES.basic ? 2 : 3;
    const velocityChoices = difficulty === DIFFICULTIES.basic
      ? [-2, -1, 0, 1, 2]
      : [-3, -2, -1, 0, 1, 2, 3];

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const durations = partitionDuration(GRID.timeMax, phaseCount, random);
      const velocities = [];
      for (let index = 0; index < phaseCount; index += 1) {
        const choices = velocityChoices.filter(value => (
          index === 0 || value !== velocities[index - 1]
        ));
        velocities.push(choose(choices, random));
      }
      if (!velocities.some(value => value !== 0)) continue;

      const initialPosition = difficulty === DIFFICULTIES.basic
        ? 0
        : randomInteger(-4, 4, random);
      try {
        return createMotionModel(
          initialPosition,
          durations.map((duration, index) => ({ duration, velocity: velocities[index] }))
        );
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    }

    if (difficulty === DIFFICULTIES.basic) {
      return createMotionModel(0, [
        { duration: 5, velocity: 1 },
        { duration: 5, velocity: -1 }
      ]);
    }
    return createMotionModel(-2, [
      { duration: 3, velocity: 2 },
      { duration: 3, velocity: 0 },
      { duration: 4, velocity: -1 }
    ]);
  }

  function positionAt(model, time) {
    assertFiniteNumber(time, 'time');
    if (time < GRID.timeMin - EPSILON || time > GRID.timeMax + EPSILON) {
      throw new RangeError('time lies outside the motion interval.');
    }
    if (Math.abs(time - GRID.timeMax) <= EPSILON) return model.finalPosition;
    const phase = model.phases.find(candidate => (
      time >= candidate.startTime - EPSILON && time < candidate.endTime - EPSILON
    ));
    if (!phase) throw new RangeError('No phase covers this time.');
    return phase.startPosition + phase.velocity * (time - phase.startTime);
  }

  function velocityAt(model, time) {
    assertFiniteNumber(time, 'time');
    if (time < GRID.timeMin - EPSILON || time > GRID.timeMax + EPSILON) {
      throw new RangeError('time lies outside the motion interval.');
    }
    if (Math.abs(time - GRID.timeMax) <= EPSILON) {
      return model.phases[model.phases.length - 1].velocity;
    }
    const phase = model.phases.find(candidate => (
      time >= candidate.startTime - EPSILON && time < candidate.endTime - EPSILON
    ));
    if (!phase) throw new RangeError('No phase covers this time.');
    return phase.velocity;
  }

  function positionSegments(model) {
    return model.phases.map(phase => ({
      t1: phase.startTime,
      value1: phase.startPosition,
      t2: phase.endTime,
      value2: phase.endPosition
    }));
  }

  function velocitySegments(model) {
    return model.phases.map(phase => ({
      t1: phase.startTime,
      value1: phase.velocity,
      t2: phase.endTime,
      value2: phase.velocity
    }));
  }

  function descriptionTargetToTaskType(target) {
    if (target === DESCRIPTION_TARGETS.position) return TASK_TYPES.textToPosition;
    if (target === DESCRIPTION_TARGETS.velocity) return TASK_TYPES.textToVelocity;
    if (target === DESCRIPTION_TARGETS.both) return TASK_TYPES.textToBoth;
    throw new RangeError(`Unknown description target: ${target}`);
  }

  function taskRequirements(taskType) {
    switch (taskType) {
      case TASK_TYPES.textToPosition:
        return deepFreeze({ given: [], answers: [GRAPH_TYPES.position], hasDescription: true });
      case TASK_TYPES.textToVelocity:
        return deepFreeze({ given: [], answers: [GRAPH_TYPES.velocity], hasDescription: true });
      case TASK_TYPES.textToBoth:
        return deepFreeze({
          given: [],
          answers: [GRAPH_TYPES.position, GRAPH_TYPES.velocity],
          hasDescription: true
        });
      case TASK_TYPES.positionToVelocity:
        return deepFreeze({
          given: [GRAPH_TYPES.position],
          answers: [GRAPH_TYPES.velocity],
          hasDescription: false
        });
      case TASK_TYPES.velocityToPosition:
        return deepFreeze({
          given: [GRAPH_TYPES.velocity],
          answers: [GRAPH_TYPES.position],
          hasDescription: false
        });
      default:
        throw new RangeError(`Unknown task type: ${taskType}`);
    }
  }

  function createTask(taskType, difficulty, distanceRequired, random, index, descriptionStyle) {
    if (!ALL_TASK_TYPES.includes(taskType)) {
      throw new RangeError(`Unknown task type: ${taskType}`);
    }
    const model = generateMotion(difficulty, random);
    const requirements = taskRequirements(taskType);
    return deepFreeze({
      id: `motion-${index + 1}`,
      type: taskType,
      difficulty,
      distanceRequired: Boolean(distanceRequired),
      requirements,
      descriptionStyle: requirements.hasDescription ? descriptionStyle : null,
      model
    });
  }

  function roundTaskTypes(options, random) {
    const { mode, descriptionTarget, count } = options;
    if (mode === QUIZ_MODES.description) {
      return Array(count).fill(descriptionTargetToTaskType(descriptionTarget));
    }
    if (mode === QUIZ_MODES.positionToVelocity) {
      return Array(count).fill(TASK_TYPES.positionToVelocity);
    }
    if (mode === QUIZ_MODES.velocityToPosition) {
      return Array(count).fill(TASK_TYPES.velocityToPosition);
    }
    if (mode === QUIZ_MODES.mixed) {
      const balanced = [];
      for (let index = 0; index < count; index += 1) {
        balanced.push(ALL_TASK_TYPES[index % ALL_TASK_TYPES.length]);
      }
      return shuffled(balanced, random);
    }
    throw new RangeError(`Unknown quiz mode: ${mode}`);
  }

  function createRoundTasks(options) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('Round options are required.');
    }
    const count = options.count === undefined ? 10 : options.count;
    assertInteger(count, 'count');
    if (count <= 0 || count % 2 !== 0) {
      throw new RangeError('count must be a positive even integer for an exact 50% split.');
    }
    const random = options.random || Math.random;
    if (typeof random !== 'function') throw new TypeError('random must be a function.');
    if (!Object.values(DIFFICULTIES).includes(options.difficulty)) {
      throw new RangeError(`Unknown difficulty: ${options.difficulty}`);
    }

    const taskTypes = roundTaskTypes({
      mode: options.mode,
      descriptionTarget: options.descriptionTarget || DESCRIPTION_TARGETS.both,
      count
    }, random);
    const distanceFlags = shuffled([
      ...Array(count / 2).fill(true),
      ...Array(count / 2).fill(false)
    ], random);

    let descriptionIndex = 0;
    return deepFreeze(taskTypes.map((taskType, index) => {
      const hasDescription = taskRequirements(taskType).hasDescription;
      const descriptionStyle = descriptionIndex % 2 === 0
        ? DESCRIPTION_STYLES.signedVelocity
        : DESCRIPTION_STYLES.absoluteSpeed;
      if (hasDescription) descriptionIndex += 1;
      return createTask(
        taskType,
        options.difficulty,
        distanceFlags[index],
        random,
        index,
        descriptionStyle
      );
    }));
  }

  function segmentCoordinates(segment) {
    if (!segment || typeof segment !== 'object') return null;
    const coordinates = {
      t1: Number(segment.t1),
      value1: Number(segment.value1),
      t2: Number(segment.t2),
      value2: Number(segment.value2)
    };
    return Object.values(coordinates).every(Number.isFinite) ? coordinates : null;
  }

  function addIssue(issues, issue) {
    const key = `${issue.code}|${issue.segmentIndex ?? ''}|${issue.intervalStart ?? ''}`;
    if (!issues.some(candidate => candidate.key === key)) {
      issues.push({ ...issue, key });
    }
  }

  function expectedLine(model, graphType, midpoint) {
    if (graphType === GRAPH_TYPES.position) {
      return { value: positionAt(model, midpoint), slope: velocityAt(model, midpoint) };
    }
    if (graphType === GRAPH_TYPES.velocity) {
      return { value: velocityAt(model, midpoint), slope: 0 };
    }
    throw new RangeError(`Unknown graph type: ${graphType}`);
  }

  function valueOnSegment(segment, time) {
    const slope = (segment.value2 - segment.value1) / (segment.t2 - segment.t1);
    return segment.value1 + slope * (time - segment.t1);
  }

  function validateGraphSegments(model, graphType, rawSegments) {
    if (!Object.values(GRAPH_TYPES).includes(graphType)) {
      throw new RangeError(`Unknown graph type: ${graphType}`);
    }
    const segments = Array.isArray(rawSegments) ? rawSegments : [];
    const intervalCount = GRID.timeMax - GRID.timeMin;
    const coverage = Array(intervalCount).fill(false);
    const issues = [];

    segments.forEach((rawSegment, segmentIndex) => {
      const segment = segmentCoordinates(rawSegment);
      if (!segment) {
        addIssue(issues, { code: 'invalid-segment', segmentIndex });
        return;
      }
      const values = [segment.t1, segment.value1, segment.t2, segment.value2];
      if (!values.every(Number.isInteger)) {
        addIssue(issues, { code: 'off-grid', segmentIndex });
      }

      const valueMin = graphType === GRAPH_TYPES.position
        ? GRID.positionMin
        : GRID.velocityMin;
      const valueMax = graphType === GRAPH_TYPES.position
        ? GRID.positionMax
        : GRID.velocityMax;
      if (
        segment.t1 < GRID.timeMin || segment.t1 > GRID.timeMax ||
        segment.t2 < GRID.timeMin || segment.t2 > GRID.timeMax ||
        segment.value1 < valueMin || segment.value1 > valueMax ||
        segment.value2 < valueMin || segment.value2 > valueMax
      ) {
        addIssue(issues, { code: 'outside-grid', segmentIndex });
      }

      if (Math.abs(segment.t2 - segment.t1) <= EPSILON) {
        addIssue(issues, {
          code: Math.abs(segment.value2 - segment.value1) <= EPSILON
            ? 'zero-length-segment'
            : 'vertical-segment',
          segmentIndex
        });
        return;
      }

      const slope = (segment.value2 - segment.value1) / (segment.t2 - segment.t1);
      if (graphType === GRAPH_TYPES.velocity && Math.abs(slope) > EPSILON) {
        addIssue(issues, { code: 'non-horizontal-velocity', segmentIndex });
      }

      const minTime = Math.min(segment.t1, segment.t2);
      const maxTime = Math.max(segment.t1, segment.t2);
      for (let interval = GRID.timeMin; interval < GRID.timeMax; interval += 1) {
        const midpoint = interval + 0.5;
        if (midpoint <= minTime + EPSILON || midpoint >= maxTime - EPSILON) continue;
        const expected = expectedLine(model, graphType, midpoint);
        const actualValue = valueOnSegment(segment, midpoint);
        const matches = (
          Math.abs(actualValue - expected.value) <= EPSILON &&
          Math.abs(slope - expected.slope) <= EPSILON
        );
        if (matches) {
          coverage[interval - GRID.timeMin] = true;
        } else {
          addIssue(issues, { code: 'segment-does-not-match', segmentIndex, intervalStart: interval });
        }
      }
    });

    coverage.forEach((covered, index) => {
      if (!covered) {
        addIssue(issues, { code: 'missing-interval', intervalStart: index + GRID.timeMin });
      }
    });

    const publicIssues = issues.map(({ key, ...issue }) => issue);
    const invalidSegmentIndices = Array.from(new Set(
      publicIssues
        .filter(issue => Number.isInteger(issue.segmentIndex))
        .map(issue => issue.segmentIndex)
    )).sort((left, right) => left - right);

    return {
      correct: publicIssues.length === 0,
      issues: publicIssues,
      issueCodes: Array.from(new Set(publicIssues.map(issue => issue.code))),
      invalidSegmentIndices,
      missingIntervals: publicIssues
        .filter(issue => issue.code === 'missing-interval')
        .map(issue => issue.intervalStart)
    };
  }

  function parseDistanceAnswer(rawValue) {
    if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
    if (typeof rawValue !== 'string') return null;
    const normalized = rawValue.trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function validateDistanceAnswer(model, rawValue) {
    const value = parseDistanceAnswer(rawValue);
    if (value === null) {
      return { correct: false, value: null, expected: model.totalDistance, issueCode: 'invalid-distance' };
    }
    return {
      correct: Math.abs(value - model.totalDistance) <= EPSILON,
      value,
      expected: model.totalDistance,
      issueCode: Math.abs(value - model.totalDistance) <= EPSILON ? null : 'wrong-distance'
    };
  }

  function evaluateTask(task, answers) {
    const safeAnswers = answers && typeof answers === 'object' ? answers : {};
    const graphAnswers = safeAnswers.graphs && typeof safeAnswers.graphs === 'object'
      ? safeAnswers.graphs
      : {};
    const graphResults = {};
    for (const graphType of task.requirements.answers) {
      graphResults[graphType] = validateGraphSegments(
        task.model,
        graphType,
        graphAnswers[graphType]
      );
    }
    const distanceResult = task.distanceRequired
      ? validateDistanceAnswer(task.model, safeAnswers.distance)
      : null;
    return {
      correct: (
        Object.values(graphResults).every(result => result.correct) &&
        (!distanceResult || distanceResult.correct)
      ),
      graphResults,
      distanceResult
    };
  }

  function latexNumber(value) {
    return Number.isInteger(value) ? String(value) : String(value).replace('.', '{,}');
  }

  function describeMotion(model, language, firstDescriptionStyle) {
    const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'de';
    const startingStyle = Object.values(DESCRIPTION_STYLES).includes(firstDescriptionStyle)
      ? firstDescriptionStyle
      : DESCRIPTION_STYLES.signedVelocity;
    const x0 = latexNumber(model.initialPosition);
    const intro = {
      de: `Bei \\(t=0\\,\\mathrm{s}\\) befindet sich der Körper am Ort \\(\\vec{x}(0)=${x0}\\,\\mathrm{m}\\).`,
      en: `At \\(t=0\\,\\mathrm{s}\\), the object is at position \\(\\vec{x}(0)=${x0}\\,\\mathrm{m}\\).`,
      fr: `À \\(t=0\\,\\mathrm{s}\\), le corps se trouve à la position \\(\\vec{x}(0)=${x0}\\,\\mathrm{m}\\).`
    }[lang];

    let movingPhaseIndex = 0;
    const phaseTexts = model.phases.map(phase => {
      const start = latexNumber(phase.startTime);
      const end = latexNumber(phase.endTime);
      if (phase.velocity === 0) {
        return {
          de: `Von \\(t=${start}\\,\\mathrm{s}\\) bis \\(t=${end}\\,\\mathrm{s}\\) bleibt der Körper am selben Ort; seine Geschwindigkeit ist \\(\\vec{v}=0\\,\\mathrm{m/s}\\).`,
          en: `From \\(t=${start}\\,\\mathrm{s}\\) to \\(t=${end}\\,\\mathrm{s}\\), the object remains at rest; its velocity is \\(\\vec{v}=0\\,\\mathrm{m/s}\\).`,
          fr: `De \\(t=${start}\\,\\mathrm{s}\\) à \\(t=${end}\\,\\mathrm{s}\\), le corps reste immobile ; sa vitesse est \\(\\vec{v}=0\\,\\mathrm{m/s}\\).`
        }[lang];
      }
      const useSignedVelocity = movingPhaseIndex % 2 === 0
        ? startingStyle === DESCRIPTION_STYLES.signedVelocity
        : startingStyle === DESCRIPTION_STYLES.absoluteSpeed;
      movingPhaseIndex += 1;
      if (useSignedVelocity) {
        const velocity = phase.velocity > 0
          ? `+${latexNumber(phase.velocity)}`
          : latexNumber(phase.velocity);
        return {
          de: `Von \\(t=${start}\\,\\mathrm{s}\\) bis \\(t=${end}\\,\\mathrm{s}\\) bewegt er sich mit der konstanten Geschwindigkeit \\(\\vec{v}=${velocity}\\,\\mathrm{m/s}\\).`,
          en: `From \\(t=${start}\\,\\mathrm{s}\\) to \\(t=${end}\\,\\mathrm{s}\\), it moves with the constant velocity \\(\\vec{v}=${velocity}\\,\\mathrm{m/s}\\).`,
          fr: `De \\(t=${start}\\,\\mathrm{s}\\) à \\(t=${end}\\,\\mathrm{s}\\), il se déplace avec la vitesse constante \\(\\vec{v}=${velocity}\\,\\mathrm{m/s}\\).`
        }[lang];
      }
      const speed = latexNumber(Math.abs(phase.velocity));
      const orientation = phase.velocity > 0
        ? { de: 'positiver', en: 'positive', fr: 'positive' }[lang]
        : { de: 'negativer', en: 'negative', fr: 'négative' }[lang];
      return {
        de: `Von \\(t=${start}\\,\\mathrm{s}\\) bis \\(t=${end}\\,\\mathrm{s}\\) bewegt er sich mit der konstanten Absolutgeschwindigkeit \\(v=${speed}\\,\\mathrm{m/s}\\) in ${orientation} \\(x\\)-Orientierung.`,
        en: `From \\(t=${start}\\,\\mathrm{s}\\) to \\(t=${end}\\,\\mathrm{s}\\), it moves with the constant speed \\(v=${speed}\\,\\mathrm{m/s}\\) in the ${orientation} \\(x\\)-orientation.`,
        fr: `De \\(t=${start}\\,\\mathrm{s}\\) à \\(t=${end}\\,\\mathrm{s}\\), il se déplace avec la vitesse absolue constante \\(v=${speed}\\,\\mathrm{m/s}\\) selon l’orientation ${orientation} de \\(x\\).`
      }[lang];
    });
    return [intro, ...phaseTexts];
  }

  return Object.freeze({
    VERSION,
    GRAPH_TYPES,
    TASK_TYPES,
    QUIZ_MODES,
    DESCRIPTION_TARGETS,
    DESCRIPTION_STYLES,
    DIFFICULTIES,
    GRID,
    ALL_TASK_TYPES,
    SUPPORTED_LANGUAGES,
    createMotionModel,
    generateMotion,
    createRoundTasks,
    taskRequirements,
    positionAt,
    velocityAt,
    positionSegments,
    velocitySegments,
    validateGraphSegments,
    parseDistanceAnswer,
    validateDistanceAnswer,
    evaluateTask,
    describeMotion
  });
});
