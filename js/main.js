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
    const btnAlgorithmFloyd = document.getElementById("btn-algorithm-floyd");
    const btnAlgorithmFloydIsac = document.getElementById("btn-algorithm-floyd-isac");
    const floydStartNode = document.getElementById("floyd-start-node");
    const floydTargetNode = document.getElementById("floyd-target-node");
    const btnFloydQueryPath = document.getElementById("btn-floyd-query-path");
    const floydRouteResultContainer = document.getElementById("floyd-route-result-container");
    const floydIsacModeEl = document.getElementById("floyd-isac-mode");
    const floydIsacStartNode = document.getElementById("floyd-isac-start-node");
    const floydIsacTargetNode = document.getElementById("floyd-isac-target-node");
    const btnFloydIsacQueryPath = document.getElementById("btn-floyd-isac-query-path");
    const floydIsacRouteResultContainer = document.getElementById("floyd-isac-route-result-container");
    const floydControls = document.getElementById("floyd-controls");
    const floydIsacControls = document.getElementById("floyd-isac-controls");
    const procedureSubtitle = document.querySelector('#procedure-panel p');
    const totalWeightLabel = document.getElementById('total-weight-label');
    const legendPrimary = document.getElementById('legend-primary');
    const legendSecondary = document.getElementById('legend-secondary');
    const legendOther = document.getElementById('legend-other');
    const exportResultLabel = document.getElementById('export-result-label');

    let currentFloydSolver = null;
    let currentFloydIsacSolver = null;

    const populateFloydNodeSelects = () => {
        const nodes = graphManager.nodes.get();
        const optionsHtml = [
            '<option value="" disabled selected>Seleccione nodo...</option>',
            ...nodes.map(n => `<option value="${n.id}">Nodo ${n.label || n.id}</option>`)
        ].join('');

        if (floydStartNode && floydTargetNode) {
            const prevStart = floydStartNode.value;
            const prevTarget = floydTargetNode.value;
            floydStartNode.innerHTML = optionsHtml;
            floydTargetNode.innerHTML = optionsHtml;
            if (nodes.some(n => n.id === prevStart)) floydStartNode.value = prevStart;
            if (nodes.some(n => n.id === prevTarget)) floydTargetNode.value = prevTarget;
        }

        if (floydIsacStartNode && floydIsacTargetNode) {
            const prevStartIsac = floydIsacStartNode.value;
            const prevTargetIsac = floydIsacTargetNode.value;
            floydIsacStartNode.innerHTML = optionsHtml;
            floydIsacTargetNode.innerHTML = optionsHtml;
            if (nodes.some(n => n.id === prevStartIsac)) floydIsacStartNode.value = prevStartIsac;
            if (nodes.some(n => n.id === prevTargetIsac)) floydIsacTargetNode.value = prevTargetIsac;
        }
    };

    const updateAlgorithmUi = () => {
        const isDijkstra = activeAlgorithm === 'dijkstra';
        const isFloyd = activeAlgorithm === 'floyd';
        const isFloydIsac = activeAlgorithm === 'floyd-isac';

        document.body.classList.toggle('dijkstra-active', isDijkstra);
        document.body.classList.toggle('floyd-active', isFloyd);
        document.body.classList.toggle('floyd-isac-active', isFloydIsac);

        if (floydControls) floydControls.style.display = isFloyd ? 'block' : 'none';
        if (floydIsacControls) floydIsacControls.style.display = isFloydIsac ? 'block' : 'none';

        btnSolve.innerHTML = isFloydIsac
            ? '<span>⚡</span> <span>Resolver Floyd (Isac)</span>'
            : isFloyd
                ? '<span>⚡</span> <span>Resolver Floyd (Fede)</span>'
                : isDijkstra
                    ? '<span>⚡</span> <span>Resolver Dijkstra</span>'
                    : '<span>⚡</span> <span>Resolver AEM</span>';

        if (procedureSubtitle) {
            procedureSubtitle.innerHTML = isFloydIsac
                ? 'Matrices D<sup>(k)</sup> y Predecesores Π<sup>(k)</sup> (Isac)'
                : isFloyd
                    ? 'Matrices paso a paso D<sup>(k)</sup> y P<sup>(k)</sup> (Fede)'
                    : isDijkstra
                        ? 'Evolución de distancias y relajaciones'
                        : 'Evolución de los conjuntos k, C<sub>k</sub> y C̄<sub>k</sub>';
        }

        if (totalWeightLabel) {
            totalWeightLabel.innerText = (isFloyd || isFloydIsac) ? 'Dist. Ruta' : isDijkstra ? 'Distancia' : 'Peso total AEM';
        }

        if (legendPrimary) {
            legendPrimary.innerHTML = (isFloyd || isFloydIsac)
                ? '<i class="legend-line legend-line-floyd"></i>Ruta Floyd'
                : isDijkstra
                    ? '<i class="legend-line legend-line-dijkstra"></i>Ruta mínima'
                    : '<i class="legend-line legend-line-mst"></i>AEM';
        }

        if (legendSecondary) {
            legendSecondary.innerHTML = (isFloyd || isFloydIsac)
                ? '<i class="legend-line legend-line-other"></i>Sin ruta'
                : isDijkstra
                    ? '<i class="legend-line legend-line-relaxed"></i>Relajada'
                    : '<i class="legend-line legend-line-tie"></i>Empate';
        }

        if (legendOther) legendOther.innerHTML = '<i class="legend-line legend-line-other"></i>Sin seleccionar';

        if (exportResultLabel) {
            exportResultLabel.innerText = isFloydIsac ? 'Exportar Floyd (Isac)' : isFloyd ? 'Exportar Floyd (Fede)' : isDijkstra ? 'Exportar Dijkstra' : 'Exportar AEM';
        }

        populateFloydNodeSelects();
    };

    const modalClasses = graphManager.getModalClasses();

    const updateHistoryButtons = () => {
        btnUndo.disabled = !graphManager.canUndo();
        btnRedo.disabled = !graphManager.canRedo();
        populateFloydNodeSelects();
    };

    graphManager.onGraphChange = updateHistoryButtons;
    updateHistoryButtons();

    btnAlgorithmMst.addEventListener("click", () => {
        activeAlgorithm = 'mst';
        btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
        btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        if (btnAlgorithmFloyd) btnAlgorithmFloyd.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        if (btnAlgorithmFloydIsac) btnAlgorithmFloydIsac.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        graphManager.resetVisualStyles();
        updateAlgorithmUi();
        resetUI();
    });

    btnAlgorithmDijkstra.addEventListener("click", () => {
        activeAlgorithm = 'dijkstra';
        btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
        btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        if (btnAlgorithmFloyd) btnAlgorithmFloyd.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        if (btnAlgorithmFloydIsac) btnAlgorithmFloydIsac.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
        graphManager.resetVisualStyles();
        updateAlgorithmUi();
        resetUI();
    });

    if (btnAlgorithmFloyd) {
        btnAlgorithmFloyd.addEventListener("click", () => {
            activeAlgorithm = 'floyd';
            btnAlgorithmFloyd.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
            btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
            btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
            if (btnAlgorithmFloydIsac) btnAlgorithmFloydIsac.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
            graphManager.resetVisualStyles();
            updateAlgorithmUi();
            resetUI();
        });
    }

    if (btnAlgorithmFloydIsac) {
        btnAlgorithmFloydIsac.addEventListener("click", () => {
            activeAlgorithm = 'floyd-isac';
            btnAlgorithmFloydIsac.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-900 shadow';
            btnAlgorithmMst.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
            btnAlgorithmDijkstra.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';
            if (btnAlgorithmFloyd) btnAlgorithmFloyd.className = 'px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-500';

            // Cargar la red exclusiva de Isac si el lienzo está en blanco o recién iniciado
            if (graphManager.nodes.length === 0) {
                graphManager.loadPresetNetwork('redFloydIsac');
            } else {
                graphManager.resetVisualStyles();
            }

            updateAlgorithmUi();
            resetUI();
        });
    }

    if (floydIsacModeEl) {
        floydIsacModeEl.addEventListener('change', () => {
            const isAll = floydIsacModeEl.value === 'all';
            const wrapper = document.getElementById('floyd-isac-target-wrapper');
            if (wrapper) wrapper.style.display = isAll ? 'none' : 'block';
        });
    }

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
                if (activeAlgorithm === 'floyd-isac') {
                    restoreFloydIsacView(importedSolution.result);
                } else if (activeAlgorithm === 'floyd') {
                    restoreFloydView(importedSolution.result);
                } else if (activeAlgorithm === 'dijkstra') {
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

        const isFloydIsac = activeAlgorithm === 'floyd-isac';
        const isFloyd = activeAlgorithm === 'floyd';
        const isDijkstra = activeAlgorithm === 'dijkstra';
        const exportFileName = isFloydIsac ? 'optigraph-floyd-isac.json' : isFloyd ? 'optigraph-floyd.json' : isDijkstra ? 'optigraph-dijkstra.json' : 'optigraph-aem.json';
        const exportAlgorithm = isFloydIsac ? 'floyd-isac' : isFloyd ? 'floyd' : isDijkstra ? 'dijkstra' : 'mst';

        downloadJson(exportFileName, {
            version: 2,
            algorithm: exportAlgorithm,
            exportedAt: new Date().toISOString(),
            graph: graphManager.getGraphData(),
            result: isFloydIsac || isFloyd || isDijkstra ? lastSolveResult : {
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
            Swal.fire({ icon: 'info', title: 'Aún no hay un resultado calculated', text: 'Resuelva la red antes de exportar el reporte.', confirmButtonColor: '#10b981', customClass: modalClasses });
            return;
        }
        if (activeAlgorithm === 'floyd-isac') {
            downloadFloydReport('optigraph-reporte-floyd-isac.html', graphManager.getGraphData(), lastSolveResult);
        } else if (activeAlgorithm === 'floyd') {
            downloadFloydReport('optigraph-reporte-floyd.html', graphManager.getGraphData(), lastSolveResult);
        } else if (activeAlgorithm === 'dijkstra') {
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

        if (activeAlgorithm === 'floyd-isac') {
            await solveFloydIsac(nodes, edges);
            return;
        }

        if (activeAlgorithm === 'floyd') {
            await solveFloyd(nodes, edges);
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
        currentFloydSolver = null;
        currentFloydIsacSolver = null;
        if (floydRouteResultContainer) floydRouteResultContainer.innerHTML = '';
        if (floydIsacRouteResultContainer) floydIsacRouteResultContainer.innerHTML = '';
        const solveLabel = activeAlgorithm === 'floyd-isac' ? 'Floyd (Isac)' : activeAlgorithm === 'floyd' ? 'Floyd (Fede)' : activeAlgorithm === 'dijkstra' ? 'Dijkstra' : 'AEM';
        document.getElementById("steps-container").innerHTML = `
            <div class="text-center py-12 text-slate-500 text-xs">
                Haga clic en "Resolver ${solveLabel}" para generar la secuencia de iteraciones.
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

    /**
     * Resuelve Floyd-Warshall sobre la red actual y presenta la bitácora matricial.
     * @param {Object[]} nodes Nodos actuales.
     * @param {Object[]} edges Aristas actuales.
     * @returns {Promise<void>}
     */
    async function solveFloyd(nodes, edges) {
        try {
            const solver = new FloydJuanManager(nodes, edges);
            const result = solver.solve();
            currentFloydSolver = solver;
            lastSolveResult = result;

            restoreFloydView(result);

            // Obtener nodos para consulta inicial
            let start = floydStartNode?.value;
            let target = floydTargetNode?.value;

            if (!start || !target || start === target) {
                if (nodes.length >= 2) {
                    start = nodes[0].id;
                    target = nodes[1].id;
                    if (floydStartNode) floydStartNode.value = start;
                    if (floydTargetNode) floydTargetNode.value = target;
                }
            }

            if (start && target) {
                queryFloydPath(start, target);
            }

            Swal.fire({
                icon: 'success',
                title: '¡Floyd-Warshall Calculado con Éxito!',
                html: `
                    <p class="text-xs text-slate-300 mb-2">Se completaron las <strong>${result.totalIterations} iteraciones</strong> del algoritmo.</p>
                    <p class="text-[11px] text-slate-400">Total de mejoras encontradas: <strong class="text-sky-400">${result.totalRelaxations}</strong></p>
                `,
                confirmButtonColor: '#10b981',
                customClass: { ...modalClasses, confirmButton: 'og-modal-confirm' }
            });

        } catch (error) {
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-900/60 text-rose-300 border border-rose-600 shadow-sm";
            statusEl.innerText = "🔴 ERROR EN RED";

            Swal.fire({
                icon: 'error',
                title: 'No se pudo ejecutar Floyd-Warshall',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: { ...modalClasses, confirmButton: 'og-modal-deny' }
            });
        }
    }

    /**
     * Restaura la vista de Floyd-Warshall en el canvas, footer y panel de procedimiento.
     * @param {Object} result Resultado producido por FloydJuanManager.
     */
    function restoreFloydView(result) {
        renderFloydStepTables(result.stepHistory, result.nodeLabels);
        const statusEl = document.getElementById("status-indicator");
        statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm";
        statusEl.innerText = "🟢 FLOYD-WARSHALL CALCULADO";
        if (iterationCountEl) iterationCountEl.innerText = result.totalIterations;
        if (tieCountEl) tieCountEl.innerText = result.totalRelaxations;
    }

    /**
     * Consulta y resalta la ruta óptima entre dos nodos usando FloydJuanManager.
     * @param {string|number} startNodeId Nodo de origen.
     * @param {string|number} targetNodeId Nodo de destino.
     */
    function queryFloydPath(startNodeId, targetNodeId) {
        const nodes = graphManager.nodes.get();
        const edges = graphManager.edges.get();

        if (!currentFloydSolver) {
            currentFloydSolver = new FloydJuanManager(nodes, edges);
            const result = currentFloydSolver.solve();
            lastSolveResult = result;
            restoreFloydView(result);
        }

        try {
            const route = currentFloydSolver.reconstructPath(startNodeId, targetNodeId);
            const startLabel = graphManager.nodes.get(startNodeId)?.label || startNodeId;
            const targetLabel = graphManager.nodes.get(targetNodeId)?.label || targetNodeId;

            if (route.reachable) {
                if (totalWeightEl) totalWeightEl.innerText = `${route.distance} u`;
                graphManager.highlightFloyd(route);

                if (floydRouteResultContainer) {
                    floydRouteResultContainer.innerHTML = `
                        <div class="floyd-route-result-card">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-bold text-sky-300">Ruta ${startLabel} → ${targetLabel}</span>
                                <span class="font-mono bg-sky-900/60 text-sky-200 px-2 py-0.5 rounded border border-sky-700">Costo: ${route.distance} u</span>
                            </div>
                            <div class="font-mono text-emerald-300 font-bold tracking-wide">${route.pathNodeLabels.join(' → ')}</div>
                        </div>
                    `;
                }
            } else {
                if (totalWeightEl) totalWeightEl.innerText = '∞';
                graphManager.resetVisualStyles();

                if (floydRouteResultContainer) {
                    floydRouteResultContainer.innerHTML = `
                        <div class="mt-2 p-2.5 rounded-lg border border-amber-600/50 bg-amber-950/40 text-amber-300 text-xs font-mono">
                            ⚠️ No existe camino alcanzable de ${startLabel} a ${targetLabel} (Distancia = ∞).
                        </div>
                    `;
                }

                Swal.fire({
                    icon: 'warning',
                    title: 'Sin Camino Alcanzable',
                    text: `No existe camino posible entre Nodo ${startLabel} y Nodo ${targetLabel} (Distancia: ∞).`,
                    confirmButtonColor: '#f59e0b',
                    customClass: modalClasses
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al consultar ruta',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: modalClasses
            });
        }
    }

    if (btnFloydQueryPath) {
        btnFloydQueryPath.addEventListener("click", () => {
            const start = floydStartNode?.value;
            const target = floydTargetNode?.value;
            if (!start || !target) {
                Swal.fire({
                    icon: 'info',
                    title: 'Seleccione Nodos',
                    text: 'Debe elegir un nodo de origen y un nodo de destino en el panel lateral.',
                    confirmButtonColor: '#10b981',
                    customClass: modalClasses
                });
                return;
            }
            queryFloydPath(start, target);
        });
    }

    /**
     * Resuelve Floyd-Warshall con el algoritmo de Isac (Matriz de Predecesores Π).
     */
    async function solveFloydIsac(nodes, edges) {
        try {
            const solver = new FloydIsacManager(nodes, edges);
            const result = solver.solve();
            currentFloydIsacSolver = solver;
            lastSolveResult = result;

            restoreFloydIsacView(result);

            let start = floydIsacStartNode?.value;
            let target = floydIsacTargetNode?.value;

            if (!start || !target || start === target) {
                if (nodes.length >= 2) {
                    start = nodes[0].id;
                    target = nodes[1].id;
                    if (floydIsacStartNode) floydIsacStartNode.value = start;
                    if (floydIsacTargetNode) floydIsacTargetNode.value = target;
                }
            }

            if (start && target) {
                queryFloydIsacPath(start, target);
            }

            Swal.fire({
                icon: 'success',
                title: '¡Floyd-Warshall (Isac) Calculado con Éxito!',
                html: `
                    <p class="text-xs text-slate-300 mb-2">Se completaron las <strong>${result.totalIterations} iteraciones</strong> del enfoque de Predecesores Π.</p>
                    <p class="text-[11px] text-slate-400">Total de mejoras encontradas: <strong class="text-emerald-400">${result.totalRelaxations}</strong></p>
                `,
                confirmButtonColor: '#10b981',
                customClass: { ...modalClasses, confirmButton: 'og-modal-confirm' }
            });

        } catch (error) {
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-900/60 text-rose-300 border border-rose-600 shadow-sm";
            statusEl.innerText = "🔴 ERROR EN RED";

            Swal.fire({
                icon: 'error',
                title: 'No se pudo ejecutar Floyd-Warshall (Isac)',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: { ...modalClasses, confirmButton: 'og-modal-deny' }
            });
        }
    }

    function restoreFloydIsacView(result) {
        renderFloydIsacStepTables(result.stepHistory, result.nodeLabels);
        const statusEl = document.getElementById("status-indicator");
        statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm";
        statusEl.innerText = "🟢 FLOYD-WARSHALL (ISAC) CALCULADO";
        if (iterationCountEl) iterationCountEl.innerText = result.totalIterations;
        if (tieCountEl) tieCountEl.innerText = result.totalRelaxations;
    }

    function queryFloydIsacPath(startNodeId, targetNodeId) {
        const nodes = graphManager.nodes.get();
        const edges = graphManager.edges.get();

        if (!currentFloydIsacSolver) {
            currentFloydIsacSolver = new FloydIsacManager(nodes, edges);
            const result = currentFloydIsacSolver.solve();
            lastSolveResult = result;
            restoreFloydIsacView(result);
        }

        const mode = floydIsacModeEl ? floydIsacModeEl.value : 'target';

        try {
            const startLabel = graphManager.nodes.get(startNodeId)?.label || startNodeId;

            if (mode === 'target') {
                if (!targetNodeId) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Seleccione Destino',
                        text: 'Debe elegir un nodo de destino.',
                        confirmButtonColor: '#10b981',
                        customClass: modalClasses
                    });
                    return;
                }
                const route = currentFloydIsacSolver.reconstructPath(startNodeId, targetNodeId);
                const targetLabel = graphManager.nodes.get(targetNodeId)?.label || targetNodeId;

                if (route.reachable) {
                    if (totalWeightEl) totalWeightEl.innerText = `${route.distance} u`;
                    graphManager.highlightFloyd(route);

                    if (floydIsacRouteResultContainer) {
                        floydIsacRouteResultContainer.innerHTML = `
                            <div class="floyd-route-result-card border-emerald-700 bg-emerald-950/60 p-3 rounded-lg border shadow-md">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="font-bold text-emerald-300">Ruta ${startLabel} → ${targetLabel} (Isac)</span>
                                    <span class="font-mono bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700">Costo: ${route.distance} u</span>
                                </div>
                                <div class="font-mono text-emerald-300 font-bold tracking-wide text-xs">${route.pathNodeLabels.join(' → ')}</div>
                            </div>
                        `;
                    }
                } else {
                    if (totalWeightEl) totalWeightEl.innerText = '∞';
                    graphManager.resetVisualStyles();

                    if (floydIsacRouteResultContainer) {
                        floydIsacRouteResultContainer.innerHTML = `
                            <div class="mt-2 p-2.5 rounded-lg border border-amber-600/50 bg-amber-950/40 text-amber-300 text-xs font-mono">
                                ⚠️ No existe camino alcanzable de ${startLabel} a ${targetLabel} (Distancia = ∞).
                            </div>
                        `;
                    }

                    Swal.fire({
                        icon: 'warning',
                        title: 'Sin Camino Alcanzable',
                        text: `No existe camino posible entre Nodo ${startLabel} y Nodo ${targetLabel} (Distancia: ∞).`,
                        confirmButtonColor: '#f59e0b',
                        customClass: modalClasses
                    });
                }
            } else {
                // Modo "Origen a Todos" (Isac)
                const otherNodes = nodes.filter(n => String(n.id) !== String(startNodeId));
                let allRoutesHtml = '';
                const allPathEdges = [];
                const allPathNodeIds = [startNodeId];

                otherNodes.forEach(n => {
                    const r = currentFloydIsacSolver.reconstructPath(startNodeId, n.id);
                    const destLabel = n.label || n.id;
                    if (r.reachable) {
                        allRoutesHtml += `
                            <div class="flex justify-between items-center py-1 border-b border-emerald-900/40 text-xs">
                                <span><strong class="text-slate-300">→ Nodo ${destLabel}:</strong> <span class="text-emerald-300 font-mono font-bold">${r.pathNodeLabels.join(' → ')}</span></span>
                                <span class="font-mono bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded text-[11px] border border-emerald-700/60">${r.distance} u</span>
                            </div>`;
                        (r.pathEdges || []).forEach(e => allPathEdges.push(e));
                        (r.pathNodeIds || []).forEach(id => allPathNodeIds.push(id));
                    } else {
                        allRoutesHtml += `
                            <div class="flex justify-between items-center py-1 border-b border-emerald-900/40 text-xs">
                                <span><strong class="text-slate-300">→ Nodo ${destLabel}:</strong> <span class="text-amber-400 font-mono">Sin camino</span></span>
                                <span class="font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded text-[11px] border border-amber-800/60">∞</span>
                            </div>`;
                    }
                });

                if (totalWeightEl) totalWeightEl.innerText = 'Matriz Origen → Todos';
                graphManager.highlightFloyd({
                    reachable: true,
                    pathNodeIds: allPathNodeIds,
                    pathEdges: allPathEdges
                });

                if (floydIsacRouteResultContainer) {
                    floydIsacRouteResultContainer.innerHTML = `
                        <div class="floyd-route-result-card border-emerald-700 bg-emerald-950/60 p-3 rounded-lg border shadow-md space-y-2 max-h-64 overflow-y-auto">
                            <div class="font-bold text-emerald-300 border-b border-emerald-800 pb-1 text-xs flex justify-between items-center">
                                <span>🌐 Rutas desde Nodo ${startLabel} a Todos</span>
                                <span class="text-[10px] text-emerald-400 font-normal">Predecesores Π</span>
                            </div>
                            <div class="space-y-1">
                                ${allRoutesHtml}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al consultar rutas',
                text: error.message,
                confirmButtonColor: '#f43f5e',
                customClass: modalClasses
            });
        }
    }

    if (btnFloydIsacQueryPath) {
        btnFloydIsacQueryPath.addEventListener("click", () => {
            const start = floydIsacStartNode?.value;
            const target = floydIsacTargetNode?.value;
            const mode = floydIsacModeEl ? floydIsacModeEl.value : 'target';
            if (!start) {
                Swal.fire({
                    icon: 'info',
                    title: 'Seleccione Nodo Origen',
                    text: 'Debe elegir un nodo de origen en el panel lateral.',
                    confirmButtonColor: '#10b981',
                    customClass: modalClasses
                });
                return;
            }
            if (mode === 'target' && !target) {
                Swal.fire({
                    icon: 'info',
                    title: 'Seleccione Nodo Destino',
                    text: 'Debe elegir un nodo de destino o cambiar al modo "Origen a Todos".',
                    confirmButtonColor: '#10b981',
                    customClass: modalClasses
                });
                return;
            }
            queryFloydIsacPath(start, target);
        });
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

/**
 * Renderiza los bloques de cada iteración k de Floyd-Warshall según la plantilla Excel:
 * - Título: "Iteración k (Nodo Pivote X)"
 * - Tablas emparejadas: Distancias (azul) y Recorridos (verde)
 * - Fila y columna pivote resaltadas en amarillo suave en la matriz de distancias
 * - Celdas modificadas en negrita y con borde luminoso
 * - Diagonal D[i][i] = 0 formateada limpiamente
 *
 * @param {Array<Object>} stepHistory Historial de pasos generado por FloydJuanManager.
 * @param {string[]} nodeLabels Etiquetas legibles de los nodos.
 * @returns {void}
 */
function renderFloydStepTables(stepHistory, nodeLabels) {
    const container = document.getElementById("steps-container");
    if (!container) return;
    container.innerHTML = "";

    stepHistory.forEach(step => {
        const stepBlock = document.createElement("div");
        stepBlock.className = "floyd-step-block";

        const badgeText = step.k === 0 ? "Paso Base Inicial" : `${step.updatedCells.length} mejoras`;

        // 1. Construir filas de la Matriz D (Distancias)
        let dRowsHtml = `<tr><th class="floyd-corner">D\\to</th>`;
        nodeLabels.forEach((label, colIdx) => {
            const isColPivot = step.pivotIndex !== null && colIdx === step.pivotIndex;
            dRowsHtml += `<th class="${isColPivot ? 'floyd-pivot-highlight' : ''}">${label}</th>`;
        });
        dRowsHtml += `</tr>`;

        nodeLabels.forEach((rowLabel, rowIdx) => {
            const isRowPivot = step.pivotIndex !== null && rowIdx === step.pivotIndex;
            dRowsHtml += `<tr><th class="${isRowPivot ? 'floyd-pivot-highlight' : ''}">${rowLabel}</th>`;
            nodeLabels.forEach((_, colIdx) => {
                const rawVal = step.D[rowIdx][colIdx];
                const val = rawVal === Infinity ? '∞' : rawVal;
                const isDiag = rowIdx === colIdx;
                const isPivotIntersection = step.pivotIndex !== null && rowIdx === step.pivotIndex && colIdx === step.pivotIndex;
                const isPivotRowCol = step.pivotIndex !== null && (rowIdx === step.pivotIndex || colIdx === step.pivotIndex);
                const isUpdated = step.updatedCells.some(u => u.i === rowIdx && u.j === colIdx);

                const cellClasses = [];
                if (isPivotIntersection) {
                    cellClasses.push('floyd-pivot-intersection');
                } else if (isPivotRowCol) {
                    cellClasses.push('floyd-pivot-highlight');
                }
                if (isDiag) cellClasses.push('floyd-cell-diag');
                if (isUpdated) cellClasses.push('floyd-cell-updated');

                dRowsHtml += `<td class="${cellClasses.join(' ')}">${val}</td>`;
            });
            dRowsHtml += `</tr>`;
        });

        // 2. Construir filas de la Matriz P (Recorridos)
        let pRowsHtml = `<tr><th class="floyd-corner">P\\to</th>`;
        nodeLabels.forEach(label => {
            pRowsHtml += `<th>${label}</th>`;
        });
        pRowsHtml += `</tr>`;

        nodeLabels.forEach((rowLabel, rowIdx) => {
            pRowsHtml += `<tr><th>${rowLabel}</th>`;
            nodeLabels.forEach((_, colIdx) => {
                const val = step.P[rowIdx][colIdx] || '-';
                const isDiag = rowIdx === colIdx;
                const isUpdated = step.updatedCells.some(u => u.i === rowIdx && u.j === colIdx);

                const cellClasses = [];
                if (isDiag) cellClasses.push('floyd-cell-diag');
                if (isUpdated) cellClasses.push('floyd-cell-updated');

                pRowsHtml += `<td class="${cellClasses.join(' ')}">${val}</td>`;
            });
            pRowsHtml += `</tr>`;
        });

        stepBlock.innerHTML = `
            <div class="floyd-step-header">
                <span class="floyd-step-title">${step.title}</span>
                <span class="floyd-step-badge">${badgeText}</span>
            </div>
            <div class="floyd-tables-grid">
                <div class="floyd-table-card">
                    <div class="floyd-header-distance">
                        <span>📊 Matriz de Distancias D<sup>(${step.k})</sup></span>
                        <span class="text-[10px] text-blue-200 font-normal">Pivote en amarillo</span>
                    </div>
                    <div class="floyd-table-scroll">
                        <table class="floyd-matrix-table">
                            ${dRowsHtml}
                        </table>
                    </div>
                </div>

                <div class="floyd-table-card">
                    <div class="floyd-header-route">
                        <span>🧭 Matriz de Recorridos P<sup>(${step.k})</sup></span>
                        <span class="text-[10px] text-emerald-200 font-normal">Predecesores</span>
                    </div>
                    <div class="floyd-table-scroll">
                        <table class="floyd-matrix-table">
                            ${pRowsHtml}
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(stepBlock);
    });
}

/**
 * Renderiza las iteraciones de Floyd-Warshall (Isac) en el panel de procedimiento:
 * - Títulos en tonos Emerald/Teal con la fórmula explícita aplicada.
 * - Destacado de fila y columna pivote.
 * - Tabla D^(k) (Distancias Cortas) y Matriz Π^(k) (Predecesores Directos CLRS).
 *
 * @param {Array<Object>} stepHistory Historial de pasos generado por FloydIsacManager.
 * @param {string[]} nodeLabels Etiquetas legibles de los nodos.
 * @returns {void}
 */
function renderFloydIsacStepTables(stepHistory, nodeLabels) {
    const container = document.getElementById("steps-container");
    if (!container) return;
    container.innerHTML = "";

    stepHistory.forEach(step => {
        const stepBlock = document.createElement("div");
        stepBlock.className = "floyd-step-block border-l-4 border-emerald-500 bg-slate-900 rounded-xl p-3 shadow-lg mb-4 space-y-3";

        const badgeText = step.k === 0 ? "Paso Base Inicial" : `${step.updatedCells.length} mejoras de distancia`;

        let dRowsHtml = `<tr><th class="floyd-corner bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">D\\to</th>`;
        nodeLabels.forEach((label, colIdx) => {
            const isColPivot = step.pivotIndex !== null && colIdx === step.pivotIndex;
            dRowsHtml += `<th class="${isColPivot ? 'bg-emerald-900 text-emerald-200 font-bold border border-emerald-700' : 'bg-slate-800 text-slate-300 border border-slate-700'}">${label}</th>`;
        });
        dRowsHtml += `</tr>`;

        nodeLabels.forEach((rowLabel, rowIdx) => {
            const isRowPivot = step.pivotIndex !== null && rowIdx === step.pivotIndex;
            dRowsHtml += `<tr><th class="${isRowPivot ? 'bg-emerald-900 text-emerald-200 font-bold border border-emerald-700' : 'bg-slate-800 text-slate-300 border border-slate-700'}">${rowLabel}</th>`;
            nodeLabels.forEach((_, colIdx) => {
                const rawVal = step.D[rowIdx][colIdx];
                const val = rawVal === Infinity ? '∞' : rawVal;
                const isDiag = rowIdx === colIdx;
                const isPivotIntersection = step.pivotIndex !== null && rowIdx === step.pivotIndex && colIdx === step.pivotIndex;
                const isPivotRowCol = step.pivotIndex !== null && (rowIdx === step.pivotIndex || colIdx === step.pivotIndex);
                const isUpdated = step.updatedCells.some(u => u.i === rowIdx && u.j === colIdx);

                let bgStyle = 'border: 1px solid #334155;';
                if (isPivotIntersection) {
                    bgStyle = 'background-color: #064e3b; color: #6ee7b7; font-weight: bold; border: 1px solid #059669;';
                } else if (isPivotRowCol) {
                    bgStyle = 'background-color: #065f46; color: #a7f3d0; border: 1px solid #047857;';
                }
                if (isDiag) bgStyle = 'background-color: #020617; color: #64748b; border: 1px solid #1e293b;';
                if (isUpdated) bgStyle = 'background-color: #047857; color: #ecfdf5; font-weight: bold; border: 2px solid #34d399;';

                dRowsHtml += `<td class="text-center p-1.5 font-mono text-xs" style="${bgStyle}">${val}</td>`;
            });
            dRowsHtml += `</tr>`;
        });

        let pRowsHtml = `<tr><th class="floyd-corner bg-teal-950 text-teal-300 font-bold border border-teal-800">Π\\to</th>`;
        nodeLabels.forEach(label => {
            pRowsHtml += `<th class="bg-slate-800 text-slate-300 border border-slate-700">${label}</th>`;
        });
        pRowsHtml += `</tr>`;

        nodeLabels.forEach((rowLabel, rowIdx) => {
            pRowsHtml += `<tr><th class="bg-slate-800 text-slate-300 border border-slate-700">${rowLabel}</th>`;
            nodeLabels.forEach((_, colIdx) => {
                const val = step.P[rowIdx][colIdx] || '-';
                const isDiag = rowIdx === colIdx;
                const isUpdated = step.updatedCells.some(u => u.i === rowIdx && u.j === colIdx);

                let bgStyle = 'border: 1px solid #334155;';
                if (isDiag) bgStyle = 'background-color: #020617; color: #64748b; border: 1px solid #1e293b;';
                if (isUpdated) bgStyle = 'background-color: #115e59; color: #ccfbf1; font-weight: bold; border: 2px solid #2dd4bf;';

                pRowsHtml += `<td class="text-center p-1.5 font-mono text-xs" style="${bgStyle}">${val}</td>`;
            });
            pRowsHtml += `</tr>`;
        });

        const formulaHtml = step.k === 0
            ? '<span class="text-[10px] text-slate-400">Matriz base construida desde los arcos directos y diagonal en 0</span>'
            : `<span class="text-[10px] text-emerald-300 font-mono">Fórmula: D<sup>(${step.k})</sup>[i][j] = min(D<sup>(${step.k - 1})</sup>[i][j], D<sup>(${step.k - 1})</sup>[i][${step.pivotNode}] + D<sup>(${step.k - 1})</sup>[${step.pivotNode}][j])</span>`;

        stepBlock.innerHTML = `
            <div class="flex justify-between items-center border-b border-emerald-800/60 pb-1.5">
                <span class="text-xs font-bold text-emerald-400">${step.title}</span>
                <span class="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">${badgeText}</span>
            </div>
            <div class="bg-slate-950/80 p-1.5 rounded border border-emerald-900/60 text-center">
                ${formulaHtml}
            </div>
            <div class="space-y-3">
                <div class="floyd-table-card border border-emerald-900/80 rounded-lg overflow-hidden">
                    <div class="bg-emerald-950 px-2 py-1 text-xs font-semibold text-emerald-300 flex justify-between items-center border-b border-emerald-900">
                        <span>📊 Matriz de Distancias Cortas D<sup>(${step.k})</sup></span>
                        <span class="text-[10px] text-emerald-400 font-normal">Pivote: ${step.pivotNode || 'Base'}</span>
                    </div>
                    <div class="overflow-x-auto p-1 bg-slate-950">
                        <table class="w-full text-xs text-center border-collapse">
                            ${dRowsHtml}
                        </table>
                    </div>
                </div>

                <div class="floyd-table-card border border-teal-900/80 rounded-lg overflow-hidden">
                    <div class="bg-teal-950 px-2 py-1 text-xs font-semibold text-teal-300 flex justify-between items-center border-b border-teal-900">
                        <span>🧭 Matriz de Predecesores Directos Π<sup>(${step.k})</sup></span>
                        <span class="text-[10px] text-teal-400 font-normal">Cadena CLRS</span>
                    </div>
                    <div class="overflow-x-auto p-1 bg-slate-950">
                        <table class="w-full text-xs text-center border-collapse">
                            ${pRowsHtml}
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(stepBlock);
    });
}

/**
 * Genera un reporte HTML autocontenido para Floyd-Warshall.
 * @param {string} filename Nombre del archivo a descargar.
 * @param {Object} graphData Red utilizada.
 * @param {Object} result Resultado de FloydJuanManager.
 * @returns {void}
 */
function downloadFloydReport(filename, graphData, result) {
    const nodeLabels = result.nodeLabels;
    const blocksHtml = result.stepHistory.map(step => {
        let dRows = `<tr><th>D\\to</th>${nodeLabels.map(l => `<th>${l}</th>`).join('')}</tr>`;
        nodeLabels.forEach((rl, rIdx) => {
            dRows += `<tr><th>${rl}</th>`;
            nodeLabels.forEach((_, cIdx) => {
                const val = step.D[rIdx][cIdx] === Infinity ? '∞' : step.D[rIdx][cIdx];
                const isPivot = step.pivotIndex !== null && (rIdx === step.pivotIndex || cIdx === step.pivotIndex);
                const isUpdated = step.updatedCells.some(u => u.i === rIdx && u.j === cIdx);
                const bg = isPivot ? 'background:#fef08a;color:#854d0e;font-weight:bold;' : isUpdated ? 'background:#bae6fd;font-weight:bold;' : '';
                dRows += `<td style="${bg}">${val}</td>`;
            });
            dRows += `</tr>`;
        });

        let pRows = `<tr><th>P\\to</th>${nodeLabels.map(l => `<th>${l}</th>`).join('')}</tr>`;
        nodeLabels.forEach((rl, rIdx) => {
            pRows += `<tr><th>${rl}</th>`;
            nodeLabels.forEach((_, cIdx) => {
                const val = step.P[rIdx][cIdx] || '-';
                const isUpdated = step.updatedCells.some(u => u.i === rIdx && u.j === cIdx);
                const bg = isUpdated ? 'background:#bbf7d0;font-weight:bold;' : '';
                pRows += `<td style="${bg}">${val}</td>`;
            });
            pRows += `</tr>`;
        });

        return `
            <div style="margin-bottom:2rem;page-break-inside:avoid;">
                <h3 style="color:#0369a1;border-bottom:2px solid #e0f2fe;padding-bottom:4px;">${step.title} (${step.updatedCells.length} mejoras)</h3>
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
                    <div>
                        <h4 style="color:#1d4ed8;margin:4px 0;">Matriz de Distancias D^(${step.k})</h4>
                        <table>${dRows}</table>
                    </div>
                    <div>
                        <h4 style="color:#047857;margin:4px 0;">Matriz de Recorridos P^(${step.k})</h4>
                        <table>${pRows}</table>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const reportHtml = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Floyd-Warshall</title><style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:1150px;margin:2rem auto;padding:0 1rem}h1{color:#0284c7}table{border-collapse:collapse;font-size:11px;font-family:monospace;text-align:center;margin-bottom:1rem}th,td{border:1px solid #cbd5e1;padding:5px 7px;min-width:24px}th{background:#f1f5f9;font-weight:bold}.summary{display:flex;gap:2rem;margin:1rem 0;font-weight:bold}</style></head><body><h1>OptiGraph Studio — Reporte Floyd-Warshall</h1><div class="summary"><span>Nodos: ${graphData.nodes.length}</span><span>Aristas: ${graphData.edges.length}</span><span>Iteraciones: ${result.totalIterations}</span><span>Mejoras Totales: ${result.totalRelaxations}</span></div>${blocksHtml}</body></html>`;

    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 100);
}