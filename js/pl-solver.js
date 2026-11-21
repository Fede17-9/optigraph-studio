/**
 * @file pl-solver.js
 * @module LinearProgrammingSolver
 * Motor geométrico de PL continua en R², con x >= 0 e y >= 0.
 * No depende del DOM, del área visible ni de una librería de optimización.
 */
/**
 * @typedef {Object} PLConstraint
 * @property {string} id Identificador único (sign-x y sign-y están reservados).
 * @property {number} a Coeficiente de x.
 * @property {number} b Coeficiente de y.
 * @property {'<='|'>='|'='} op Operador.
 * @property {number} rhs Término independiente.
 */
/**
 * @typedef {Object} PLModel
 * @property {{sense:'max'|'min', c1:number, c2:number}} objective Función objetivo.
 * @property {PLConstraint[]} constraints Condiciones adicionales a x,y>=0.
 */
/** Motor de geometría y optimización en dos variables no negativas. */
class LinearProgrammingSolver {
    /** @param {PLModel} model Modelo continuo, independiente de la interfaz. */
    constructor(model) {
        this.model = LinearProgrammingSolver.validate(model);
    }

    static EPS = 1e-9;

    /** Tolerancia relativa; los cálculos conservan su precisión interna. */
    static tolerance(...values) {
        return this.EPS * Math.max(1, ...values.map(v => Math.abs(v)));
    }

    static near(a, b) { return Math.abs(a - b) <= this.tolerance(a, b); }
    static dot(a, b) { return a.x * b.x + a.y * b.y; }
    static samePoint(a, b) { return this.near(a.x, b.x) && this.near(a.y, b.y); }

    /** Rechaza modelos incompletos, coerciones silenciosas y dimensiones distintas. */
    static validate(model) {
        if (!model || !model.objective || !Array.isArray(model.constraints)) {
            throw new Error('El modelo necesita una función objetivo y una lista de restricciones.');
        }
        const { sense, c1, c2 } = model.objective;
        if (!['max', 'min'].includes(sense) || !Number.isFinite(c1) || !Number.isFinite(c2)) {
            throw new Error('Seleccione máximo o mínimo e ingrese dos coeficientes numéricos finitos.');
        }
        const ids = new Set(['sign-x', 'sign-y']);
        const constraints = model.constraints.map((r, i) => {
            if (!r || ![r.a, r.b, r.rhs].every(Number.isFinite) || !['<=', '>=', '='].includes(r.op)) {
                throw new Error(`La restricción ${i + 1} contiene un coeficiente o signo inválido.`);
            }
            const id = String(r.id ?? `R${i + 1}`);
            if (ids.has(id)) throw new Error(`Identificador de restricción repetido: ${id}.`);
            ids.add(id);
            return { id, a: r.a, b: r.b, op: r.op, rhs: r.rhs };
        });
        return { objective: { sense, c1, c2 }, constraints };
    }

    /**
     * Convierte cada condición a ax+by<=c. Una igualdad genera dos semiplanos.
     * Las condiciones 0x+0y se resuelven lógicamente, sin inventar una recta.
     */
    static normalize(model) {
        const bounds = [
            { id: 'sign-x', a: 1, b: 0, op: '>=', rhs: 0 },
            { id: 'sign-y', a: 0, b: 1, op: '>=', rhs: 0 }
        ];
        const originals = [...model.constraints, ...bounds];
        const halfplanes = [], lines = [], trivial = [];
        for (const r of originals) {
            const norm = Math.hypot(r.a, r.b);
            if (!Number.isFinite(norm)) throw new Error('La escala de los coeficientes excede la precisión numérica disponible.');
            if (norm === 0) {
                const satisfied = r.op === '<=' ? 0 <= r.rhs : r.op === '>=' ? 0 >= r.rhs : r.rhs === 0;
                trivial.push({ ...r, satisfied });
                continue;
            }
            const line = { id: r.id, a: r.a / norm, b: r.b / norm, c: r.rhs / norm, original: r };
            if (![line.a, line.b, line.c].every(Number.isFinite)) {
                throw new Error('La escala de los coeficientes excede la precisión numérica disponible.');
            }
            lines.push(line);
            if (r.op !== '>=') halfplanes.push({ ...line });
            if (r.op !== '<=') halfplanes.push({ ...line, a: -line.a, b: -line.b, c: -line.c });
        }
        return { originals, halfplanes, lines, trivial };
    }

