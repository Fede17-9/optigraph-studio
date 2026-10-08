/**
 * @file js/graph-manager.js
 * @module GraphManager
 * @fileoverview Capa de presentación y edición del grafo. Centraliza los
 * DataSet de Vis.js, los eventos del lienzo, los presets, la persistencia JSON,
 * el menú contextual y los estilos de aristas del AEM.
 */

/**
 * Configuración visual de clases CSS utilizadas por SweetAlert2.
 * @typedef {Object} ModalClasses
 * @property {string} popup Clase del contenedor del modal.
 * @property {string} title Clase del título.
 * @property {string} htmlContainer Clase del contenido textual.
 * @property {string} input Clase de los controles de entrada.
 * @property {string} confirmButton Clase del botón de confirmación.
 * @property {string} cancelButton Clase del botón de cancelación.
 * @property {string} denyButton Clase del botón de rechazo o eliminación.
 */

/**
 * Documento serializado de una red editable.
 * @typedef {Object} GraphDocument
 * @property {number} version Versión del formato de persistencia.
 * @property {string} exportedAt Fecha de exportación en formato ISO 8601.
 * @property {Object[]} nodes Nodos con identificador, etiqueta y posición.
 * @property {Object[]} edges Aristas con extremos, peso y estilo.
 */

/**
 * Administra el modelo visual y editable de la red en Vis.js.
 * @class
 */
class GraphManager {
    /**
    * Gestor de la red Vis.js y de las operaciones de edición del grafo.
    *
    * @param {string} containerId ID del elemento HTML que alojará el lienzo.
     */
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        this.network = null;
        this.mode = 'select'; // 'select', 'add-node', 'add-edge'
        this.selectedSourceNode = null;
        this.onNodeCountChange = null;
        this.onGraphChange = null;
        this._history = [];
        this._historyIndex = -1;
        this._historySuspended = false;
        this.formalLabels = new Map();

