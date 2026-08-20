'use strict';

(function() {
  const frame = document.getElementById('appFrame');
  const resultElement = document.getElementById('result');

  function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function waitFor(check, label) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (check()) return;
      await sleep(50);
    }
    throw new Error(`Timed out waiting for ${label}.`);
  }

  function key(target, value) {
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: value,
      bubbles: true,
      cancelable: true
    }));
  }

  async function run() {
    await waitFor(() => frame.contentWindow && frame.contentWindow.GGMotionApp, 'app startup');
    const appWindow = frame.contentWindow;
    const appDocument = frame.contentDocument;
    const browserErrors = [];
    appWindow.addEventListener('error', event => browserErrors.push(event.message));
    const originalConsoleError = appWindow.console.error.bind(appWindow.console);
    appWindow.console.error = function(...values) {
      browserErrors.push(values.map(String).join(' '));
      originalConsoleError(...values);
    };
    if (appWindow.MathJax && appWindow.MathJax.startup) {
      await appWindow.MathJax.startup.promise;
    }
    await waitFor(
      () => appDocument.querySelectorAll('#notationNote mjx-container').length >= 8,
      'intro notation MathJax'
    );

    const report = {};
    report.intro = {
      language: appDocument.documentElement.lang,
      version: appWindow.GG_APP_VERSION,
      visible: !appDocument.getElementById('introScreen').classList.contains('hidden'),
      overflow: appDocument.documentElement.scrollWidth > appWindow.innerWidth,
      notationMath: appDocument.querySelectorAll('#notationNote mjx-container').length
    };
    assert(report.intro.language === 'de', 'The app did not start in German.');
    assert(report.intro.version === '20260820.1', 'The browser loaded the wrong app version.');
    assert(report.intro.visible, 'The intro screen is not visible.');
    assert(!report.intro.overflow, 'The desktop intro has horizontal overflow.');
    assert(report.intro.notationMath >= 8, 'The intro notation was not rendered by MathJax.');

    appDocument.getElementById('startSelectedQuizButton').click();
    await waitFor(
      () => !appDocument.getElementById('quizScreen').classList.contains('hidden'),
      'default quiz'
    );
    report.preStart = {
      svgCount: appDocument.querySelectorAll('.motion-graph-svg').length,
      positionVisible: !appDocument.getElementById('positionDiagramPanel').classList.contains('hidden'),
      velocityVisible: !appDocument.getElementById('velocityDiagramPanel').classList.contains('hidden'),
      lockedCount: appDocument.querySelectorAll('.motion-graph.is-locked').length,
      promptHidden: appDocument.getElementById('taskPromptArea').classList.contains('hidden')
    };
    assert(report.preStart.svgCount === 2, 'The default text-to-both task needs two SVG graphs.');
    assert(report.preStart.positionVisible && report.preStart.velocityVisible, 'Both target graphs must be visible.');
    assert(report.preStart.lockedCount === 2, 'Both answer graphs must be locked before Start.');
    assert(report.preStart.promptHidden, 'The prompt must remain hidden before Start.');

    appDocument.getElementById('beginRoundButton').click();
    await waitFor(
      () => !appDocument.getElementById('taskPromptArea').classList.contains('hidden'),
      'started task'
    );
    await sleep(100);
    report.started = {
      editableCount: appDocument.querySelectorAll('.motion-graph.is-editable').length,
      hasMath: appDocument.querySelectorAll('#taskPromptArea mjx-container').length > 0,
      hasVectorMath: Boolean(appDocument.querySelector('#taskPromptArea mjx-over')),
      answerVisible: !appDocument.getElementById('answerArea').classList.contains('hidden')
    };
    assert(report.started.editableCount === 2, 'Both answer graphs must become editable.');
    assert(report.started.hasMath, 'The dynamic question was not rendered by MathJax.');
    assert(report.started.hasVectorMath, 'The dynamic prompt has no vector notation.');
    assert(report.started.answerVisible, 'The answer controls are hidden after Start.');

    appDocument.getElementById('langEnButton').click();
    await waitFor(() => appDocument.documentElement.lang === 'en', 'English localization');
    report.english = {
      heading: appDocument.getElementById('mainHeading').textContent,
      notationTitle: appDocument.getElementById('notationTitle').textContent,
      svgCount: appDocument.querySelectorAll('.motion-graph-svg').length,
      selectedLanguage: appWindow.GGMotionApp.getState().language
    };
    assert(report.english.heading.includes('Piecewise'), 'The English heading is missing.');
    assert(report.english.notationTitle.includes('velocity'), 'The English notation is missing.');
    assert(report.english.svgCount === 2, 'Changing language destroyed a graph.');
    assert(report.english.selectedLanguage === 'en', 'The shared language state did not update.');

    appDocument.getElementById('homeButton').click();
    appDocument.getElementById('modePositionToVelocityButton').click();
    appDocument.getElementById('startSelectedQuizButton').click();
    await waitFor(
      () => !appDocument.getElementById('quizScreen').classList.contains('hidden'),
      'position-to-velocity quiz'
    );
    report.conversion = {
      givenPositionSegments: appDocument.querySelectorAll('#positionGraph .graph-given-segment').length,
      answerVelocity: appDocument.getElementById('velocityDiagramPanel').classList.contains('is-answer'),
      svgCount: appDocument.querySelectorAll('.motion-graph-svg').length
    };
    assert(report.conversion.givenPositionSegments >= 2, 'The given position graph is missing.');
    assert(report.conversion.answerVelocity, 'The velocity graph is not marked as the answer graph.');
    assert(report.conversion.svgCount === 2, 'The conversion task needs a given and an answer graph.');

    appDocument.getElementById('beginRoundButton').click();
    await waitFor(
      () => appDocument.querySelector('#velocityGraph.motion-graph.is-editable'),
      'editable velocity graph'
    );
    await waitFor(
      () => appDocument.querySelector('#velocityGraph .graph-axis-label mjx-container'),
      'MathJax graph-axis labels'
    );
    const velocitySvg = appDocument.querySelector('#velocityGraph .motion-graph-svg');
    velocitySvg.focus();
    key(velocitySvg, ' ');
    key(velocitySvg, 'ArrowUp');
    key(velocitySvg, ' ');
    assert(
      appDocument.querySelectorAll('#velocityGraph .graph-student-segment').length === 1,
      'Keyboard drawing did not create the vertical test segment.'
    );
    appDocument.getElementById('checkAnswerButton').click();
    await waitFor(
      () => !appDocument.getElementById('feedbackPanel').classList.contains('hidden'),
      'vertical-line feedback'
    );
    report.verticalFeedback = {
      feedback: appDocument.getElementById('feedbackDetails').textContent.trim(),
      invalidSegments: appDocument.querySelectorAll('#velocityGraph .graph-student-segment.is-invalid').length,
      solutionVerticals: Array.from(
        appDocument.querySelectorAll('#velocityGraph .graph-solution-segment')
      ).filter(line => line.getAttribute('x1') === line.getAttribute('x2')).length
    };
    assert(
      report.verticalFeedback.feedback.includes('not connected by a vertical line'),
      'The dedicated vertical-jump explanation is missing.'
    );
    assert(report.verticalFeedback.invalidSegments === 1, 'The vertical segment was not highlighted.');
    assert(report.verticalFeedback.solutionVerticals === 0, 'The official velocity solution contains a vertical connector.');

    frame.style.width = '390px';
    await sleep(100);
    report.mobile = {
      width: appWindow.innerWidth,
      scrollWidth: appDocument.documentElement.scrollWidth,
      overflow: appDocument.documentElement.scrollWidth > appWindow.innerWidth,
      graphWidth: velocitySvg.getBoundingClientRect().width
    };
    assert(!report.mobile.overflow, 'The phone layout has horizontal overflow.');
    assert(report.mobile.graphWidth <= report.mobile.width, 'The velocity graph exceeds the phone viewport.');
    frame.style.width = '100%';
    await sleep(50);

    for (let step = 0; step < 10; step += 1) {
      appDocument.getElementById('nextButton').click();
      await sleep(30);
    }
    await waitFor(
      () => !appDocument.getElementById('resultScreen').classList.contains('hidden'),
      'ten-task result screen'
    );
    report.roundFlow = {
      result: appDocument.getElementById('resultScore').textContent,
      quizHidden: appDocument.getElementById('quizScreen').classList.contains('hidden'),
      resultVisible: !appDocument.getElementById('resultScreen').classList.contains('hidden')
    };
    assert(report.roundFlow.result.includes('0 out of 10 points'), 'Skipped tasks were not scored as zero.');
    assert(report.roundFlow.quizHidden && report.roundFlow.resultVisible, 'The result screen did not replace the quiz.');

    assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join(' | ')}`);
    document.body.dataset.status = 'pass';
    resultElement.textContent = JSON.stringify(report, null, 2);
    document.title = 'PASS motion browser smoke test';
  }

  function start() {
    run().catch(error => {
      document.body.dataset.status = 'fail';
      resultElement.textContent = error.stack || error.message;
      document.title = 'FAIL motion browser smoke test';
    });
  }

  if (frame.contentDocument && frame.contentDocument.readyState === 'complete') start();
  else frame.addEventListener('load', start, { once: true });
})();