    static satisfies(point, planes) {
        return planes.every(h => {
            const lhs = h.a * point.x + h.b * point.y;
            return lhs - h.c <= this.tolerance(lhs, h.c);
        });
    }

    /** Detalle académico de cada sustitución, incluyendo las condiciones de signo. */
    static checks(point, originals) {
        return originals.map(r => {
            const norm = Math.hypot(r.a, r.b);
            const lhs = r.a * point.x + r.b * point.y;
            const residual = lhs - r.rhs;
            const normalizedResidual = norm ? residual / norm : residual;
            const tol = norm ? this.tolerance(lhs / norm, r.rhs / norm) : 0;
            const satisfied = r.op === '<=' ? normalizedResidual <= tol
                : r.op === '>=' ? normalizedResidual >= -tol : Math.abs(normalizedResidual) <= tol;
            return { ...r, lhs, residual, satisfied, active: satisfied && Math.abs(normalizedResidual) <= tol };
        });
    }

    /** Interceptos: punto único, ninguno o recta coincidente con el eje. */
    static intercepts(r) {
        const axis = (coefficient, otherCoefficient, coordinate) => {
            if (coefficient !== 0) {
                const value = r.rhs / coefficient;
                if (!Number.isFinite(value)) return { kind: 'out-of-range' };
                return { kind: 'point', x: coordinate === 'x' ? value : 0, y: coordinate === 'y' ? value : 0 };
            }
            return { kind: r.rhs === 0 && otherCoefficient !== 0 ? 'axis' : 'none' };
        };
        return { id: r.id, x: axis(r.a, r.b, 'x'), y: axis(r.b, r.a, 'y'), a: r.a, b: r.b, rhs: r.rhs };
    }

    /** Casco convexo antihorario; elimina puntos interiores de lados colineales. */
    static hull(points) {
        if (points.length <= 1) return points.slice();
        const sorted = points.slice().sort((p, q) => p.x - q.x || p.y - q.y);
        const turn = (o, a, b) => {
            const ux = a.x - o.x, uy = a.y - o.y, vx = b.x - a.x, vy = b.y - a.y;
            const scale = Math.hypot(ux, uy) * Math.hypot(vx, vy);
            return scale ? (ux * vy - uy * vx) / scale : 0;
        };
        const lower = [], upper = [];
        for (const p of sorted) {
            while (lower.length >= 2 && turn(lower.at(-2), lower.at(-1), p) <= this.EPS) lower.pop();
            lower.push(p);
        }
        for (const p of sorted.slice().reverse()) {
            while (upper.length >= 2 && turn(upper.at(-2), upper.at(-1), p) <= this.EPS) upper.pop();
            upper.push(p);
        }
        lower.pop(); upper.pop();
        return [...lower, ...upper];
    }

    /**
     * Direcciones factibles del cono de recesión A d <= 0.
     * En el primer cuadrante es un cono apuntado: sus rayos extremos están en
     * un eje o son paralelos a alguna recta límite. No se usa una caja artificial.
     */
    static recession(planes) {
        const candidates = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
        planes.forEach(h => candidates.push({ x: -h.b, y: h.a }, { x: h.b, y: -h.a }));
        const rays = [];
        for (const d of candidates) {
            const length = Math.hypot(d.x, d.y);
            if (!length) continue;
            const ray = { x: d.x / length, y: d.y / length };
            if (planes.every(h => h.a * ray.x + h.b * ray.y <= this.EPS)
                && !rays.some(p => this.samePoint(p, ray))) rays.push(ray);
        }
        return rays;
    }

    static dimension(vertices, rays) {
        if (!vertices.length) return null;
        const first = vertices[0];
        const vectors = [...vertices.slice(1).map(p => ({ x: p.x - first.x, y: p.y - first.y })), ...rays]
            .filter(v => Math.hypot(v.x, v.y) > 0);
        if (!vectors.length) return 0;
        const u = vectors[0], n = Math.hypot(u.x, u.y);
        return vectors.some(v => Math.abs(u.x * v.y - u.y * v.x) > this.EPS * n * Math.hypot(v.x, v.y)) ? 2 : 1;
    }

