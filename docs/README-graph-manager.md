# Documentacion de `js/graph-manager.js`

## Responsabilidad

`graph-manager.js` define `GraphManager`, la capa que administra el grafo visual y editable. Es el puente entre los datos de nodos/aristas y la libreria Vis.js.

La clase controla:

- Inicializacion de `vis.Network`.
- `vis.DataSet` de nodos y aristas.
- Modos de edicion.
- Menus contextuales.
- Presets.
- Importacion y exportacion JSON.
- Historial de deshacer y rehacer.
- Creacion de redes vacias y aleatorias.
- Estilos del AEM y empates.
- Estilos de la ruta Dijkstra, nodos procesados y aristas relajadas.

## Estado principal

- `container`: elemento HTML del lienzo.
- `nodes`: `vis.DataSet` de nodos.
- `edges`: `vis.DataSet` de aristas.
- `network`: instancia de `vis.Network`.
- `mode`: `select`, `add-node` o `add-edge`.
- `selectedSourceNode`: nodo origen temporal al conectar.
- `onNodeCountChange`: callback para actualizar el contador.
- `onGraphChange`: callback para actualizar botones de historial.
- `_history`: snapshots de nodos y aristas.
- `_historyIndex`: posicion actual dentro del historial.

## Inicializacion de Vis.js

### `_initNetwork()`

Configura:

- Nodos circulares azules.
- Etiquetas monoespaciadas.
- Aristas ponderadas con etiquetas.
- Fisica desactivada para los presets y ediciones normales.
- Arrastre de nodos.
- Zoom y desplazamiento del lienzo.
- Hover para interaccion visual.

El contenedor bloquea el menu contextual nativo para que el clic derecho pueda usarse en la edicion.

### `_bindEvents()`

Registra dos familias de eventos:

#### Clic izquierdo

- En modo `add-node`, agrega un nodo donde se hizo clic.
- En modo `add-edge`, guarda el primer nodo y luego abre el modal de peso al seleccionar el segundo.

#### Clic derecho

Usa el evento `oncontext` de Vis.js y las coordenadas `params.pointer.DOM`:

- `getNodeAt` identifica nodos.
- `getEdgeAt` identifica aristas.
- Nodo encontrado: abre confirmacion de eliminacion.
- Arista encontrada: permite cambiar peso o eliminar.

Los `DataSet` notifican cambios mediante `nodes.on('*')` y `edges.on('*')`.

## Edicion manual

### `addNode(x, y)`

Crea un nodo con identificador alfabetico basado en la cantidad actual de nodos y conserva la posicion recibida desde Vis.js.

### `promptAddEdge(fromNode, toNode)`

Solicita un peso positivo usando SweetAlert2, evita conexiones duplicadas y agrega la arista con etiqueta y propiedad `weight`.

### `promptDeleteNode(nodeId)`

Elimina las aristas incidentes y despues el nodo. El contador se actualiza mediante el callback reactivo.

### `promptManageEdge(edgeId)`

Ofrece dos acciones:

- Editar el peso y actualizar la etiqueta.
- Eliminar unicamente la conexion.

## Estilos del grafo

### `highlightMST(mstEdges, tieEdges)`

Aplica estilos visuales segun el resultado de Prim:

- AEM: verde, solido y ancho.
- Empates: azul y punteado.
- Aristas restantes: gris atenuado.

Si una arista aparece como seleccionada y empatada, el estilo verde del AEM tiene prioridad.

### `resetVisualStyles()`

Devuelve todas las aristas al estilo base sin modificar nodos, conexiones ni pesos.

### `highlightDijkstra(result)`

Pinta el resultado de Dijkstra sin reutilizar la paleta de Prim:

- Naranja: ruta mínima final.
- Amarillo: nodos procesados.
- Azul: aristas relajadas.
- Gris: elementos restantes.

## Presets

### `loadPresetNetwork(presetKey)`

Carga las redes academicas `red1`, `red2` o `red3`. Cada preset define nodos, coordenadas, aristas y pesos. La clase limpia el estado anterior y ajusta el zoom con `network.fit`.

## Generacion de redes

### `createEmptyNetwork(nodeCount)`

- Valida entre 2 y 50 nodos.
- Limpia el grafo.
- Distribuye nodos en una circunferencia.
- No crea aristas.

### `createRandomNetwork(nodeCount, density, maxWeight)`

- Valida cantidad, densidad y peso maximo.
- Crea primero un arbol base, garantizando conexidad.
- Agrega aristas adicionales segun la densidad.
- Asigna pesos enteros positivos aleatorios.
- Guarda el resultado en los DataSet.

La densidad no modifica Prim; solo controla cuantas conexiones extras pueden aparecer.

## Persistencia

### `getGraphData()`

Devuelve una copia serializable con version, fecha, nodos y aristas. Se usa para Exportar red.

### `importGraph(graphData)`

Acepta dos formatos:

1. Red simple con `nodes` y `edges` en la raiz.
2. Resultado AEM con `graph.nodes`, `graph.edges` y `result`.

Valida identificadores, extremos y pesos antes de reemplazar el grafo actual. Si existe `result`, lo devuelve a `main.js` para restaurar la vista solucionada.

## Historial

- `_recordHistory()`: guarda snapshots evitando duplicados.
- `_restoreSnapshot(snapshot)`: restaura nodos y aristas sin crear otra entrada.
- `undo()`: vuelve al snapshot anterior.
- `redo()`: avanza al siguiente snapshot.
- `canUndo()` y `canRedo()`: habilitan o deshabilitan botones.

El historial incluye ediciones, cargas de presets, importaciones, redes vacias y redes aleatorias.

## Integracion con otros archivos

- `index.html` proporciona `#canvas-container`.
- `main.js` crea el gestor y consume sus callbacks y metodos publicos.
- `mst-algorithm.js` no depende de `GraphManager`; ambos se conectan desde `main.js`.
- `styles.css` define las clases visuales usadas por modales y controles.
