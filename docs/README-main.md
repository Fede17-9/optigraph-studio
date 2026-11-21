# Documentacion de `js/main.js`

## Responsabilidad

`main.js` es el controlador principal de OptiGraph Studio. Se ejecuta cuando el DOM esta listo y conecta la interfaz HTML con `GraphManager`, `MSTSolver` y SweetAlert2.

También coordina Dijkstra y Floyd-Warshall: selección de algoritmo, modos de Dijkstra, tablas de distancias, matrices de Floyd, consultas de rutas y restauración de resultados importados.

No implementa la matematica de Prim ni dibuja directamente el canvas. Coordina los servicios que viven en los otros modulos.

## Estado de la aplicacion

- `graphManager`: instancia que administra la red visual.
- `lastSolveResult`: ultima solucion calculada o importada.
- `lastStartNode`: nodo inicial de la ultima solucion.
- `activeAlgorithm`: algoritmo activo (`mst`, `dijkstra`, `floyd`, `floyd-isac` o `pl`).
- `currentFloydSolver`: instancia de Floyd usada para consultar rutas después del cálculo.
- `currentFloydIsacSolver`: instancia con la convención de predecesores de Isac.
- `plController`: modelo, resultado y vista PL independientes de la red.

Estos datos permiten actualizar el footer y exportar el resultado activo. Viven en memoria y no se guardan automáticamente al cerrar la página.

## Integración de Programación Lineal

`updateAlgorithmUi()` alterna `workspace-layout` y `pl-workspace`, sin vaciar los
nodos ni el modelo PL. El controlador PL administra sus propios controles y tres
paneles. El evento de resolver se dirige a PL antes de comprobar dos nodos.

El importador distingue `type: 'linear-programming'` antes de invocar
`GraphManager.importGraph()`: valida y recalcula PL; los formatos antiguos siguen
su ruta anterior. Los eventos de exportación también despachan primero el modo PL.
Las responsabilidades de sus tres módulos se detallan en
[README-programacion-lineal.md](README-programacion-lineal.md).

## Inicializacion

El listener `DOMContentLoaded`:

1. Crea `GraphManager`.
2. Obtiene referencias a botones, selectores, paneles, input de archivos y metricas.
3. Conecta los callbacks de cantidad de nodos e historial.
4. Registra todos los eventos de usuario.

## Herramientas de edicion

### Agregar nodo

Activa el modo `add-node` en GraphManager. El siguiente clic sobre una zona libre del canvas crea el nodo.

### Conectar arco

Activa `add-edge`, reinicia el nodo origen y solicita el destino. GraphManager abre el modal para ingresar el peso.

### Limpiar red

Elimina nodos y aristas y llama `resetUI()` para limpiar metricas, estado e historial visual del procedimiento.

## Generacion de redes

### Red vacia

Abre un modal que valida de 2 a 50 nodos. Luego llama `createEmptyNetwork()` y deja activo el modo de conexion.

### Red aleatoria

Solicita:

- Cantidad de nodos.
- Densidad adicional en porcentaje.
- Peso maximo.

Convierte la densidad de porcentaje a rango `0..1` y llama `createRandomNetwork()`. La red es conexa porque GraphManager crea primero una estructura base.

## Importacion y exportacion

### Importar

Lee un archivo JSON, lo analiza y lo entrega a `GraphManager.importGraph()`.

El importador admite una red simple o una exportación con `graph` y `result`. Selecciona la restauración mediante `result.algorithm`, `graphData.algorithm` o `mst` como valor predeterminado. `restoreSolutionView()` recupera para Prim:

- Resaltado de aristas.
- Peso total.
- Iteraciones.
- Empates.
- Tarjetas de procedimiento.
- Estado de red calculada.

Para Dijkstra utiliza `restoreDijkstraView()` y para Floyd, `restoreFloydView()`. El resultado adjunto no tiene validación estructural completa; restaurar la vista no verifica la corrección matemática de la solución importada.

### Exportar red

Usa `getGraphData()` y descarga un JSON editable con nodos y aristas.

### Exportar AEM

