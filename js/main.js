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
    let activeAlgorithm = 'mst';

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
    const btnEmptyNetwork = document.getElementById("btn-empty-network");
    const btnRandomNetwork = document.getElementById("btn-random-network");
    const btnUndo = document.getElementById("btn-undo");
    const btnRedo = document.getElementById("btn-redo");
    const btnExportReport = document.getElementById("btn-export-report");
    const graphFileInput = document.getElementById("graph-file-input");
    const iterationCountEl = document.getElementById("iteration-count");
    const tieCountEl = document.getElementById("tie-count");
    const toolsPanel = document.getElementById("tools-panel");
    const procedurePanel = document.getElementById("procedure-panel");
    const dijkstraModeEl = document.getElementById("dijkstra-mode");
    const btnAlgorithmMst = document.getElementById("btn-algorithm-mst");
    const btnAlgorithmDijkstra = document.getElementById("btn-algorithm-dijkstra");
    const procedureSubtitle = document.querySelector('#procedure-panel p');
    const totalWeightLabel = document.getElementById('total-weight-label');
    const legendPrimary = document.getElementById('legend-primary');
    const legendSecondary = document.getElementById('legend-secondary');
    const legendOther = document.getElementById('legend-other');
    const exportResultLabel = document.getElementById('export-result-label');

    const updateAlgorithmUi = () => {
        const isDijkstra = activeAlgorithm === 'dijkstra';
        document.body.classList.toggle('dijkstra-active', isDijkstra);
        btnSolve.innerHTML = isDijkstra ? '<span>⚡</span> <span>Resolver Dijkstra</span>' : '<span>⚡</span> <span>Resolver AEM</span>';
        if (procedureSubtitle) procedureSubtitle.innerHTML = isDijkstra ? 'Evolución de distancias y relajaciones' : 'Evolución de los conjuntos k, C<sub>k</sub> y C̄<sub>k</sub>';
        if (totalWeightLabel) totalWeightLabel.innerText = isDijkstra ? 'Distancia' : 'Peso total AEM';
        if (legendPrimary) legendPrimary.innerHTML = isDijkstra ? '<i class="legend-line legend-line-dijkstra"></i>Ruta mínima' : '<i class="legend-line legend-line-mst"></i>AEM';
        if (legendSecondary) legendSecondary.innerHTML = isDijkstra ? '<i class="legend-line legend-line-relaxed"></i>Relajada' : '<i class="legend-line legend-line-tie"></i>Empate';
        if (legendOther) legendOther.innerHTML = '<i class="legend-line legend-line-other"></i>Sin seleccionar';
        if (exportResultLabel) exportResultLabel.innerText = isDijkstra ? 'Exportar Dijkstra' : 'Exportar AEM';
    };

    const modalClasses = graphManager.getModalClasses();

    const updateHistoryButtons = () => {
        btnUndo.disabled = !graphManager.canUndo();
        btnRedo.disabled = !graphManager.canRedo();
    };

    graphManager.onGraphChange = updateHistoryButtons;
    updateHistoryButtons();

    btnAlgorithmMst.addEventListener("click", () => {
        activeAlgorithm = 'mst';
        btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
        btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        graphManager.resetVisualStyles();
        updateAlgorithmUi();
        resetUI();
    });

    btnAlgorithmDijkstra.addEventListener("click", () => {
        activeAlgorithm = 'dijkstra';
        btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
        btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        graphManager.resetVisualStyles();
        updateAlgorithmUi();
        resetUI();
    });

    updateAlgorithmUi();

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
        updateHistoryButtons();
    });

    btnEmptyNetwork.addEventListener("click", async () => {
        const { value: nodeCount } = await Swal.fire({
            title: 'Crear red vacía',
            text: 'Indique cuántos nodos desea colocar en el lienzo.',
            input: 'number',
            inputValue: 6,
            inputAttributes: { min: 2, max: 50, step: 1 },
            showCancelButton: true,
            confirmButtonText: 'Crear red',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            customClass: modalClasses,
            inputValidator: value => {
                if (!Number.isInteger(Number(value)) || Number(value) < 2 || Number(value) > 50) {
                    return 'Ingrese un número entero entre 2 y 50.';
                }
            }
        });
        if (!nodeCount) return;
        graphManager.createEmptyNetwork(Number(nodeCount));
        resetUI();
        updateHistoryButtons();
        setActiveToolButton(btnAddEdge);
        graphManager.mode = 'add-edge';
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Red creada. Conecte sus nodos.', showConfirmButton: false, timer: 2500 });
    });

    btnRandomNetwork.addEventListener("click", async () => {
        const { value: randomConfig } = await Swal.fire({
            title: 'Generar red aleatoria',
            html: `
                <label class="og-form-label" for="random-node-count">Cantidad de nodos</label>
                <input id="random-node-count" class="og-modal-input" type="number" min="2" max="50" value="8">
                <label class="og-form-label" for="random-density">Densidad adicional (%)</label>
                <input id="random-density" class="og-modal-input" type="number" min="0" max="100" value="35">
                <label class="og-form-label" for="random-max-weight">Peso máximo</label>
                <input id="random-max-weight" class="og-modal-input" type="number" min="1" max="999" value="20">
            `,
            showCancelButton: true,
            confirmButtonText: 'Generar red',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            customClass: modalClasses,
            preConfirm: () => {
                const nodeCount = Number(document.getElementById('random-node-count').value);
                const density = Number(document.getElementById('random-density').value);
                const maxWeight = Number(document.getElementById('random-max-weight').value);
                if (!Number.isInteger(nodeCount) || nodeCount < 2 || nodeCount > 50 || density < 0 || density > 100 || !Number.isInteger(maxWeight) || maxWeight < 1 || maxWeight > 999) {
                    Swal.showValidationMessage('Revise los valores: nodos 2-50, densidad 0-100 y peso 1-999.');
                    return null;
                }
                return { nodeCount, density: density / 100, maxWeight };
            }
        });
        if (!randomConfig) return;
        graphManager.createRandomNetwork(randomConfig.nodeCount, randomConfig.density, randomConfig.maxWeight);
        resetUI();
        updateHistoryButtons();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Red aleatoria conexa generada', showConfirmButton: false, timer: 2200 });
    });

    btnUndo.addEventListener("click", () => {
        if (graphManager.undo()) resetUI();
        updateHistoryButtons();
    });

    btnRedo.addEventListener("click", () => {
        if (graphManager.redo()) resetUI();
        updateHistoryButtons();
    });

    btnImport.addEventListener("click", () => graphFileInput.click());

    graphFileInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const graphData = JSON.parse(await file.text());
            const importedSolution = graphManager.importGraph(graphData);
            resetUI();
            if (importedSolution?.result) {
                lastSolveResult = importedSolution.result;
                lastStartNode = importedSolution.startNode;
                activeAlgorithm = importedSolution.result.algorithm || graphData.algorithm || 'mst';
                updateAlgorithmUi();
                if (activeAlgorithm === 'dijkstra') {
                    restoreDijkstraView(importedSolution.result);
                } else {
                    restoreSolutionView(importedSolution.result);
                }
            }
            updateHistoryButtons();
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
                title: 'Aún no hay un resultado calculado',
                text: 'Resuelva la red antes de exportar su resultado.',
                confirmButtonColor: '#10b981',
                customClass: graphManager.getModalClasses()
            });
            return;
        }

        const isDijkstra = activeAlgorithm === 'dijkstra';
        downloadJson(isDijkstra ? 'optigraph-dijkstra.json' : 'optigraph-aem.json', {
            version: 2,
            algorithm: isDijkstra ? 'dijkstra' : 'mst',
            exportedAt: new Date().toISOString(),
            graph: graphManager.getGraphData(),
            result: isDijkstra ? lastSolveResult : {
                startNode: lastStartNode,
                selectedEdges: lastSolveResult.selectedEdges,
                tiedEdges: lastSolveResult.tiedEdges,
                totalWeight: lastSolveResult.totalWeight,
                stepTable: lastSolveResult.stepTable
            }
        });
    });

    btnExportReport.addEventListener("click", () => {
        if (!lastSolveResult) {
            Swal.fire({ icon: 'info', title: 'Aún no hay un AEM calculado', text: 'Resuelva la red antes de exportar el reporte.', confirmButtonColor: '#10b981', customClass: modalClasses });
            return;
        }
        if (activeAlgorithm === 'dijkstra') {
            downloadDijkstraReport('optigraph-reporte-dijkstra.html', graphManager.getGraphData(), lastSolveResult);
        } else {
            downloadReport('optigraph-reporte-aem.html', graphManager.getGraphData(), lastStartNode, lastSolveResult);
        }
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

        if (activeAlgorithm === 'dijkstra') {
            await solveDijkstra(nodes, edges);
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

            restoreSolutionView(result);

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
                Haga clic en "Resolver ${activeAlgorithm === 'dijkstra' ? 'Dijkstra' : 'AEM'}" para generar la secuencia de iteraciones.
            </div>`;
        const statusEl = document.getElementById("status-indicator");
        statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300";
        statusEl.innerText = "⚪ Esperando red...";
        updateHistoryButtons();
    }

    /**
     * Restaura en la interfaz una solución AEM importada o recién calculada.
     * @param {Object} result Resultado producido por MSTSolver.
     * @returns {void}
     */
    function restoreSolutionView(result) {
        graphManager.highlightMST(result.selectedEdges, result.tiedEdges);
        renderProcedureSteps(result.stepTable);
        const statusEl = document.getElementById("status-indicator");
        statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm";
        statusEl.innerText = "🟢 RED CONEXA — AEM CALCULADO";
        if (totalWeightEl) totalWeightEl.innerText = `${result.totalWeight} u`;
        if (iterationCountEl) iterationCountEl.innerText = result.stepTable.length;
        if (tieCountEl) tieCountEl.innerText = result.tiedEdges.length;
    }

    /**
     * Restaura una solucion Dijkstra importada en el canvas y el panel.
     * @param {Object} result Resultado serializado de Dijkstra.
     * @returns {void}
     */
    function restoreDijkstraView(result) {
        graphManager.highlightDijkstra(result);
        renderDijkstraSteps(result.stepTable);
        document.getElementById('status-indicator').className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm';
        document.getElementById('status-indicator').innerText = '🟢 DIJKSTRA CALCULADO';
        if (totalWeightEl) totalWeightEl.innerText = result.targetNode === null ? '—' : `${result.distances[result.targetNode]} u`;
        if (iterationCountEl) iterationCountEl.innerText = result.stepTable.length;
        if (tieCountEl) tieCountEl.innerText = result.stepTable.filter(step => step.tieDescription).length;
    }

    /**
     * Solicita origen y destino/modo y ejecuta Dijkstra sobre la red actual.
     * @param {Object[]} nodes Nodos actuales.
     * @param {Object[]} edges Aristas actuales.
     * @returns {Promise<void>} Promesa de la resolucion y presentacion.
     */
    async function solveDijkstra(nodes, edges) {
        const optionsHtml = nodes.map(node => `<option value="${node.id}">Nodo ${node.label}</option>`).join('');
        const { value: config } = await Swal.fire({
            title: 'Configurar Dijkstra',
            html: `
                <label class="og-form-label" for="dijkstra-start">Nodo de origen</label>
                <select id="dijkstra-start" class="og-modal-input">${optionsHtml}</select>
                <div id="dijkstra-target-wrapper">
                    <label class="og-form-label" for="dijkstra-target">Nodo de destino</label>
                    <select id="dijkstra-target" class="og-modal-input">${optionsHtml}</select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Resolver Dijkstra',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            customClass: modalClasses,
            didOpen: () => {
                const mode = dijkstraModeEl.value;
                document.getElementById('dijkstra-target-wrapper').style.display = mode === 'target' ? 'block' : 'none';
            },
            preConfirm: () => ({
                startNode: document.getElementById('dijkstra-start').value,
                targetNode: dijkstraModeEl.value === 'target' ? document.getElementById('dijkstra-target').value : null
            })
        });
        if (!config) return;

        try {
            const result = new DijkstraSolver(nodes, edges).solve(config.startNode, config.targetNode);
            lastSolveResult = result;
            lastStartNode = config.startNode;
            graphManager.highlightDijkstra(result);
            renderDijkstraSteps(result.stepTable);
            document.getElementById('status-indicator').className = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm';
            document.getElementById('status-indicator').innerText = '🟢 DIJKSTRA CALCULADO';
            if (totalWeightEl) totalWeightEl.innerText = config.targetNode === null ? '—' : `${result.distances[config.targetNode]} u`;
            if (iterationCountEl) iterationCountEl.innerText = result.stepTable.length;
            if (tieCountEl) tieCountEl.innerText = result.stepTable.filter(step => step.tieDescription).length;
            Swal.fire({ icon: 'success', title: '¡Dijkstra calculado!', text: config.targetNode === null ? 'Se calcularon las distancias desde el nodo de origen.' : `Distancia mínima: ${result.distances[config.targetNode]} unidades.`, confirmButtonColor: '#10b981', customClass: { ...modalClasses, confirmButton: 'og-modal-confirm' } });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'No se pudo ejecutar Dijkstra', text: error.message, confirmButtonColor: '#f43f5e', customClass: { ...modalClasses, confirmButton: 'og-modal-deny' } });
        }
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

