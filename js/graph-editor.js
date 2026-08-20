'use strict';

(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GGMotionGraphEditor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const VERSION = '20260820.3';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VIEWBOX = Object.freeze({ width: 760, height: 360 });
  const PLOT = Object.freeze({ left: 70, right: 728, top: 24, bottom: 306 });
  let editorSequence = 0;

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes || {})) {
      element.setAttribute(key, String(value));
    }
    return element;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function samePoint(left, right) {
    return Boolean(left && right && left.t === right.t && left.value === right.value);
  }

  function segmentCopy(segment) {
    return {
      t1: segment.t1,
      value1: segment.value1,
      t2: segment.t2,
      value2: segment.value2
    };
  }

  class GraphEditor {
    constructor(rootElement, options) {
      if (!rootElement || typeof rootElement.replaceChildren !== 'function') {
        throw new TypeError('GraphEditor requires a root element.');
      }
      if (!options || typeof options !== 'object') {
        throw new TypeError('GraphEditor options are required.');
      }
      this.root = rootElement;
      this.graphType = options.graphType;
      this.timeMin = options.timeMin;
      this.timeMax = options.timeMax;
      this.valueMin = options.valueMin;
      this.valueMax = options.valueMax;
      this.valueTickEvery = options.valueTickEvery || 1;
      this.editable = Boolean(options.editable);
      this.locked = !this.editable;
      this.givenSegments = (options.givenSegments || []).map(segmentCopy);
      this.referencePoints = (options.referencePoints || []).map(point => ({ ...point }));
      this.studentSegments = [];
      this.solutionSegments = [];
      this.result = null;
      this.pendingStart = null;
      this.keyboardCursor = this.referencePoints[0]
        ? { t: this.referencePoints[0].t, value: this.referencePoints[0].value }
        : { t: this.timeMin, value: 0 };
      this.hoverPoint = null;
      this.activePointerId = null;
      this.activeStart = null;
      this.pointerDownPoint = null;
      this.pointerEndPoint = null;
      this.onChange = typeof options.onChange === 'function' ? options.onChange : function() {};
      this.statusFormatter = options.statusFormatter || ((point, pending) => (
        `${pending ? '• ' : ''}t = ${point.t}, ${this.graphType === 'position' ? 'x' : 'v'} = ${point.value}`
      ));
      this.id = `motion-graph-${++editorSequence}`;
      this.labels = {
        xAxisHtml: options.xAxisHtml || '\\(t\\,/\\,\\mathrm{s}\\)',
        yAxisHtml: options.yAxisHtml || '',
        ariaLabel: options.ariaLabel || ''
      };

      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handlePointerCancel = this.handlePointerCancel.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);

      this.build();
      this.renderGivenSegments();
      this.renderReferencePoints();
      this.renderStudentSegments();
      this.setEditable(this.editable);
    }

    build() {
      this.root.replaceChildren();
      this.root.classList.add('motion-graph');
      this.root.dataset.graphType = this.graphType;

      this.frame = document.createElement('div');
      this.frame.className = 'motion-graph-frame';
      this.svg = svgElement('svg', {
        class: 'motion-graph-svg',
        viewBox: `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`,
        role: 'application',
        tabindex: '0',
        'aria-label': this.labels.ariaLabel
      });

      const defs = svgElement('defs');
      const marker = svgElement('marker', {
        id: `${this.id}-axis-arrow`,
        markerWidth: 9,
        markerHeight: 9,
        refX: 7.5,
        refY: 4.5,
        orient: 'auto',
        markerUnits: 'strokeWidth'
      });
      marker.appendChild(svgElement('path', { d: 'M 0 0 L 9 4.5 L 0 9 z', class: 'axis-arrowhead' }));
      defs.appendChild(marker);
      const clipPath = svgElement('clipPath', { id: `${this.id}-clip` });
      clipPath.appendChild(svgElement('rect', {
        x: PLOT.left,
        y: PLOT.top,
        width: PLOT.right - PLOT.left,
        height: PLOT.bottom - PLOT.top
      }));
      defs.appendChild(clipPath);
      this.svg.appendChild(defs);

      this.gridLayer = svgElement('g', { class: 'graph-grid-layer' });
      this.axesLayer = svgElement('g', { class: 'graph-axes-layer' });
      this.givenLayer = svgElement('g', {
        class: 'graph-given-layer',
        'clip-path': `url(#${this.id}-clip)`
      });
      this.referenceLayer = svgElement('g', { class: 'graph-reference-layer' });
      this.solutionLayer = svgElement('g', {
        class: 'graph-solution-layer',
        'clip-path': `url(#${this.id}-clip)`
      });
      this.studentLayer = svgElement('g', {
        class: 'graph-student-layer',
        'clip-path': `url(#${this.id}-clip)`
      });
      this.interactionLayer = svgElement('g', { class: 'graph-interaction-layer' });

      this.drawGridAndAxes();
      this.svg.append(
        this.gridLayer,
        this.axesLayer,
        this.givenLayer,
        this.referenceLayer,
        this.solutionLayer,
        this.studentLayer,
        this.interactionLayer
      );

      this.hitArea = svgElement('rect', {
        class: 'graph-hit-area',
        x: PLOT.left,
        y: PLOT.top,
        width: PLOT.right - PLOT.left,
        height: PLOT.bottom - PLOT.top
      });
      this.interactionLayer.appendChild(this.hitArea);
      this.previewLine = svgElement('line', { class: 'graph-preview-line is-hidden' });
      this.pendingMarker = svgElement('circle', { class: 'graph-pending-marker is-hidden', r: 7 });
      this.snapMarker = svgElement('circle', { class: 'graph-snap-marker is-hidden', r: 5 });
      this.interactionLayer.append(this.previewLine, this.pendingMarker, this.snapMarker);

      this.yAxisLabel = document.createElement('div');
      this.yAxisLabel.className = 'graph-axis-label graph-y-axis-label mathjax-content';
      this.yAxisLabel.innerHTML = this.labels.yAxisHtml;
      this.xAxisLabel = document.createElement('div');
      this.xAxisLabel.className = 'graph-axis-label graph-x-axis-label mathjax-content';
      this.xAxisLabel.innerHTML = this.labels.xAxisHtml;

      this.frame.append(this.svg, this.yAxisLabel, this.xAxisLabel);
      this.status = document.createElement('div');
      this.status.className = 'graph-coordinate-status';
      this.status.setAttribute('aria-live', 'polite');
      this.root.append(this.frame, this.status);

      this.svg.addEventListener('pointerdown', this.handlePointerDown);
      this.svg.addEventListener('pointermove', this.handlePointerMove);
      this.svg.addEventListener('pointerup', this.handlePointerUp);
      this.svg.addEventListener('pointercancel', this.handlePointerCancel);
      this.svg.addEventListener('pointerleave', this.handlePointerLeave);
      this.svg.addEventListener('keydown', this.handleKeyDown);
    }

    drawGridAndAxes() {
      for (let time = this.timeMin; time <= this.timeMax; time += 1) {
        const x = this.toSvgX(time);
        this.gridLayer.appendChild(svgElement('line', {
          class: time === 0 ? 'graph-grid-line graph-grid-zero' : 'graph-grid-line',
          x1: x,
          y1: PLOT.top,
          x2: x,
          y2: PLOT.bottom
        }));
        const tick = svgElement('text', {
          class: 'graph-tick-label graph-time-tick',
          x,
          y: PLOT.bottom + 24,
          'text-anchor': 'middle'
        });
        tick.textContent = String(time);
        this.axesLayer.appendChild(tick);
      }

      for (let value = this.valueMin; value <= this.valueMax; value += 1) {
        const y = this.toSvgY(value);
        this.gridLayer.appendChild(svgElement('line', {
          class: value === 0 ? 'graph-grid-line graph-grid-zero' : 'graph-grid-line',
          x1: PLOT.left,
          y1: y,
          x2: PLOT.right,
          y2: y
        }));
        if (value % this.valueTickEvery === 0) {
          const tick = svgElement('text', {
            class: 'graph-tick-label graph-value-tick',
            x: PLOT.left - 12,
            y: y + 5,
            'text-anchor': 'end'
          });
          tick.textContent = String(value).replace('-', '−');
          this.axesLayer.appendChild(tick);
        }
      }

      const zeroY = this.toSvgY(0);
      this.axesLayer.appendChild(svgElement('line', {
        class: 'graph-axis-line graph-time-axis',
        x1: PLOT.left,
        y1: zeroY,
        x2: PLOT.right + 2,
        y2: zeroY,
        'marker-end': `url(#${this.id}-axis-arrow)`
      }));
      this.axesLayer.appendChild(svgElement('line', {
        class: 'graph-axis-line graph-value-axis',
        x1: PLOT.left,
        y1: PLOT.bottom,
        x2: PLOT.left,
        y2: PLOT.top - 2,
        'marker-end': `url(#${this.id}-axis-arrow)`
      }));
      this.axesLayer.appendChild(svgElement('rect', {
        class: 'graph-plot-border',
        x: PLOT.left,
        y: PLOT.top,
        width: PLOT.right - PLOT.left,
        height: PLOT.bottom - PLOT.top
      }));
    }

    toSvgX(time) {
      return PLOT.left + (
        (time - this.timeMin) / (this.timeMax - this.timeMin)
      ) * (PLOT.right - PLOT.left);
    }

    toSvgY(value) {
      return PLOT.bottom - (
        (value - this.valueMin) / (this.valueMax - this.valueMin)
      ) * (PLOT.bottom - PLOT.top);
    }

    pointFromEvent(event) {
      const rect = this.svg.getBoundingClientRect();
      const svgX = ((event.clientX - rect.left) / rect.width) * VIEWBOX.width;
      const svgY = ((event.clientY - rect.top) / rect.height) * VIEWBOX.height;
      const time = this.timeMin + (
        (svgX - PLOT.left) / (PLOT.right - PLOT.left)
      ) * (this.timeMax - this.timeMin);
      const value = this.valueMin + (
        (PLOT.bottom - svgY) / (PLOT.bottom - PLOT.top)
      ) * (this.valueMax - this.valueMin);
      return {
        t: clamp(Math.round(time), this.timeMin, this.timeMax),
        value: clamp(Math.round(value), this.valueMin, this.valueMax)
      };
    }

    lineForSegment(segment, className) {
      return svgElement('line', {
        class: className,
        x1: this.toSvgX(segment.t1),
        y1: this.toSvgY(segment.value1),
        x2: this.toSvgX(segment.t2),
        y2: this.toSvgY(segment.value2),
        'vector-effect': 'non-scaling-stroke'
      });
    }

    renderGivenSegments() {
      this.givenLayer.replaceChildren();
      this.givenSegments.forEach(segment => {
        this.givenLayer.appendChild(this.lineForSegment(segment, 'graph-given-segment'));
      });
    }

    renderReferencePoints() {
      this.referenceLayer.replaceChildren();
      this.referencePoints.forEach(point => {
        this.referenceLayer.appendChild(svgElement('circle', {
          class: 'graph-reference-point',
          cx: this.toSvgX(point.t),
          cy: this.toSvgY(point.value),
          r: 6
        }));
      });
    }

    renderStudentSegments() {
      this.studentLayer.replaceChildren();
      const invalidIndices = new Set(this.result ? this.result.invalidSegmentIndices || [] : []);
      this.studentSegments.forEach((segment, index) => {
        const classes = ['graph-student-segment'];
        if (this.result && this.result.correct) classes.push('is-correct');
        if (this.result && !this.result.correct) classes.push('is-incorrect');
        if (invalidIndices.has(index)) classes.push('is-invalid');
        this.studentLayer.appendChild(this.lineForSegment(segment, classes.join(' ')));
      });

      if (!this.result) {
        const seen = new Set();
        for (const segment of this.studentSegments) {
          for (const point of [
            { t: segment.t1, value: segment.value1 },
            { t: segment.t2, value: segment.value2 }
          ]) {
            const key = `${point.t}|${point.value}`;
            if (seen.has(key)) continue;
            seen.add(key);
            this.studentLayer.appendChild(svgElement('circle', {
              class: 'graph-student-vertex',
              cx: this.toSvgX(point.t),
              cy: this.toSvgY(point.value),
              r: 3.5
            }));
          }
        }
      }
    }

    showSolution(segments) {
      this.solutionSegments = (segments || []).map(segmentCopy);
      this.solutionLayer.replaceChildren();
      this.solutionSegments.forEach(segment => {
        this.solutionLayer.appendChild(this.lineForSegment(segment, 'graph-solution-segment'));
      });
    }

    updateInteractionGraphics(point) {
      if (point) {
        this.snapMarker.setAttribute('cx', this.toSvgX(point.t));
        this.snapMarker.setAttribute('cy', this.toSvgY(point.value));
        this.snapMarker.classList.remove('is-hidden');
        this.status.textContent = this.statusFormatter(point, Boolean(this.pendingStart));
      } else {
        this.snapMarker.classList.add('is-hidden');
        if (!this.pendingStart) this.status.textContent = '';
      }

      if (this.pendingStart) {
        this.pendingMarker.setAttribute('cx', this.toSvgX(this.pendingStart.t));
        this.pendingMarker.setAttribute('cy', this.toSvgY(this.pendingStart.value));
        this.pendingMarker.classList.remove('is-hidden');
      } else {
        this.pendingMarker.classList.add('is-hidden');
      }
    }

    updatePreview(start, end) {
      if (!start || !end || samePoint(start, end)) {
        this.previewLine.classList.add('is-hidden');
        return;
      }
      this.previewLine.setAttribute('x1', this.toSvgX(start.t));
      this.previewLine.setAttribute('y1', this.toSvgY(start.value));
      this.previewLine.setAttribute('x2', this.toSvgX(end.t));
      this.previewLine.setAttribute('y2', this.toSvgY(end.value));
      this.previewLine.classList.remove('is-hidden');
    }

    handlePointerDown(event) {
      if (this.locked) return;
      event.preventDefault();
      const point = this.pointFromEvent(event);
      this.activePointerId = event.pointerId;
      this.pointerDownPoint = point;
      this.pointerEndPoint = point;
      this.activeStart = this.pendingStart || point;
      this.svg.setPointerCapture(event.pointerId);
      this.hoverPoint = point;
      this.updateInteractionGraphics(point);
      this.updatePreview(this.activeStart, point);
    }

    handlePointerMove(event) {
      if (this.locked) return;
      const point = this.pointFromEvent(event);
      this.hoverPoint = point;
      this.keyboardCursor = { ...point };
      this.updateInteractionGraphics(point);
      if (this.activePointerId === event.pointerId) {
        event.preventDefault();
        this.pointerEndPoint = point;
        this.updatePreview(this.activeStart, point);
      } else if (this.pendingStart) {
        this.updatePreview(this.pendingStart, point);
      }
    }

    handlePointerUp(event) {
      if (this.locked || this.activePointerId !== event.pointerId) return;
      event.preventDefault();
      const end = this.pointFromEvent(event);
      const start = this.activeStart;
      if (this.svg.hasPointerCapture(event.pointerId)) {
        this.svg.releasePointerCapture(event.pointerId);
      }
      this.activePointerId = null;
      this.activeStart = null;
      this.pointerDownPoint = null;
      this.pointerEndPoint = null;

      if (!samePoint(start, end)) {
        this.commitSegment(start, end);
        this.pendingStart = null;
        this.updatePreview(null, null);
      } else if (this.pendingStart) {
        this.pendingStart = null;
        this.updatePreview(null, null);
      } else {
        this.pendingStart = { ...end };
      }
      this.updateInteractionGraphics(end);
    }

    handlePointerCancel(event) {
      if (this.activePointerId !== event.pointerId) return;
      this.activePointerId = null;
      this.activeStart = null;
      this.pointerDownPoint = null;
      this.pointerEndPoint = null;
      this.updatePreview(this.pendingStart, this.hoverPoint);
    }

    handlePointerLeave() {
      if (this.activePointerId !== null) return;
      this.hoverPoint = null;
      this.snapMarker.classList.add('is-hidden');
      if (!this.pendingStart) {
        this.updatePreview(null, null);
        this.status.textContent = '';
      }
    }

    handleKeyDown(event) {
      if (this.locked) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.undo();
        return;
      }

      const cursor = { ...this.keyboardCursor };
      if (event.key === 'ArrowLeft') cursor.t -= 1;
      else if (event.key === 'ArrowRight') cursor.t += 1;
      else if (event.key === 'ArrowUp') cursor.value += 1;
      else if (event.key === 'ArrowDown') cursor.value -= 1;
      else if (event.key === 'Escape') {
        event.preventDefault();
        this.pendingStart = null;
        this.updatePreview(null, null);
        this.updateInteractionGraphics(cursor);
        return;
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!this.pendingStart) {
          this.pendingStart = { ...cursor };
        } else if (!samePoint(this.pendingStart, cursor)) {
          this.commitSegment(this.pendingStart, cursor);
          this.pendingStart = null;
        } else {
          this.pendingStart = null;
        }
        this.updatePreview(this.pendingStart, cursor);
        this.updateInteractionGraphics(cursor);
        return;
      } else {
        return;
      }

      event.preventDefault();
      this.keyboardCursor = {
        t: clamp(cursor.t, this.timeMin, this.timeMax),
        value: clamp(cursor.value, this.valueMin, this.valueMax)
      };
      this.hoverPoint = { ...this.keyboardCursor };
      this.updateInteractionGraphics(this.keyboardCursor);
      this.updatePreview(this.pendingStart, this.keyboardCursor);
    }

    commitSegment(start, end) {
      if (!start || !end || samePoint(start, end)) return;
      this.result = null;
      this.solutionLayer.replaceChildren();
      this.studentSegments.push({
        t1: start.t,
        value1: start.value,
        t2: end.t,
        value2: end.value
      });
      this.renderStudentSegments();
      this.onChange(this.getSegments());
    }

    getSegments() {
      return this.studentSegments.map(segmentCopy);
    }

    undo() {
      if (this.locked || this.studentSegments.length === 0) return;
      this.pendingStart = null;
      this.studentSegments.pop();
      this.renderStudentSegments();
      this.updatePreview(null, null);
      this.updateInteractionGraphics(this.hoverPoint);
      this.onChange(this.getSegments());
    }

    clear() {
      if (this.locked) return;
      this.pendingStart = null;
      this.studentSegments = [];
      this.result = null;
      this.solutionLayer.replaceChildren();
      this.renderStudentSegments();
      this.updatePreview(null, null);
      this.updateInteractionGraphics(this.hoverPoint);
      this.onChange(this.getSegments());
    }

    setEditable(editable) {
      this.editable = Boolean(editable);
      this.locked = !this.editable;
      this.root.classList.toggle('is-editable', this.editable);
      this.root.classList.toggle('is-locked', this.locked);
      this.svg.setAttribute('aria-disabled', String(this.locked));
      this.svg.setAttribute('tabindex', this.locked ? '-1' : '0');
      if (this.locked) {
        this.pendingStart = null;
        this.updatePreview(null, null);
        this.updateInteractionGraphics(null);
      }
    }

    setResult(result) {
      this.result = result ? {
        correct: Boolean(result.correct),
        invalidSegmentIndices: (result.invalidSegmentIndices || []).slice()
      } : null;
      this.setEditable(false);
      this.renderStudentSegments();
    }

    updateLabels(options) {
      if (options.xAxisHtml !== undefined) {
        this.labels.xAxisHtml = options.xAxisHtml;
        this.xAxisLabel.innerHTML = options.xAxisHtml;
      }
      if (options.yAxisHtml !== undefined) {
        this.labels.yAxisHtml = options.yAxisHtml;
        this.yAxisLabel.innerHTML = options.yAxisHtml;
      }
      if (options.ariaLabel !== undefined) {
        this.labels.ariaLabel = options.ariaLabel;
        this.svg.setAttribute('aria-label', options.ariaLabel);
      }
      if (typeof options.statusFormatter === 'function') {
        this.statusFormatter = options.statusFormatter;
      }
      if (this.hoverPoint) this.updateInteractionGraphics(this.hoverPoint);
    }

    focus() {
      this.svg.focus();
    }

    destroy() {
      this.svg.removeEventListener('pointerdown', this.handlePointerDown);
      this.svg.removeEventListener('pointermove', this.handlePointerMove);
      this.svg.removeEventListener('pointerup', this.handlePointerUp);
      this.svg.removeEventListener('pointercancel', this.handlePointerCancel);
      this.svg.removeEventListener('pointerleave', this.handlePointerLeave);
      this.svg.removeEventListener('keydown', this.handleKeyDown);
      this.root.replaceChildren();
      this.root.classList.remove('motion-graph', 'is-editable', 'is-locked');
    }
  }

  return Object.freeze({ VERSION, GraphEditor });
});
