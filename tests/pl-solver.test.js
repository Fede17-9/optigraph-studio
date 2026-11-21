const { test } = require('node:test');
const assert = require('node:assert/strict');
const Solver = require('../js/pl-solver.js');

const solve = (sense, c1, c2, rows) => new Solver({ objective: { sense, c1, c2 },
    constraints: rows.map(([a, b, op, rhs], i) => ({ id: `R${i + 1}`, a, b, op, rhs })) }).solve();
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const point = (p, x, y) => { close(p.x, x); close(p.y, y); };

test('Escalas que desbordan la normalización se rechazan sin inventar una solución', () => {
    assert.throws(() => solve('max', 1.7e308, 1.7e308, []), /escala/i);
    assert.throws(() => solve('max', 1, 1, [[1.7e308, 1.7e308, '<=', 1]]), /escala/i);
});

const expected = [
    ['spec', 10, 20, 1000], ['computers', 6, 8, 3080000], ['contracts', 20, 10, 1900000],
    ['modules', 4, 6, 34], ['datacenter', 7, 4.5, 71.5]
];
for (const [id, x, y, z] of expected) {
    test(`Ejemplo académico ${id}: solución óptima y comprobación de todos los vértices`, () => {
        const example = Solver.examples().find(e => e.id === id);
        const r = new Solver(example.model).solve();
        assert.equal(r.status, 'optimal-unique'); close(r.optimalValue, z);
        point(r.optimalPoints[0], x, y);
        assert.equal(r.regionBounded, true);
        assert.ok(r.vertices.every(v => v.checks.every(c => c.satisfied)));
        assert.ok(r.vertices.every(v => v.x >= -1e-8 && v.y >= -1e-8));
        assert.ok(r.candidates.some(v => !v.feasible));
    });
}

test('Profesora: mínimo 2 sobre todo el segmento entre (0,1) y (2/3,0)', () => {
    const r = new Solver(Solver.examples().find(e => e.id === 'teacher').model).solve();
    assert.equal(r.status, 'optimal-multiple'); close(r.optimalValue, 2);
    assert.equal(r.optimalSet, 'segment'); assert.equal(r.optimalPoints.length, 2);
    assert.ok(r.optimalPoints.some(p => Solver.samePoint(p, { x: 0, y: 1 })));
    assert.ok(r.optimalPoints.some(p => Solver.samePoint(p, { x: 2 / 3, y: 0 })));
});

test('Paralelas incompatibles: infactible sin reportar un óptimo', () => {
    const r = solve('max', 1, 1, [[1, 1, '<=', 1], [1, 1, '>=', 3]]);
    assert.equal(r.status, 'infeasible'); assert.equal(r.optimalValue, null);
    assert.equal(r.vertices.length, 0);
    assert.ok(r.intersections.some(p => p.kind === 'parallel'));
});

test('Z no acotada: se devuelve una dirección que cumple el cono y mejora Z', () => {
    const r = solve('max', 1, 1, [[1, -1, '>=', 0]]);
    assert.equal(r.status, 'unbounded'); assert.equal(r.regionBounded, false);
    assert.equal(r.optimalValue, null); assert.ok(r.improvingDirection.deltaZ > 0);
    assert.ok(r.halfplanes.every(h => h.a * r.improvingDirection.x + h.b * r.improvingDirection.y <= 1e-8));
});

test('Región no acotada con mínimo único finito: (1,1), Z=2', () => {
    const r = solve('min', 1, 1, [[1, 0, '>=', 1], [0, 1, '>=', 1]]);
    assert.equal(r.status, 'optimal-unique'); assert.equal(r.regionBounded, false);
    close(r.optimalValue, 2); point(r.optimalPoints[0], 1, 1);
});

test('Óptimos sobre una semirrecta aunque solamente exista un vértice', () => {
    const r = solve('min', 1, 0, [[1, 0, '>=', 1]]);
    assert.equal(r.status, 'optimal-multiple'); assert.equal(r.optimalSet, 'ray');
    assert.equal(r.optimalPoints.length, 1); close(r.optimalValue, 1);
    assert.ok(r.optimalRays.length > 0);
});

test('Una igualdad produce un segmento, no una región de área positiva', () => {
    const r = solve('max', 1, 1, [[1, 1, '=', 2]]);
    assert.equal(r.dimension, 1); assert.equal(r.vertices.length, 2);
    assert.equal(r.status, 'optimal-multiple'); close(r.optimalValue, 2);
});

