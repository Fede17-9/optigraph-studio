/**
 * @file js/mst-algorithm.js
 * @module MSTSolver
 * @fileoverview Módulo de lógica algorítmica para el Árbol de Expansión Mínima
 * (AEM). Implementa Prim sobre un grafo no dirigido y registra cada iteración,
 * incluidos los arcos alternativos que empatan con el peso mínimo.
 */

/**
 * Nodo de un grafo ponderado utilizado por el algoritmo.
 * @typedef {Object} GraphNode
 * @property {string|number} id Identificador único del nodo.
 * @property {string} [label] Etiqueta visible del nodo.
 */

/**
 * Arista no dirigida y ponderada del grafo.
 * @typedef {Object} WeightedEdge
 * @property {string|number} id Identificador único de la arista.
 * @property {string|number} from Identificador del nodo de origen.
 * @property {string|number} to Identificador del nodo de destino.
 * @property {number} weight Costo o peso de la arista.
 */

/**
 * Registro de una iteración del algoritmo de Prim.
 * @typedef {Object} PrimStep
 * @property {number} iteration Número de iteración k.
 * @property {string} Ck Representación del conjunto de nodos visitados C_k.
 * @property {string} Cbar Representación del conjunto complementario C̄_k.
 * @property {string} selectedEdge Arista elegida para ampliar el AEM.
 * @property {number} weight Peso de la arista seleccionada.
 * @property {WeightedEdge[]} tieEdges Aristas alternativas con el mismo peso mínimo.
 * @property {string|null} tieDescription Explicación del empate, si existe.
 */

/**
 * Resuelve el Árbol de Expansión Mínima de una red mediante Prim.
 * @class
 */
class MSTSolver {
    /**
    * Motor del algoritmo de Prim para redes no dirigidas y ponderadas.
    *
    * @param {GraphNode[]} nodes Lista de nodos de la red.
    * @param {WeightedEdge[]} edges Lista de aristas ponderadas de la red.
     */
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    /**
     * Verifica la conexidad de la red mediante Búsqueda en Profundidad (DFS).
        * Construye una lista de adyacencia y recorre la red desde el primer nodo.
        * La red es conexa cuando todos sus nodos son alcanzables desde ese origen.
        *
     * @returns {boolean} Verdadero si la red es conexa, Falso de lo contrario.
     */
    isConnected() {
        if (this.nodes.length === 0) return false;

        const visited = new Set();
        const adjacencyList = new Map();

        this.nodes.forEach(node => adjacencyList.set(node.id, []));
        this.edges.forEach(edge => {
            adjacencyList.get(edge.from).push(edge.to);
            adjacencyList.get(edge.to).push(edge.from);
        });

        const dfs = (nodeId) => {
            visited.add(nodeId);
            const neighbors = adjacencyList.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                }
            }
        };

        // Iniciar DFS desde el primer nodo y medir el componente alcanzable.
        dfs(this.nodes[0].id);

        return visited.size === this.nodes.length;
    }

    /**
        * Ejecuta el algoritmo de Prim para encontrar el AEM y registra sus iteraciones.
        * En cada paso se mantiene la partición entre C_k y C̄_k, se evalúan las
        * aristas que cruzan la frontera y se elige la de menor peso. Si varias
        * aristas tienen ese mismo peso mínimo, la primera se incorpora al AEM y
        * las restantes se conservan como alternativas válidas del empate.
        *
        * @param {string|number} [startNodeId] ID del nodo de origen seleccionado.
        * @returns {{selectedEdges: WeightedEdge[], tiedEdges: WeightedEdge[], totalWeight: number, stepTable: PrimStep[]}}
        * Resultado con aristas del AEM, alternativas empatadas, costo total y bitácora.
     */
    solvePrim(startNodeId) {
        if (!this.isConnected()) {
            throw new Error("La red no es conexa. Existen nodos o subgrafos aislados.");
        }

        // Definir el nodo de origen; si el usuario no indica uno válido, usar el primero.
        const initialNode = (startNodeId && this.nodes.some(n => n.id === startNodeId)) 
            ? startNodeId 
            : this.nodes[0].id;

        // C_k contiene los nodos visitados y C̄_k los que aún no pertenecen al árbol.
        const C_k = new Set([initialNode]);
        const C_bar = new Set(this.nodes.map(n => n.id).filter(id => id !== initialNode));
        const selectedEdges = [];
        const tiedEdges = [];
        const stepTable = [];
        let totalWeight = 0;
        let k = 1;

        while (C_bar.size > 0) {
            const candidateEdges = [];

            // Evaluar la frontera C_k/C̄_k: solo son candidatas las aristas que
            // conectan un nodo visitado con otro todavía no visitado.
            this.edges.forEach(edge => {
                const fromInCk = C_k.has(edge.from);
                const toInCbar = C_bar.has(edge.to);
                const toInCk = C_k.has(edge.to);
                const fromInCbar = C_bar.has(edge.from);

                if ((fromInCk && toInCbar) || (toInCk && fromInCbar)) {
                    candidateEdges.push(edge);
                }
            });

            if (candidateEdges.length === 0) break;

            // Obtener el peso mínimo y conservar todas las aristas que lo tienen.
            const minWeight = Math.min(...candidateEdges.map(edge => edge.weight));
            const minimumEdges = candidateEdges.filter(edge => edge.weight === minWeight);
            const minEdge = minimumEdges[0];
            const alternativeEdges = minimumEdges.slice(1);
            // La primera candidata mantiene el desempate determinista; las demás
            // quedan registradas para la explicación y la visualización punteada.
            const tieDescription = minimumEdges.length > 1
                ? `Empate detectado entre: ${minimumEdges.map(edge => `(${edge.from} - ${edge.to})`).join(', ')} [Peso: ${minWeight}]. Se seleccionó: (${minEdge.from} - ${minEdge.to})`
                : null;

            // Determinar el nuevo nodo que ingresa a C_k mediante la arista elegida.
            const newConnectedNode = C_k.has(minEdge.from) ? minEdge.to : minEdge.from;

            // Registrar el estado previo: conjuntos, decisión, peso y empate.
            stepTable.push({
                iteration: k,
                Ck: Array.from(C_k).join(", "),
                Cbar: Array.from(C_bar).join(", "),
                selectedEdge: `(${minEdge.from} - ${minEdge.to})`,
                weight: minEdge.weight,
                tieEdges: alternativeEdges,
                tieDescription
            });

            // Actualizar C_k, C̄_k, el conjunto de aristas del AEM y su costo total.
            C_k.add(newConnectedNode);
            C_bar.delete(newConnectedNode);
            selectedEdges.push(minEdge);
            tiedEdges.push(...alternativeEdges);
            totalWeight += minEdge.weight;
            k++;
        }

        return {
            selectedEdges,
            tiedEdges,
            totalWeight,
            stepTable
        };
    }
}