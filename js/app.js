'use strict';

const APP_VERSION = '20260819.3';
const QUESTIONS_PER_ROUND = 10;
const TIMER_UPDATE_INTERVAL_MS = 250;
const LANGUAGE_STORAGE_KEY = 'motion-language';

const VERSION_MISMATCH_TEXT = {
  de: {
    title: 'Neue Version verfügbar',
    body: 'Diese Seite hat Dateien aus unterschiedlichen Versionen geladen. Bitte lade die Seite neu.'
  },
  en: {
    title: 'New version available',
    body: 'This page loaded files from different versions. Please reload the page.'
  },
  fr: {
    title: 'Nouvelle version disponible',
    body: 'Cette page a chargé des fichiers de versions différentes. Veuillez recharger la page.'
  }
};

function stopForVersionMismatch(detail) {
  const language = VERSION_MISMATCH_TEXT[document.documentElement.lang]
    ? document.documentElement.lang
    : 'de';
  const message = VERSION_MISMATCH_TEXT[language];
  document.body.innerHTML = [
    '<main style="max-width:720px;margin:40px auto;padding:20px;font-family:system-ui,sans-serif;line-height:1.5">',
    `<h1>${message.title}</h1>`,
    `<p>${message.body}</p>`,
    '</main>'
  ].join('');
  throw new Error(detail);
}

if (window.GG_APP_VERSION !== APP_VERSION) {
  stopForVersionMismatch(
    `Version mismatch: index ${window.GG_APP_VERSION || 'missing'}, app ${APP_VERSION}`
  );
}

const motionCore = window.GGMotionCore;
const graphLibrary = window.GGMotionGraphEditor;
if (!motionCore || motionCore.VERSION !== APP_VERSION) {
  stopForVersionMismatch(
    `Motion-core mismatch: expected ${APP_VERSION}, received ${motionCore ? motionCore.VERSION : 'missing'}`
  );
}
if (!graphLibrary || graphLibrary.VERSION !== APP_VERSION) {
  stopForVersionMismatch(
    `Graph-editor mismatch: expected ${APP_VERSION}, received ${graphLibrary ? graphLibrary.VERSION : 'missing'}`
  );
}