/**
 * Genera un reporte HTML autocontenido que puede abrirse o imprimirse como PDF.
 * @param {string} filename Nombre del archivo descargado.
 * @param {Object} graphData Red utilizada en la solución.
 * @param {string|number} startNode Nodo inicial de Prim.
 * @param {Object} result Resultado completo del AEM.
 * @returns {void}
 */
function downloadReport(filename, graphData, startNode, result) {
    const steps = result.stepTable.map(step => `
        <tr><td>${step.iteration}</td><td>{ ${step.Ck} }</td><td>{ ${step.Cbar} }</td><td>${step.selectedEdge}</td><td>${step.weight}</td><td>${step.tieDescription || '—'}</td></tr>
    `).join('');
    const report = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Reporte AEM</title><style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:1100px;margin:2rem auto;padding:0 1rem}h1{color:#047857}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#d1fae5}.summary{display:flex;gap:2rem;margin:1rem 0;font-weight:bold}</style></head><body><h1>OptiGraph Studio — Reporte AEM</h1><div class="summary"><span>Nodo inicial: ${startNode}</span><span>Peso total: ${result.totalWeight}</span><span>Iteraciones: ${result.stepTable.length}</span><span>Empates: ${result.tiedEdges.length}</span></div><p>Nodos: ${graphData.nodes.length} · Aristas: ${graphData.edges.length}</p><table><thead><tr><th>Paso</th><th>C_k</th><th>C̄_k</th><th>Arista elegida</th><th>Peso</th><th>Empate</th></tr></thead><tbody>${steps}</tbody></table></body></html>`;
    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 100);
}

