/**
 * @file js/dijkstra-algorithm.js
 * @module DijkstraSolver
 * @fileoverview Implementa el algoritmo de Dijkstra para redes no dirigidas
 * con pesos positivos. El solver es independiente del DOM y de Vis.js.
 */

/**
 * @typedef {Object} DijkstraStep
 * @property {number} iteration Numero de iteracion.
 * @property {string|number} currentNode Nodo procesado en el paso.
 * @property {Object.<string|number, number>} distances Distancias conocidas.
 * @property {Object.<string|number, (string|number|null)>} predecessors Predecesores actuales.
 * @property {Array<Object>} relaxedEdges Aristas relajadas en el paso.
 * @property {string|null} tieDescription Descripcion de empates de distancia.
 */

/**
 * Resuelve rutas minimas desde un nodo de origen mediante Dijkstra.
 * @class
 */
class DijkstraSolver {
    /**
     * @param {Array<Object>} nodes Nodos con propiedad `id`.
     * @param {Array<Object>} edges Aristas no dirigidas con `from`, `to` y `weight`.
     */
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    /**
     * Ejecuta Dijkstra desde un nodo de origen.
     * @param {string|number} startNodeId Identificador del nodo inicial.
     * @param {string|number|null} [targetNodeId=null] Destino opcional.
     * @returns {{algorithm: string, startNode: string|number, targetNode: string|number|null, distances: Object, predecessors: Object, selectedPathEdges: Array<Object>, settledNodes: Array<string|number>, relaxedEdges: Array<Object>, stepTable: DijkstraStep[]}}
     * @throws {Error} Si el origen no existe o hay pesos invalidos.
     */
    solve(startNodeId, targetNodeId = null) {
        const nodeIds = this.nodes.map(node => node.id);
        if (!nodeIds.includes(startNodeId)) {
            throw new Error('El nodo de origen no existe en la red.');
        }
        if (targetNodeId !== null && !nodeIds.includes(targetNodeId)) {
            throw new Error('El nodo de destino no existe en la red.');
        }
        this.validateWeights();

        const adjacency = this.buildAdjacency();
        const distances = {};
        const predecessors = {};
        const permanentIterations = {}; // Guardará k cuando el nodo se vuelve permanente
        const unsettled = new Set(nodeIds);
        const settledNodes = [];
        const stepTable = [];
        const relaxedEdges = [];

        nodeIds.forEach(nodeId => {
            distances[nodeId] = Infinity;
            predecessors[nodeId] = null;
        });
        distances[startNodeId] = 0;

        nodeIds.forEach(nodeId => {
            permanentIterations[nodeId] = null;
        });
        distances[startNodeId] = 0;
        permanentIterations[startNodeId] = 0;

        let iteration = 1;
        while (unsettled.size > 0) {
            const currentNode = this.getClosestNode(unsettled, distances);
            if (currentNode === null || distances[currentNode] === Infinity) break;

            unsettled.delete(currentNode);
            settledNodes.push(currentNode);
            if (permanentIterations[currentNode] === null) {
                permanentIterations[currentNode] = iteration - 1;
            }
            const stepRelaxations = [];
            const tiedCandidates = [];

            adjacency.get(currentNode).forEach(connection => {
                if (!unsettled.has(connection.nodeId)) return;

                const candidateDistance = distances[currentNode] + connection.edge.weight;
                if (candidateDistance < distances[connection.nodeId]) {
                    distances[connection.nodeId] = candidateDistance;
                    predecessors[connection.nodeId] = currentNode;
                    stepRelaxations.push({
                        edge: connection.edge,
                        nodeId: connection.nodeId,
                        distance: candidateDistance,
                        predecessor: currentNode
                    });
                    relaxedEdges.push(connection.edge);
                } else if (candidateDistance === distances[connection.nodeId]) {
                    tiedCandidates.push(connection.edge);
                }
            });

            stepTable.push({
                iteration,
                currentNode,
                distances: { ...distances },
                predecessors: { ...predecessors },
                permanentIterations: { ...permanentIterations },
                relaxedEdges: stepRelaxations,
                tieDescription: tiedCandidates.length > 0
                    ? `Empate de distancia en ${tiedCandidates.map(edge => `(${edge.from} -${edge.to})`).join(', ')} [Distancia: ${distances[tiedCandidates[0].to]}]`
                    : null
            });

            iteration++;

            if (targetNodeId !== null && currentNode === targetNodeId) break;
        }

        const selectedPathEdges = targetNodeId === null
            ? []
            : this.reconstructPath(startNodeId, targetNodeId, predecessors);

        return {
            algorithm: 'dijkstra',
            startNode: startNodeId,
            targetNode: targetNodeId,
            distances,
            predecessors,
            permanentIterations,
            selectedPathEdges,
            settledNodes,
            relaxedEdges,
            stepTable
        };
    }

    /**
     * Valida que todas las aristas tengan pesos numericos positivos.
     * @returns {void}
     * @throws {Error} Si algun peso no es valido para Dijkstra.
     */
    validateWeights() {
        const invalidEdge = this.edges.find(edge => !Number.isFinite(Number(edge.weight)) || Number(edge.weight) <= 0);
        if (invalidEdge) {
            throw new Error('Dijkstra requiere pesos numericos mayores que 0.');
        }
    }

    /**
     * Construye adyacencias en ambas direcciones porque la red es no dirigida.
     * @returns {Map<string|number, Array<{nodeId: string|number, edge: Object}>>} Lista de adyacencia.
     */
    buildAdjacency() {
        const adjacency = new Map(this.nodes.map(node => [node.id, []]));
        this.edges.forEach(edge => {
            adjacency.get(edge.from).push({ nodeId: edge.to, edge });
            adjacency.get(edge.to).push({ nodeId: edge.from, edge });
        });
        return adjacency;
    }

    /**
     * Obtiene el nodo no procesado con menor distancia conocida.
     * @param {Set<string|number>} unsettled Nodos pendientes.
     * @param {Object} distances Distancias actuales.
     * @returns {string|number|null} Nodo elegido o null si no quedan alcanzables.
     */
    getClosestNode(unsettled, distances) {
        let closestNode = null;
        let closestDistance = Infinity;
        unsettled.forEach(nodeId => {
            if (distances[nodeId] < closestDistance) {
                closestDistance = distances[nodeId];
                closestNode = nodeId;
            }
        });
        return closestNode;
    }

    /**
     * Reconstruye la ruta final desde el destino hacia el origen.
     * @param {string|number} startNodeId Nodo inicial.
     * @param {string|number} targetNodeId Nodo destino.
     * @param {Object} predecessors Mapa de predecesores.
     * @returns {Array<Object>} Aristas ordenadas desde el origen hasta el destino.
     */
    reconstructPath(startNodeId, targetNodeId, predecessors) {
        const pathNodeIds = [];
        let currentNode = targetNodeId;
        while (currentNode !== null) {
            pathNodeIds.unshift(currentNode);
            if (currentNode === startNodeId) break;
            currentNode = predecessors[currentNode];
        }
        if (pathNodeIds[0] !== startNodeId) return [];

        const pathEdges = [];
        for (let index = 1; index < pathNodeIds.length; index++) {
            const from = pathNodeIds[index - 1];
            const to = pathNodeIds[index];
            const edge = this.edges.find(candidate =>
                (candidate.from === from && candidate.to === to) ||
                (candidate.from === to && candidate.to === from)
            );
            if (edge) pathEdges.push(edge);
        }
        return pathEdges;
    }
}