/**
 * @file js/floyd-algorithm.js
 * @module FloydJuanManager
 * @fileoverview Módulo algorítmico independiente para la resolución del problema de
 * todas las rutas mínimas mediante el Algoritmo de Floyd-Warshall.
 *
 * Cumple con los requerimientos académicos:
 * 1. Validación de pesos estrictamente positivos (> 0).
 * 2. Manejo de desconexiones (Infinity / ∞) y diagonal principal en 0.
 * 3. Ejecución manual de tres bucles anidados (k, i, j) sin librerías externas.
 * 4. Registro de matrices D^(k) (Distancias) y P^(k) (Recorridos/Predecesores) en cada iteración.
 * 5. Reconstrucción recursiva de la ruta óptima a partir de la matriz P.
 */

/**
 * Representa una celda modificada en la iteración k.
 * @typedef {Object} MatrixUpdate
 * @property {number} i Índice de fila (origen).
 * @property {number} j Índice de columna (destino).
 * @property {string} fromNode Etiqueta del nodo origen.
 * @property {string} toNode Etiqueta del nodo destino.
 * @property {number} oldVal Distancia previa antes de relajar.
 * @property {number} newVal Nueva distancia mínima calculada.
 */

/**
 * Representa el estado de una iteración k de Floyd-Warshall.
 * @typedef {Object} FloydStep
 * @property {number} k Número de iteración (0 para inicial, 1..N para pivotes).
 * @property {string} title Título descriptivo (ej. "Iteración k (Nodo Pivote X)").
 * @property {string|null} pivotNode Etiqueta del nodo pivote evaluado.
 * @property {number|null} pivotIndex Índice numérico del nodo pivote.
 * @property {number[][]} D Copia de la matriz de distancias en esta iteración.
 * @property {string[][]} P Copia de la matriz de recorridos/predecesores en esta iteración.
 * @property {MatrixUpdate[]} updatedCells Lista de celdas modificadas en este paso.
 */

/**
 * Administrador y motor de cálculo del algoritmo de Floyd-Warshall.
 * @class
 */
class FloydJuanManager {
    /**
     * Inicializa el administrador con los nodos y aristas de la red.
     * @param {Array<{id: string|number, label?: string}>} nodes Lista de nodos de la red.
     * @param {Array<{id: string|number, from: string|number, to: string|number, weight: number, arrows?: string, directed?: boolean}>} edges Lista de aristas.
     */
    constructor(nodes, edges) {
        this.nodes = Array.isArray(nodes) ? nodes : [];
        this.edges = Array.isArray(edges) ? edges : [];

        // Mapeos ordenados para indexación consistente de matrices (0..N-1)
        this.nodeIds = this.nodes.map(node => node.id);
        this.nodeLabels = this.nodes.map(node => String(node.label ?? node.id));

        this.nodeIndexById = new Map();
        this.nodeIndexByLabel = new Map();
        this.nodes.forEach((node, index) => {
            this.nodeIndexById.set(node.id, index);
            this.nodeIndexByLabel.set(String(node.label ?? node.id), index);
        });

        // Almacenes de cálculo
        this.steps = [];
        this.finalD = [];
        this.finalP = [];
    }

    /**
     * Valida que la red cumpla los requisitos de la profesora:
     * - Debe tener al menos 2 nodos.
     * - Todos los pesos deben ser valores numéricos finitos estrictamente mayores que 0.
     * @throws {Error} Si algún peso es inválido, nulo, cero o negativo.
     * @returns {void}
     */
    validateNetwork() {
        if (this.nodes.length < 2) {
            throw new Error('La red requiere al menos 2 nodos para ejecutar Floyd-Warshall.');
        }

        const invalidEdge = this.edges.find(edge => {
            const weight = Number(edge.weight);
            return !Number.isFinite(weight) || weight <= 0;
        });

        if (invalidEdge) {
            throw new Error(`El algoritmo requiere pesos estrictamente positivos (> 0). Arco con peso inválido: ${invalidEdge.from} → ${invalidEdge.to} [Peso: ${invalidEdge.weight}]`);
        }
    }

