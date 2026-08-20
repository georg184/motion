# motion

Interactive static quiz for piecewise uniform motion in a one-dimensional coordinate system. Students translate written motion descriptions and convert between position–time and velocity–time graphs by drawing exact line segments on a snapping grid.

Repository: <https://github.com/georg184/motion>

Live app: <https://georg184.github.io/motion/>

## Learning Model

The app distinguishes four physical quantities and notations:

- \(\vec{x}(t)\): signed position vector in metres; it may increase, decrease, or remain constant
- \(\vec{v}(t)\): signed velocity vector in metres per second; it is constant within each phase and may jump between phases
- \(v(t)=\lvert\vec{v}(t)\rvert\): speed (absolute velocity), which has no vector arrow and is never negative
- `s_total`: total distance travelled in metres; it is the sum of the absolute phase displacements

Every task comes from one canonical motion model with an initial position and consecutive constant-velocity phases. The model derives the written description, both graphs, the exact answer contract, and

\[
s_{\mathrm{total}}=\sum_i \lvert\vec{v}_i\rvert\,\Delta t_i.
\]

A full distance–time graph is intentionally outside the first version. The model retains enough information to add it later.

## Task Types

The five internal task types are:

1. written description to \(\vec{x}(t)\)
2. written description to \(\vec{v}(t)\)
3. written description to both graphs
4. given \(\vec{x}(t)\) to \(\vec{v}(t)\)
5. given \(\vec{v}(t)\) and \(\vec{x}(0)\) to \(\vec{x}(t)\)

The start screen groups these into description, position-to-velocity, velocity-to-position, and mixed modes. A mixed ten-question round contains every internal task type exactly twice.

Exactly five of every ten tasks also require the numerical total distance. A task awards one point only when every requested graph and the optional distance value are correct. Each part receives separate feedback.

## Generation Contract

Both supported difficulties use the fixed grids

- time: `0` through `10 s` in `1 s` steps
- position: `-10` through `10 m` in `1 m` steps
- velocity: `-3` through `3 m/s` in `1 m/s` steps

All interval boundaries, velocities, and initial positions are integers. The generator rejects trajectories that leave the visible position range and never creates adjacent phases with the same velocity.

- **Basic**: two phases, \(\vec{x}(0)=0\), and velocities from `-2` through `2 m/s`
- **Standard**: three phases, an initial position from `-4` through `4 m`, and velocities from `-3` through `3 m/s`

## Description Contract

The start screen explains the distinction between signed velocity
\(\vec{v}\) and speed \(v=\lvert\vec{v}\rvert\), both in one dimension and
for a two-dimensional vector \(\vec{v}=(v_x,v_y)\).

Generated motion descriptions alternate systematically between two equivalent
forms:

- a signed velocity such as \(\vec{v}=-3\,\mathrm{m/s}\), without a separate orientation statement
- a non-negative speed such as \(v=3\,\mathrm{m/s}\), together with the positive or negative \(x\)-orientation

Successive moving phases alternate between these forms. Description tasks also
alternate which form comes first, so both conventions occur even when a model
contains only one moving phase.

## Drawing Contract

The drawing surface is responsive inline SVG. Mouse, touch, and pen use Pointer Events. Students can drag between two grid points or select the endpoints one after another. Arrow keys move a keyboard cursor and Space or Enter selects an endpoint.

The editor stores exact snapped coordinates rather than pointer pixels. The answer checker compares the mathematical line on every one-second interval.

- A correct line may be split at additional collinear grid points. This does not change the graph and remains correct.
- Position graphs must cover the entire time interval and have the correct position and slope on every phase.
- Velocity graphs consist only of separate horizontal sections.
- A velocity jump is a discontinuity. The official graph never contains a vertical connector.
- Every vertical segment is an explicit error in either graph and receives dedicated localized feedback.
- There is no geometric answer tolerance after snapping.
- Open and closed endpoint markers at velocity jumps are not assessed; the interval interiors determine the physical motion.