const TEXT = {
  de: {
    documentTitle: 'Stückweise gleichförmige Bewegung',
    heading: 'Stückweise gleichförmige Bewegung',
    languageSelectorAria: 'Sprachauswahl',
    introLead: 'Übe den Zusammenhang zwischen Bewegungsbeschreibung, Orts-Zeit-Diagramm und Geschwindigkeits-Zeit-Diagramm.',
    modeLegend: 'Wähle den Aufgabentyp',
    modes: {
      description: {
        title: 'Beschreibung umsetzen',
        description: 'Zeichne aus einem Text ein oder beide Bewegungsdiagramme.'
      },
      positionToVelocity: {
        title: 'Ort → Geschwindigkeit',
        description: 'Leite aus dem Ortsdiagramm die Geschwindigkeit ab.'
      },
      velocityToPosition: {
        title: 'Geschwindigkeit → Ort',
        description: 'Konstruiere mit dem angegebenen Anfangsort das Ortsdiagramm.'
      },
      mixed: {
        title: 'Gemischtes Quiz',
        description: 'Wechsle zwischen allen fünf Aufgabenvarianten.'
      }
    },
    descriptionTargetLegend: 'Zu zeichnende Diagramme',
    descriptionTargets: { position: 'Ort', velocity: 'Geschwindigkeit', both: 'Beide' },
    difficultyLegend: 'Schwierigkeit',
    difficulties: {
      basic: { title: 'Basis', description: 'Zwei Bewegungsabschnitte, Anfangsort null' },
      standard: { title: 'Standard', description: 'Drei Abschnitte mit beliebigem Anfangsort' }
    },
    startQuiz: 'Quiz starten',
    continueQuiz: 'Quiz fortsetzen',
    home: 'Zur Startseite',
    next: 'Nächste Aufgabe',
    showResult: 'Ergebnis anzeigen',
    status: {
      task: (current, total) => `Aufgabe ${current}/${total}`,
      score: (correct, answered) => `Punkte: ${correct}/${answered}`,
      time: value => `Zeit: ${value}`
    },
    roundStart: 'Die erste Aufgabe ist bereit. Die Zeit beginnt erst mit einem Klick auf Start.',
    begin: 'Start',
    drawingInstructions: 'Ziehe mit Maus oder Stift von einem Gitterpunkt zum nächsten. Du kannst auch zwei Punkte nacheinander anklicken. Die Endpunkte rasten exakt ein.',
    diagram: {
      positionTitle: 'Orts-Zeit-Diagramm',
      velocityTitle: 'Geschwindigkeits-Zeit-Diagramm',
      given: 'Gegeben',
      draw: 'Zeichnen',
      undo: 'Letzten Abschnitt rückgängig',
      clear: 'Zeichnung löschen',
      aria: (type, editable) => `${type === 'position' ? 'Orts-Zeit-Diagramm' : 'Geschwindigkeits-Zeit-Diagramm'} mit Gitter. ${editable ? 'Zeichne Geradensegmente mit Zeiger oder Tastatur.' : 'Vorgegebenes Diagramm.'}`,
      status: (type, point, pending) => {
        const coordinate = type === 'position'
          ? `x = ${point.value} m`
          : `v = ${point.value} m/s`;
        return `Fangpunkt: t = ${point.t} s, ${coordinate}${pending ? '; Anfangspunkt gewählt' : ''}`;
      }
    },
    distanceLabel: 'Berechne zusätzlich die insgesamt zurückgelegte Strecke.',
    check: 'Antwort prüfen',
    taskBadges: {
      'text-to-position': 'Beschreibung → Ort',
      'text-to-velocity': 'Beschreibung → Geschwindigkeit',
      'text-to-both': 'Beschreibung → beide Diagramme',
      'position-to-velocity': 'Ort → Geschwindigkeit',
      'velocity-to-position': 'Geschwindigkeit → Ort'
    },
    questions: {
      'text-to-position': () => 'Zeichne zur beschriebenen Bewegung das Orts-Zeit-Diagramm \\(x(t)\\).',
      'text-to-velocity': () => 'Zeichne zur beschriebenen Bewegung das Geschwindigkeits-Zeit-Diagramm \\(v(t)\\).',
      'text-to-both': () => 'Zeichne zur beschriebenen Bewegung sowohl \\(x(t)\\) als auch \\(v(t)\\).',
      'position-to-velocity': () => 'Lies die Steigungen des gegebenen Orts-Zeit-Diagramms ab und zeichne das zugehörige Geschwindigkeits-Zeit-Diagramm.',
      'velocity-to-position': model => `Zeichne zum gegebenen Geschwindigkeits-Zeit-Diagramm das Orts-Zeit-Diagramm. Verwende \\(x(0)=${model.initialPosition}\\,\\mathrm{m}\\).`
    },
    feedback: {
      correctHeading: 'Richtig!',
      incorrectHeading: 'Noch nicht richtig.',
      graphCorrect: type => `${type === 'position' ? 'Das Ortsdiagramm' : 'Das Geschwindigkeitsdiagramm'} ist korrekt.`,
      verticalVelocity: 'Ein Geschwindigkeitssprung wird nicht durch eine senkrechte Linie verbunden. Zeichne die konstanten Geschwindigkeitsabschnitte getrennt.',
      verticalPosition: 'Eine senkrechte Linie im Ortsdiagramm würde bedeuten, dass sich der Körper gleichzeitig an mehreren Orten befindet.',
      nonHorizontalVelocity: 'Bei einer stückweise gleichförmigen Bewegung besteht das Geschwindigkeitsdiagramm ausschließlich aus waagerechten Abschnitten.',
      missing: type => `${type === 'position' ? 'Das Ortsdiagramm' : 'Das Geschwindigkeitsdiagramm'} deckt noch nicht den gesamten Zeitraum von 0 bis 10 Sekunden ab.`,
      mismatch: type => `Mindestens ein Abschnitt des ${type === 'position' ? 'Ortsdiagramms hat nicht den richtigen Verlauf' : 'Geschwindigkeitsdiagramms liegt nicht bei der richtigen Geschwindigkeit'}.`,
      offGrid: 'Mindestens ein Abschnitt liegt außerhalb des erlaubten Gitters.',
      zeroLength: 'Ein Abschnitt benötigt zwei verschiedene Endpunkte.',
      invalidGraph: 'Die Zeichnung enthält einen ungültigen Abschnitt.',
      distanceCorrect: value => `Die Gesamtstrecke von ${value} m ist korrekt.`,
      distanceWrong: expected => `Die Gesamtstrecke ist nicht korrekt. Richtig sind ${expected} m.`,
      distanceInvalid: 'Gib die Gesamtstrecke als Zahl ohne Einheit ein.'
    },
    solution: {
      summary: 'Musterlösung und Erklärung',
      positionRelation: 'Im Orts-Zeit-Diagramm entspricht die Steigung der Geschwindigkeit: \\(v=\\frac{\\Delta x}{\\Delta t}\\).',
      velocityRelation: 'Aus jedem Geschwindigkeitsabschnitt folgt der neue Ort mit \\(x_{i+1}=x_i+v_i\\Delta t_i\\).',
      tableIntro: 'Die Bewegung besteht aus folgenden Abschnitten:',
      interval: 'Zeitintervall',
      velocity: 'Geschwindigkeit',
      positionChange: 'Ortsänderung',
      positions: 'Ort',
      partialDistance: 'Teil​strecke',
      totalDistance: value => `Damit beträgt die insgesamt zurückgelegte Strecke \\(s_{\\mathrm{ges}}=${value}\\,\\mathrm{m}\\).`
    },
    result: {
      heading: 'Ergebnis',
      score: (score, total) => `${score} von ${total} Punkten`,
      time: value => `Benötigte Zeit: ${value}`,
      restart: 'Neues Quiz starten',
      home: 'Zur Startseite'
    }
  },
  en: {
    documentTitle: 'Piecewise uniform motion',
    heading: 'Piecewise Uniform Motion',
    languageSelectorAria: 'Language selection',
    introLead: 'Practise the relationship between a written motion description, a position–time graph, and a velocity–time graph.',
    modeLegend: 'Choose the task type',
    modes: {
      description: {
        title: 'Convert a description',
        description: 'Draw one or both motion graphs from a written description.'
      },
      positionToVelocity: {
        title: 'Position → velocity',
        description: 'Derive the velocity from the position graph.'
      },
      velocityToPosition: {
        title: 'Velocity → position',
        description: 'Construct the position graph using the given initial position.'
      },
      mixed: {
        title: 'Mixed quiz',
        description: 'Alternate among all five task variants.'
      }
    },
    descriptionTargetLegend: 'Graphs to draw',
    descriptionTargets: { position: 'Position', velocity: 'Velocity', both: 'Both' },
    difficultyLegend: 'Difficulty',
    difficulties: {
      basic: { title: 'Basic', description: 'Two motion phases, initial position zero' },
      standard: { title: 'Standard', description: 'Three phases with a variable initial position' }
    },
    startQuiz: 'Start quiz',
    continueQuiz: 'Continue quiz',
    home: 'Back to start',
    next: 'Next task',
    showResult: 'Show result',
    status: {
      task: (current, total) => `Task ${current}/${total}`,
      score: (correct, answered) => `Score: ${correct}/${answered}`,
      time: value => `Time: ${value}`
    },
    roundStart: 'The first task is ready. The timer starts only after you press Start.',
    begin: 'Start',
    drawingInstructions: 'Drag from one grid point to another with a mouse or pen. You can also select two points one after the other. Endpoints snap exactly to the grid.',
    diagram: {
      positionTitle: 'Position–time graph',
      velocityTitle: 'Velocity–time graph',
      given: 'Given',
      draw: 'Draw',
      undo: 'Undo last segment',
      clear: 'Clear drawing',
      aria: (type, editable) => `${type === 'position' ? 'Position–time graph' : 'Velocity–time graph'} with a grid. ${editable ? 'Draw line segments with a pointer or the keyboard.' : 'Given graph.'}`,
      status: (type, point, pending) => {
        const coordinate = type === 'position'
          ? `x = ${point.value} m`
          : `v = ${point.value} m/s`;
        return `Snap point: t = ${point.t} s, ${coordinate}${pending ? '; start point selected' : ''}`;
      }
    },
    distanceLabel: 'Also calculate the total distance travelled.',
    check: 'Check answer',
    taskBadges: {
      'text-to-position': 'Description → position',
      'text-to-velocity': 'Description → velocity',
      'text-to-both': 'Description → both graphs',
      'position-to-velocity': 'Position → velocity',
      'velocity-to-position': 'Velocity → position'
    },
    questions: {
      'text-to-position': () => 'Draw the position–time graph \\(x(t)\\) for the described motion.',
      'text-to-velocity': () => 'Draw the velocity–time graph \\(v(t)\\) for the described motion.',
      'text-to-both': () => 'Draw both \\(x(t)\\) and \\(v(t)\\) for the described motion.',
      'position-to-velocity': () => 'Read the slopes of the given position–time graph and draw the corresponding velocity–time graph.',
      'velocity-to-position': model => `Draw the position–time graph for the given velocity–time graph. Use \\(x(0)=${model.initialPosition}\\,\\mathrm{m}\\).`
    },
    feedback: {
      correctHeading: 'Correct!',
      incorrectHeading: 'Not correct yet.',
      graphCorrect: type => `The ${type === 'position' ? 'position graph' : 'velocity graph'} is correct.`,
      verticalVelocity: 'A velocity jump is not connected by a vertical line. Draw the constant-velocity sections separately.',
      verticalPosition: 'A vertical line in the position graph would mean that the object is at several positions at the same time.',
      nonHorizontalVelocity: 'For piecewise uniform motion, the velocity graph consists only of horizontal sections.',
      missing: type => `The ${type === 'position' ? 'position graph' : 'velocity graph'} does not yet cover the complete interval from 0 to 10 seconds.`,
      mismatch: type => `At least one section of the ${type === 'position' ? 'position graph has the wrong shape' : 'velocity graph is at the wrong velocity'}.`,
      offGrid: 'At least one segment lies outside the permitted grid.',
      zeroLength: 'A segment needs two different endpoints.',
      invalidGraph: 'The drawing contains an invalid segment.',
      distanceCorrect: value => `The total distance of ${value} m is correct.`,
      distanceWrong: expected => `The total distance is incorrect. The correct distance is ${expected} m.`,
      distanceInvalid: 'Enter the total distance as a number without a unit.'
    },
    solution: {
      summary: 'Model answer and explanation',
      positionRelation: 'In the position–time graph, the slope equals the velocity: \\(v=\\frac{\\Delta x}{\\Delta t}\\).',
      velocityRelation: 'Each velocity section gives the next position through \\(x_{i+1}=x_i+v_i\\Delta t_i\\).',
      tableIntro: 'The motion consists of these phases:',
      interval: 'Time interval',
      velocity: 'Velocity',
      positionChange: 'Position change',
      positions: 'Position',
      partialDistance: 'Partial distance',
      totalDistance: value => `Thus the total distance travelled is \\(s_{\\mathrm{tot}}=${value}\\,\\mathrm{m}\\).`
    },
    result: {
      heading: 'Result',
      score: (score, total) => `${score} out of ${total} points`,
      time: value => `Time taken: ${value}`,
      restart: 'Start a new quiz',
      home: 'Back to start'
    }
  },
  fr: {
    documentTitle: 'Mouvement uniforme par morceaux',
    heading: 'Mouvement uniforme par morceaux',
    languageSelectorAria: 'Choix de la langue',
    introLead: 'Entraîne-toi à relier une description du mouvement, un graphique position–temps et un graphique vitesse–temps.',
    modeLegend: 'Choisis le type d’exercice',
    modes: {
      description: {
        title: 'Traduire une description',
        description: 'Trace un ou deux graphiques du mouvement à partir d’un texte.'
      },
      positionToVelocity: {
        title: 'Position → vitesse',
        description: 'Déduis la vitesse du graphique de position.'
      },
      velocityToPosition: {
        title: 'Vitesse → position',
        description: 'Construis le graphique de position avec la position initiale indiquée.'
      },
      mixed: {
        title: 'Quiz mixte',
        description: 'Alterne entre les cinq variantes d’exercice.'
      }
    },
    descriptionTargetLegend: 'Graphiques à tracer',
    descriptionTargets: { position: 'Position', velocity: 'Vitesse', both: 'Les deux' },
    difficultyLegend: 'Difficulté',
    difficulties: {
      basic: { title: 'Base', description: 'Deux phases, position initiale nulle' },
      standard: { title: 'Standard', description: 'Trois phases avec une position initiale variable' }
    },
    startQuiz: 'Démarrer le quiz',
    continueQuiz: 'Continuer le quiz',
    home: 'Retour à l’accueil',
    next: 'Exercice suivant',
    showResult: 'Afficher le résultat',
    status: {
      task: (current, total) => `Exercice ${current}/${total}`,
      score: (correct, answered) => `Points : ${correct}/${answered}`,
      time: value => `Temps : ${value}`
    },
    roundStart: 'Le premier exercice est prêt. Le chronomètre démarre seulement après un clic sur Démarrer.',
    begin: 'Démarrer',
    drawingInstructions: 'Fais glisser la souris ou le stylet d’un point de la grille à un autre. Tu peux aussi sélectionner deux points successivement. Les extrémités s’alignent exactement sur la grille.',
    diagram: {
      positionTitle: 'Graphique position–temps',
      velocityTitle: 'Graphique vitesse–temps',
      given: 'Donné',
      draw: 'À tracer',
      undo: 'Annuler le dernier segment',
      clear: 'Effacer le tracé',
      aria: (type, editable) => `${type === 'position' ? 'Graphique position–temps' : 'Graphique vitesse–temps'} avec une grille. ${editable ? 'Trace des segments avec un pointeur ou le clavier.' : 'Graphique donné.'}`,
      status: (type, point, pending) => {
        const coordinate = type === 'position'
          ? `x = ${point.value} m`
          : `v = ${point.value} m/s`;
        return `Point d’accrochage : t = ${point.t} s, ${coordinate}${pending ? ' ; point de départ sélectionné' : ''}`;
      }
    },
    distanceLabel: 'Calcule aussi la distance totale parcourue.',
    check: 'Vérifier la réponse',
    taskBadges: {
      'text-to-position': 'Description → position',
      'text-to-velocity': 'Description → vitesse',
      'text-to-both': 'Description → deux graphiques',
      'position-to-velocity': 'Position → vitesse',
      'velocity-to-position': 'Vitesse → position'
    },
    questions: {
      'text-to-position': () => 'Trace le graphique position–temps \\(x(t)\\) du mouvement décrit.',
      'text-to-velocity': () => 'Trace le graphique vitesse–temps \\(v(t)\\) du mouvement décrit.',
      'text-to-both': () => 'Trace à la fois \\(x(t)\\) et \\(v(t)\\) pour le mouvement décrit.',
      'position-to-velocity': () => 'Lis les pentes du graphique position–temps donné et trace le graphique vitesse–temps correspondant.',
      'velocity-to-position': model => `Trace le graphique position–temps correspondant au graphique vitesse–temps donné. Utilise \\(x(0)=${model.initialPosition}\\,\\mathrm{m}\\).`
    },
    feedback: {
      correctHeading: 'Correct !',
      incorrectHeading: 'Ce n’est pas encore correct.',
      graphCorrect: type => `Le graphique de ${type === 'position' ? 'position' : 'vitesse'} est correct.`,
      verticalVelocity: 'Un saut de vitesse n’est pas relié par une ligne verticale. Trace séparément les sections à vitesse constante.',
      verticalPosition: 'Une ligne verticale dans le graphique de position signifierait que le corps se trouve simultanément à plusieurs positions.',
      nonHorizontalVelocity: 'Pour un mouvement uniforme par morceaux, le graphique de vitesse ne comporte que des sections horizontales.',
      missing: type => `Le graphique de ${type === 'position' ? 'position' : 'vitesse'} ne couvre pas encore tout l’intervalle de 0 à 10 secondes.`,
      mismatch: type => `Au moins une section du graphique de ${type === 'position' ? 'position ne suit pas le bon tracé' : 'vitesse n’a pas la bonne valeur'}.`,
      offGrid: 'Au moins un segment se trouve hors de la grille autorisée.',
      zeroLength: 'Un segment nécessite deux extrémités différentes.',
      invalidGraph: 'Le tracé contient un segment non valide.',
      distanceCorrect: value => `La distance totale de ${value} m est correcte.`,
      distanceWrong: expected => `La distance totale est incorrecte. La bonne réponse est ${expected} m.`,
      distanceInvalid: 'Saisis la distance totale sous forme de nombre, sans unité.'
    },
    solution: {
      summary: 'Solution et explication',
      positionRelation: 'Dans le graphique position–temps, la pente correspond à la vitesse : \\(v=\\frac{\\Delta x}{\\Delta t}\\).',
      velocityRelation: 'Chaque section de vitesse donne la position suivante par \\(x_{i+1}=x_i+v_i\\Delta t_i\\).',
      tableIntro: 'Le mouvement comporte les phases suivantes :',
      interval: 'Intervalle de temps',
      velocity: 'Vitesse',
      positionChange: 'Variation de position',
      positions: 'Position',
      partialDistance: 'Distance partielle',
      totalDistance: value => `La distance totale parcourue vaut donc \\(s_{\\mathrm{tot}}=${value}\\,\\mathrm{m}\\).`
    },
    result: {
      heading: 'Résultat',
      score: (score, total) => `${score} point${score === 1 ? '' : 's'} sur ${total}`,
      time: value => `Temps nécessaire : ${value}`,
      restart: 'Démarrer un nouveau quiz',
      home: 'Retour à l’accueil'
    }
  }
};

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}.`);
  return element;
}

const controls = {
  languageSwitcher: byId('languageSwitcher'),
  languageButtons: {
    de: byId('langDeButton'),
    en: byId('langEnButton'),
    fr: byId('langFrButton')
  },
  mainHeading: byId('mainHeading'),
  screens: {
    intro: byId('introScreen'),
    quiz: byId('quizScreen'),
    result: byId('resultScreen')
  },
  introLead: byId('introLead'),
  modeLegend: byId('modeLegend'),
  modeButtons: Array.from(document.querySelectorAll('.mode-choice')),
  modeText: {
    description: {
      title: byId('modeDescriptionTitle'),
      description: byId('modeDescriptionDescription')
    },
    positionToVelocity: {
      title: byId('modePositionToVelocityTitle'),
      description: byId('modePositionToVelocityDescription')
    },
    velocityToPosition: {
      title: byId('modeVelocityToPositionTitle'),
      description: byId('modeVelocityToPositionDescription')
    },
    mixed: {
      title: byId('modeMixedTitle'),
      description: byId('modeMixedDescription')
    }
  },
  descriptionTargetFieldset: byId('descriptionTargetFieldset'),
  descriptionTargetLegend: byId('descriptionTargetLegend'),
  descriptionTargetInputs: Array.from(document.querySelectorAll('input[name="descriptionTarget"]')),
  descriptionTargetLabels: {
    position: byId('descriptionTargetPositionLabel'),
    velocity: byId('descriptionTargetVelocityLabel'),
    both: byId('descriptionTargetBothLabel')
  },
  difficultyLegend: byId('difficultyLegend'),
  difficultyInputs: Array.from(document.querySelectorAll('input[name="difficulty"]')),
  difficultyText: {
    basic: {
      title: byId('difficultyBasicTitle'),
      description: byId('difficultyBasicDescription')
    },
    standard: {
      title: byId('difficultyStandardTitle'),
      description: byId('difficultyStandardDescription')
    }
  },
  startSelectedQuizButton: byId('startSelectedQuizButton'),
  homeButton: byId('homeButton'),
  nextButton: byId('nextButton'),
  taskCounter: byId('taskCounter'),
  scoreCounter: byId('scoreCounter'),
  timeCounter: byId('timeCounter'),
  taskPromptArea: byId('taskPromptArea'),
  taskTypeBadge: byId('taskTypeBadge'),
  taskQuestion: byId('taskQuestion'),
  motionDescription: byId('motionDescription'),
  position: {
    panel: byId('positionDiagramPanel'),
    title: byId('positionDiagramTitle'),
    role: byId('positionDiagramRole'),
    graph: byId('positionGraph'),
    toolbar: byId('positionToolbar'),
    undo: byId('positionUndoButton'),
    clear: byId('positionClearButton')
  },
  velocity: {
    panel: byId('velocityDiagramPanel'),
    title: byId('velocityDiagramTitle'),
    role: byId('velocityDiagramRole'),
    graph: byId('velocityGraph'),
    toolbar: byId('velocityToolbar'),
    undo: byId('velocityUndoButton'),
    clear: byId('velocityClearButton')
  },
  roundStartPanel: byId('roundStartPanel'),
  roundStartText: byId('roundStartText'),
  beginRoundButton: byId('beginRoundButton'),
  answerArea: byId('answerArea'),
  drawingInstructions: byId('drawingInstructions'),
  distanceAnswerGroup: byId('distanceAnswerGroup'),
  distanceAnswerLabel: byId('distanceAnswerLabel'),
  distanceInput: byId('distanceInput'),
  checkAnswerButton: byId('checkAnswerButton'),
  feedbackPanel: byId('feedbackPanel'),
  feedbackHeading: byId('feedbackHeading'),
  feedbackDetails: byId('feedbackDetails'),
  solutionPanel: byId('solutionPanel'),
  solutionSummary: byId('solutionSummary'),
  solutionContent: byId('solutionContent'),
  resultHeading: byId('resultHeading'),
  resultScore: byId('resultScore'),
  resultTime: byId('resultTime'),
  restartButton: byId('restartButton'),
  resultHomeButton: byId('resultHomeButton')
};

function storedLanguage() {
  try {
    const value = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    return motionCore.SUPPORTED_LANGUAGES.includes(value) ? value : 'de';
  } catch (error) {
    return 'de';
  }
}

const state = {
  language: storedLanguage(),
  selectedMode: motionCore.QUIZ_MODES.description,
  selectedDescriptionTarget: motionCore.DESCRIPTION_TARGETS.both,
  selectedDifficulty: motionCore.DIFFICULTIES.standard,
  activeRound: null,
  editors: {},
  timerId: null,
  typesetQueue: Promise.resolve()
};

function currentText() {
  return TEXT[state.language];
}

function setText(element, value) {
  element.textContent = value;
}

function currentTask() {
  return state.activeRound ? state.activeRound.tasks[state.activeRound.index] : null;
}

function selectedConfig() {
  return {
    mode: state.selectedMode,
    descriptionTarget: state.selectedDescriptionTarget,
    difficulty: state.selectedDifficulty
  };
}

function configKey(config) {
  return `${config.mode}|${config.descriptionTarget}|${config.difficulty}`;
}

function elapsedMilliseconds(round) {
  if (!round || !round.startedAt) return 0;
  const end = round.completedAt || Date.now();
  return Math.max(0, end - round.startedAt);
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clearMath(elements) {
  if (!window.MathJax || typeof window.MathJax.typesetClear !== 'function') return;
  const connected = elements.filter(element => element && element.isConnected);
  if (connected.length > 0) window.MathJax.typesetClear(connected);
}

function queueTypeset(elements) {
  const targets = elements.filter(Boolean);
  state.typesetQueue = state.typesetQueue
    .catch(() => undefined)
    .then(() => {
      if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') return undefined;
      const connected = targets.filter(element => element.isConnected);
      return connected.length > 0 ? window.MathJax.typesetPromise(connected) : undefined;
    })
    .catch(error => {
      console.error('MathJax rendering failed.', error);
    });
  return state.typesetQueue;
}

function showScreen(name) {
  Object.entries(controls.screens).forEach(([screenName, element]) => {
    element.classList.toggle('hidden', screenName !== name);
  });
}

function updateModeSelection() {
  controls.modeButtons.forEach(button => {
    const selected = button.dataset.mode === state.selectedMode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  controls.descriptionTargetFieldset.classList.toggle(
    'hidden',
    state.selectedMode !== motionCore.QUIZ_MODES.description
  );
}

function updateStartButton() {
  const round = state.activeRound;
  const canResume = Boolean(
    round && !round.completed && configKey(round.config) === configKey(selectedConfig())
  );
  controls.startSelectedQuizButton.textContent = canResume
    ? currentText().continueQuiz
    : currentText().startQuiz;
}

function applyLanguage() {
  const text = currentText();
  document.documentElement.lang = state.language;
  document.title = text.documentTitle;
  setText(controls.mainHeading, text.heading);
  controls.languageSwitcher.setAttribute('aria-label', text.languageSelectorAria);
  Object.entries(controls.languageButtons).forEach(([language, button]) => {
    const selected = language === state.language;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  setText(controls.introLead, text.introLead);
  setText(controls.modeLegend, text.modeLegend);
  for (const [mode, elements] of Object.entries(controls.modeText)) {
    setText(elements.title, text.modes[mode].title);
    setText(elements.description, text.modes[mode].description);
  }
  setText(controls.descriptionTargetLegend, text.descriptionTargetLegend);
  for (const [target, element] of Object.entries(controls.descriptionTargetLabels)) {
    setText(element, text.descriptionTargets[target]);
  }
  setText(controls.difficultyLegend, text.difficultyLegend);
  for (const [difficulty, elements] of Object.entries(controls.difficultyText)) {
    setText(elements.title, text.difficulties[difficulty].title);
    setText(elements.description, text.difficulties[difficulty].description);
  }
  setText(controls.homeButton, text.home);
  setText(controls.roundStartText, text.roundStart);
  setText(controls.beginRoundButton, text.begin);
  setText(controls.drawingInstructions, text.drawingInstructions);
  setText(controls.distanceAnswerLabel, text.distanceLabel);
  setText(controls.checkAnswerButton, text.check);
  setText(controls.position.title, text.diagram.positionTitle);
  setText(controls.velocity.title, text.diagram.velocityTitle);
  setText(controls.position.undo, text.diagram.undo);
  setText(controls.position.clear, text.diagram.clear);
  setText(controls.velocity.undo, text.diagram.undo);
  setText(controls.velocity.clear, text.diagram.clear);
  setText(controls.solutionSummary, text.solution.summary);
  setText(controls.resultHeading, text.result.heading);
  setText(controls.restartButton, text.result.restart);
  setText(controls.resultHomeButton, text.result.home);
  updateModeSelection();
  updateStartButton();
  updateStatus();
  updateTaskLanguage();
  updateResultText();
  try {
    sessionStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  } catch (error) {
    // Language persistence is optional when storage is unavailable.
  }
}

function updateStatus() {
  const text = currentText();
  const round = state.activeRound;
  if (!round) {
    setText(controls.taskCounter, text.status.task(1, QUESTIONS_PER_ROUND));
    setText(controls.scoreCounter, text.status.score(0, 0));
    setText(controls.timeCounter, text.status.time('00:00'));
    return;
  }
  setText(controls.taskCounter, text.status.task(round.index + 1, round.tasks.length));
  setText(controls.scoreCounter, text.status.score(round.score, round.answered));
  setText(controls.timeCounter, text.status.time(formatElapsed(elapsedMilliseconds(round))));
  setText(
    controls.nextButton,
    round.index === round.tasks.length - 1 ? text.showResult : text.next
  );
}

function graphLabels(graphType, editable) {
  const text = currentText();
  return {
    xAxisHtml: '\\(t\\,/\\,\\mathrm{s}\\)',
    yAxisHtml: graphType === motionCore.GRAPH_TYPES.position
      ? '\\(x(t)\\,/\\,\\mathrm{m}\\)'
      : '\\(v(t)\\,/\\,(\\mathrm{m/s})\\)',
    ariaLabel: text.diagram.aria(graphType, editable),
    statusFormatter: (point, pending) => text.diagram.status(graphType, point, pending)
  };
}

function taskQuestionText(task) {
  return currentText().questions[task.type](task.model);
}

function updateDiagramLanguage(graphType) {
  const editor = state.editors[graphType];
  if (!editor) return;
  const editable = currentTask().requirements.answers.includes(graphType);
  editor.updateLabels(graphLabels(graphType, editable));
  const elements = graphType === motionCore.GRAPH_TYPES.position
    ? controls.position
    : controls.velocity;
  setText(elements.role, editable ? currentText().diagram.draw : currentText().diagram.given);
}

function updateTaskLanguage() {
  const task = currentTask();
  if (!task) return;
  clearMath([
    controls.taskPromptArea,
    controls.position.graph,
    controls.velocity.graph,
    controls.feedbackPanel,
    controls.solutionContent
  ]);
  setText(controls.taskTypeBadge, currentText().taskBadges[task.type]);
  controls.taskQuestion.innerHTML = taskQuestionText(task);
  if (task.requirements.hasDescription) {
    controls.motionDescription.innerHTML = motionCore.describeMotion(task.model, state.language)
      .map(paragraph => `<p>${paragraph}</p>`)
      .join('');
    controls.motionDescription.classList.remove('hidden');
  } else {
    controls.motionDescription.replaceChildren();
    controls.motionDescription.classList.add('hidden');
  }
  updateDiagramLanguage(motionCore.GRAPH_TYPES.position);
  updateDiagramLanguage(motionCore.GRAPH_TYPES.velocity);
  if (state.activeRound.currentEvaluation) renderFeedback(state.activeRound.currentEvaluation);
  if (state.activeRound.currentSubmitted) renderSolution(task);
  queueTypeset([
    controls.taskPromptArea,
    controls.position.graph,
    controls.velocity.graph,
    controls.feedbackPanel,
    controls.solutionContent,
    controls.distanceAnswerGroup
  ]);
}

function destroyEditors() {
  Object.values(state.editors).forEach(editor => editor.destroy());
  state.editors = {};
}

function expectedSegments(task, graphType) {
  return graphType === motionCore.GRAPH_TYPES.position
    ? motionCore.positionSegments(task.model)
    : motionCore.velocitySegments(task.model);
}

function buildEditor(task, graphType) {
  const elements = graphType === motionCore.GRAPH_TYPES.position
    ? controls.position
    : controls.velocity;
  const isAnswer = task.requirements.answers.includes(graphType);
  const isGiven = task.requirements.given.includes(graphType);
  const valueMin = graphType === motionCore.GRAPH_TYPES.position
    ? motionCore.GRID.positionMin
    : motionCore.GRID.velocityMin;
  const valueMax = graphType === motionCore.GRAPH_TYPES.position
    ? motionCore.GRID.positionMax
    : motionCore.GRID.velocityMax;
  elements.panel.classList.remove('hidden');
  elements.panel.classList.toggle('is-answer', isAnswer);
  elements.toolbar.classList.toggle('hidden', !isAnswer);
  setText(elements.role, isAnswer ? currentText().diagram.draw : currentText().diagram.given);

  const referencePoints = isAnswer && graphType === motionCore.GRAPH_TYPES.position
    ? [{ t: 0, value: task.model.initialPosition }]
    : [];
  const editor = new graphLibrary.GraphEditor(elements.graph, {
    graphType,
    timeMin: motionCore.GRID.timeMin,
    timeMax: motionCore.GRID.timeMax,
    valueMin,
    valueMax,
    valueTickEvery: graphType === motionCore.GRAPH_TYPES.position ? 2 : 1,
    editable: isAnswer && state.activeRound.started && !state.activeRound.currentSubmitted,
    givenSegments: isGiven ? expectedSegments(task, graphType) : [],
    referencePoints,
    ...graphLabels(graphType, isAnswer)
  });
  state.editors[graphType] = editor;
}

function setAnswerControlsEnabled(enabled) {
  const task = currentTask();
  if (!task) return;
  for (const graphType of task.requirements.answers) {
    const editor = state.editors[graphType];
    if (editor) editor.setEditable(enabled);
    const elements = graphType === motionCore.GRAPH_TYPES.position
      ? controls.position
      : controls.velocity;
    elements.undo.disabled = !enabled;
    elements.clear.disabled = !enabled;
  }
  controls.distanceInput.disabled = !enabled || !task.distanceRequired;
  controls.checkAnswerButton.disabled = !enabled;
}

function renderCurrentTask() {
  const round = state.activeRound;
  const task = currentTask();
  if (!round || !task) return;
  clearMath([
    controls.taskPromptArea,
    controls.position.graph,
    controls.velocity.graph,
    controls.feedbackPanel,
    controls.solutionContent
  ]);
  destroyEditors();
  controls.position.panel.classList.add('hidden');
  controls.velocity.panel.classList.add('hidden');
  controls.feedbackPanel.classList.add('hidden');
  controls.feedbackPanel.classList.remove('is-correct', 'is-incorrect');
  controls.feedbackDetails.replaceChildren();
  controls.solutionPanel.classList.add('hidden');
  controls.solutionPanel.open = false;
  controls.solutionContent.replaceChildren();
  controls.distanceInput.value = '';

  const visibleGraphTypes = Array.from(new Set([
    ...task.requirements.given,
    ...task.requirements.answers
  ]));
  for (const graphType of [motionCore.GRAPH_TYPES.position, motionCore.GRAPH_TYPES.velocity]) {
    if (visibleGraphTypes.includes(graphType)) buildEditor(task, graphType);
  }

  controls.taskPromptArea.classList.toggle('hidden', !round.started);
  controls.roundStartPanel.classList.toggle('hidden', round.started);
  controls.answerArea.classList.toggle('hidden', !round.started);
  controls.distanceAnswerGroup.classList.toggle('hidden', !task.distanceRequired);
  controls.nextButton.disabled = !round.started;
  round.currentSubmitted = false;
  round.currentEvaluation = null;
  setAnswerControlsEnabled(round.started);
  updateStatus();
  updateTaskLanguage();
}

function beginRound() {
  const round = state.activeRound;
  if (!round || round.started) return;
  round.started = true;
  round.startedAt = Date.now();
  controls.taskPromptArea.classList.remove('hidden');
  controls.roundStartPanel.classList.add('hidden');
  controls.answerArea.classList.remove('hidden');
  controls.nextButton.disabled = false;
  setAnswerControlsEnabled(true);
  startTimer();
  updateStatus();
  updateTaskLanguage();
  const firstAnswerType = currentTask().requirements.answers[0];
  if (state.editors[firstAnswerType]) state.editors[firstAnswerType].focus();
}

function startTimer() {
  if (state.timerId !== null) return;
  state.timerId = window.setInterval(() => {
    if (state.activeRound && state.activeRound.started && !state.activeRound.completed) {
      updateStatus();
    }
  }, TIMER_UPDATE_INTERVAL_MS);
}

function createRound(config) {
  destroyEditors();
  state.activeRound = {
    config: { ...config },
    tasks: motionCore.createRoundTasks({
      ...config,
      count: QUESTIONS_PER_ROUND
    }),
    index: 0,
    score: 0,
    answered: 0,
    started: false,
    startedAt: null,
    completed: false,
    completedAt: null,
    currentSubmitted: false,
    currentEvaluation: null
  };
  renderCurrentTask();
}

function startSelectedQuiz(forceNew) {
  const config = selectedConfig();
  const round = state.activeRound;
  const canResume = Boolean(
    !forceNew && round && !round.completed && configKey(round.config) === configKey(config)
  );
  if (!canResume) createRound(config);
  showScreen('quiz');
  updateStatus();
  updateTaskLanguage();
  if (state.activeRound.started) startTimer();
}

function feedbackItemsForGraph(graphType, result) {
  const text = currentText().feedback;
  if (result.correct) return [text.graphCorrect(graphType)];
  const codes = new Set(result.issueCodes);
  const items = [];
  if (codes.has('vertical-segment')) {
    items.push(graphType === motionCore.GRAPH_TYPES.velocity
      ? text.verticalVelocity
      : text.verticalPosition);
  }
  if (codes.has('non-horizontal-velocity')) items.push(text.nonHorizontalVelocity);
  if (codes.has('missing-interval')) items.push(text.missing(graphType));
  if (codes.has('segment-does-not-match')) items.push(text.mismatch(graphType));
  if (codes.has('off-grid') || codes.has('outside-grid')) items.push(text.offGrid);
  if (codes.has('zero-length-segment')) items.push(text.zeroLength);
  if (codes.has('invalid-segment')) items.push(text.invalidGraph);
  return Array.from(new Set(items));
}

function renderFeedback(evaluation) {
  const task = currentTask();
  if (!task) return;
  const text = currentText().feedback;
  controls.feedbackPanel.classList.remove('hidden', 'is-correct', 'is-incorrect');
  controls.feedbackPanel.classList.add(evaluation.correct ? 'is-correct' : 'is-incorrect');
  setText(
    controls.feedbackHeading,
    evaluation.correct ? text.correctHeading : text.incorrectHeading
  );
  const items = [];
  for (const graphType of task.requirements.answers) {
    items.push(...feedbackItemsForGraph(graphType, evaluation.graphResults[graphType]));
  }
  if (evaluation.distanceResult) {
    if (evaluation.distanceResult.correct) {
      items.push(text.distanceCorrect(evaluation.distanceResult.expected));
    } else if (evaluation.distanceResult.issueCode === 'invalid-distance') {
      items.push(text.distanceInvalid);
    } else {
      items.push(text.distanceWrong(evaluation.distanceResult.expected));
    }
  }
  controls.feedbackDetails.innerHTML = `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function signedLatex(value) {
  return value > 0 ? `+${value}` : String(value);
}