    /**
     * Construye las matrices iniciales D^(0) y P^(0) respetando la regla:
     * - D[i][i] = 0 para todo i.
     * - Si hay arco dirigido (from -> to) con peso W: D[from][to] = W (D[to][from] = Infinity salvo arco explícito).
     * - Si hay arco no dirigido (bidireccional) con peso W: D[from][to] = W y D[to][from] = W.
     * - Si no hay conexión directa: D[i][j] = Infinity.
     * - Matriz P^(0): P[i][j] = i (nodo origen) si existe conexión directa (i != j); '-' si no hay conexión o en la diagonal.
     *
     * @returns {{ D0: number[][], P0: string[][] }}
     */
    buildInitialMatrices() {
        const n = this.nodes.length;
        const D0 = Array.from({ length: n }, () => Array(n).fill(Infinity));
        const P0 = Array.from({ length: n }, () => Array(n).fill('-'));

        // Regla 1: Diagonal principal en 0
        for (let i = 0; i < n; i++) {
            D0[i][i] = 0;
            P0[i][i] = '-';
        }

        // Regla 2 y 3: Conexiones dirigidas o bidireccionales
        this.edges.forEach(edge => {
            const fromIdx = this.nodeIndexById.get(edge.from);
            const toIdx = this.nodeIndexById.get(edge.to);

            if (fromIdx === undefined || toIdx === undefined) return;
            if (fromIdx === toIdx) return; // Lazos ignorados

            const weight = Number(edge.weight);
            const isDirected = edge.arrows === 'to' || edge.directed === true;

            // Arco from -> to
            if (weight < D0[fromIdx][toIdx]) {
                D0[fromIdx][toIdx] = weight;
                P0[fromIdx][toIdx] = this.nodeLabels[fromIdx];
            }

            // Si es no dirigido, replicar to -> from
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
     * Ejecuta el Algoritmo de Floyd-Warshall manual de tres bucles anidados sobre (k, i, j).
     * Guarda el estado de D^(k) y P^(k) en cada iteración k desde 0 hasta N.
     *
     * @returns {Object} Resultado completo con lista de pasos, matrices finales y métricas.
     */
    solve() {
        this.validateNetwork();

        const n = this.nodes.length;
        const { D0, P0 } = this.buildInitialMatrices();

        // Matrices de trabajo activas
        let D = D0.map(row => [...row]);
        let P = P0.map(row => [...row]);

        this.steps = [];

        // Registro de la Iteración 0 (Inicial)
        this.steps.push({
            k: 0,
            title: 'Iteración 0 (Matrices Iniciales)',
            pivotNode: null,
            pivotIndex: null,
            D: D.map(row => [...row]),
            P: P.map(row => [...row]),
            updatedCells: []
        });

        let totalRelaxations = 0;

        // Tres bucles anidados manuales: k (pivote), i (fila/origen), j (columna/destino)
        for (let k = 0; k < n; k++) {
            const pivotLabel = this.nodeLabels[k];
            const nextD = D.map(row => [...row]);
            const nextP = P.map(row => [...row]);
            const stepUpdates = [];

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    // Evitar overflow de Infinity
                    if (D[i][k] !== Infinity && D[k][j] !== Infinity) {
                        const candidate = D[i][k] + D[k][j];

                        // Condición fundamental de Floyd-Warshall:
                        // D^(k)[i][j] = min( D^(k-1)[i][j], D^(k-1)[i][k] + D^(k-1)[k][j] )
                        if (candidate < D[i][j]) {
                            const oldVal = D[i][j];
                            nextD[i][j] = candidate;

                            // Actualización del predecesor: P^(k)[i][j] = P^(k-1)[k][j]
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

            // Guardar instantánea de la iteración k
            this.steps.push({
                k: k + 1,
                title: `Iteración ${k + 1} (Nodo Pivote ${pivotLabel})`,
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
            algorithm: 'floyd',
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
     * Reconstruye de forma estrictamente RECURSIVA la ruta óptima entre dos nodos
     * a partir de la matriz de recorridos/predecesores P.
     *
     * @param {string|number} startNodeId Identificador del nodo origen.
     * @param {string|number} targetNodeId Identificador del nodo destino.
     * @returns {{ reachable: boolean, startNode: string|number, targetNode: string|number, distance: number, pathNodeLabels: string[], pathNodeIds: Array<string|number>, pathEdges: Object[] }}
     */
    reconstructPath(startNodeId, targetNodeId) {
        const u = this.nodeIndexById.get(startNodeId);
        const v = this.nodeIndexById.get(targetNodeId);

        if (u === undefined || v === undefined) {
            throw new Error('Los nodos seleccionados no existen en la red.');
        }

        // Caso directo: distancia infinita -> inalcanzable
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

        // Caso trivial: origen == destino
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

        /**
         * Función recursiva auxiliar que recorre la cadena de predecesores P[i][j]:
         * Si origen == destino retorna [origen].
         * En caso contrario busca el predecesor pred de destino y concatena:
         * camino(origen, pred) + [destino].
         */
        const recursiveBuild = (srcIdx, destIdx) => {
            if (srcIdx === destIdx) {
                return [destIdx];
            }
            const predLabel = this.finalP[srcIdx][destIdx];
            if (!predLabel || predLabel === '-') {
                return null;
            }
            const predIdx = this.nodeIndexByLabel.get(predLabel);
            if (predIdx === undefined) {
                return null;
            }

            const prefix = recursiveBuild(srcIdx, predIdx);
            if (!prefix) return null;
            return [...prefix, destIdx];
        };

        const pathIndices = recursiveBuild(u, v);
        if (!pathIndices || pathIndices.length === 0) {
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

        // Identificar los arcos de Vis.js que componen la ruta
        const pathEdges = [];
        for (let idx = 0; idx < pathNodeIds.length - 1; idx++) {
            const from = pathNodeIds[idx];
            const to = pathNodeIds[idx + 1];

            // Buscar arco preferentemente directo from -> to
            let edge = this.edges.find(e => e.from === from && e.to === to);
            // Si no se encuentra directo, buscar no dirigido compatible
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

// Exportar globalmente para consumo en navegador y modularidad
if (typeof window !== 'undefined') {
    window.FloydJuanManager = FloydJuanManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FloydJuanManager };
}