        this._initNetwork();
        this._recordHistory();
    }

    /**
     * Inicializa la instancia de Vis.Network, sus DataSet y opciones visuales.
     * @private
     * @returns {void}
     */
    _initNetwork() {
        // Bloquear el menú contextual del navegador para reservar el clic derecho
        // a la edición de nodos y aristas mediante la API de Vis.js.
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

        // Vis.js trabaja con DataSet reactivos: cualquier alta, baja o actualización
        // se refleja automáticamente en el lienzo sin reconstruir la red.
        const data = { nodes: this.nodes, edges: this.edges };
        const options = {
            nodes: {
                shape: 'circle',
                size: 24,
                font: { color: '#0f172a', size: 14, face: 'monospace', bold: 'bold' },
                color: {
                    background: '#38bdf8',
                    border: '#0284c7',
                    highlight: { background: '#f59e0b', border: '#d97706' }
                },
                borderWidth: 2
            },
            edges: {
                width: 2,
                color: { color: '#64748b', highlight: '#f59e0b' },
                font: { color: '#f8fafc', size: 12, strokeWidth: 4, strokeColor: '#0f172a', align: 'top' },
                smooth: { type: 'continuous' }
            },
            // La posición se controla manualmente para conservar los presets y evitar
            // que la física reposicione los nodos después de cada edición.
            physics: { enabled: false },
            interaction: {
                hover: true,
                dragNodes: true,
                zoomView: true,
                dragView: true
            }
        };

        this.network = new vis.Network(this.container, data, options);
        this.formalLabelLayer = document.createElement('div');
        this.formalLabelLayer.className = 'dijkstra-label-layer';
        this.container.appendChild(this.formalLabelLayer);
        this._bindEvents();
    }

    /**
     * Registra eventos de interacción y suscriptores de cambios de DataSet.
     * @private
     * @returns {void}
     */
    _bindEvents() {
        // El clic izquierdo sirve como herramienta contextual: agrega nodos libres
        // o completa una conexión origen-destino según el modo seleccionado.
        this.network.on('click', (params) => {
            if (this.mode === 'add-node' && params.nodes.length === 0 && params.edges.length === 0) {
                const clickPos = params.pointer.canvas;
                this.addNode(clickPos.x, clickPos.y);
            } else if (this.mode === 'add-edge' && params.nodes.length > 0) {
                const clickedNode = params.nodes[0];
                if (!this.selectedSourceNode) {
                    this.selectedSourceNode = clickedNode;
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'info',
                        title: `Nodo origen: ${clickedNode}. Seleccione el nodo destino.`,
                        showConfirmButton: false,
                        timer: 2500
                    });
                } else if (this.selectedSourceNode !== clickedNode) {
                    this.promptAddEdge(this.selectedSourceNode, clickedNode);
                    this.selectedSourceNode = null;
                }
            }
        });

        // El evento oncontext de Vis.js entrega coordenadas DOM; getNodeAt/getEdgeAt
        // identifica el elemento bajo el puntero después de prevenir el menú nativo.
        this.network.on('oncontext', (params) => {
            const originalEvent = params.event?.srcEvent || params.event;
            if (originalEvent?.preventDefault) {
                originalEvent.preventDefault();
            }

            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            const edgeId = this.network.getEdgeAt(params.pointer.DOM);

            if (nodeId) {
                this.promptDeleteNode(nodeId);
            } else if (edgeId) {
                this.promptManageEdge(edgeId);
            }
        });

        // Reposicionar las etiquetas academicas cuando Vis.js redibuja, arrastra
        // nodos o cambia la escala del lienzo.
        this.network.on('afterDrawing', () => this.positionFormalLabels());

        // Notificar cambios reactivos de nodos y aristas a la capa de UI.
        this.nodes.on('*', () => {
            if (typeof this.onNodeCountChange === 'function') {
                this.onNodeCountChange(this.nodes.length);
            }
            this.notifyGraphChange();
        });
        this.edges.on('*', () => {
            this.notifyGraphChange();
        });
    }

    /**
     * Notifica a la interfaz que el documento del grafo fue modificado.
     * @returns {void}
     */
    notifyGraphChange() {
        if (typeof this.onGraphChange === 'function') {
            this.onGraphChange();
        }
    }

    /**
     * Captura el estado actual para permitir deshacer y rehacer ediciones.
     * @private
     * @returns {void}
     */
    _recordHistory() {
        if (this._historySuspended) return;

        const snapshot = {
            nodes: JSON.parse(JSON.stringify(this.nodes.get())),
            edges: JSON.parse(JSON.stringify(this.edges.get()))
        };
        const current = this._history[this._historyIndex];
        if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;

        this._history = this._history.slice(0, this._historyIndex + 1);
        this._history.push(snapshot);
        this._historyIndex = this._history.length - 1;
    }

    /**
     * Restaura un snapshot interno sin generar otra entrada de historial.
     * @private
     * @param {{nodes: Object[], edges: Object[]}} snapshot Estado serializado.
     * @returns {void}
     */
    _restoreSnapshot(snapshot) {
        this._historySuspended = true;
        this.nodes.clear();
        this.edges.clear();
        this.nodes.add(snapshot.nodes);
        this.edges.add(snapshot.edges);
        this._historySuspended = false;
        this.network.fit({ animation: { duration: 250, easingFunction: 'easeInOutQuad' } });
        this.notifyGraphChange();
    }

    /**
     * Deshace la última modificación de la red.
     * @returns {boolean} Verdadero si se restauró un estado anterior.
     */
    undo() {
        if (this._historyIndex <= 0) return false;
        this._historyIndex--;
        this._restoreSnapshot(this._history[this._historyIndex]);
        return true;
    }

    /**
     * Rehace una modificación previamente deshecha.
     * @returns {boolean} Verdadero si se restauró un estado posterior.
     */
    redo() {
        if (this._historyIndex >= this._history.length - 1) return false;
        this._historyIndex++;
        this._restoreSnapshot(this._history[this._historyIndex]);
        return true;
    }

    /**
     * Indica si existe un estado disponible para deshacer.
     * @returns {boolean} Verdadero cuando hay una edición anterior.
     */
    canUndo() {
        return this._historyIndex > 0;
    }

    /**
     * Indica si existe un estado disponible para rehacer.
     * @returns {boolean} Verdadero cuando hay una edición posterior.
     */
    canRedo() {
        return this._historyIndex < this._history.length - 1;
    }

    /**
     * Genera identificadores legibles para redes creadas automáticamente.
     * @param {number} index Índice base cero del nodo.
     * @returns {string} Identificador alfabético o numérico estable.
     */
    createGeneratedNodeId(index) {
        return index < 26 ? String.fromCharCode(65 + index) : `N${index + 1}`;
    }

    /**
     * Crea una red con nodos distribuidos y sin conexiones.
     * @param {number} nodeCount Cantidad de nodos entre 2 y 50.
     * @returns {void}
     * @throws {Error} Cuando la cantidad está fuera del rango permitido.
     */
    createEmptyNetwork(nodeCount) {
        if (!Number.isInteger(nodeCount) || nodeCount < 2 || nodeCount > 50) {
            throw new Error('La cantidad de nodos debe estar entre 2 y 50.');
        }

        this._recordHistory();
        this.clear(false);
        this.nodes.add(Array.from({ length: nodeCount }, (_, index) => {
            const angle = (index / nodeCount) * Math.PI * 2;
            const radius = Math.min(260, 80 + nodeCount * 5);
            const id = this.createGeneratedNodeId(index);
            return {
                id,
                label: id,
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            };
        }));
        this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
        this._recordHistory();
    }

    /**
     * Genera una red aleatoria conexa con pesos positivos.
     * Primero crea un árbol de expansión aleatorio y luego agrega aristas según
     * la densidad solicitada, garantizando que el resultado sea conexo.
     * @param {number} nodeCount Cantidad de nodos entre 2 y 50.
     * @param {number} density Proporción de aristas adicionales entre 0 y 1.
     * @param {number} maxWeight Peso máximo entero de las aristas.
     * @returns {void}
     */
    createRandomNetwork(nodeCount, density = 0.35, maxWeight = 20) {
        if (!Number.isInteger(nodeCount) || nodeCount < 2 || nodeCount > 50) {
            throw new Error('La cantidad de nodos debe estar entre 2 y 50.');
        }
        if (!Number.isFinite(density) || density < 0 || density > 1) {
            throw new Error('La densidad debe estar entre 0 y 1.');
        }
        if (!Number.isInteger(maxWeight) || maxWeight < 1 || maxWeight > 999) {
            throw new Error('El peso máximo debe estar entre 1 y 999.');
        }

        this._recordHistory();
        this.clear(false);
        const nodes = Array.from({ length: nodeCount }, (_, index) => {
            const angle = (index / nodeCount) * Math.PI * 2;
            const radius = Math.min(260, 80 + nodeCount * 5);
            const id = this.createGeneratedNodeId(index);
            return { id, label: id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        });
        const edges = [];
        const edgeKeys = new Set();
        const addRandomEdge = (from, to) => {
            const key = [from, to].sort().join('|');
            if (edgeKeys.has(key)) return;
            edgeKeys.add(key);
            const weight = Math.floor(Math.random() * maxWeight) + 1;
            edges.push({ id: `${from}-${to}`, from, to, label: String(weight), weight });
        };

        // Árbol base: conecta cada nodo nuevo con uno ya incorporado.
        for (let index = 1; index < nodeCount; index++) {
            const parentIndex = Math.floor(Math.random() * index);
            addRandomEdge(nodes[index].id, nodes[parentIndex].id);
        }
        // Aristas adicionales: aumentan la variedad sin sacrificar conexidad.
        for (let fromIndex = 0; fromIndex < nodeCount; fromIndex++) {
            for (let toIndex = fromIndex + 1; toIndex < nodeCount; toIndex++) {
                if (Math.random() < density) addRandomEdge(nodes[fromIndex].id, nodes[toIndex].id);
            }
        }

        this.nodes.add(nodes);
        this.edges.add(edges);
        this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
        this._recordHistory();
    }

    /**
     * Agrega un nodo en coordenadas del lienzo Vis.js.
     * @param {number} x Coordenada horizontal en el sistema canvas.
     * @param {number} y Coordenada vertical en el sistema canvas.
     * @returns {void}
     */
    addNode(x, y) {
        this._recordHistory();
        const nextIdLetter = String.fromCharCode(65 + this.nodes.length);
        this.nodes.add({ id: nextIdLetter, label: nextIdLetter, x: x, y: y });
        this._recordHistory();
    }

    /**
     * Solicita el peso y crea una arista no dirigida entre dos nodos.
     * @param {string|number} fromNode Identificador del nodo origen.
     * @param {string|number} toNode Identificador del nodo destino.
     * @returns {Promise<void>} Promesa resuelta cuando termina el modal.
     */
    async promptAddEdge(fromNode, toNode) {
        const { value: edgeData } = await Swal.fire({
            title: `Conectar ${fromNode} y ${toNode}`,
            html: `
                <label class="og-form-label" for="swal-edge-weight">Peso o valor del arco (> 0):</label>
                <input id="swal-edge-weight" class="og-modal-input" type="number" step="any" min="0.01" placeholder="Ej. 5">
                <label class="og-form-label" for="swal-edge-direction">Dirección del arco:</label>
                <select id="swal-edge-direction" class="og-modal-input">
                    <option value="directed">Dirigido (${fromNode} → ${toNode})</option>
                    <option value="undirected">No dirigido / Bidireccional (${fromNode} ↔ ${toNode})</option>
                </select>
            `,
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            customClass: this.getModalClasses(),
            preConfirm: () => {
                const weightVal = document.getElementById('swal-edge-weight')?.value;
                const dirVal = document.getElementById('swal-edge-direction')?.value;
                const weightNum = parseFloat(weightVal);
                if (!weightVal || isNaN(weightNum) || weightNum <= 0) {
                    Swal.showValidationMessage('Ingrese un número válido mayor a 0');
                    return false;
                }
                return {
                    weight: weightNum,
                    isDirected: dirVal === 'directed'
                };
            }
        });

        if (edgeData) {
            const { weight, isDirected } = edgeData;
            const existingEdges = this.edges.get();
            const exists = isDirected
                ? existingEdges.some(e => e.from === fromNode && e.to === toNode)
                : existingEdges.some(e => (e.from === fromNode && e.to === toNode) || (e.from === toNode && e.to === fromNode));

            if (exists) {
                Swal.fire('Atención', 'Ya existe una conexión en esa dirección entre estos nodos.', 'warning');
                return;
            }

            const edgeId = isDirected ? `${fromNode}->${toNode}` : `${fromNode}-${toNode}`;
            this._recordHistory();
            this.edges.add({
                id: edgeId,
                from: fromNode,
                to: toNode,
                label: String(weight),
                weight: weight,
                arrows: isDirected ? 'to' : '',
                directed: isDirected,
                smooth: isDirected ? { type: 'curvedCW', roundness: 0.15 } : { type: 'continuous' }
            });
            this._recordHistory();
        }
    }

    /**
     * Muestra un modal y elimina un nodo junto con sus aristas incidentes.
     * @param {string|number} nodeId Identificador del nodo que se eliminará.
     * @returns {Promise<void>} Promesa resuelta después de confirmar o cancelar.
     */
    async promptDeleteNode(nodeId) {
        const result = await Swal.fire({
            title: `¿Eliminar Nodo ${nodeId}?`,
            text: 'Se eliminará únicamente este nodo y sus conexiones asociadas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            customClass: this.getModalClasses()
        });

        if (result.isConfirmed) {
            this._recordHistory();
            // Eliminar todas las aristas incidentes antes de retirar el nodo.
            const connectedEdges = this.edges.get().filter(e => e.from === nodeId || e.to === nodeId);
            connectedEdges.forEach(e => this.edges.remove(e.id));

            // Eliminar el nodo del DataSet; el contador reacciona al evento de cambio.
            this.nodes.remove(nodeId);
            this._recordHistory();

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Nodo ${nodeId} eliminado`,
                showConfirmButton: false,
                timer: 2000
            });
        }
    }

    /**
     * Permite modificar el peso o eliminar una arista desde el menú contextual.
     * @param {string|number} edgeId Identificador de la arista seleccionada.
     * @returns {Promise<void>} Promesa resuelta al finalizar la operación.
     */
    async promptManageEdge(edgeId) {
        const edge = this.edges.get(edgeId);
        if (!edge) return;

        const result = await Swal.fire({
            title: `Editar Arco (${edge.from} ↔ ${edge.to})`,
            text: `Peso actual: ${edge.weight}`,
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '✏️ Cambiar Peso',
            denyButtonText: '🗑️ Eliminar Arco',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            denyButtonColor: '#f43f5e',
            customClass: this.getModalClasses()
        });

        if (result.isConfirmed) {
            // Solicitar un nuevo peso y actualizar la etiqueta visible de la arista.
            const { value: newWeight } = await Swal.fire({
                title: 'Nuevo Peso del Arco',
                input: 'number',
                inputValue: edge.weight,
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                customClass: this.getModalClasses(),
                inputValidator: (val) => {
                    if (!val || isNaN(val) || parseFloat(val) <= 0) {
                        return 'Ingrese un número válido mayor a 0';
                    }
                }
            });

            if (newWeight) {
                this._recordHistory();
                this.edges.update({
                    id: edgeId,
                    label: String(newWeight),
                    weight: parseFloat(newWeight)
                });
                this._recordHistory();
            }
        } else if (result.isDenied) {
            this._recordHistory();
            // Eliminar únicamente esta conexión del DataSet de Vis.js.
            this.edges.remove(edgeId);
            this._recordHistory();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Arco eliminado',
                showConfirmButton: false,
                timer: 2000
            });
        }
    }

    /**
     * Devuelve las clases visuales compartidas por los modales SweetAlert2.
     * @returns {ModalClasses} Mapa de clases CSS para cada región del modal.
     */
    getModalClasses() {
        return {
            popup: 'og-modal',
            title: 'og-modal-title',
            htmlContainer: 'og-modal-text',
            input: 'og-modal-input',
            confirmButton: 'og-modal-confirm',
            cancelButton: 'og-modal-cancel',
            denyButton: 'og-modal-deny'
        };
    }

    /**
     * Construye una copia serializable de la red editable actual.
     * @returns {GraphDocument} Documento JSON con nodos y aristas.
     */
    getGraphData() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            nodes: JSON.parse(JSON.stringify(this.nodes.get())),
            edges: JSON.parse(JSON.stringify(this.edges.get()))
        };
    }

    /**
     * Valida y carga una red serializada desde un archivo JSON.
     * @param {GraphDocument} graphData Documento de red previamente exportado.
     * @returns {void}
     * @throws {Error} Cuando la estructura, identificadores o pesos son inválidos.
     */
    importGraph(graphData) {
        const document = graphData?.graph && graphData?.result
            ? { ...graphData.graph, result: graphData.result }
            : graphData;

        if (!document || !Array.isArray(document.nodes) || !Array.isArray(document.edges)) {
            throw new Error('El archivo no contiene una red válida.');
        }

        const nodeIds = new Set(document.nodes.map(node => String(node.id)));
        if (nodeIds.size !== document.nodes.length || document.nodes.some(node => node.id === undefined || node.id === null)) {
            throw new Error('La red contiene nodos inválidos o identificadores repetidos.');
        }

        const importedEdges = document.edges.map(edge => ({
            ...edge,
            weight: Number(edge.weight),
            label: edge.label ?? String(edge.weight)
        }));
        const hasInvalidEdge = importedEdges.some(edge =>
            edge.id === undefined ||
            edge.from === undefined ||
            edge.to === undefined ||
            !nodeIds.has(String(edge.from)) ||
            !nodeIds.has(String(edge.to)) ||
            !Number.isFinite(edge.weight) ||
            edge.weight <= 0
        );

        if (hasInvalidEdge) {
            throw new Error('La red contiene conexiones inválidas o pesos no permitidos.');
        }

        this._recordHistory();
        this.clear(false);
        this.nodes.add(document.nodes);
        this.edges.add(importedEdges);
        this._recordHistory();
        this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });

        return document.result ? {
            startNode: document.result.startNode,
            result: document.result
        } : null;
    }

    /**
     * Restablece el estilo base de todas las aristas sin borrar el grafo.
     * @returns {void}
     */
    resetVisualStyles() {
        this.formalLabels.clear();
        if (this.formalLabelLayer) this.formalLabelLayer.innerHTML = '';
        this.nodes.update(this.nodes.get().map(node => ({
            id: node.id,
            label: node.label,
            title: '',
            color: {
                background: '#38bdf8',
                border: '#0284c7',
                highlight: { background: '#f59e0b', border: '#d97706' }
            }
        })));
        this.edges.update(this.edges.get().map(edge => ({
            id: edge.id,
            color: { color: '#64748b', highlight: '#f59e0b' },
            width: 2,
            dashes: false
        })));
    }

    /**
     * Resalta el AEM y sus alternativas empatadas en Vis.js.
     * Las aristas seleccionadas usan línea verde sólida; las alternativas de
     * igual peso usan línea azul discontinua; las restantes quedan atenuadas.
     *
     * @param {Array<{id: string|number}>} mstEdges Aristas pertenecientes al AEM.
     * @param {Array<{id: string|number}>} [tieEdges=[]] Aristas alternativas empatadas.
     * @returns {void}
     */
    highlightMST(mstEdges, tieEdges = []) {
        const mstEdgeIds = new Set(mstEdges.map(e => e.id));
        const tieEdgeIds = new Set(tieEdges.map(e => e.id));

        const updatedEdges = this.edges.get().map(edge => {
            const isSelected = mstEdgeIds.has(edge.id) || mstEdgeIds.has(`${edge.to}-${edge.from}`);
            const isTie = tieEdgeIds.has(edge.id) || tieEdgeIds.has(`${edge.to}-${edge.from}`);
            return {
                id: edge.id,
                color: isSelected
                    ? { color: '#10b981', highlight: '#34d399' }
                    : isTie
                        ? { color: '#38bdf8', highlight: '#7dd3fc' }
                        : { color: '#334155', opacity: 0.3 },
                width: isSelected ? 5 : isTie ? 3 : 1,
                dashes: !isSelected && isTie
            };
        });

        this.edges.update(updatedEdges);
    }

    /**
     * Resalta el resultado de Dijkstra sin reutilizar los estilos del AEM.
     * @param {{selectedPathEdges: Object[], settledNodes: Array<string|number>, relaxedEdges: Object[]}} result Resultado visual de Dijkstra.
     * @returns {void}
     */
    /**
 * Renderiza las etiquetas formales [u_j, pred]_(k) exigidas en la clase sobre cada nodo.
 */
    /**
 * Renderiza las etiquetas formales [u_j, pred]_(k) sobre los nodos de Vis.js.
 */
    renderFormalLabels(dijkstraResult) {
        if (!dijkstraResult) return;

        const distances = dijkstraResult.distances || {};
        const predecessors = dijkstraResult.predecessors || {};
        const settledNodes = dijkstraResult.settledNodes || [];
        const permanentIterations = dijkstraResult.permanentIterations || {};

        const updatedNodes = this.nodes.get().map(node => {
            const nodeIdRaw = node.id;
            const nodeIdStr = String(nodeIdRaw);

            // Busca la distancia aceptando la clave como viene o en formato string
            const dist = distances[nodeIdRaw] !== undefined ? distances[nodeIdRaw] : distances[nodeIdStr];
            const pred = predecessors[nodeIdRaw] !== undefined ? predecessors[nodeIdRaw] : predecessors[nodeIdStr];

            if (dist === undefined) return node;

            // Intenta obtener la iteracion k
            let iter = permanentIterations[nodeIdRaw] !== undefined ? permanentIterations[nodeIdRaw] : permanentIterations[nodeIdStr];

            // Si no se encuentra en el objeto, calcula k segun la posicion en settledNodes
            if (iter === null || iter === undefined) {
                const idxRaw = settledNodes.indexOf(nodeIdRaw);
                const idxStr = settledNodes.indexOf(nodeIdStr);
                const index = idxRaw !== -1 ? idxRaw : idxStr;
                iter = index !== -1 ? index : '?';
            }

            const formattedDist = dist === Infinity ? '∞' : dist;
            const formattedPred = (pred === null || pred === undefined) ? '-' : pred;
            const formattedIter = (iter === '?' || iter === null || iter === undefined) ? '-' : iter;

            // Mantener la bolita pequena y conservar la notacion academica en una
            // etiqueta lateral persistente, independiente del tamano del nodo.
            this.formalLabels.set(node.id, `[${formattedDist}, ${formattedPred}]_(${formattedIter})`);
            return {
                id: node.id,
                label: node.label || node.id,
                title: `${node.label || node.id}\n[${formattedDist}, ${formattedPred}]_(${formattedIter})`
            };
        });

        this.nodes.update(updatedNodes);
        this.positionFormalLabels();
    }

    /**
     * Dibuja y posiciona las etiquetas laterales de Dijkstra sobre el canvas.
     * @returns {void}
     */
    positionFormalLabels() {
        if (!this.formalLabelLayer || !this.network) return;

        this.formalLabels.forEach((text, nodeId) => {
            let labelElement = this.formalLabelLayer.querySelector(`[data-node-id="${CSS.escape(String(nodeId))}"]`);
            if (!labelElement) {
                labelElement = document.createElement('span');
                labelElement.className = 'dijkstra-side-label';
                labelElement.dataset.nodeId = String(nodeId);
                this.formalLabelLayer.appendChild(labelElement);
            }
            labelElement.textContent = text;
            const position = this.network.getPositions([nodeId])[nodeId];
            if (!position) return;
            const domPosition = this.network.canvasToDOM(position);
            labelElement.style.left = `${domPosition.x}px`;
            labelElement.style.top = `${domPosition.y}px`;
        });

        Array.from(this.formalLabelLayer.children).forEach(element => {
            if (!this.formalLabels.has(element.dataset.nodeId)) element.remove();
        });
    }

    highlightDijkstra(result) {
        const pathIds = new Set(result.selectedPathEdges.map(edge => edge.id));
        const relaxedIds = new Set(result.relaxedEdges.map(edge => edge.id));
        const settledIds = new Set(result.settledNodes);

        this.nodes.update(this.nodes.get().map(node => ({
            id: node.id,
            color: settledIds.has(node.id)
                ? { background: '#f59e0b', border: '#d97706', highlight: { background: '#fbbf24', border: '#f59e0b' } }
                : { background: '#38bdf8', border: '#0284c7', highlight: { background: '#f59e0b', border: '#d97706' } }
        })));

        this.edges.update(this.edges.get().map(edge => ({
            id: edge.id,
            color: pathIds.has(edge.id)
                ? { color: '#f59e0b', highlight: '#fbbf24' }
                : relaxedIds.has(edge.id)
                    ? { color: '#38bdf8', highlight: '#7dd3fc' }
                    : { color: '#334155', opacity: 0.3 },
            width: pathIds.has(edge.id) ? 5 : relaxedIds.has(edge.id) ? 3 : 1,
            dashes: false
        })));

        // ESTA LÍNEA ES LA QUE DIBUJA EL [u_j, pred]_(k) EN EL CANVAS:
        this.renderFormalLabels(result);
    }

    /**
     * Resalta la ruta óptima calculada por Floyd-Warshall en el lienzo de Vis.js.
     * @param {{ reachable: boolean, pathNodeIds: Array<string|number>, pathEdges: Object[] }} routeInfo Información de la ruta.
     * @returns {void}
     */
    highlightFloyd(routeInfo) {
        this.formalLabels.clear();
        if (this.formalLabelLayer) this.formalLabelLayer.innerHTML = '';

        if (!routeInfo || !routeInfo.reachable || !routeInfo.pathNodeIds || routeInfo.pathNodeIds.length === 0) {
            this.resetVisualStyles();
            return;
        }

        const pathNodeIdsSet = new Set(routeInfo.pathNodeIds.map(String));
        const startId = String(routeInfo.pathNodeIds[0]);
        const endId = String(routeInfo.pathNodeIds[routeInfo.pathNodeIds.length - 1]);
        const pathEdgeIdsSet = new Set((routeInfo.pathEdges || []).map(e => String(e.id)));

        // Resaltar nodos de la ruta
        this.nodes.update(this.nodes.get().map(node => {
            const nodeIdStr = String(node.id);
            const isStart = nodeIdStr === startId;
            const isEnd = nodeIdStr === endId;
            const isInPath = pathNodeIdsSet.has(nodeIdStr);

            if (isStart) {
                return {
                    id: node.id,
                    color: { background: '#38bdf8', border: '#0284c7', highlight: { background: '#7dd3fc', border: '#38bdf8' } }
                };
            }
            if (isEnd) {
                return {
                    id: node.id,
                    color: { background: '#10b981', border: '#059669', highlight: { background: '#34d399', border: '#10b981' } }
                };
            }
            if (isInPath) {
                return {
                    id: node.id,
                    color: { background: '#f59e0b', border: '#d97706', highlight: { background: '#fbbf24', border: '#f59e0b' } }
                };
            }
            return {
                id: node.id,
                color: { background: '#1e293b', border: '#475569', highlight: { background: '#334155', border: '#64748b' } }
            };
        }));

        // Resaltar aristas que componen la ruta
        this.edges.update(this.edges.get().map(edge => {
            const isSelected = pathEdgeIdsSet.has(String(edge.id));
            return {
                id: edge.id,
                color: isSelected
                    ? { color: '#38bdf8', highlight: '#7dd3fc' }
                    : { color: '#334155', opacity: 0.25 },
                width: isSelected ? 5 : 1
            };
        }));
    }

    /**
     * Carga uno de los escenarios académicos predefinidos y ajusta el lienzo.
     * @param {string} presetKey Clave del preset (`red1`, `red2`, `red3` o `redFloyd`).
     * @returns {void}
     */
    loadPresetNetwork(presetKey) {
        this._recordHistory();
        this.clear(false);

        if (presetKey === 'red1') {
            this.nodes.add([
                { id: 'a', label: 'a', x: -300, y: 0 },
                { id: 'b', label: 'b', x: -120, y: -150 },
                { id: 'c', label: 'c', x: -120, y: 0 },
                { id: 'd', label: 'd', x: -120, y: 170 },
                { id: 'f', label: 'f', x: 110, y: 0 },
                { id: 'e', label: 'e', x: 110, y: 170 },
                { id: 'g', label: 'g', x: 110, y: -150 },
                { id: 'z', label: 'z', x: 300, y: 0 }
            ]);
            this.edges.add([
                { id: 'a-b', from: 'a', to: 'b', label: '16', weight: 16 },
                { id: 'a-c', from: 'a', to: 'c', label: '10', weight: 10 },
                { id: 'a-d', from: 'a', to: 'd', label: '5', weight: 5 },
                { id: 'b-c', from: 'b', to: 'c', label: '2', weight: 2 },
                { id: 'b-f', from: 'b', to: 'f', label: '4', weight: 4 },
                { id: 'b-g', from: 'b', to: 'g', label: '6', weight: 6 },
                { id: 'c-d', from: 'c', to: 'd', label: '4', weight: 4 },
                { id: 'c-e', from: 'c', to: 'e', label: '10', weight: 10 },
                { id: 'c-f', from: 'c', to: 'f', label: '12', weight: 12 },
                { id: 'd-e', from: 'd', to: 'e', label: '15', weight: 15 },
                { id: 'e-f', from: 'e', to: 'f', label: '3', weight: 3 },
                { id: 'e-z', from: 'e', to: 'z', label: '5', weight: 5 },
                { id: 'f-g', from: 'f', to: 'g', label: '8', weight: 8 },
                { id: 'f-z', from: 'f', to: 'z', label: '16', weight: 16 },
                { id: 'g-z', from: 'g', to: 'z', label: '7', weight: 7 }
            ]);
        } else if (presetKey === 'red2') {
            this.nodes.add([
                { id: 'R', label: 'R', x: -300, y: 0 },
                { id: 'M', label: 'M', x: -160, y: -130 },
                { id: 'N', label: 'N', x: -160, y: 150 },
                { id: 'K', label: 'K', x: 0, y: -200 },
                { id: 'P', label: 'P', x: 0, y: 0 },
                { id: 'Q', label: 'Q', x: 190, y: -130 },
                { id: 'L', label: 'L', x: 190, y: 0 },
                { id: 'U', label: 'U', x: 70, y: 170 },
                { id: 'T', label: 'T', x: 230, y: 170 },
                { id: 'S', label: 'S', x: 350, y: 0 }
            ]);
            this.edges.add([
                { id: 'R-M', from: 'R', to: 'M', label: '6', weight: 6 },
                { id: 'R-N', from: 'R', to: 'N', label: '4', weight: 4 },
                { id: 'R-P', from: 'R', to: 'P', label: '2', weight: 2 },
                { id: 'M-N', from: 'M', to: 'N', label: '3', weight: 3 },
                { id: 'M-P', from: 'M', to: 'P', label: '8', weight: 8 },
                { id: 'M-K', from: 'M', to: 'K', label: '9', weight: 9 },
                { id: 'N-P', from: 'N', to: 'P', label: '7', weight: 7 },
                { id: 'N-U', from: 'N', to: 'U', label: '8', weight: 8 },
                { id: 'K-P', from: 'K', to: 'P', label: '4', weight: 4 },
                { id: 'K-Q', from: 'K', to: 'Q', label: '7', weight: 7 },
                { id: 'P-L', from: 'P', to: 'L', label: '5', weight: 5 },
                { id: 'P-U', from: 'P', to: 'U', label: '6', weight: 6 },
                { id: 'Q-L', from: 'Q', to: 'L', label: '3', weight: 3 },
                { id: 'Q-S', from: 'Q', to: 'S', label: '2', weight: 2 },
                { id: 'L-S', from: 'L', to: 'S', label: '9', weight: 9 },
                { id: 'L-T', from: 'L', to: 'T', label: '1', weight: 1 },
                { id: 'U-S', from: 'U', to: 'S', label: '4', weight: 4 },
                { id: 'U-T', from: 'U', to: 'T', label: '5', weight: 5 },
                { id: 'T-S', from: 'T', to: 'S', label: '6', weight: 6 }
            ]);
        } else if (presetKey === 'red3') {
            this.nodes.add([
                { id: 'A', label: 'A', x: -450, y: 0 },
                { id: 'B', label: 'B', x: -330, y: -180 },
                { id: 'C', label: 'C', x: -310, y: 80 },
                { id: 'D', label: 'D', x: -350, y: 220 },
                { id: 'E', label: 'E', x: -180, y: -20 },
                { id: 'F', label: 'F', x: -170, y: 220 },
                { id: 'G', label: 'G', x: -30, y: -200 },
                { id: 'H', label: 'H', x: -30, y: 0 },
                { id: 'I', label: 'I', x: 100, y: -20 },
                { id: 'J', label: 'J', x: 90, y: 220 },
                { id: 'K', label: 'K', x: 210, y: -170 },
                { id: 'L', label: 'L', x: 220, y: 220 },
                { id: 'M', label: 'M', x: 330, y: -180 },
                { id: 'N', label: 'N', x: 310, y: 0 },
                { id: 'O', label: 'O', x: 430, y: 100 }
            ]);
            this.edges.add([
                { id: 'A-B', from: 'A', to: 'B', label: '4', weight: 4 },
                { id: 'A-E', from: 'A', to: 'E', label: '5', weight: 5 },
                { id: 'A-C', from: 'A', to: 'C', label: '3', weight: 3 },
                { id: 'A-D', from: 'A', to: 'D', label: '6', weight: 6 },
                { id: 'B-C', from: 'B', to: 'C', label: '2', weight: 2 },
                { id: 'B-E', from: 'B', to: 'E', label: '4', weight: 4 },
                { id: 'B-G', from: 'B', to: 'G', label: '7', weight: 7 },
                { id: 'C-D', from: 'C', to: 'D', label: '5', weight: 5 },
                { id: 'C-E', from: 'C', to: 'E', label: '1', weight: 1 },
                { id: 'C-F', from: 'C', to: 'F', label: '4', weight: 4 },
                { id: 'D-F', from: 'D', to: 'F', label: '2', weight: 2 },
                { id: 'E-G', from: 'E', to: 'G', label: '6', weight: 6 },
                { id: 'E-H', from: 'E', to: 'H', label: '3', weight: 3 },
                { id: 'E-F', from: 'E', to: 'F', label: '7', weight: 7 },
                { id: 'F-H', from: 'F', to: 'H', label: '4', weight: 4 },
                { id: 'F-J', from: 'F', to: 'J', label: '5', weight: 5 },
                { id: 'G-H', from: 'G', to: 'H', label: '2', weight: 2 },
                { id: 'G-I', from: 'G', to: 'I', label: '5', weight: 5 },
                { id: 'G-K', from: 'G', to: 'K', label: '3', weight: 3 },
                { id: 'H-I', from: 'H', to: 'I', label: '4', weight: 4 },
                { id: 'H-J', from: 'H', to: 'J', label: '6', weight: 6 },
                { id: 'I-K', from: 'I', to: 'K', label: '3', weight: 3 },
                { id: 'I-J', from: 'I', to: 'J', label: '2', weight: 2 },
                { id: 'I-L', from: 'I', to: 'L', label: '4', weight: 4 },
                { id: 'J-L', from: 'J', to: 'L', label: '3', weight: 3 },
                { id: 'K-M', from: 'K', to: 'M', label: '6', weight: 6 },
                { id: 'K-N', from: 'K', to: 'N', label: '5', weight: 5 },
                { id: 'L-N', from: 'L', to: 'N', label: '6', weight: 6 },
                { id: 'L-O', from: 'L', to: 'O', label: '5', weight: 5 },
                { id: 'M-N', from: 'M', to: 'N', label: '3', weight: 3 },
                { id: 'M-O', from: 'M', to: 'O', label: '7', weight: 7 },
                { id: 'N-O', from: 'N', to: 'O', label: '4', weight: 4 }
            ]);
        } else if (presetKey === 'redFloyd') {
            // Escenario de prueba oficial de 8 nodos (Red para resolver por Floyd)
            this.nodes.add([
                { id: 'A', label: 'A', x: -180, y: -160 },
                { id: 'B', label: 'B', x: 180, y: -160 },
                { id: 'H', label: 'H', x: -320, y: 0 },
                { id: 'C', label: 'C', x: 320, y: 0 },
                { id: 'G', label: 'G', x: -320, y: 160 },
                { id: 'F', label: 'F', x: -160, y: 160 },
                { id: 'E', label: 'E', x: 160, y: 160 },
                { id: 'D', label: 'D', x: 320, y: 160 }
            ]);
            this.edges.add([
                { id: 'A-B', from: 'A', to: 'B', label: '4', weight: 4, arrows: 'to', directed: true },
                { id: 'A-H', from: 'A', to: 'H', label: '8', weight: 8, arrows: 'to', directed: true },
                { id: 'A-F', from: 'A', to: 'F', label: '10', weight: 10, arrows: 'to', directed: true },
                { id: 'H-G', from: 'H', to: 'G', label: '3', weight: 3, arrows: 'to', directed: true },
                { id: 'H-F', from: 'H', to: 'F', label: '6', weight: 6, arrows: 'to', directed: true },
                { id: 'G-F', from: 'G', to: 'F', label: '2', weight: 2, arrows: 'to', directed: true },
                { id: 'F-B', from: 'F', to: 'B', label: '11', weight: 11, arrows: 'to', directed: true },
                { id: 'F-E', from: 'F', to: 'E', label: '1', weight: 1, arrows: 'to', directed: true },
                { id: 'B-E', from: 'B', to: 'E', label: '9', weight: 9, arrows: 'to', directed: true },
                { id: 'E-C', from: 'E', to: 'C', label: '3', weight: 3, arrows: 'to', directed: true },
                { id: 'E-D', from: 'E', to: 'D', label: '7', weight: 7, arrows: 'to', directed: true },
                { id: 'D-C', from: 'D', to: 'C', label: '4', weight: 4, arrows: 'to', directed: true },
                { id: 'C-B', from: 'C', to: 'B', label: '5', weight: 5, arrows: 'to', directed: true }
            ]);
        } else if (presetKey === 'redFloydIsac') {
            // RED EXCLUSIVA ISAC: Estructura base preparada. Reemplazable fácilmente al recibir la imagen de la profesora.
            this.nodes.add([
                { id: '1', label: '1', x: -200, y: -100 },
                { id: '2', label: '2', x: 0, y: -160 },
                { id: '3', label: '3', x: 200, y: -100 },
                { id: '4', label: '4', x: -200, y: 100 },
                { id: '5', label: '5', x: 0, y: 160 },
                { id: '6', label: '6', x: 200, y: 100 }
            ]);
            this.edges.add([
                { id: '1->2', from: '1', to: '2', label: '4', weight: 4, arrows: 'to', directed: true },
                { id: '1->4', from: '1', to: '4', label: '2', weight: 2, arrows: 'to', directed: true },
                { id: '2->3', from: '2', to: '3', label: '5', weight: 5, arrows: 'to', directed: true },
                { id: '2->5', from: '2', to: '5', label: '1', weight: 1, arrows: 'to', directed: true },
                { id: '3->6', from: '3', to: '6', label: '3', weight: 3, arrows: 'to', directed: true },
                { id: '4->5', from: '4', to: '5', label: '3', weight: 3, arrows: 'to', directed: true },
                { id: '5->3', from: '5', to: '3', label: '2', weight: 2, arrows: 'to', directed: true },
                { id: '5->6', from: '5', to: '6', label: '6', weight: 6, arrows: 'to', directed: true }
            ]);
        }

        this._recordHistory();

        setTimeout(() => {
            this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
        }, 100);
    }

    /**
     * Elimina todos los nodos y aristas y cancela una selección de conexión.
     * @returns {void}
     */
    clear(recordHistory = true) {
        if (recordHistory) this._recordHistory();
        this.formalLabels.clear();
        if (this.formalLabelLayer) this.formalLabelLayer.innerHTML = '';
        this.nodes.clear();
        this.edges.clear();
        this.selectedSourceNode = null;
        if (recordHistory) this._recordHistory();
    }
}