function buildSolutionHtml(task) {
  const text = currentText().solution;
  const rows = task.model.phases.map(phase => {
    const delta = phase.endPosition - phase.startPosition;
    return [
      `<tr>`,
      `<td>\\(${phase.startTime}\\,\\mathrm{s}\\)–\\(${phase.endTime}\\,\\mathrm{s}\\)</td>`,
      `<td>\\(${signedLatex(phase.velocity)}\\,\\mathrm{m/s}\\)</td>`,
      `<td>\\(\\Delta x=${signedLatex(delta)}\\,\\mathrm{m}\\)</td>`,
      `<td>\\(${phase.startPosition}\\,\\mathrm{m}\\to ${phase.endPosition}\\,\\mathrm{m}\\)</td>`,
      `<td>\\(${phase.distance}\\,\\mathrm{m}\\)</td>`,
      `</tr>`
    ].join('');
  }).join('');
  const relations = [];
  if (task.requirements.answers.includes(motionCore.GRAPH_TYPES.velocity)) {
    relations.push(`<p>${text.positionRelation}</p>`);
  }
  if (task.requirements.answers.includes(motionCore.GRAPH_TYPES.position)) {
    relations.push(`<p>${text.velocityRelation}</p>`);
  }
  const totalDistance = task.distanceRequired
    ? `<p>${text.totalDistance(task.model.totalDistance)}</p>`
    : '';
  return [
    ...relations,
    `<p>${text.tableIntro}</p>`,
    '<div class="solution-table-wrap">',
    '<table class="solution-table">',
    '<thead><tr>',
    `<th>${text.interval}</th>`,
    `<th>${text.velocity}</th>`,
    `<th>${text.positionChange}</th>`,
    `<th>${text.positions}</th>`,
    `<th>${text.partialDistance}</th>`,
    '</tr></thead>',
    `<tbody>${rows}</tbody>`,
    '</table>',
    '</div>',
    totalDistance
  ].join('');
}

