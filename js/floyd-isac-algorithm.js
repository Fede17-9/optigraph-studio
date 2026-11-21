/**
 * @file js/floyd-isac-algorithm.js
 * @module FloydIsacManager
 * @fileoverview Módulo algorítmico independiente para la resolución del problema de
 * todas las rutas mínimas mediante el Algoritmo de Floyd-Warshall (Enfoque de Matriz de Predecesores Π).
 *
 * Implementación de Isac Velasquez:
 * 1. Validación de pesos estrictamente positivos (> 0).
 * 2. Construcción de la matriz inicial de distancias D^(0) y matriz de predecesores directos Π^(0).
 * 3. Ejecución de tres bucles anidados (k, i, j) aplicando la regla de relajación de predecesores:
 *    Π^(k)[i][j] = Π^(k-1)[k][j] cuando D^(k-1)[i][k] + D^(k-1)[k][j] < D^(k-1)[i][j].
 * 4. Reconstrucción iterativa/cadena de predecesores para la ruta óptima.
 * 5. Garantiza exactamente los mismos resultados de distancias y rutas mínimas que el enfoque pivote.
 */

class FloydIsacManager {
    /**
     * Inicializa el gestor del algoritmo de Isac con nodos y aristas.
     * @param {Array<{id: string|number, label?: string}>} nodes Lista de nodos.
     * @param {Array<{id: string|number, from: string|number, to: string|number, weight: number, arrows?: string, directed?: boolean}>} edges Lista de aristas.
     */
    constructor(nodes, edges) {
        this.nodes = Array.isArray(nodes) ? nodes : [];
        this.edges = Array.isArray(edges) ? edges : [];

        this.nodeIds = this.nodes.map(node => node.id);
        this.nodeLabels = this.nodes.map(node => String(node.label ?? node.id));

        this.nodeIndexById = new Map();
        this.nodeIndexByLabel = new Map();
        this.nodes.forEach((node, index) => {
            this.nodeIndexById.set(node.id, index);
            this.nodeIndexByLabel.set(String(node.label ?? node.id), index);
        });

        this.steps = [];
        this.finalD = [];
        this.finalP = [];
    }

    /**
     * Valida los requisitos de la red:
     * - Al menos 2 nodos.
     * - Pesos finitos y estrictamente mayores que 0.
     */
    validateNetwork() {
        if (this.nodes.length < 2) {
            throw new Error('La red requiere al menos 2 nodos para ejecutar Floyd-Warshall (Isac).');
        }

        const invalidEdge = this.edges.find(edge => {
            const weight = Number(edge.weight);
            return !Number.isFinite(weight) || weight <= 0;
        });

        if (invalidEdge) {
            throw new Error(`El algoritmo de Isac requiere pesos estrictamente positivos (> 0). Arco con peso inválido: ${invalidEdge.from} → ${invalidEdge.to} [Peso: ${invalidEdge.weight}]`);
        }
    }

    /**
     * Construye las matrices iniciales D^(0) y Π^(0) (Matriz de Predecesores Directos):
     * - D[i][i] = 0, Π[i][i] = '-'
     * - Si existe arco u -> v con peso W: D[u][v] = W, Π[u][v] = etiqueta(u) (el predecesor directo de v es u).
     * - Si no existe conexión directa: D[u][v] = Infinity, Π[u][v] = '-'.
     */
    buildInitialMatrices() {
        const n = this.nodes.length;
        const D0 = Array.from({ length: n }, () => Array(n).fill(Infinity));
        const P0 = Array.from({ length: n }, () => Array(n).fill('-'));

        for (let i = 0; i < n; i++) {
            D0[i][i] = 0;
            P0[i][i] = '-';
        }

        this.edges.forEach(edge => {
            const fromIdx = this.nodeIndexById.get(edge.from);
            const toIdx = this.nodeIndexById.get(edge.to);

            if (fromIdx === undefined || toIdx === undefined) return;
            if (fromIdx === toIdx) return;

            const weight = Number(edge.weight);
            const isDirected = edge.arrows === 'to' || edge.directed === true;

            // Arco from -> to: el predecesor directo de toIdx en la ruta desde fromIdx es fromIdx
            if (weight < D0[fromIdx][toIdx]) {
                D0[fromIdx][toIdx] = weight;
                P0[fromIdx][toIdx] = this.nodeLabels[fromIdx];
            }

            // Si es no dirigido / bidireccional
            if (!isDirected) {
                if (weight < D0[toIdx][fromIdx]) {
                    D0[toIdx][fromIdx] = weight;
                    P0[toIdx][fromIdx] = this.nodeLabels[toIdx];
                }
            }
        });

        return { D0, P0 };
    }

