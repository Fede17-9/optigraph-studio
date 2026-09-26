# Documentacion de `index.html`

## Responsabilidad

`index.html` es el punto de entrada de OptiGraph Studio. Define la estructura visual de la aplicacion y carga las dependencias externas y los modulos JavaScript.

No contiene la logica del algoritmo de Prim. Su funcion es construir el esqueleto de la interfaz y exponer los identificadores HTML que utilizan `main.js` y `GraphManager`.

## Dependencias externas

El documento carga desde CDN:

- **Tailwind CSS:** clases utilitarias para layout, espaciado, color, tipografia y estados visuales.
- **Vis Network:** renderizado interactivo del grafo mediante `vis.Network` y `vis.DataSet`.
- **SweetAlert2:** modales, formularios, confirmaciones, mensajes y notificaciones toast.
- `css/styles.css`: estilos propios, responsive, modales, footer, leyenda y animaciones.

El orden de los scripts es importante:

1. `js/mst-algorithm.js` define `MSTSolver`.
2. `js/graph-manager.js` define `GraphManager`.
3. `js/main.js` instancia ambas clases y conecta los eventos de la interfaz.

## Estructura visual

### Encabezado

Contiene la marca OptiGraph Studio y la navegacion de talleres. El Taller 1: AEM esta habilitado; los talleres futuros aparecen bloqueados visualmente.

### Panel izquierdo de herramientas

El elemento `#tools-panel` contiene:

- `#btn-add-node`: activa la creacion manual de nodos.
- `#btn-add-edge`: activa la conexion de dos nodos.
- `#btn-clear`: limpia la red.
- `#btn-empty-network`: crea una red con nodos sin aristas.
- `#btn-random-network`: abre el formulario para crear una red aleatoria conexa.
- `#btn-undo` y `#btn-redo`: navegan por el historial de ediciones.
- `#btn-import`: abre el selector de archivos JSON.
- `#btn-export-network`: exporta una red editable.
- `#btn-export-result`: exporta la red junto con el resultado AEM.
- `#btn-export-report`: descarga un reporte HTML imprimible.
- `#btn-reset-view`: elimina el resaltado visual del AEM.
- `#select-demo`: carga los presets Red 1, Red 2 o Red 3.
- `#btn-solve`: inicia la resolucion de Prim.
- `#btn-algorithm-mst` y `#btn-algorithm-dijkstra`: cambian el algoritmo activo.
- `#dijkstra-controls`: selecciona el modo origen-destino u origen-a-todos.

El input `#graph-file-input` permanece oculto y es activado por el boton Importar.

### Lienzo central

`#canvas-container` es el contenedor que recibe la instancia de `vis.Network`. La leyenda `#graph-legend` explica los estilos visuales:

- Verde solido: arco seleccionado para el AEM.
- Azul punteado: arco alternativo empatado.
- Gris: arco no seleccionado.

### Footer de metricas

El footer muestra:

- `#status-indicator`: estado de la red.
- `#node-count`: cantidad de nodos.
- `#total-weight`: peso total del AEM.
- `#iteration-count`: cantidad de iteraciones.
- `#tie-count`: cantidad de arcos alternativos empatados.

### Panel derecho

`#procedure-panel` contiene `#steps-container`, donde `main.js` crea las tarjetas de la bitacora de Prim.

En pantallas pequenas existen `#btn-toggle-tools` y `#btn-toggle-procedure` para plegar los paneles laterales.

## Flujo de carga

Cuando el DOM termina de cargar, `main.js` crea `new GraphManager("canvas-container")`. El gestor inicializa Vis.js y luego el controlador registra los eventos de los botones y del algoritmo.

## Mantenimiento

Al agregar un control nuevo:

1. Crear el elemento HTML con un `id` unico.
2. Conectar su evento en `main.js`.
3. Agregar estilos en `css/styles.css` si no basta con Tailwind.
4. Mantener el orden de carga de los scripts.
5. Verificar la vista de escritorio y la responsive.