Editable position graphs show the given initial point \((0,\vec{x}(0))\). Given and answer diagrams use identical time scales and are stacked vertically so corresponding times align.

## Quiz Flow

- ten tasks per round
- first task and diagrams visible before the round starts
- timer begins only when Start is pressed
- unanswered tasks may be skipped for zero points
- every task is scored at most once
- returning to the start screen preserves the unfinished in-memory round
- reopening the same mode, description target, and difficulty resumes that round
- a full page reload starts fresh

## Language Maintenance

The app supports German (`de`), English (`en`), and French (`fr`). Every user-visible change must update all three languages together, including static German fallback text, controls, prompts, generated descriptions, graph accessibility labels, feedback, solutions, result text, and version-mismatch messages.

The selected language is stored in `sessionStorage` and remains shared across all screens.

## Rendering

- motion graphs, grid lines, axes, and user segments use inline SVG
- mathematical symbols, questions, formulas, axis quantities, and solutions use pinned MathJax `3.2.2` with TeX input and CommonHTML output
- MathJax overlay labels remain transparent and have no text-shadow halo
- no angle arcs or angle markers are used, so the shared angle-layout helper is not a dependency
- no service worker is used

## Project Structure

- `index.html`: German fallback markup, all quiz screens, MathJax bootstrap, and versioned local assets
- `css/styles.css`: responsive UI and SVG graph styling
- `js/mathjax-config.js`: pinned CommonHTML configuration
- `js/motion-core.js`: DOM-independent motion model, task generator, descriptions, graph validation, and scoring
- `js/graph-editor.js`: snapping SVG editor for pointer and keyboard input
- `js/app.js`: localization, quiz state, timer, rendering adapters, feedback, and result flow
- `scripts/verify-javascript-syntax.js`: recursive JavaScript syntax check
- `scripts/verify-motion-core.js`: physical model, generator, task distribution, and distance tests
- `scripts/verify-graph-validation.js`: exact graph semantics and strict vertical-line rejection
- `scripts/verify-localization.js`: translation-shape, generated-description, and German fallback checks
- `scripts/verify-static-contract.js`: cache, MathJax, SVG interaction, workflow, and integration checks
- `scripts/browser-smoke.html` and `scripts/browser-smoke.js`: local real-browser interaction harness
- `.github/workflows/deploy-pages.yml`: validation and GitHub Pages deployment

## Cache And Version Safety

Current application version: `20260820.1`.

The same version must appear in:

- `window.GG_APP_VERSION` in `index.html`
- every local CSS and JavaScript query token in `index.html`
- `APP_VERSION` in `js/app.js`
- `VERSION` in `js/motion-core.js`
- `VERSION` in `js/graph-editor.js`
- the visible version badge

Bump every location whenever local HTML, CSS, JavaScript, or MathJax configuration changes. The app stops with a localized update message if HTML, app, core, and editor versions differ.

## Verification

Run from the project root:

```bash
node scripts/verify-javascript-syntax.js
node scripts/verify-motion-core.js
node scripts/verify-graph-validation.js
node scripts/verify-localization.js
node scripts/verify-static-contract.js
```

For the local real-browser smoke test, serve the project over HTTP and open
`scripts/browser-smoke.html`. The page reports `data-status="pass"` after it
has exercised startup, MathJax rendering, language switching, mode changes,
keyboard drawing, strict vertical-line feedback, phone-width layout, and the
complete ten-task flow.

Browser verification should cover:

- all four start modes and all five internal task types
- Basic and Standard generation
- German, English, and French on every screen
- drag, two-click, touch/pen, keyboard, undo, and clear interactions
- exact grid snapping and responsive graph alignment
- correct position and velocity graphs split at optional collinear points
- explicit rejection and highlighting of vertical lines
- five distance questions in every round
- correct, incorrect, incomplete, and skipped answers
- start, timer, ten-question result, home, resume, and restart flow
- desktop, tablet, and phone widths without horizontal page overflow

## GitHub Pages

The workflow publishes the validated `main` branch through GitHub Pages. The
public deployment is available at <https://georg184.github.io/motion/>.