Descarga la red actual y el objeto `result`, que incluye nodo inicial, aristas seleccionadas, empates, peso total y `stepTable`.

El mismo control exporta `optigraph-dijkstra.json` u `optigraph-floyd.json` cuando corresponde. El contenedor incluye `version: 2`, `algorithm`, `exportedAt`, `graph` y `result`.

### Reporte

`downloadReport()`, `downloadDijkstraReport()` y `downloadFloydReport()` crean HTML independiente con el resumen y procedimiento del algoritmo correspondiente. El usuario puede abrirlo e imprimirlo; guardar como PDF depende del navegador.

## Historial

Los botones Deshacer y Rehacer llaman `graphManager.undo()` y `graphManager.redo()`. `updateHistoryButtons()` refleja si hay estados disponibles.

## Resolucion AEM

El flujo de `btnSolve` es:

1. Obtener nodos y aristas actuales.
2. Validar que existan al menos dos nodos.
3. Construir dinamicamente el selector del nodo inicial.
4. Crear `new MSTSolver(nodes, edges)`.
5. Ejecutar `solvePrim(selectedStartNode)`.
6. Guardar resultado y nodo inicial.
7. Llamar `restoreSolutionView()`.
8. Mostrar el modal de exito.

Si DFS determina que la red no es conexa, se actualiza el estado visual y se muestra el modal de error.

## Resolucion Dijkstra

Cuando el algoritmo activo es Dijkstra, `btnSolve` solicita origen y, en modo origen-destino, destino. Instancia `DijkstraSolver`, pinta la ruta minima mediante `highlightDijkstra()` y renderiza una tabla de nodos procesados, distancias y relajaciones. Cada distancia se presenta como `[Distancia, Predecesor]` para coincidir con el formato academico de los talleres.

Los valores desconocidos se presentan con `-` en lugar de `?`, tanto en el panel como en el reporte.

## Resolución Floyd-Warshall

`solveFloyd()` crea `FloydJuanManager`, ejecuta `solve()` y conserva la instancia en `currentFloydSolver`. `restoreFloydView()` muestra matrices y métricas; `queryFloydPath()` reconstruye y resalta una ruta entre los nodos seleccionados. Si todavía no hay una instancia, la consulta calcula las matrices primero.

`renderFloydStepTables()` presenta la iteración inicial y cada pivote con las matrices D y P, destacando las celdas que mejoran. El contador rotulado «Empates» recibe `totalRelaxations`, no un recuento de empates de Floyd.

## Límites del estado y la importación

- `onGraphChange` actualiza los controles de historial y los selectores de Floyd; no invalida automáticamente `lastSolveResult` ni `currentFloydSolver`. Después de editar manualmente hay que volver a resolver.
- `JSON.stringify` convierte `Infinity` en `null`; no existe recuperación de ese valor al importar resultados.
- Hay interpolación de datos importados en HTML sin escape. Utilizar archivos de confianza hasta incorporar validación y escape completos.
- Los valores de los selectores son texto; los IDs numéricos importados pueden no coincidir con los IDs esperados por los solvers.

## `restoreSolutionView(result)`

Centraliza la presentacion de una solucion nueva o importada:

- Llama `highlightMST()`.
- Renderiza `stepTable`.
- Actualiza estado, peso, iteraciones y empates.

## `renderProcedureSteps(stepTable)`

Crea tarjetas DOM para cada iteracion. Cada tarjeta muestra:

- Numero de paso.
- Peso seleccionado.
- `C_k`.
- `C_bar_k`.
- Arista elegida.
- Texto del empate cuando existe.

## `downloadJson(filename, data)`

Serializa un objeto con `JSON.stringify`, crea un `Blob`, genera una URL temporal y dispara una descarga desde un enlace temporal.

## Integracion

- `index.html` expone los IDs que busca el controlador.
- `GraphManager` administra datos, edicion, persistencia y estilos.
- `MSTSolver`, `DijkstraSolver` y `FloydJuanManager` devuelven los resultados matemáticos sin manipular el DOM.
- SweetAlert2 gestiona formularios, confirmaciones, errores y notificaciones.
- `styles.css` define las clases usadas por los modales, controles y layout responsive.