    /** Núcleo reutilizable en los problemas auxiliares de redundancia. */
    static core(model) {
        if (!Number.isFinite(Math.hypot(model.objective.c1, model.objective.c2))) {
            throw new Error('La escala de la función objetivo excede la precisión numérica disponible.');
        }
        const normalized = this.normalize(model);
        const { lines, halfplanes, originals, trivial } = normalized;
        const candidates = [], intersections = [];
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const p = lines[i], q = lines[j];
                const determinant = p.a * q.b - q.a * p.b;
                if (Math.abs(determinant) <= 16 * Number.EPSILON) {
                    const coincident = this.near(p.a * q.c, q.a * p.c) && this.near(p.b * q.c, q.b * p.c);
                    intersections.push({ first: p.original, second: q.original, kind: coincident ? 'coincident' : 'parallel' });
                    continue;
                }
                const x = (p.c * q.b - q.c * p.b) / determinant;
                const y = (p.a * q.c - q.a * p.c) / determinant;
                if (![x, y].every(Number.isFinite)) throw new Error('Un cruce excede la escala numérica disponible.');
                const point = { x: Object.is(x, -0) ? 0 : x, y: Object.is(y, -0) ? 0 : y };
                let candidate = candidates.find(c => this.samePoint(c, point));
                if (!candidate) {
                    const checks = this.checks(point, originals);
                    candidate = { ...point, id: `P${candidates.length + 1}`, checks, feasible: checks.every(c => c.satisfied), sources: [] };
                    candidates.push(candidate);
                }
                candidate.sources.push([p.id, q.id]);
                intersections.push({ first: p.original, second: q.original, kind: 'point', x, y,
                    candidateId: candidate.id, feasible: candidate.feasible });
            }
        }
        const feasible = trivial.some(t => !t.satisfied) ? [] : candidates.filter(p => p.feasible);
        const vertices = this.hull(feasible).map((p, i) => ({ ...p, label: this.vertexLabel(i),
            z: model.objective.c1 * p.x + model.objective.c2 * p.y,
            activeConstraintIds: p.checks.filter(c => c.active).map(c => c.id) }));
        if (vertices.some(v => !Number.isFinite(v.z))) throw new Error('La evaluación de Z excede la escala numérica disponible.');
        const result = { model, ...normalized, candidates, intersections,
            intercepts: model.constraints.filter(r => r.a !== 0 || r.b !== 0).map(r => this.intercepts(r)),
            vertices, rays: [], regionBounded: null, dimension: null, status: 'infeasible',
            optimalValue: null, optimalPoints: [], optimalRays: [], optimalSet: null, improvingDirection: null };
        // Bajo x,y>=0, cualquier poliedro factible no vacío tiene algún vértice.
        if (!vertices.length) return result;
        result.rays = this.recession(halfplanes).map(d => ({ ...d, deltaZ: model.objective.c1 * d.x + model.objective.c2 * d.y }));
        result.regionBounded = result.rays.length === 0;
        result.dimension = this.dimension(vertices, result.rays);
        const sign = model.objective.sense === 'max' ? 1 : -1;
        const objectiveTol = this.EPS * Math.max(Math.hypot(model.objective.c1, model.objective.c2), Number.MIN_VALUE);
        result.improvingDirection = result.rays.find(d => sign * d.deltaZ > objectiveTol) ?? null;
        if (result.improvingDirection) {
            result.status = 'unbounded';
            return result;
        }
        result.optimalValue = vertices.reduce((best, p) => sign * p.z > sign * best ? p.z : best, vertices[0].z);
        const objectiveNorm = Math.hypot(model.objective.c1, model.objective.c2) || 1;
        result.optimalPoints = vertices.filter(p => Math.abs(p.z - result.optimalValue)
            <= objectiveNorm * this.tolerance(p.z / objectiveNorm, result.optimalValue / objectiveNorm));
        result.optimalRays = result.rays.filter(d => Math.abs(d.deltaZ) <= objectiveTol);
        const multiple = result.optimalPoints.length > 1 || result.optimalRays.length > 0;
        result.status = multiple ? 'optimal-multiple' : 'optimal-unique';
        result.optimalSet = model.objective.c1 === 0 && model.objective.c2 === 0 ? (result.dimension ? 'region' : 'point')
            : result.optimalRays.length ? 'ray' : multiple ? 'segment' : 'point';
        return result;
    }

    static vertexLabel(index) {
        let label = '', value = index + 1;
        while (value) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
        return label;
    }

    /**
     * Redundancia individual: maximiza la violación de cada condición tras
     * retirarla. Una igualdad requiere verificar ambas desigualdades.
     * No hay recursión: los auxiliares usan core(), que no analiza redundancia.
     */
    solve() {
        const S = LinearProgrammingSolver;
        const result = S.core(this.model);
        result.redundantConstraintIds = [];
        if (result.status === 'infeasible') return result;
        this.model.constraints.forEach((r, index) => {
            const remaining = this.model.constraints.filter((_, i) => i !== index);
            const norm = Math.hypot(r.a, r.b) || 1;
            const sides = r.op === '=' ? [1, -1] : [r.op === '<=' ? 1 : -1];
            const redundant = sides.every(sign => {
                const aux = S.core({ objective: { sense: 'max', c1: sign * r.a / norm, c2: sign * r.b / norm }, constraints: remaining });
                const bound = sign * r.rhs / norm;
                return aux.status !== 'unbounded' && aux.optimalValue !== null
                    && aux.optimalValue - bound <= S.tolerance(aux.optimalValue, bound);
            });
            if (redundant) result.redundantConstraintIds.push(r.id);
        });
        return result;
    }

    /** Banco académico compartido por interfaz, pruebas y demostración. */
    static examples() {
        const make = (id, title, sense, c1, c2, rows) => ({ id, title, model: {
            objective: { sense, c1, c2 }, constraints: rows.map(([a, b, op, rhs], i) => ({ id: `R${i + 1}`, a, b, op, rhs }))
        } });
        return [
            make('spec', 'Ejemplo de las especificaciones', 'max', 40, 30, [[2, 1, '<=', 40], [1, 2, '<=', 50], [1, 0, '<=', 15]]),
            make('computers', 'Taller 1 · Computadores', 'max', 180000, 250000, [[2, 3, '<=', 36], [4, 2, '<=', 40], [1, 1, '<=', 14]]),
            make('contracts', 'Taller 2 · Contratos', 'max', 50000, 90000, [[2, 5, '<=', 100], [1, 2, '<=', 40], [1, 1, '<=', 30]]),
            make('modules', 'Taller 3 · Módulos', 'min', 4, 3, [[3, 2, '>=', 24], [1, 2, '>=', 16], [1, 1, '<=', 20]]),
            make('datacenter', 'Taller 4 · Centro de datos', 'max', 7, 5, [[3, 2, '<=', 30], [2, 4, '<=', 32], [1, 1, '<=', 12]]),
            make('teacher', 'Profesora · Óptimos múltiples', 'min', 3, 2, [[3, 4, '<=', 12], [3, 2, '>=', 2]]),
            make('infeasible', 'Caso especial · Sin región factible', 'max', 1, 1, [[1, 1, '<=', 1], [1, 1, '>=', 3]]),
            make('unbounded', 'Caso especial · Z no acotada', 'max', 1, 1, [[1, -1, '>=', 0]]),
            make('finite-open', 'Región no acotada · Óptimo finito', 'min', 1, 1, [[1, 0, '>=', 1], [0, 1, '>=', 1]]),
            make('optimal-ray', 'Óptimos sobre una semirrecta', 'min', 1, 0, [[1, 0, '>=', 1]]),
            make('equality', 'Igualdad · Segmento factible', 'max', 1, 1, [[1, 1, '=', 2]]),
            make('point', 'Caso especial · Un solo punto', 'min', 4, 3, [[1, 0, '=', 1], [0, 1, '=', 2]]),
            make('zero', 'Objetivo nulo · Toda la región óptima', 'max', 0, 0, [[1, 1, '<=', 4]])
        ];
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = LinearProgrammingSolver;