/**
 * Renderiza la tabla de distancias y relajaciones de Dijkstra.
 * @param {Object[]} stepTable Pasos producidos por DijkstraSolver.
 * @returns {void}
 */
function renderDijkstraSteps(stepTable) {
    const container = document.getElementById('steps-container');
    if (!container) return;
    container.innerHTML = '';
    stepTable.forEach(step => {
        const card = document.createElement('div');
        card.className = 'step-card bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-1.5 shadow mb-2';

        // AQUÍ: Le pasamos el mapa de iteraciones guardado en la iteración
        const distances = formatDijkstraDistanceTable(step.distances, step.predecessors, step.permanentIterations || {});

        const relaxations = step.relaxedEdges.length > 0 ? step.relaxedEdges.map(item => `${item.nodeId} (${item.distance})`).join(', ') : 'Ninguna';
        card.innerHTML = `<div class="flex justify-between items-center border-b border-slate-800 pb-1"><span class="text-xs font-bold text-emerald-400">Paso k = ${step.iteration}</span><span class="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Procesado: ${step.currentNode}</span></div><div class="text-[11px] font-mono text-slate-300 space-y-0.5 mt-1"><p><span class="text-slate-500">Distancias:</span> { ${distances} }</p><p><span class="text-slate-500">Relajaciones:</span> ${relaxations}</p>${step.tieDescription ? `<p class="text-sky-300">${step.tieDescription}</p>` : ''}</div>`;
        container.appendChild(card);
    });
}

