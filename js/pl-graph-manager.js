/**
 * @file pl-graph-manager.js
 * @module LinearProgrammingGraphManager
 * Plano SVG para PL. El recorte al visor solo sirve para dibujar: nunca se
 * devuelve al solver ni se utiliza como prueba de acotación.
 */
/** Representa un resultado matemático mediante SVG sin cambiar su geometría. */
class LinearProgrammingGraphManager {
    static COLORS = ['#60a5fa', '#fb7185', '#fbbf24', '#c084fc', '#2dd4bf', '#fb923c'];
    static NS = 'http://www.w3.org/2000/svg';

    /** @param {HTMLElement} container Visor. @param {Function} onSelect Recibe el vértice seleccionado. */
    constructor(container, onSelect = () => {}) {
        this.container = container;
        this.onSelect = onSelect;
        this.result = null;
        this.selectedLabel = null;
        this.showHalfplanes = false;
        this.view = { xmin: -1, xmax: 10, ymin: -1, ymax: 10 };
        this.drag = null;
        this.observer = new ResizeObserver(() => this.render());
        this.observer.observe(container);
        container.addEventListener('wheel', event => {
            event.preventDefault();
            this.zoom(event.deltaY < 0 ? 1 / 1.15 : 1.15, event);
        }, { passive: false });
        container.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('[data-vertex]')) return;
            this.drag = { x: event.clientX, y: event.clientY, view: { ...this.actual } };
            container.setPointerCapture(event.pointerId);
        });
        container.addEventListener('pointermove', event => {
            if (!this.drag || !this.scale) return;
            const dx = (event.clientX - this.drag.x) / this.scale;
            const dy = (event.clientY - this.drag.y) / this.scale;
            const v = this.drag.view;
            this.view = { xmin: v.xmin - dx, xmax: v.xmax - dx, ymin: v.ymin + dy, ymax: v.ymax + dy };
            this.render();
        });
        const end = () => { this.drag = null; };
        container.addEventListener('pointerup', end);
        container.addEventListener('pointercancel', end);
    }

    static format(value) {
        if (!Number.isFinite(value)) return '—';
        if (value !== 0 && (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e10)) return value.toExponential(3);
        return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 }).format(Object.is(value, -0) ? 0 : value);
    }

    static equation(r) {
        const f = this.format.bind(this);
        return `${f(r.a)}x ${r.b < 0 ? '−' : '+'} ${f(Math.abs(r.b))}y ${r.op === '<=' ? '≤' : r.op === '>=' ? '≥' : '='} ${f(r.rhs)}`;
    }

    /** Crea elementos SVG con texto plano, sin interpolación de HTML importado. */
    element(tag, attrs = {}, text = null, parent = this.svg) {
        const el = document.createElementNS(LinearProgrammingGraphManager.NS, tag);
        Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
        if (text !== null) el.textContent = text;
        if (parent) parent.appendChild(el);
        return el;
    }

    setResult(result, fit = true) {
        this.result = result;
        this.selectedLabel = result?.optimalPoints?.[0]?.label ?? result?.vertices?.[0]?.label ?? null;
        if (fit) this.fit(); else this.render();
    }

    fit() {
        const r = this.result;
        const points = [...(r?.vertices ?? [])];
        for (const it of r?.intercepts ?? []) {
            for (const p of [it.x, it.y]) if (p.kind === 'point' && p.x >= 0 && p.y >= 0) points.push(p);
        }
        const maxX = Math.max(4, ...points.map(p => p.x)), maxY = Math.max(4, ...points.map(p => p.y));
        this.view = { xmin: -.08 * maxX, xmax: 1.2 * maxX, ymin: -.08 * maxY, ymax: 1.2 * maxY };
        this.render();
    }

    zoom(factor, event = null) {
        if (!this.actual) return;
        const v = this.actual;
        const box = this.container.getBoundingClientRect();
        const cx = event ? v.xmin + (event.clientX - box.left - this.left) / this.scale : (v.xmin + v.xmax) / 2;
        const cy = event ? v.ymax - (event.clientY - box.top - this.top) / this.scale : (v.ymin + v.ymax) / 2;
        const width = (v.xmax - v.xmin) * factor, height = (v.ymax - v.ymin) * factor;
        if (width < 1e-7 || height < 1e-7 || width > 1e12 || height > 1e12) return;
        this.view = { xmin: cx + (v.xmin - cx) * factor, xmax: cx + (v.xmax - cx) * factor,
            ymin: cy + (v.ymin - cy) * factor, ymax: cy + (v.ymax - cy) * factor };
        this.render();
    }

    select(label) {
        this.selectedLabel = label;
        this.render();
        const p = this.result?.vertices.find(v => v.label === label);
        if (p) this.onSelect(p);
    }

    /** Sutherland-Hodgman contra un único semiplano ax+by<=c. */
    static clip(polygon, plane) {
        if (!polygon.length) return [];
        const out = [], S = LinearProgrammingSolver;
        for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const fp = plane.a * p.x + plane.b * p.y - plane.c;
            const fq = plane.a * q.x + plane.b * q.y - plane.c;
            const insideP = fp <= S.tolerance(plane.c, fp), insideQ = fq <= S.tolerance(plane.c, fq);
            if (insideP) out.push(p);
            if (insideP !== insideQ) {
                const t = fp / (fp - fq);
                out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
            }
        }
        return out;
    }

    /** Segmento visible de ax+by=c, incluyendo rectas verticales y horizontales. */
    segment(a, b, c) {
        const v = this.actual, points = [];
        if (b !== 0) for (const x of [v.xmin, v.xmax]) points.push({ x, y: (c - a * x) / b });
        if (a !== 0) for (const y of [v.ymin, v.ymax]) points.push({ x: (c - b * y) / a, y });
        const valid = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)
            && p.x >= v.xmin - 1e-8 && p.x <= v.xmax + 1e-8 && p.y >= v.ymin - 1e-8 && p.y <= v.ymax + 1e-8);
        const unique = valid.filter((p, i) => !valid.slice(0, i).some(q => LinearProgrammingSolver.samePoint(p, q)));
        return unique.length >= 2 ? unique.slice(0, 2) : [];
    }

    points(points) { return points.map(p => `${this.x(p.x)},${this.y(p.y)}`).join(' '); }
    x(x) { return this.left + (x - this.actual.xmin) * this.scale; }
    y(y) { return this.top + (this.actual.ymax - y) * this.scale; }

    static niceStep(span, target) {
        const raw = span / target, unit = 10 ** Math.floor(Math.log10(raw));
        return [1, 2, 5, 10].find(n => n * unit >= raw) * unit;
    }

    render() {
        const box = this.container.getBoundingClientRect();
        if (box.width < 10 || box.height < 10) return;
        const width = Math.max(280, box.width), height = Math.max(300, box.height);
        this.left = 52; this.top = 32;
        const pw = width - 72, ph = height - 82;
        const v = this.view;
        this.scale = Math.min(pw / (v.xmax - v.xmin), ph / (v.ymax - v.ymin));
        this.actual = { xmin: v.xmin, ymin: v.ymin, xmax: v.xmin + pw / this.scale, ymax: v.ymin + ph / this.scale };
        this.container.replaceChildren();
        this.svg = this.element('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: '100%',
            role: 'img', 'aria-label': 'Plano cartesiano de programación lineal, con restricciones, región factible y vértices' }, null, this.container);
        this.element('title', {}, 'Método gráfico de programación lineal');
        this.element('desc', {}, 'El sombreado representa la intersección de todas las restricciones. Los bordes de la ventana no limitan el modelo.');
        this.element('rect', { width, height, fill: '#07111f', 'data-pl-background': '' });
        const defs = this.element('defs');
        const clip = this.element('clipPath', { id: 'pl-plot-clip' }, null, defs);
        this.element('rect', { x: this.left, y: this.top, width: pw, height: ph }, null, clip);
        const marker = this.element('marker', { id: 'pl-ray-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' }, null, defs);
        this.element('path', { d: 'M0,0 L8,4 L0,8 Z', fill: '#34d399' }, null, marker);
        const layer = this.element('g', { 'clip-path': 'url(#pl-plot-clip)' });
        const b = this.actual;
        const rectangle = [{ x: b.xmin, y: b.ymin }, { x: b.xmax, y: b.ymin }, { x: b.xmax, y: b.ymax }, { x: b.xmin, y: b.ymax }];
        const step = LinearProgrammingGraphManager.niceStep(Math.max(b.xmax - b.xmin, b.ymax - b.ymin), width < 430 ? 5 : 9);
        for (let x = Math.ceil(b.xmin / step) * step; x <= b.xmax; x += step) {
            this.element('line', { x1: this.x(x), y1: this.top, x2: this.x(x), y2: this.top + ph, stroke: '#203147', 'data-pl-grid': '' }, null, layer);
            this.element('text', { x: this.x(x), y: this.top + ph + 20, fill: '#a8b6c8', 'font-size': 11, 'text-anchor': 'middle', 'data-pl-text': '' }, LinearProgrammingGraphManager.format(x));
        }
        for (let y = Math.ceil(b.ymin / step) * step; y <= b.ymax; y += step) {
            this.element('line', { x1: this.left, y1: this.y(y), x2: this.left + pw, y2: this.y(y), stroke: '#203147', 'data-pl-grid': '' }, null, layer);
            this.element('text', { x: this.left - 8, y: this.y(y) + 4, fill: '#a8b6c8', 'font-size': 11, 'text-anchor': 'end', 'data-pl-text': '' }, LinearProgrammingGraphManager.format(y));
        }
        const r = this.result;
        if (r && this.showHalfplanes) r.model.constraints.forEach((constraint, index) => {
            let poly = rectangle;
            for (const h of r.halfplanes.filter(h => h.id === constraint.id)) poly = LinearProgrammingGraphManager.clip(poly, h);
            if (constraint.op !== '=') this.element('polygon', { points: this.points(poly), fill: LinearProgrammingGraphManager.COLORS[index % 6], opacity: .075 }, null, layer);
        });
        if (r && r.status !== 'infeasible') {
            let poly = rectangle;
            for (const h of r.halfplanes) poly = LinearProgrammingGraphManager.clip(poly, h);
            this.element('polygon', { points: this.points(poly), fill: '#34d399', 'fill-opacity': .22,
                stroke: r.dimension === 1 ? '#34d399' : 'none', 'stroke-width': 4, 'data-feasible-region': '' }, null, layer);
        }
        for (const [a, bb, c] of [[1, 0, 0], [0, 1, 0]]) {
            const p = this.segment(a, bb, c);
            if (p.length) this.element('polyline', { points: this.points(p), stroke: '#9eafc6', 'stroke-width': 1.5, fill: 'none', 'data-pl-axis': '' }, null, layer);
        }
        this.element('text', { x: this.left + pw, y: this.top + ph + 39, fill: '#c4d2e5', 'text-anchor': 'end', 'font-size': 12, 'data-pl-text': '' }, 'X · unidades');
        this.element('text', { x: this.left, y: 18, fill: '#c4d2e5', 'font-size': 12, 'data-pl-text': '' }, 'Y · unidades');
        if (!r) return;
        r.model.constraints.forEach((constraint, index) => {
            const seg = this.segment(constraint.a, constraint.b, constraint.rhs);
            if (!seg.length) return;
            const color = LinearProgrammingGraphManager.COLORS[index % 6];
            const line = this.element('polyline', { points: this.points(seg), fill: 'none', stroke: color, 'stroke-width': 2 }, null, layer);
            this.element('title', {}, `${constraint.id}: ${LinearProgrammingGraphManager.equation(constraint)}`, line);
            const t = .19 + .14 * (index % 4), x = seg[0].x + t * (seg[1].x - seg[0].x), y = seg[0].y + t * (seg[1].y - seg[0].y);
            this.element('text', { x: this.x(x) + 4, y: this.y(y) - 6, fill: color, 'font-size': 12, 'font-weight': 600,
                stroke: '#07111f', 'stroke-width': 3, 'paint-order': 'stroke' }, constraint.id, layer);
        });
        if (r.optimalValue !== null && (r.model.objective.c1 !== 0 || r.model.objective.c2 !== 0)) {
            const seg = this.segment(r.model.objective.c1, r.model.objective.c2, r.optimalValue);
            if (seg.length) this.element('polyline', { points: this.points(seg), fill: 'none', stroke: '#e9d5ff',
                'stroke-width': 2, 'stroke-dasharray': '8 5', 'data-objective-line': '' }, null, layer);
        }
        if (r.optimalPoints.length > 1 && r.optimalSet !== 'region') {
            this.element('polyline', { points: this.points(r.optimalPoints), fill: 'none', stroke: '#c4b5fd', 'stroke-width': 5 }, null, layer);
        }
        // Las semirrectas óptimas también pertenecen al conjunto óptimo.
        if (r.optimalPoints.length && r.optimalRays.length) {
            const start = r.optimalPoints[0];
            for (const ray of r.optimalRays) {
                const ts = [];
                if (ray.x > 1e-12) ts.push((b.xmax - start.x) / ray.x);
                if (ray.y > 1e-12) ts.push((b.ymax - start.y) / ray.y);
                const t = Math.min(...ts.filter(t => t > 0));
                if (!Number.isFinite(t)) continue;
                this.element('line', { x1: this.x(start.x), y1: this.y(start.y),
                    x2: this.x(start.x + t * ray.x), y2: this.y(start.y + t * ray.y),
                    stroke: '#c4b5fd', 'stroke-width': 5, 'data-optimal-ray': '' }, null, layer);
            }
        }
        if (r.regionBounded === false && r.vertices.length) {
            const start = r.vertices[0];
            for (const ray of r.rays) {
                const ts = [];
                if (ray.x > 1e-12) ts.push((b.xmax - start.x) / ray.x);
                if (ray.y > 1e-12) ts.push((b.ymax - start.y) / ray.y);
                const t = Math.min(...ts.filter(t => t > 0));
                if (!Number.isFinite(t)) continue;
                const p = { x: start.x + .8 * t * ray.x, y: start.y + .8 * t * ray.y };
                const q = { x: start.x + .96 * t * ray.x, y: start.y + .96 * t * ray.y };
                this.element('line', { x1: this.x(p.x), y1: this.y(p.y), x2: this.x(q.x), y2: this.y(q.y),
                    stroke: '#34d399', 'stroke-width': 3, 'marker-end': 'url(#pl-ray-arrow)' }, null, layer);
            }
        }
        const occupied = [];
        for (const p of r.vertices) {
            const x = this.x(p.x), y = this.y(p.y);
            if (x < this.left || x > this.left + pw || y < this.top || y > this.top + ph) continue;
            const optimum = r.optimalPoints.some(o => o.label === p.label);
            const selected = p.label === this.selectedLabel;
            const circle = this.element('circle', { cx: x, cy: y, r: selected ? 7 : 5,
                fill: optimum ? '#c4b5fd' : '#f1f5f9', stroke: '#07111f', 'stroke-width': 2,
                role: 'button', tabindex: 0, 'data-vertex': p.label,
                'aria-label': `Vértice ${p.label}, x ${p.x}, y ${p.y}, Z ${p.z}${optimum ? ', óptimo' : ''}` });
            circle.addEventListener('click', () => this.select(p.label));
            circle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(p.label); } });
            const label = `${p.label} (${LinearProgrammingGraphManager.format(p.x)}; ${LinearProgrammingGraphManager.format(p.y)})${optimum ? ' ★' : ''}`;
            const length = label.length * 6.2;
            const positions = [[10, -13], [10, 22], [-length - 10, -13], [-length - 10, 22], [10, -33], [10, 42]];
            let chosen = null;
            for (const [dx, dy] of positions) {
                const rect = { x: x + dx, y: y + dy - 13, w: length, h: 18 };
                if (rect.x >= this.left && rect.x + rect.w <= width - 10 && rect.y >= this.top
                    && rect.y + rect.h <= height - 40 && !occupied.some(q => rect.x < q.x + q.w && rect.x + rect.w > q.x && rect.y < q.y + q.h && rect.y + rect.h > q.y)) {
                    chosen = rect; break;
                }
            }
            chosen ??= { x: Math.max(this.left, Math.min(width - length - 10, x + 10)), y: Math.max(this.top, y - 26), w: length, h: 18 };
            occupied.push(chosen);
            this.element('text', { x: chosen.x, y: chosen.y + 13, fill: optimum ? '#e9d5ff' : '#e2e8f0',
                'font-size': 11, stroke: '#07111f', 'stroke-width': 3, 'paint-order': 'stroke', 'data-pl-label': '' }, label);
        }
    }

    /** SVG autónomo: conserva colores, tipografía y fondo también en el reporte. */
    exportSvg() {
        if (!this.svg) return '';
        const copy = this.svg.cloneNode(true);
        copy.setAttribute('xmlns', LinearProgrammingGraphManager.NS);
        copy.setAttribute('style', 'font-family:system-ui,sans-serif;max-width:100%;height:auto');
        copy.querySelectorAll('[tabindex]').forEach(el => el.removeAttribute('tabindex'));
        return new XMLSerializer().serializeToString(copy);
    }
}
