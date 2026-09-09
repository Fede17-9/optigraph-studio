/**
 * @fileoverview Controlador principal de eventos y UI.
 * Enlaza GraphManager y MSTSolver con la interfaz de usuario.
 */

document.addEventListener("DOMContentLoaded", () => {
    const graphManager = new GraphManager("canvas-container");

    // Enlazar contador de nodos a la barra inferior
    const nodeCountEl = document.getElementById("node-count");
    graphManager.onNodeCountChange = (count) => {
        if (nodeCountEl) nodeCountEl.innerText = count;
    };

    // --- Control de Botones de Herramientas ---
    const btnAddNode = document.getElementById("btn-add-node");
    const btnAddEdge = document.getElementById("btn-add-edge");
    const btnClear = document.getElementById("btn-clear");
    const btnSolve = document.getElementById("btn-solve");
    const selectDemo = document.getElementById("select-demo");

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

    // --- Resolver AEM ---
    btnSolve.addEventListener("click", async () => {
        const nodes = graphManager.nodes.get();
        const edges = graphManager.edges.get();

        if (nodes.length < 2) {
            Swal.fire({
                icon: 'warning',
                title: 'Red Incompleta',
                text: 'Debe ingresar al menos 2 nodos y sus conexiones para ejecutar el algoritmo.',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        // Generar lista de nodos para el modal de inicio
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
            preConfirm: () => {
                return document.getElementById('swal-start-node').value;
            }
        });

        if (!selectedStartNode) return;

        const solver = new MSTSolver(nodes, edges);

        try {
            const result = solver.solvePrim(selectedStartNode);

            // 1. Resaltar arcos visualmente en el lienzo
            graphManager.highlightMST(result.selectedEdges, result.tiedEdges);

            // 2. Renderizar pasos analíticos en el panel derecho
            renderProcedureSteps(result.stepTable);

            // 3. Actualizar indicador de estado permanente
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-600 shadow-sm";
            statusEl.innerText = "🟢 RED CONEXA — AEM CALCULADO";

            Swal.fire({
                icon: 'success',
                title: '¡AEM Calculado con Éxito!',
                text: `Iniciando desde Nodo (${selectedStartNode}), el peso total del árbol es de ${result.totalWeight} unidades.`,
                confirmButtonColor: '#10b981'
            });

        } catch (error) {
            const statusEl = document.getElementById("status-indicator");
            statusEl.className = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-900/60 text-rose-300 border border-rose-600 shadow-sm";
            statusEl.innerText = "🔴 RED NO CONEXA";

            Swal.fire({
                icon: 'error',
                title: 'Error de Conexidad',
                text: error.message,
                confirmButtonColor: '#f43f5e'
            });
        }
    });

    function setActiveToolButton(activeBtn) {
        [btnAddNode, btnAddEdge].forEach(btn => btn.classList.remove("border-emerald-500", "bg-slate-600"));
        activeBtn.classList.add("border-emerald-500", "bg-slate-600");
    }

    function resetUI() {
        if (nodeCountEl) nodeCountEl.innerText = graphManager.nodes.length;
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
 * Renderiza la secuencia formal de iteraciones en el panel lateral derecho.
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