test('Dos igualdades independientes producen un único punto', () => {
    const r = solve('min', 4, 3, [[1, 0, '=', 1], [0, 1, '=', 2]]);
    assert.equal(r.dimension, 0); assert.equal(r.status, 'optimal-unique');
    point(r.optimalPoints[0], 1, 2); close(r.optimalValue, 10);
});

test('Objetivo nulo: toda la región factible es óptima', () => {
    const r = solve('max', 0, 0, [[1, 1, '<=', 4]]);
    assert.equal(r.optimalSet, 'region'); assert.equal(r.status, 'optimal-multiple');
    assert.equal(r.optimalValue, 0); assert.equal(r.optimalPoints.length, 3);
});

test('Restricción redundante puede estar activa en el óptimo', () => {
    const r = new Solver(Solver.examples().find(e => e.id === 'computers').model).solve();
    assert.ok(r.redundantConstraintIds.includes('R3'));
    assert.ok(r.optimalPoints[0].activeConstraintIds.includes('R3'));
});

test('Restricción inactiva no es automáticamente redundante', () => {
    const r = solve('max', 1, 0, [[1, 0, '<=', 3], [0, 1, '<=', 2]]);
    assert.ok(!r.redundantConstraintIds.includes('R2'));
});

test('Centro de datos: límite de supervisión redundante y cruces (6,6),(8,4) rechazados', () => {
    const r = new Solver(Solver.examples().find(e => e.id === 'datacenter').model).solve();
    assert.ok(r.redundantConstraintIds.includes('R3'));
    for (const [x, y] of [[6, 6], [8, 4]]) assert.ok(r.candidates.some(p => Solver.samePoint(p, { x, y }) && !p.feasible));
});

test('Verticales, horizontales y coincidencia con ejes no dividen entre cero', () => {
    const r = solve('max', 1, 1, [[1, 0, '<=', 3], [0, 1, '<=', 2], [1, 0, '>=', 0]]);
    close(r.optimalValue, 5);
    assert.equal(r.intercepts[0].y.kind, 'none');
    assert.equal(r.intercepts[2].y.kind, 'axis');
    assert.ok(r.intersections.some(p => p.kind === 'coincident'));
});

test('Triples cruces y restricciones duplicadas no duplican vértices', () => {
    const r = solve('max', 1, 1, [[1, 1, '<=', 2], [2, 2, '<=', 4], [1, 0, '<=', 2]]);
    assert.equal(r.vertices.length, 3);
    assert.ok(r.redundantConstraintIds.includes('R1'));
    assert.ok(r.redundantConstraintIds.includes('R2'));
});

test('0x+0y: tautología y contradicción se distinguen exactamente', () => {
    assert.equal(solve('min', 1, 1, [[0, 0, '<=', 1]]).status, 'optimal-unique');
    assert.equal(solve('max', 1, 1, [[0, 0, '>=', 1e-12]]).status, 'infeasible');
    assert.equal(solve('min', 0, 0, [[0, 0, '=', 0]]).status, 'optimal-multiple');
});

test('Sin restricciones explícitas: el primer cuadrante se analiza sin caja artificial', () => {
    assert.equal(solve('max', 1, 1, []).status, 'unbounded');
    assert.equal(solve('min', 1, 1, []).optimalValue, 0);
    assert.equal(solve('max', 0, 0, []).optimalSet, 'region');
});

test('Reescalar restricciones u objetivo no cambia la solución ni crea falsos empates', () => {
    const r = solve('max', 1e-12, 2e-12, [[1e-12, 0, '<=', 3e-12], [0, 1e12, '<=', 2e12]]);
    assert.equal(r.status, 'optimal-unique'); point(r.optimalPoints[0], 3, 2);
    assert.deepEqual(r.redundantConstraintIds, []);
});

test('Coeficientes negativos y minimización no acotada', () => {
    const r = solve('min', -1, 0, [[-1, 0, '<=', -1]]);
    assert.equal(r.status, 'unbounded'); assert.ok(r.improvingDirection.deltaZ < 0);
});

test('Validación de valores vacíos, no finitos, signos e IDs', () => {
    assert.throws(() => new Solver({ objective: { sense: 'max', c1: '', c2: 1 }, constraints: [] }));
    assert.throws(() => solve('max', 1, 1, [[1, 2, '<', 3]]));
    assert.throws(() => solve('max', 1, Infinity, []));
    assert.throws(() => new Solver({ objective: { sense: 'max', c1: 1, c2: 1 }, constraints: [
        { id: 'R1', a: 1, b: 1, op: '<=', rhs: 2 }, { id: 'R1', a: 1, b: 0, op: '>=', rhs: 0 }
    ] }));
});
