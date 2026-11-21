const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
// Playwright es opcional y solo se usa para validación; no se carga en la aplicación.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(__dirname, '../output/pl-validation');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end('No encontrado'); }
});

(async () => {
    await fs.mkdir(artifacts, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    const errors = [], requests = [], checks = [];
    const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('OK', name); };
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
        page.on('pageerror', e => errors.push(e.message));
        page.on('requestfailed', req => requests.push(req.url() + ': ' + req.failure()?.errorText));
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.locator('#btn-algorithm-pl').click();
        await page.locator('#pl-result[data-status="optimal-unique"]').waitFor();
        check('PL abre sin exigir nodos', await page.locator('#pl-result').innerText().then(t => t.includes('1.000')));
        check('Gráfica SVG visible', await page.locator('#pl-plot svg').isVisible());
        const cases = [
            ['computers', 'optimal-unique', '3.080.000'], ['contracts', 'optimal-unique', '1.900.000'],
            ['modules', 'optimal-unique', '34'], ['datacenter', 'optimal-unique', '71,5'],
            ['teacher', 'optimal-multiple', 'segmento'], ['infeasible', 'infeasible', 'No hay'],
            ['unbounded', 'unbounded', 'sin límite'], ['finite-open', 'optimal-unique', 'óptimo finito'],
            ['optimal-ray', 'optimal-multiple', 'infinitos'], ['equality', 'optimal-multiple', 'segmento'],
            ['point', 'optimal-unique', '10'], ['zero', 'optimal-multiple', 'toda la región']
        ];
        for (const [id, status, expected] of cases) {
            await page.selectOption('#pl-example', id);
            check('Caso ' + id, await page.locator('#pl-result').getAttribute('data-status') === status
                && (await page.locator('#pl-result').innerText()).includes(expected));
        }
        await page.selectOption('#pl-example', 'optimal-ray');
        check('Semirrecta óptima resaltada', await page.locator('[data-optimal-ray]').count() > 0);
        await page.selectOption('#pl-example', 'computers');
        await page.locator('#pl-c1').fill('');
        await page.waitForTimeout(320);
        check('Campo vacío retira resultados anteriores', await page.locator('#pl-errors').isVisible()
            && await page.locator('#pl-plot [data-vertex]').count() === 0);
        await page.locator('#pl-c1').fill('180000,0');
        await page.waitForTimeout(350);
        check('Coma decimal y actualización automática', (await page.locator('#pl-result').innerText()).includes('3.080.000'));
        await page.locator('#pl-add').click();
        const card = page.locator('#pl-constraints fieldset').last();
        await card.locator('[data-coefficient=a]').fill('1');
        await card.locator('[data-coefficient=b]').fill('0');
        await card.locator('[data-coefficient=rhs]').fill('6');
        await page.waitForTimeout(350);
        check('Agregar restricción vertical', (await page.locator('#pl-result').innerText()).includes('3.080.000'));
        await card.getByRole('button', { name: /Eliminar/ }).click();
        await page.waitForTimeout(350);
        check('Eliminar restricción', await page.locator('#pl-constraints fieldset').count() === 3);
        await page.locator('#pl-plot [data-vertex=B]').click();
        check('Selección gráfica de vértice', (await page.locator('#pl-vertex-detail h3').innerText()).includes('B'));
        await page.locator('#pl-halfplanes').check();
        await page.locator('#pl-zoom-in').click();
        await page.locator('#pl-zoom-out').click();
        await page.locator('#pl-fit').click();
        check('Controles de semiplanos y zoom', await page.locator('#pl-plot svg').isVisible());
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#pl-export-model').click();
        const download = await downloadPromise;
        const payload = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
        check('Exportación de modelo PL', payload.type === 'linear-programming' && payload.model.constraints.length === 3);
        const forged = { ...payload, result: { optimalValue: -999999 } };
        await page.locator('#graph-file-input').setInputFiles({ name: 'modelo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(forged)) });
        check('Importación recalcula sin confiar en resultado adjunto', (await page.locator('#pl-result').innerText()).includes('3.080.000'));
        const sparse = structuredClone(payload);
        sparse.model.constraints[0].id = 'R4';
        await page.locator('#graph-file-input').setInputFiles({ name: 'ids.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sparse)) });
        await page.locator('#pl-add').click();
        const identifiers = await page.locator('#pl-constraints fieldset').evaluateAll(cards => cards.map(c => c.dataset.id));
        check('Agregar después de importar mantiene IDs únicos', new Set(identifiers).size === identifiers.length);
        await page.locator('#pl-constraints fieldset').last().getByRole('button', { name: /Eliminar/ }).click();
        await page.waitForTimeout(350);
        await page.selectOption('#pl-example', 'computers');
        const resultPromise = page.waitForEvent('download');
        await page.locator('#pl-export-result').click();
        const resultDownload = await resultPromise;
        const resultPayload = JSON.parse(await fs.readFile(await resultDownload.path(), 'utf8'));
        check('Exportación de resultado con vértices y óptimo', Math.abs(resultPayload.result.optimalValue - 3080000) < 1e-6 && resultPayload.result.vertices.length === 4);

        // El estado PL se conserva al navegar a los módulos anteriores.
        for (const id of ['mst', 'dijkstra', 'floyd', 'floyd-isac']) {
            await page.locator('#btn-algorithm-' + id).click();
            check('Navegación a ' + id, await page.locator('#workspace-layout').isVisible() && !await page.locator('#pl-workspace').isVisible());
        }
        // Importar una red mientras PL está activo también conserva el modelo PL.
        await page.locator('#btn-algorithm-pl').click();
        const network = { version: 1, nodes: ['A', 'B', 'C'].map((id, i) => ({ id, label: id, x: i * 100, y: 0 })),
            edges: [{ id: 'ab', from: 'A', to: 'B', weight: 2 }, { id: 'bc', from: 'B', to: 'C', weight: 3 }, { id: 'ac', from: 'A', to: 'C', weight: 10 }] };
        await page.locator('#graph-file-input').setInputFiles({ name: 'red.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(network)) });
        await page.locator('#workspace-layout').waitFor({ state: 'visible' });
        await page.evaluate(() => Swal.close());
        check('Importación de redes desde PL mantiene compatibilidad', (await page.locator('#node-count').innerText()) === '3');
        for (const id of ['mst', 'dijkstra', 'floyd', 'floyd-isac']) {
            await page.locator('#btn-algorithm-' + id).click();
            if (id === 'dijkstra') await page.selectOption('#dijkstra-mode', 'target');
            if (id === 'floyd' || id === 'floyd-isac') {
                const prefix = id === 'floyd' ? 'floyd' : 'floyd-isac';
                await page.selectOption('#' + prefix + '-start-node', 'A');
                await page.selectOption('#' + prefix + '-target-node', 'C');
            }
            await page.locator('#btn-solve').click();
            if (id === 'mst' || id === 'dijkstra') {
                if (id === 'mst') await page.selectOption('#swal-start-node', 'A');
                else { await page.selectOption('#dijkstra-start', 'A'); await page.selectOption('#dijkstra-target', 'C'); }
                await page.locator('.swal2-confirm').click();
            }
            await page.waitForFunction(() => document.querySelector('#total-weight').textContent.includes('5'));
            check('Resolución de red en ' + id, (await page.locator('#total-weight').innerText()).includes('5'));
            await page.locator('.swal2-confirm').click();
        }
        await page.locator('#btn-algorithm-pl').click();
        check('PL conserva modelo y solución al volver', (await page.locator('#pl-result').innerText()).includes('3.080.000'));
        await page.locator('#pl-halfplanes').uncheck();
        await page.locator('.pl-sidebar').evaluate(el => { el.scrollTop = 0; });
        await page.screenshot({ path: path.join(artifacts, 'pl-desktop.png'), fullPage: false });
        check('Escritorio sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

        await page.selectOption('#pl-example', 'modules');
        const reportPromise = page.waitForEvent('download');
        await page.locator('#pl-report').click();
        const reportDownload = await reportPromise;
        const report = await fs.readFile(await reportDownload.path(), 'utf8');
        await fs.writeFile(path.join(artifacts, 'reporte-pl.html'), report);
        check('Reporte autónomo con SVG y operaciones', report.includes('<svg') && report.includes('Eliminando y') && report.includes('34'));
        const reportPage = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
        await reportPage.setContent(report);
        await reportPage.screenshot({ path: path.join(artifacts, 'pl-report.png'), fullPage: false });
        await reportPage.close();

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#pl-main').count();
        await page.locator('.pl-main').scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        check('Móvil sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(artifacts, 'pl-mobile.png'), fullPage: false });
        await page.locator('#pl-clear').scrollIntoViewIfNeeded();
        await page.locator('#pl-clear').click();
        check('Limpiar retira la solución', await page.locator('#pl-plot [data-vertex]').count() === 0);
        check('Sin errores JavaScript', errors.length === 0);
        check('Sin solicitudes fallidas', requests.length === 0);
        await fs.writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ checks, errors, failedRequests: requests }, null, 2));
        console.log(JSON.stringify({ total: checks.length, errors, failedRequests: requests }, null, 2));
    } catch (error) {
        console.error(error.stack, JSON.stringify({ errors, failedRequests: requests }));
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})();
