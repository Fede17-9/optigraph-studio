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
2. `js/dijkstra-algorithm.js` define `DijkstraSolver`.
3. `js/floyd-algorithm.js` define `FloydJuanManager`.
4. `js/graph-manager.js` define `GraphManager`.
5. `js/main.js` instancia los servicios y conecta los eventos de la interfaz.

Tailwind CSS y Vis Network se cargan sin una versión fijada en sus URLs. SweetAlert2 fija solo la versión mayor mediante `sweetalert2@11`. No hay un lockfile que registre las versiones exactas resueltas.

## Estructura visual

### Encabezado

Contiene la marca OptiGraph Studio y la navegación de algoritmos. AEM, Dijkstra y Floyd están habilitados. El botón de Flujo Máximo está deshabilitado y no tiene un solver implementado.

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
- `#btn-export-result`: exporta la red junto con el resultado del algoritmo activo.
- `#btn-export-report`: descarga un reporte HTML imprimible.
- `#btn-reset-view`: limpia el resaltado y el resultado activo sin borrar la red.
- `#select-demo`: carga los presets Red 1, Red 2, Red 3 o Red 4 de Floyd.
- `#btn-solve`: inicia la resolución del algoritmo activo.
- `#btn-algorithm-mst`, `#btn-algorithm-dijkstra` y `#btn-algorithm-floyd`: cambian el algoritmo activo.
- `#dijkstra-controls`: selecciona el modo origen-destino u origen-a-todos.
- `#floyd-controls`: contiene los selectores de origen/destino y el botón `#btn-floyd-query-path` para consultar rutas de Floyd.

El input `#graph-file-input` permanece oculto y es activado por el boton Importar.

### Lienzo central

`#canvas-container` es el contenedor que recibe la instancia de `vis.Network`. La leyenda `.graph-legend` cambia según el algoritmo; para Prim explica estos estilos:

- Verde solido: arco seleccionado para el AEM.
- Azul punteado: arco alternativo empatado.
- Gris: arco no seleccionado.

### Footer de metricas

El footer muestra:

- `#status-indicator`: estado de la red.
- `#node-count`: cantidad de nodos.
- `#total-weight`: peso total del AEM o distancia de la ruta consultada.
- `#iteration-count`: cantidad de iteraciones.
- `#tie-count`: alternativas empatadas acumuladas en Prim, pasos con empate en Dijkstra o mejoras de distancia en Floyd, aunque la etiqueta visible siga diciendo «Empates».

### Panel derecho

`#procedure-panel` contiene `#steps-container`, donde `main.js` crea las tarjetas de Prim, los pasos de Dijkstra o las matrices de Floyd, según el algoritmo activo.

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
