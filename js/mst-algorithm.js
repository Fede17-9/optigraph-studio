/**
 * @fileoverview Módulo de lógica algorítmica para el Árbol de Expansión Mínima.
 * Aplica estándares ES6 Clean Code / PEP-8 para documentación clara.
 */

class MSTSolver {
    /**
     * @param {Array} nodes Lista de objetos nodo {id, label}
     * @param {Array} edges Lista de objetos arco {from, to, weight}
     */
    constructor(nodes, edges) {
        this.nodes = nodes;
        this.edges = edges;
    }

    /**
     * Verifica la conexidad de la red mediante Búsqueda en Profundidad (DFS).
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

        // Iniciar DFS desde el primer nodo
        dfs(this.nodes[0].id);

        return visited.size === this.nodes.length;
    }

    /**
     * Ejecuta el Algoritmo de Prim para encontrar el AEM y registra las iteraciones.
     * @param {string} [startNodeId] ID del nodo inicial seleccionado por el usuario.
     * @returns {Object} Resultado con arcos seleccionados, peso total y tabla de pasos.
     */
    solvePrim(startNodeId) {
        if (!this.isConnected()) {
            throw new Error("La red no es conexa. Existen nodos o subgrafos aislados.");
        }

        // Definir nodo inicial (si no se proporciona o no existe, toma el primero)
        const initialNode = (startNodeId && this.nodes.some(n => n.id === startNodeId)) 
            ? startNodeId 
            : this.nodes[0].id;

        const C_k = new Set([initialNode]);
        const C_bar = new Set(this.nodes.map(n => n.id).filter(id => id !== initialNode));
        const selectedEdges = [];
        const stepTable = [];
        let totalWeight = 0;
        let k = 1;

        while (C_bar.size > 0) {
            let minEdge = null;
            let minWeight = Infinity;

            // Buscar el arco de menor peso que conecta C_k con C_bar
            this.edges.forEach(edge => {
                const fromInCk = C_k.has(edge.from);
                const toInCbar = C_bar.has(edge.to);
                const toInCk = C_k.has(edge.to);
                const fromInCbar = C_bar.has(edge.from);

                if ((fromInCk && toInCbar) || (toInCk && fromInCbar)) {
                    if (edge.weight < minWeight) {
                        minWeight = edge.weight;
                        minEdge = edge;
                    }
                }
            });

            if (!minEdge) break;

            // Determinar el nuevo nodo que ingresa a C_k
            const newConnectedNode = C_k.has(minEdge.from) ? minEdge.to : minEdge.from;

            // Registrar el paso antes de actualizar conjuntos
            stepTable.push({
                iteration: k,
                Ck: Array.from(C_k).join(", "),
                Cbar: Array.from(C_bar).join(", "),
                selectedEdge: `(${minEdge.from} - ${minEdge.to})`,
                weight: minEdge.weight
            });

            // Actualizar conjuntos
            C_k.add(newConnectedNode);
            C_bar.delete(newConnectedNode);
            selectedEdges.push(minEdge);
            totalWeight += minEdge.weight;
            k++;
        }

        return {
            selectedEdges,
            totalWeight,
            stepTable
        };
    }
}