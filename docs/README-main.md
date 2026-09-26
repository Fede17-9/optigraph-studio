# Documentacion de `js/main.js`

## Responsabilidad

`main.js` es el controlador principal de OptiGraph Studio. Se ejecuta cuando el DOM esta listo y conecta la interfaz HTML con `GraphManager`, `MSTSolver` y SweetAlert2.

Tambien coordina el Taller 2: Dijkstra, incluyendo la seleccion del algoritmo, los modos origen-destino/origen-a-todos, la tabla de distancias y la restauracion de resultados importados.

No implementa la matematica de Prim ni dibuja directamente el canvas. Coordina los servicios que viven en los otros modulos.

## Estado de la aplicacion

- `graphManager`: instancia que administra la red visual.
- `lastSolveResult`: ultima solucion calculada o importada.
- `lastStartNode`: nodo inicial de la ultima solucion.

Estos datos permiten actualizar el footer y exportar el resultado AEM.

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

El importador admite una red simple y una exportacion AEM completa. Si se restaura una solucion, `restoreSolutionView()` recupera:

- Resaltado de aristas.
- Peso total.
- Iteraciones.
- Empates.
- Tarjetas de procedimiento.
- Estado de red calculada.

### Exportar red

Usa `getGraphData()` y descarga un JSON editable con nodos y aristas.

### Exportar AEM

Descarga la red actual y el objeto `result`, que incluye nodo inicial, aristas seleccionadas, empates, peso total y `stepTable`.

### Reporte

`downloadReport()` crea un HTML independiente con resumen y tabla de iteraciones. El usuario puede abrirlo o imprimirlo como PDF.

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
- `MSTSolver` devuelve el resultado matematico.
- SweetAlert2 gestiona formularios, confirmaciones, errores y notificaciones.
- `styles.css` define las clases usadas por los modales, controles y layout responsive.