/**
 * Formatea la tabla academica de Dijkstra con distancia y predecesor.
 * El nodo origen o un nodo aun no alcanzable usa `-` como predecesor.
 *
 * @param {Object.<string, number>} distances Distancias conocidas por nodo.
 * @param {Object.<string, (string|number|null)>} predecessors Predecesores actuales.
 * @returns {string} Texto con el formato `Nodo: [Dist, Previo]`.
 */
/**
 * Formatea la tabla académica de Dijkstra con la notación formal [u_j, pred]_(k).
 */
function formatDijkstraDistanceTable(distances, predecessors, permanentIterations = {}) {
    return Object.entries(distances).map(([node, distance]) => {
        const formattedDistance = distance === Infinity ? '∞' : distance;
        const predecessor = predecessors[node] === null || predecessors[node] === undefined ? '-' : predecessors[node];
        const iter = (permanentIterations && permanentIterations[node] !== null && permanentIterations[node] !== undefined)
            ? permanentIterations[node]
            : '-';
        return `${node}: [${formattedDistance}, ${predecessor}]_(${iter})`;
    }).join(', ');
}

/**
 * Genera un reporte HTML para un resultado de Dijkstra.
 * @param {string} filename Nombre del archivo.
 * @param {Object} graphData Red utilizada.
 * @param {Object} result Resultado de Dijkstra.
 * @returns {void}
 */
