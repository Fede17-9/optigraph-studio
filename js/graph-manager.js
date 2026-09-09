/**
 * @fileoverview Gestor del lienzo interactivo Vis.js con soporte para
 * eliminación de nodos, edición/eliminación de arcos y prevención del menú nativo.
 */

class GraphManager {
    /**
     * @param {string} containerId ID del elemento HTML contenedor del lienzo.
     */
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        this.network = null;
        this.mode = 'select'; // 'select', 'add-node', 'add-edge'
        this.selectedSourceNode = null;
        this.onNodeCountChange = null;

        this._initNetwork();
    }

    _initNetwork() {
        // Bloquear menú contextual por defecto del navegador en el contenedor
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());

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
            physics: { enabled: false }, // Sin rebotes/física
            interaction: { 
                hover: true, 
                dragNodes: true, 
                zoomView: true,
                dragView: true
            }
        };

        this.network = new vis.Network(this.container, data, options);
        this._bindEvents();
    }

    _bindEvents() {
        // Clic izquierdo (Agregar nodo o conectar arcos)
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

        // Clic derecho (Menú de edición/eliminación)
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

        // Notificar cambios en la cantidad de nodos
        this.nodes.on('*', () => {
            if (typeof this.onNodeCountChange === 'function') {
                this.onNodeCountChange(this.nodes.length);
            }
        });
    }

    addNode(x, y) {
        const nextIdLetter = String.fromCharCode(65 + this.nodes.length);
        this.nodes.add({ id: nextIdLetter, label: nextIdLetter, x: x, y: y });
    }

    async promptAddEdge(fromNode, toNode) {
        const { value: weight } = await Swal.fire({
            title: `Conectar ${fromNode} ↔ ${toNode}`,
            input: 'number',
            inputLabel: 'Ingrese el peso o valor del arco:',
            inputPlaceholder: 'Ej. 5',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            inputValidator: (value) => {
                if (!value || isNaN(value) || parseFloat(value) <= 0) {
                    return 'Ingrese un número válido mayor a 0';
                }
            }
        });

        if (weight) {
            const edgeId = `${fromNode}-${toNode}`;
            const exists = this.edges.get().some(e => 
                (e.from === fromNode && e.to === toNode) || (e.from === toNode && e.to === fromNode)
            );

            if (exists) {
                Swal.fire('Atención', 'Ya existe una conexión entre estos nodos.', 'warning');
                return;
            }

            this.edges.add({
                id: edgeId,
                from: fromNode,
                to: toNode,
                label: String(weight),
                weight: parseFloat(weight)
            });
        }
    }

    /**
     * Modal para confirmar la eliminación de un solo nodo.
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
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            // Eliminar arcos conectados al nodo
            const connectedEdges = this.edges.get().filter(e => e.from === nodeId || e.to === nodeId);
            connectedEdges.forEach(e => this.edges.remove(e.id));
            
            // Eliminar el nodo
            this.nodes.remove(nodeId);

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
     * Modal para modificar el peso o borrar un arco individual.
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
            denyButtonColor: '#f43f5e'
        });

        if (result.isConfirmed) {
            // Modificar peso
            const { value: newWeight } = await Swal.fire({
                title: 'Nuevo Peso del Arco',
                input: 'number',
                inputValue: edge.weight,
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                inputValidator: (val) => {
                    if (!val || isNaN(val) || parseFloat(val) <= 0) {
                        return 'Ingrese un número válido mayor a 0';
                    }
                }
            });

            if (newWeight) {
                this.edges.update({
                    id: edgeId,
                    label: String(newWeight),
                    weight: parseFloat(newWeight)
                });
            }
        } else if (result.isDenied) {
            // Eliminar arco
            this.edges.remove(edgeId);
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

    highlightMST(mstEdges) {
        const mstEdgeIds = new Set(mstEdges.map(e => e.id));

        const updatedEdges = this.edges.get().map(edge => {
            const isSelected = mstEdgeIds.has(edge.id) || mstEdgeIds.has(`${edge.to}-${edge.from}`);
            return {
                id: edge.id,
                color: isSelected ? { color: '#10b981', highlight: '#34d399' } : { color: '#334155', opacity: 0.3 },
                width: isSelected ? 5 : 1
            };
        });

        this.edges.update(updatedEdges);
    }

    loadPresetNetwork(presetKey) {
        this.clear();

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
        }

        setTimeout(() => {
            this.network.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
        }, 100);
    }

    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.selectedSourceNode = null;
    }
}