function renderSolution(task) {
  controls.solutionPanel.classList.remove('hidden');
  controls.solutionContent.innerHTML = buildSolutionHtml(task);
}

function submitAnswer() {
  const round = state.activeRound;
  const task = currentTask();
  if (!round || !round.started || round.currentSubmitted) return;
  const graphAnswers = {};
  for (const graphType of task.requirements.answers) {
    graphAnswers[graphType] = state.editors[graphType].getSegments();
  }
  const evaluation = motionCore.evaluateTask(task, {
    graphs: graphAnswers,
    distance: controls.distanceInput.value
  });
  round.currentSubmitted = true;
  round.currentEvaluation = evaluation;
  round.answered += 1;
  if (evaluation.correct) round.score += 1;

  for (const graphType of task.requirements.answers) {
    const editor = state.editors[graphType];
    editor.setResult(evaluation.graphResults[graphType]);
    editor.showSolution(expectedSegments(task, graphType));
  }
  setAnswerControlsEnabled(false);
  renderFeedback(evaluation);
  renderSolution(task);
  controls.solutionPanel.open = !evaluation.correct;
  updateStatus();
  queueTypeset([controls.feedbackPanel, controls.solutionContent]);
}

function finishRound() {
  const round = state.activeRound;
  if (!round) return;
  round.completed = true;
  round.completedAt = Date.now();
  showScreen('result');
  updateResultText();
  updateStartButton();
}

