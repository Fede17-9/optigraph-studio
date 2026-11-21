/**
 * @file pl-controller.js
 * @module LinearProgrammingController
 * Formularios, bitácora académica y archivos del modo PL. Todo dato ingresado
 * se convierte a número o se inserta como texto; no se evalúa código del usuario.
 */
/** Coordina el estado independiente de PL, su vista y sus archivos. */
class LinearProgrammingController {
    /** @param {HTMLElement} root Sección del modo PL. @param {Object} [options] Callbacks de integración. */
    constructor(root, { onImport = () => {} } = {}) {
        this.root = root;
        this.onImport = onImport;
        this.result = null;
        this.timer = null;
        this.rowCounter = 0;
        this.root.innerHTML = `
          <aside class="pl-sidebar" aria-label="Ingreso del modelo de programación lineal">
            <div class="pl-panel-heading"><span class="pl-eyebrow">DOS VARIABLES · PL CONTINUA</span><h2>Modelo matemático</h2>
              <p>Define tu objetivo y las condiciones del problema.</p></div>
            <label class="pl-field">Ejemplos de clase<select id="pl-example"><option value="">Modelo personalizado</option></select></label>
            <form id="pl-form" novalidate>
              <label class="pl-field">Tipo de optimización<select id="pl-sense"><option value="max">Maximizar</option><option value="min">Minimizar</option></select></label>
              <fieldset class="pl-objective"><legend>Función objetivo · Z</legend><div class="pl-coefficients">
                <label><span class="sr-only">Coeficiente de x en Z</span><input id="pl-c1" inputmode="decimal" autocomplete="off"><span>x</span></label>
                <span>+</span><label><span class="sr-only">Coeficiente de y en Z</span><input id="pl-c2" inputmode="decimal" autocomplete="off"><span>y</span></label>
              </div></fieldset>
              <div class="pl-section-heading"><h3>Restricciones</h3><button id="pl-add" type="button" class="pl-button">+ Agregar</button></div>
              <div id="pl-constraints"></div>
              <p class="pl-domain">Condiciones de signo: <strong>x ≥ 0 · y ≥ 0</strong></p>
              <p class="pl-help">Admite enteros y decimales con punto o coma. Las variables son continuas: los resultados no se redondean a enteros.</p>
              <div id="pl-errors" role="alert" class="pl-errors" hidden></div>
              <div class="pl-actions"><button type="submit" class="pl-button pl-primary">Resolver modelo</button><button id="pl-clear" type="button" class="pl-button">Limpiar</button></div>
            </form>
            <div class="pl-files"><button id="pl-import" class="pl-button" type="button">Importar modelo</button><button id="pl-export-model" class="pl-button" type="button">Exportar modelo</button>
              <button id="pl-export-result" class="pl-button" type="button">Exportar resultado</button><button id="pl-report" class="pl-button" type="button">Reporte imprimible</button></div>
          </aside>
          <main class="pl-main">
            <div class="pl-plot-heading"><div><span class="pl-eyebrow">INTERSECCIÓN DE SEMIPLANOS</span><h2>Plano cartesiano</h2></div>
              <div class="pl-plot-actions"><button id="pl-zoom-in" class="pl-button" type="button" aria-label="Acercar gráfica">+</button><button id="pl-zoom-out" class="pl-button" type="button" aria-label="Alejar gráfica">−</button><button id="pl-fit" class="pl-button" type="button">Ajustar</button></div></div>
            <div class="pl-layers"><label><input id="pl-halfplanes" type="checkbox"> Mostrar semiplanos</label><span>Arrastra para desplazar · rueda para zoom</span></div>
            <div id="pl-plot" class="pl-plot"></div>
            <div id="pl-legend" class="pl-legend" aria-label="Leyenda de restricciones"></div>
            <div id="pl-region-note" class="pl-region-note"></div>
            <section id="pl-result" class="pl-result" aria-live="polite"></section>
            <section id="pl-vertex-detail" class="pl-vertex-detail" aria-label="Vértice seleccionado"></section>
          </main>
          <aside class="pl-procedure-panel" aria-label="Procedimiento completo del método gráfico"><div class="pl-panel-heading"><span class="pl-eyebrow">DESARROLLO ACADÉMICO</span><h2>Procedimiento paso a paso</h2><p>Abre cada etapa para revisar operaciones y comprobaciones.</p></div><div id="pl-procedure"></div></aside>`;
        const get = id => root.querySelector(`#${id}`);
        this.form = get('pl-form'); this.rows = get('pl-constraints');
        this.example = get('pl-example'); this.sense = get('pl-sense');
        this.c1 = get('pl-c1'); this.c2 = get('pl-c2'); this.errors = get('pl-errors');
        this.summary = get('pl-result'); this.procedure = get('pl-procedure');
        this.detail = get('pl-vertex-detail'); this.note = get('pl-region-note'); this.legend = get('pl-legend');
        this.graph = new LinearProgrammingGraphManager(get('pl-plot'), p => this.selectVertex(p));
        for (const example of LinearProgrammingSolver.examples()) {
            this.example.appendChild(this.el('option', example.title, { value: example.id }));
        }
        this.example.addEventListener('change', () => {
            const preset = LinearProgrammingSolver.examples().find(e => e.id === this.example.value);
            if (preset) this.loadModel(preset.model);
        });
        this.form.addEventListener('submit', e => { e.preventDefault(); clearTimeout(this.timer); this.solve(true); });
        this.form.addEventListener('input', () => this.schedule());
        this.form.addEventListener('change', () => this.schedule());
        get('pl-add').addEventListener('click', () => { this.addRow(); this.schedule(); });
        get('pl-clear').addEventListener('click', () => this.clear());
        get('pl-halfplanes').addEventListener('change', e => { this.graph.showHalfplanes = e.target.checked; this.graph.render(); });
        get('pl-zoom-in').addEventListener('click', () => this.graph.zoom(1 / 1.3));
        get('pl-zoom-out').addEventListener('click', () => this.graph.zoom(1.3));
        get('pl-fit').addEventListener('click', () => this.graph.fit());
        get('pl-import').addEventListener('click', () => this.onImport());
        get('pl-export-model').addEventListener('click', () => this.tryAction(() => this.exportModel()));
        get('pl-export-result').addEventListener('click', () => this.tryAction(() => this.exportResult()));
        get('pl-report').addEventListener('click', () => this.tryAction(() => this.exportReport()));
        this.example.value = 'spec';
        this.loadModel(LinearProgrammingSolver.examples()[0].model);
    }

