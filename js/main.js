/**
 * @file js/main.js
 * @module ApplicationController
 * @fileoverview Punto de entrada de la aplicación. Orquesta la interfaz HTML,
 * los modales SweetAlert2, GraphManager y MSTSolver, además de coordinar
 * persistencia, exportaciones, métricas y visualización del procedimiento.
 */

/**
 * Inicializa la aplicación cuando el árbol DOM está disponible.
 * Este controlador conserva el estado de la última ejecución del AEM para
 * mostrarlo en métricas, exportarlo y renderizar su bitácora educativa.
 * @returns {void}
 */
document.addEventListener("DOMContentLoaded", () => {
    const graphManager = new GraphManager("canvas-container");
    let lastSolveResult = null;
    let lastStartNode = null;

    // Enlazar las métricas reactivas de GraphManager con la barra inferior.
    const nodeCountEl = document.getElementById("node-count");
    const totalWeightEl = document.getElementById("total-weight");
    graphManager.onNodeCountChange = (count) => {
        if (nodeCountEl) nodeCountEl.innerText = count;
    };

    // --- Control de herramientas, persistencia y navegación responsive ---
    const btnAddNode = document.getElementById("btn-add-node");
    const btnAddEdge = document.getElementById("btn-add-edge");
    const btnClear = document.getElementById("btn-clear");
    const btnSolve = document.getElementById("btn-solve");
    const selectDemo = document.getElementById("select-demo");
    const btnImport = document.getElementById("btn-import");
    const btnExportNetwork = document.getElementById("btn-export-network");
    const btnExportResult = document.getElementById("btn-export-result");
    const btnResetView = document.getElementById("btn-reset-view");
    const graphFileInput = document.getElementById("graph-file-input");
    const iterationCountEl = document.getElementById("iteration-count");
    const tieCountEl = document.getElementById("tie-count");
    const toolsPanel = document.getElementById("tools-panel");
    const procedurePanel = document.getElementById("procedure-panel");

    btnAddNode.addEventListener("click", () => {
        graphManager.mode = 'add-node';
        setActiveToolButton(btnAddNode);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Haga clic en cualquier punto del lienzo para crear un nodo.',
            showConfirmButton: false,
            timer: 2500
        });
    });

    btnAddEdge.addEventListener("click", () => {
        graphManager.mode = 'add-edge';
        graphManager.selectedSourceNode = null;
        setActiveToolButton(btnAddEdge);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Haga clic en el nodo origen y luego en el nodo destino.',
            showConfirmButton: false,
            timer: 2500
        });
    });

    btnClear.addEventListener("click", () => {
        graphManager.clear();
        resetUI();
    });

    selectDemo.addEventListener("change", (e) => {
        graphManager.loadPresetNetwork(e.target.value);
        resetUI();
    });

    btnImport.addEventListener("click", () => graphFileInput.click());

    graphFileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const graphData = JSON.parse(await file.text());
            graphManager.importGraph(graphData);
            resetUI();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Red importada correctamente',
                showConfirmButton: false,
                timer: 2200
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo importar la red',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: {
                    popup: 'og-modal',
                    title: 'og-modal-title',
                    htmlContainer: 'og-modal-text',
                    confirmButton: 'og-modal-deny'
                }
            });
        } finally {
            graphFileInput.value = '';
        }
    });

    btnExportNetwork.addEventListener("click", () => {
        downloadJson('optigraph-red.json', graphManager.getGraphData());
    });

    btnExportResult.addEventListener("click", () => {
        if (!lastSolveResult) {
            Swal.fire({
                icon: 'info',
                title: 'Aún no hay un AEM calculado',
                text: 'Resuelva la red antes de exportar su resultado.',
                confirmButtonColor: '#10b981',
                customClass: graphManager.getModalClasses()
            });
            return;
        }

        downloadJson('optigraph-aem.json', {
            version: 1,
            exportedAt: new Date().toISOString(),
            graph: graphManager.getGraphData(),
            result: {
                startNode: lastStartNode,
                selectedEdges: lastSolveResult.selectedEdges,
                tiedEdges: lastSolveResult.tiedEdges,
                totalWeight: lastSolveResult.totalWeight,
                stepTable: lastSolveResult.stepTable
            }
        });
    });

    btnResetView.addEventListener("click", () => {
        graphManager.resetVisualStyles();
        resetUI();
    });

    document.getElementById("btn-toggle-tools").addEventListener("click", () => {
        toolsPanel.classList.toggle("is-collapsed");
    });

    document.getElementById("btn-toggle-procedure").addEventListener("click", () => {
        procedurePanel.classList.toggle("is-collapsed");
    });

    // --- Resolver AEM mediante Prim y presentar su resultado ---
    btnSolve.addEventListener("click", async () => {
        const nodes = graphManager.nodes.get();
        const edges = graphManager.edges.get();

        if (nodes.length < 2) {
            Swal.fire({
                icon: 'warning',
                title: 'Red Incompleta',
                text: 'Debe ingresar al menos 2 nodos y sus conexiones para ejecutar el algoritmo.',
                confirmButtonColor: '#10b981',
                customClass: {
                    popup: 'og-modal',
                    title: 'og-modal-title',
                    htmlContainer: 'og-modal-text',
                    confirmButton: 'og-modal-confirm'
                }
            });
            return;
        }

        // Generar dinámicamente las opciones del nodo de origen a partir del grafo actual.
        const optionsHtml = nodes.map(n => `<option value="${n.id}">Nodo ${n.label}</option>`).join('');

        const { value: selectedStartNode } = await Swal.fire({
            title: 'Seleccionar Nodo Inicial',
            html: `
                <p class="text-xs text-slate-300 mb-3">Elija el nodo origen desde el cual comenzará la expansión del AEM:</p>
                <select id="swal-start-node" class="swal2-input text-sm font-mono text-slate-900">
                    ${optionsHtml}
                </select>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Resolver AEM',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            customClass: {
                popup: 'og-modal',
                title: 'og-modal-title',
                htmlContainer: 'og-modal-text',
                input: 'og-modal-input',
                confirmButton: 'og-modal-confirm',
                cancelButton: 'og-modal-cancel'
            },
            preConfirm: () => {
                return document.getElementById('swal-start-node').value;
            }
        });

        if (!selectedStartNode) return;

        const solver = new MSTSolver(nodes, edges);

        try {
            const result = solver.solvePrim(selectedStartNode);
            lastSolveResult = result;
            lastStartNode = selectedStartNode;

            // 1. Transferir la solución a Vis.js: AEM sólido y empates punteados.
            graphManager.highlightMST(result.selectedEdges, result.tiedEdges);

            // 2. Renderizar la bitácora de conjuntos C_k, C̄_k y decisiones.
            renderProcedureSteps(result.stepTable);

            // 3. Actualizar estado, costo total, iteraciones y cantidad de empates.
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm";
            statusEl.innerText = "🟢 RED CONEXA — AEM CALCULADO";
            if (totalWeightEl) totalWeightEl.innerText = `${result.totalWeight} u`;
            if (iterationCountEl) iterationCountEl.innerText = result.stepTable.length;
            if (tieCountEl) tieCountEl.innerText = result.tiedEdges.length;

            Swal.fire({
                icon: 'success',
                title: '¡AEM Calculado con Éxito!',
                text: `Iniciando desde Nodo (${selectedStartNode}), el peso total del árbol es de ${result.totalWeight} unidades.`,
                confirmButtonColor: '#10b981',
                customClass: {
                    popup: 'og-modal',
                    title: 'og-modal-title',
                    htmlContainer: 'og-modal-text',
                    confirmButton: 'og-modal-confirm'
                }
            });

        } catch (error) {
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-900/60 text-rose-300 border border-rose-600 shadow-sm";
            statusEl.innerText = "🔴 RED NO CONEXA";

            Swal.fire({
                icon: 'error',
                title: 'Error de Conexidad',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: {
                    popup: 'og-modal',
                    title: 'og-modal-title',
                    htmlContainer: 'og-modal-text',
                    confirmButton: 'og-modal-deny'
                }
            });
        }
    });

    /**
     * Marca visualmente la herramienta de edición activa.
     * @param {HTMLElement} activeBtn Botón que representa la herramienta elegida.
     * @returns {void}
     */
    function setActiveToolButton(activeBtn) {
        [btnAddNode, btnAddEdge].forEach(btn => btn.classList.remove("border-emerald-500", "bg-slate-600"));
        activeBtn.classList.add("border-emerald-500", "bg-slate-600");
    }

    /**
     * Restablece el estado visual de la interfaz después de limpiar, importar,
     * cargar un preset o solicitar un nuevo cálculo.
     * @returns {void}
     */
    function resetUI() {
        if (nodeCountEl) nodeCountEl.innerText = graphManager.nodes.length;
        if (totalWeightEl) totalWeightEl.innerText = "—";
        if (iterationCountEl) iterationCountEl.innerText = "—";
        if (tieCountEl) tieCountEl.innerText = "—";
        lastSolveResult = null;
        lastStartNode = null;
        document.getElementById("steps-container").innerHTML = `
            <div class="text-center py-12 text-slate-500 text-xs">
                Haga clic en "Resolver AEM" para generar la secuencia de iteraciones.
            </div>`;
        const statusEl = document.getElementById("status-indicator");
        statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300";
        statusEl.innerText = "⚪ Esperando red...";
    }
});

/**
 * Descarga un objeto JavaScript como archivo JSON desde el navegador.
 * Se utiliza tanto para la red editable como para el resultado completo del AEM.
 *
 * @param {string} filename Nombre sugerido para el archivo descargado.
 * @param {Object} data Datos serializables que se convertirán a JSON.
 * @returns {void}
 */
function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
    }, 100);
}

/**
 * Renderiza la secuencia formal de iteraciones en el panel lateral derecho.
 * Cada tarjeta representa un paso de Prim e incluye la frontera entre C_k y C̄_k,
 * la arista elegida y, cuando corresponde, la explicación del empate de peso mínimo.
 *
 * @param {Array<Object>} stepTable Registros de iteración producidos por MSTSolver.
 * @returns {void}
 */
function renderProcedureSteps(stepTable) {
    const container = document.getElementById("steps-container");
    container.innerHTML = "";

    stepTable.forEach(step => {
        const stepCard = document.createElement("div");
        stepCard.className = "step-card bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-1.5 shadow";
        
        stepCard.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-800 pb-1">
                <span class="text-xs font-bold text-emerald-400">Paso k = ${step.iteration}</span>
                <span class="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    Peso: ${step.weight}
                </span>
            </div>
            <div class="text-[11px] font-mono text-slate-300 space-y-0.5">
                <p><span class="text-slate-500">C<sub>${step.iteration}</sub>:</span> { ${step.Ck} }</p>
                <p><span class="text-slate-500">C̄<sub>${step.iteration}</sub>:</span> { ${step.Cbar} }</p>
                <p><span class="text-slate-500">Arco elegido:</span> <strong class="text-emerald-300">${step.selectedEdge}</strong></p>
                ${step.tieDescription ? `<p class="text-sky-300">${step.tieDescription}</p>` : ''}
            </div>
        `;
        container.appendChild(stepCard);
    });
}