function downloadDijkstraReport(filename, graphData, result) {
    const steps = result.stepTable.map(step => {
        const distances = formatDijkstraDistanceTable(step.distances, step.predecessors, step.permanentIterations);
        const relaxed = step.relaxedEdges.map(item => `${item.nodeId} (${item.distance})`).join(', ') || 'Ninguna';
        return `<tr><td>${step.iteration}</td><td>${step.currentNode}</td><td>${distances}</td><td>${relaxed}</td><td>${step.tieDescription || '—'}</td></tr>`;
    }).join('');
    const destination = result.targetNode === null ? 'Todos los nodos' : result.targetNode;
    const distance = result.targetNode === null ? '—' : result.distances[result.targetNode];
    const report = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Dijkstra</title><style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:1100px;margin:2rem auto;padding:0 1rem}h1{color:#047857}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}th{background:#d1fae5}.summary{display:flex;gap:2rem;margin:1rem 0;font-weight:bold;flex-wrap:wrap}</style></head><body><h1>OptiGraph Studio — Reporte Dijkstra</h1><div class="summary"><span>Origen: ${result.startNode}</span><span>Destino: ${destination}</span><span>Distancia: ${distance}</span><span>Pasos: ${result.stepTable.length}</span></div><p>Nodos: ${graphData.nodes.length} · Aristas: ${graphData.edges.length}</p><table><thead><tr><th>Paso</th><th>Nodo procesado</th><th>Distancias [Dist, Previo]</th><th>Relajaciones</th><th>Empate</th></tr></thead><tbody>${steps}</tbody></table></body></html>`;
    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 100);
}