    el(tag, text = null, attrs = {}) {
        const node = document.createElement(tag);
        if (text !== null) node.textContent = text;
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    static format(n) { return LinearProgrammingGraphManager.format(n); }
    static equation(r) { return LinearProgrammingGraphManager.equation(r); }
    static point(p) { return `(${this.format(p.x)}; ${this.format(p.y)})`; }

    addRow(r = null) {
        // Un archivo importado puede usar IDs fuera del orden R1, R2, ...
        const used = new Set([...this.rows.children].map(card => card.dataset.id));
        do { this.rowCounter++; } while (!r && used.has(`R${this.rowCounter}`));
        const key = this.rowCounter;
        const card = this.el('fieldset', null, { class: 'pl-constraint', 'data-id': r?.id ?? `R${key}` });
        const id = card.dataset.id;
        const legend = this.el('legend', id);
        card.appendChild(legend);
        const remove = this.el('button', 'Eliminar', { type: 'button', class: 'pl-remove', 'aria-label': `Eliminar restricción ${id}` });
        remove.addEventListener('click', () => { card.remove(); this.schedule(); });
        card.appendChild(remove);
        const row = this.el('div', null, { class: 'pl-coefficients' });
        for (const [name, variable] of [['a', 'x'], ['b', 'y']]) {
            if (name === 'b') row.appendChild(this.el('span', '+'));
            const label = this.el('label');
            label.appendChild(this.el('span', `${id}, coeficiente de ${variable}`, { class: 'sr-only' }));
            const input = this.el('input', null, { 'data-coefficient': name, inputmode: 'decimal', autocomplete: 'off' });
            input.value = r ? String(r[name]) : '';
            label.append(input, this.el('span', variable)); row.appendChild(label);
        }
        card.appendChild(row);
        const relation = this.el('div', null, { class: 'pl-relation' });
        const select = this.el('select', null, { 'aria-label': `${id}, signo de la restricción` });
        for (const [value, text] of [['<=', '≤'], ['>=', '≥'], ['=', '=']]) select.appendChild(this.el('option', text, { value }));
        select.value = r?.op ?? '<=';
        const rhsLabel = this.el('label');
        rhsLabel.appendChild(this.el('span', `${id}, término independiente`, { class: 'sr-only' }));
        const rhs = this.el('input', null, { 'data-coefficient': 'rhs', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Límite' });
        rhs.value = r ? String(r.rhs) : '';
        rhsLabel.appendChild(rhs); relation.append(select, rhsLabel); card.appendChild(relation);
        this.rows.appendChild(card);
    }

    /** Entrada decimal localizada, sin aceptar valores vacíos como cero. */
    readNumber(input) {
        const text = input.value.trim();
        const valid = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text);
        const value = valid ? Number(text.replace(',', '.')) : NaN;
        const ok = Number.isFinite(value);
        input.setAttribute('aria-invalid', String(!ok));
        if (!ok) throw new Error('Completa los campos señalados con números finitos. Usa punto o coma decimal, sin separadores de miles.');
        return value;
    }

    readModel() {
        let invalid = null;
        const read = field => { try { return this.readNumber(field); } catch (e) { invalid = e; return 0; } };
        const model = { objective: { sense: this.sense.value, c1: read(this.c1), c2: read(this.c2) }, constraints: [] };
        for (const card of this.rows.children) {
            const field = key => card.querySelector(`[data-coefficient="${key}"]`);
            model.constraints.push({ id: card.dataset.id, a: read(field('a')), b: read(field('b')),
                op: card.querySelector('select').value, rhs: read(field('rhs')) });
        }
        if (invalid) throw invalid;
        return LinearProgrammingSolver.validate(model);
    }

    loadModel(model) {
        clearTimeout(this.timer);
        const checked = LinearProgrammingSolver.validate(model);
        this.sense.value = checked.objective.sense; this.c1.value = checked.objective.c1; this.c2.value = checked.objective.c2;
        this.rows.replaceChildren(); this.rowCounter = 0;
        checked.constraints.forEach(r => this.addRow(r));
        this.solve(true);
    }

    clear() {
        clearTimeout(this.timer); this.rows.replaceChildren(); this.rowCounter = 0;
        this.c1.value = ''; this.c2.value = ''; this.sense.value = 'max'; this.example.value = '';
        this.addRow(); this.errors.hidden = true;
        this.invalidate('Ingresa una función objetivo y sus restricciones para comenzar.');
    }

    schedule() {
        clearTimeout(this.timer); this.example.value = '';
        this.invalidate('Actualizando el modelo…');
        this.timer = setTimeout(() => this.solve(false), 220);
    }

    invalidate(message) {
        this.result = null; this.graph.setResult(null, false);
        this.summary.replaceChildren(this.el('p', message)); this.detail.replaceChildren();
        this.procedure.replaceChildren(); this.legend.replaceChildren(); this.note.textContent = '';
    }

    solve(fit = false) {
        try {
            const model = this.readModel();
            this.result = new LinearProgrammingSolver(model).solve();
            this.errors.hidden = true;
            this.graph.setResult(this.result, fit);
            this.renderSummary(); this.renderProcedure(); this.renderLegend();
            const p = this.result.optimalPoints[0] ?? this.result.vertices[0];
            if (p) this.selectVertex(p); else this.detail.replaceChildren();
            return this.result;
        } catch (error) {
            this.invalidate('Modelo incompleto o inválido. Corrige los datos para actualizar la gráfica.');
            this.errors.textContent = error.message; this.errors.hidden = false;
            return null;
        }
    }

    show() { this.root.hidden = false; requestAnimationFrame(() => this.graph.render()); }
    hide() { this.root.hidden = true; }

    renderLegend() {
        this.legend.replaceChildren();
        this.result.model.constraints.forEach((r, i) => {
            const label = this.el('span', `${r.id}: ${LinearProgrammingController.equation(r)}`);
            const swatch = this.el('i'); swatch.style.backgroundColor = LinearProgrammingGraphManager.COLORS[i % 6];
            label.prepend(swatch); this.legend.appendChild(label);
        });
        this.legend.appendChild(this.el('span', 'Verde: región factible · Lila: óptimo y recta de Z'));
        this.note.textContent = this.result.regionBounded === false
            ? 'La región continúa fuera de la ventana. Las flechas indican direcciones factibles; el borde del visor NO es una restricción.'
            : this.result.status === 'infeasible' ? 'No existe una zona que cumpla simultáneamente todas las restricciones.'
                : `Región acotada · ${this.result.dimension === 0 ? 'un punto' : this.result.dimension === 1 ? 'un segmento' : `${this.result.vertices.length} vértices`}.`;
    }

    static statusText(r) {
        if (r.status === 'infeasible') return 'Sin región factible';
        if (r.status === 'unbounded') return 'Función objetivo no acotada';
        return r.status === 'optimal-multiple' ? 'Soluciones óptimas múltiples' : 'Solución óptima única';
    }

    explanation() {
        const r = this.result, F = LinearProgrammingController;
        if (r.status === 'infeasible') return 'No hay un punto que satisfaga todas las condiciones. No existe solución óptima.';
        if (r.status === 'unbounded') {
            const d = r.improvingDirection, p = r.vertices[0];
            return `Desde ${F.point(p)}, la dirección (${F.format(d.x)}; ${F.format(d.y)}) mantiene la factibilidad para t ≥ 0. Z ${r.model.objective.sense === 'max' ? 'aumenta' : 'disminuye'} sin límite (variación por t: ${F.format(d.deltaZ)}). No hay óptimo finito.`;
        }
        let text = `${r.model.objective.sense === 'max' ? 'Máximo' : 'Mínimo'} Z = ${F.format(r.optimalValue)}. `;
        if (r.optimalSet === 'region') text += 'La función objetivo es nula: toda la región factible es óptima.';
        else if (r.optimalSet === 'ray') text += `El valor se alcanza en ${r.optimalPoints.map(F.point.bind(F)).join(', ')} y en las direcciones factibles con variación de Z igual a cero; hay infinitos óptimos.`;
        else if (r.optimalSet === 'segment') text += `Se alcanza en todo el segmento entre ${r.optimalPoints.map(F.point.bind(F)).join(' y ')}.`;
        else text += `Se alcanza únicamente en ${F.point(r.optimalPoints[0])}.`;
        if (!r.regionBounded) text += ' La región es no acotada, pero Z sí tiene un óptimo finito.';
        return text;
    }

    renderSummary() {
        const r = this.result;
        this.summary.dataset.status = r.status;
        this.summary.replaceChildren(this.el('h3', LinearProgrammingController.statusText(r)), this.el('p', this.explanation()));
        if (r.redundantConstraintIds.length) this.summary.appendChild(this.el('p', `Restricciones redundantes: ${r.redundantConstraintIds.join(', ')}. Se conservan en el modelo; una redundante también puede estar activa.`, { class: 'pl-help' }));
    }

    selectVertex(p) {
        const F = LinearProgrammingController;
        this.detail.replaceChildren(this.el('h3', `Vértice ${p.label} · ${F.point(p)}`));
        this.detail.appendChild(this.el('p', `Z = ${F.format(this.result.model.objective.c1)}(${F.format(p.x)}) + ${F.format(this.result.model.objective.c2)}(${F.format(p.y)}) = ${F.format(p.z)}`));
        const names = p.activeConstraintIds.map(id => id === 'sign-x' ? 'x = 0' : id === 'sign-y' ? 'y = 0' : id);
        this.detail.appendChild(this.el('p', `Restricciones activas: ${names.join(', ') || 'ninguna'}.`));
        this.procedure.querySelectorAll('[data-vertex-row]').forEach(row => row.classList.toggle('pl-selected-row', row.dataset.vertexRow === p.label));
    }

    section(title, open = false, parent = this.procedure) {
        const details = this.el('details', null, { class: 'pl-step' });
        details.open = open; details.appendChild(this.el('summary', title));
        const content = this.el('div', null, { class: 'pl-step-content' }); details.appendChild(content); parent.appendChild(details);
        return content;
    }

    table(headers, rows, parent, onRow = null) {
        const wrap = this.el('div', null, { class: 'pl-table-wrap' });
        const table = this.el('table', null, { class: 'pl-table' }), head = this.el('thead'), tr = this.el('tr');
        headers.forEach(h => tr.appendChild(this.el('th', h, { scope: 'col' }))); head.appendChild(tr); table.appendChild(head);
        const body = this.el('tbody');
        rows.forEach((values, index) => {
            const row = this.el('tr'); values.forEach(value => row.appendChild(this.el('td', String(value))));
            if (onRow) onRow(row, index); body.appendChild(row);
        });
        table.appendChild(body); wrap.appendChild(table); parent.appendChild(wrap); return table;
    }

    renderProcedure() {
        const r = this.result, F = LinearProgrammingController, f = F.format.bind(F);
        this.procedure.replaceChildren();
        const model = this.section('1. Modelo matemático', true);
        model.appendChild(this.el('p', `${r.model.objective.sense === 'max' ? 'Maximizar' : 'Minimizar'} Z = ${f(r.model.objective.c1)}x + ${f(r.model.objective.c2)}y`, { class: 'pl-equation' }));
        r.model.constraints.forEach(c => model.appendChild(this.el('p', `${c.id}: ${F.equation(c)}`, { class: 'pl-equation' })));
        model.appendChild(this.el('p', 'x ≥ 0; y ≥ 0. Variables continuas.'));
        const ints = this.section('2. Rectas límite e interceptos');
        for (const record of r.intercepts) {
            const body = this.section(`${record.id}: ${F.equation({ ...record, op: '=' })}`, false, ints);
            for (const [axis, variable, fixed, coefficient] of [['x', 'x', 'y', record.a], ['y', 'y', 'x', record.b]]) {
                const p = record[axis];
                const text = p.kind === 'point' ? `Con ${fixed} = 0: ${f(coefficient)}${variable} = ${f(record.rhs)} ⇒ ${variable} = ${f(record.rhs)} / ${f(coefficient)} = ${f(p[variable])} ⇒ ${F.point(p)}.`
                    : p.kind === 'axis' ? `Con ${fixed} = 0: 0 = 0. La recta coincide con este eje; hay infinitos puntos de corte.`
                        : p.kind === 'out-of-range' ? 'Intercepto fuera de la precisión numérica disponible.' : `Con ${fixed} = 0: 0 = ${f(record.rhs)} no tiene solución. No existe este intercepto.`;
                body.appendChild(this.el('p', text));
            }
        }
        for (const t of r.trivial) ints.appendChild(this.el('p', `${t.id}: 0 ${t.op} ${f(t.rhs)} es ${t.satisfied ? 'siempre verdadera (redundante)' : 'falsa (contradictoria)'}. No define una recta.`));
        const crosses = this.section(`3. Cruces de rectas (${r.intersections.length})`);
        for (const pair of r.intersections) {
            const p = pair.first, q = pair.second;
            const body = this.section(`${p.id} ∩ ${q.id} · ${pair.kind === 'point' ? `${F.point(pair)} · ${pair.feasible ? 'factible' : 'descartado'}` : pair.kind === 'parallel' ? 'paralelas' : 'coincidentes'}`, false, crosses);
            body.append(this.el('p', F.equation({ ...p, op: '=' })), this.el('p', F.equation({ ...q, op: '=' })));
            if (pair.kind !== 'point') {
                body.appendChild(this.el('p', pair.kind === 'parallel' ? 'Las rectas son paralelas distintas y no tienen un cruce.' : 'Ambas ecuaciones representan la misma recta; no hay un cruce único.'));
                continue;
            }
            const det = p.a * q.b - q.a * p.b, nx = p.rhs * q.b - q.rhs * p.b, ny = p.a * q.rhs - q.a * p.rhs;
            body.appendChild(this.el('p', `Δ = (${f(p.a)})(${f(q.b)}) − (${f(q.a)})(${f(p.b)}) = ${f(det)}.`));
            body.appendChild(this.el('p', `Eliminando y: Δx = (${f(p.rhs)})(${f(q.b)}) − (${f(q.rhs)})(${f(p.b)}) = ${f(nx)}. x = ${f(nx)} / ${f(det)} = ${f(pair.x)}.`));
            body.appendChild(this.el('p', `Eliminando x: Δy = (${f(p.a)})(${f(q.rhs)}) − (${f(q.a)})(${f(p.rhs)}) = ${f(ny)}. y = ${f(ny)} / ${f(det)} = ${f(pair.y)}.`));
        }
        const checks = this.section('4. Verificación de todos los candidatos');
        checks.appendChild(this.el('p', 'Un cruce solo es factible si cumple todas las restricciones, incluida la no negatividad. Los cruces repetidos se verifican una sola vez.'));
        for (const p of r.candidates) {
            const body = this.section(`${p.id} ${F.point(p)} · ${p.feasible ? 'Factible' : 'Descartado'}`, false, checks);
            this.table(['Condición', 'Sustitución y comprobación'], p.checks.map(c => [c.id,
                `${f(c.a)}(${f(p.x)}) + ${f(c.b)}(${f(p.y)}) = ${f(c.lhs)} ${c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '='} ${f(c.rhs)} · ${c.satisfied ? 'Cumple' : 'NO cumple'}`]), body);
        }
        const vertices = this.section('5. Vértices y evaluación de Z', true);
        if (r.vertices.length) {
            this.table(['Vértice', '(x; y)', 'Sustitución en Z', 'Valor'], r.vertices.map(p => [p.label, F.point(p),
                `${f(r.model.objective.c1)}(${f(p.x)}) + ${f(r.model.objective.c2)}(${f(p.y)})`, f(p.z)]), vertices,
            (row, i) => {
                const p = r.vertices[i]; row.dataset.vertexRow = p.label;
                const button = this.el('button', p.label, { type: 'button', class: 'pl-vertex-button', 'aria-label': `Seleccionar vértice ${p.label}` });
                button.addEventListener('click', () => this.graph.select(p.label)); row.firstChild.replaceChildren(button);
                if (r.optimalPoints.some(o => o.label === p.label)) row.classList.add('pl-optimal-row');
            });
        } else vertices.appendChild(this.el('p', 'No hay vértices factibles.'));
        const conclusion = this.section('6. Solución y justificación', true);
        conclusion.appendChild(this.el('p', this.explanation()));
        conclusion.appendChild(this.el('p', r.status === 'infeasible'
            ? 'La intersección de las condiciones es vacía: no puede evaluarse una solución óptima.'
            : r.status === 'unbounded' ? 'Se ha encontrado una dirección factible que mejora Z indefinidamente. Evaluar solo los vértices no bastaría para concluir.'
                : 'Para una función lineal con óptimo finito en este poliedro, basta comparar sus vértices y comprobar las direcciones de recesión. Si hay empate en un lado, todos sus puntos también son óptimos.'));
        if (r.rays.length) this.table(['Dirección factible (dx; dy)', 'Variación de Z'], r.rays.map(d => [F.point(d), f(d.deltaZ)]), conclusion);
        conclusion.appendChild(this.el('p', `Restricciones redundantes: ${r.redundantConstraintIds.join(', ') || 'ninguna identificada'}. Se comprueban retirando cada condición y maximizando su posible violación; no basta con mirar si está activa en el óptimo.`));
        conclusion.appendChild(this.el('p', 'Las comparaciones usan tolerancia numérica relativa. Solo se redondean los valores mostrados, nunca los cálculos.'));
    }

    tryAction(action) {
        try { action(); } catch (e) { this.errors.textContent = e.message; this.errors.hidden = false; }
    }

    payload(includeResult = false) {
        const model = this.readModel();
        if (includeResult && !this.result) throw new Error('Resuelve un modelo válido antes de exportar el resultado.');
        return { type: 'linear-programming', version: 1, algorithm: 'pl', exportedAt: new Date().toISOString(), model,
            ...(includeResult ? { result: this.result } : {}) };
    }

    importPayload(data) {
        if (data.type !== 'linear-programming' || data.version !== 1) throw new Error('Formato o versión de archivo PL no compatible.');
        const model = LinearProgrammingSolver.validate(data.model);
        this.example.value = ''; this.loadModel(model);
        // Nunca se confía en un resultado adjunto: siempre se vuelve a calcular.
    }

    static download(filename, content, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a'); link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);
    }

    exportModel() { LinearProgrammingController.download('optigraph-pl-modelo.json', JSON.stringify(this.payload(), null, 2), 'application/json'); }
    exportResult() { LinearProgrammingController.download('optigraph-pl-resultado.json', JSON.stringify(this.payload(true), null, 2), 'application/json'); }

    exportReport() {
        if (!this.result) throw new Error('Resuelve un modelo válido antes de generar el reporte.');
        const procedure = this.procedure.cloneNode(true);
        procedure.querySelectorAll('details').forEach(d => d.open = true);
        procedure.querySelectorAll('button').forEach(b => b.replaceWith(document.createTextNode(b.textContent)));
        const svg = this.graph.exportSvg();
        const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OptiGraph Studio · Método gráfico de PL</title>
          <style>body{font:14px/1.5 system-ui,sans-serif;max-width:1050px;margin:32px auto;padding:0 24px;color:#17202a}h1{font-size:25px}h2,summary{font-weight:650}svg{display:block;width:100%;max-height:720px}table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12px}td,th{border:1px solid #bcc7d1;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#edf2f5}details{margin:14px 0}details details{margin-left:12px}summary{font-size:16px}p{overflow-wrap:anywhere}.pl-optimal-row{background:#e7f4e9}.pl-selected-row{font-weight:500}.pl-step-content{padding:6px 0}.pl-table-wrap{overflow:visible}@media print{body{margin:0;padding:0}button{display:none}svg{max-height:650px}tr{break-inside:avoid}h1,summary{break-after:avoid}@page{size:A4;margin:16mm}}</style>
          <h1>Programación Lineal por el método gráfico</h1><p>OptiGraph Studio · Dos variables continuas, x ≥ 0 e y ≥ 0</p><button onclick="window.print()">Imprimir o guardar como PDF</button>
          ${this.summary.innerHTML}<p>${this.note.textContent}</p>${svg}${this.detail.innerHTML}<h2>Procedimiento completo</h2>${procedure.innerHTML}</html>`;
        LinearProgrammingController.download('optigraph-reporte-pl.html', html, 'text/html;charset=utf-8');
    }
}