function nextTask() {
  const round = state.activeRound;
  if (!round || !round.started || round.completed) return;
  if (!round.currentSubmitted) round.answered += 1;
  if (round.index === round.tasks.length - 1) {
    finishRound();
    return;
  }
  round.index += 1;
  round.currentSubmitted = false;
  round.currentEvaluation = null;
  renderCurrentTask();
}

function updateResultText() {
  const round = state.activeRound;
  if (!round || !round.completed) return;
  const text = currentText().result;
  setText(controls.resultHeading, text.heading);
  setText(controls.resultScore, text.score(round.score, round.tasks.length));
  setText(controls.resultTime, text.time(formatElapsed(elapsedMilliseconds(round))));
}

function returnHome() {
  showScreen('intro');
  updateStartButton();
}

function restartRound() {
  const previousConfig = state.activeRound ? state.activeRound.config : selectedConfig();
  state.selectedMode = previousConfig.mode;
  state.selectedDescriptionTarget = previousConfig.descriptionTarget;
  state.selectedDifficulty = previousConfig.difficulty;
  controls.descriptionTargetInputs.forEach(input => {
    input.checked = input.value === state.selectedDescriptionTarget;
  });
  controls.difficultyInputs.forEach(input => {
    input.checked = input.value === state.selectedDifficulty;
  });
  updateModeSelection();
  startSelectedQuiz(true);
}

