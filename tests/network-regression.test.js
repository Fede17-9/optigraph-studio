const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { FloydJuanManager } = require('../js/floyd-algorithm.js');
const { FloydIsacManager } = require('../js/floyd-isac-algorithm.js');

// Los scripts clásicos de Prim y Dijkstra siguen sin depender de Node ni del DOM.
const load = (file, name) => vm.runInNewContext(
    readFileSync(resolve(__dirname, '../js', file), 'utf8') + `\n${name};`);
const MSTSolver = load('mst-algorithm.js', 'MSTSolver');
const DijkstraSolver = load('dijkstra-algorithm.js', 'DijkstraSolver');
const nodes = ['A', 'B', 'C'].map(id => ({ id, label: id }));
const edges = [
    { id: 'ab', from: 'A', to: 'B', weight: 2, directed: false },
    { id: 'bc', from: 'B', to: 'C', weight: 3, directed: false },
    { id: 'ac', from: 'A', to: 'C', weight: 10, directed: false }
];

test('Prim conserva AEM de peso 5 y rechaza una red desconectada', () => {
    const result = new MSTSolver(nodes, edges).solvePrim('A');
    assert.equal(result.totalWeight, 5);
    assert.equal(result.selectedEdges.length, 2);
    assert.throws(() => new MSTSolver(nodes, [edges[0]]).solvePrim('A'), /conexa/);
});

test('Dijkstra conserva ruta de costo 5 e identifica un destino inalcanzable', () => {
    const result = new DijkstraSolver(nodes, edges).solve('A', 'C');
    assert.equal(result.distances.C, 5);
    assert.equal(result.selectedPathEdges.length, 2);
    assert.equal(new DijkstraSolver(nodes, [edges[0]]).solve('A').distances.C, Infinity);
});

for (const [name, Solver] of [['Floyd (Fede)', FloydJuanManager], ['Floyd (Isac)', FloydIsacManager]]) {
    test(`${name}: ruta A-B-C de costo 5, con respeto de dirección y desconexión`, () => {
        const solver = new Solver(nodes, edges);
        solver.solve();
        const result = solver.reconstructPath('A', 'C');
        assert.equal(result.distance, 5);
        assert.deepEqual(result.pathNodeIds, ['A', 'B', 'C']);
        const directed = new Solver(nodes, edges.map(e => ({ ...e, directed: true })));
        directed.solve();
        assert.equal(directed.reconstructPath('C', 'A').reachable, false);
        assert.equal(directed.reconstructPath('A', 'C').distance, 5);
    });
}