    /**
     * Ejecuta Floyd-Warshall con enfoque de matriz de predecesores directos Π.
     * Tres bucles anidados manuales: k, i, j.
     */
    solve() {
        this.validateNetwork();

        const n = this.nodes.length;
        const { D0, P0 } = this.buildInitialMatrices();

        let D = D0.map(row => [...row]);
        let P = P0.map(row => [...row]);

        this.steps = [];

        // Iteración 0
        this.steps.push({
            k: 0,
            title: 'Iteración 0 (Matriz Base D y Predecesores Π)',
            pivotNode: null,
            pivotIndex: null,
            D: D.map(row => [...row]),
            P: P.map(row => [...row]),
            updatedCells: []
        });

        let totalRelaxations = 0;

        for (let k = 0; k < n; k++) {
            const pivotLabel = this.nodeLabels[k];
            const nextD = D.map(row => [...row]);
            const nextP = P.map(row => [...row]);
            const stepUpdates = [];

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (D[i][k] !== Infinity && D[k][j] !== Infinity) {
                        const candidate = D[i][k] + D[k][j];

                        if (candidate < D[i][j]) {
                            const oldVal = D[i][j];
                            nextD[i][j] = candidate;

                            // Regla de Predecesores Directos (CLRS):
                            // El predecesor de j al ir de i pasando por k es el mismo predecesor de j desde k.
                            nextP[i][j] = P[k][j];

                            stepUpdates.push({
                                i,
                                j,
                                fromNode: this.nodeLabels[i],
                                toNode: this.nodeLabels[j],
                                oldVal,
                                newVal: candidate
                            });
                            totalRelaxations++;
                        }
                    }
                }
            }

            D = nextD;
            P = nextP;

            this.steps.push({
                k: k + 1,
                title: `Iteración ${k + 1} (Pivote ${pivotLabel} - Enfoque Predecesores Π)`,
                pivotNode: pivotLabel,
                pivotIndex: k,
                D: D.map(row => [...row]),
                P: P.map(row => [...row]),
                updatedCells: stepUpdates
            });
        }

        this.finalD = D;
        this.finalP = P;

        return {
            algorithm: 'floyd-isac',
            nodeCount: n,
            nodeLabels: [...this.nodeLabels],
            nodeIds: [...this.nodeIds],
            stepHistory: this.steps,
            finalDistanceMatrix: this.finalD,
            finalPredecessorMatrix: this.finalP,
            totalIterations: n,
            totalRelaxations
        };
    }

    /**
     * Reconstruye la ruta óptima mediante rastreo de cadena de predecesores hacia atrás:
     * Comienza en el destino v y retrocede buscando P[u][curr] hasta llegar al origen u.
     */
    reconstructPath(startNodeId, targetNodeId) {
        const u = this.nodeIndexById.get(startNodeId);
        const v = this.nodeIndexById.get(targetNodeId);

        if (u === undefined || v === undefined) {
            throw new Error('Los nodos seleccionados no existen en la red.');
        }

        const distance = this.finalD[u][v];
        if (distance === Infinity) {
            return {
                reachable: false,
                startNode: startNodeId,
                targetNode: targetNodeId,
                distance: Infinity,
                pathNodeLabels: [],
                pathNodeIds: [],
                pathEdges: []
            };
        }

        if (u === v) {
            return {
                reachable: true,
                startNode: startNodeId,
                targetNode: targetNodeId,
                distance: 0,
                pathNodeLabels: [this.nodeLabels[u]],
                pathNodeIds: [this.nodeIds[u]],
                pathEdges: []
            };
        }

        // Rastrear la cadena de predecesores hacia atrás desde v hasta u
        const pathIndicesRev = [v];
        let curr = v;
        const visited = new Set([v]);

        while (curr !== u) {
            const predLabel = this.finalP[u][curr];
            if (!predLabel || predLabel === '-') {
                return {
                    reachable: false,
                    startNode: startNodeId,
                    targetNode: targetNodeId,
                    distance: Infinity,
                    pathNodeLabels: [],
                    pathNodeIds: [],
                    pathEdges: []
                };
            }

            const predIdx = this.nodeIndexByLabel.get(predLabel);
            if (predIdx === undefined || visited.has(predIdx)) {
                break;
            }

            pathIndicesRev.push(predIdx);
            visited.add(predIdx);
            curr = predIdx;
        }

        const pathIndices = pathIndicesRev.reverse();

        if (pathIndices[0] !== u) {
            return {
                reachable: false,
                startNode: startNodeId,
                targetNode: targetNodeId,
                distance: Infinity,
                pathNodeLabels: [],
                pathNodeIds: [],
                pathEdges: []
            };
        }

        const pathNodeIds = pathIndices.map(idx => this.nodeIds[idx]);
        const pathNodeLabels = pathIndices.map(idx => this.nodeLabels[idx]);

        const pathEdges = [];
        for (let idx = 0; idx < pathNodeIds.length - 1; idx++) {
            const from = pathNodeIds[idx];
            const to = pathNodeIds[idx + 1];

            let edge = this.edges.find(e => e.from === from && e.to === to);
            if (!edge) {
                edge = this.edges.find(e =>
                    (e.from === to && e.to === from) &&
                    (e.arrows !== 'to' && e.directed !== true)
                );
            }
            if (edge) pathEdges.push(edge);
        }

        return {
            reachable: true,
            startNode: startNodeId,
            targetNode: targetNodeId,
            distance,
            pathNodeLabels,
            pathNodeIds,
            pathEdges
        };
    }
}

if (typeof window !== 'undefined') {
    window.FloydIsacManager = FloydIsacManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FloydIsacManager };
}