controls.modeButtons.forEach(button => {
  button.addEventListener('click', () => {
    state.selectedMode = button.dataset.mode;
    updateModeSelection();
    updateStartButton();
  });
});

controls.descriptionTargetInputs.forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    state.selectedDescriptionTarget = input.value;
    updateStartButton();
  });
});

controls.difficultyInputs.forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    state.selectedDifficulty = input.value;
    updateStartButton();
  });
});

Object.entries(controls.languageButtons).forEach(([language, button]) => {
  button.addEventListener('click', () => {
    state.language = language;
    applyLanguage();
  });
});

controls.startSelectedQuizButton.addEventListener('click', () => startSelectedQuiz(false));
controls.beginRoundButton.addEventListener('click', beginRound);
controls.homeButton.addEventListener('click', returnHome);
controls.resultHomeButton.addEventListener('click', returnHome);
controls.restartButton.addEventListener('click', restartRound);
controls.nextButton.addEventListener('click', nextTask);
controls.checkAnswerButton.addEventListener('click', submitAnswer);
controls.distanceInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitAnswer();
  }
});
controls.position.undo.addEventListener('click', () => {
  if (state.editors[motionCore.GRAPH_TYPES.position]) {
    state.editors[motionCore.GRAPH_TYPES.position].undo();
  }
});
controls.position.clear.addEventListener('click', () => {
  if (state.editors[motionCore.GRAPH_TYPES.position]) {
    state.editors[motionCore.GRAPH_TYPES.position].clear();
  }
});
controls.velocity.undo.addEventListener('click', () => {
  if (state.editors[motionCore.GRAPH_TYPES.velocity]) {
    state.editors[motionCore.GRAPH_TYPES.velocity].undo();
  }
});
controls.velocity.clear.addEventListener('click', () => {
  if (state.editors[motionCore.GRAPH_TYPES.velocity]) {
    state.editors[motionCore.GRAPH_TYPES.velocity].clear();
  }
});

window.GGMotionApp = Object.freeze({
  APP_VERSION,
  getState: () => ({
    language: state.language,
    selectedMode: state.selectedMode,
    selectedDescriptionTarget: state.selectedDescriptionTarget,
    selectedDifficulty: state.selectedDifficulty,
    hasActiveRound: Boolean(state.activeRound)
  })
});

applyLanguage();
showScreen('intro');
