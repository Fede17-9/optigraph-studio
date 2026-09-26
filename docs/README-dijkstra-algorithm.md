# Documentacion de `js/dijkstra-algorithm.js`

## Responsabilidad

Este modulo implementa Dijkstra para redes no dirigidas con pesos positivos. Es un solver puro: no conoce el DOM, Vis.js ni SweetAlert2.

## Clase `DijkstraSolver`

### `solve(startNodeId, targetNodeId)`

Ejecuta Dijkstra desde un origen. El destino es opcional:

- Con destino: se detiene al procesarlo y reconstruye la ruta minima.
- Sin destino: calcula las distancias minimas hacia todos los nodos alcanzables.

Devuelve:

- `algorithm`: siempre `dijkstra`.
- `startNode`: origen.
- `targetNode`: destino o `null`.
- `distances`: distancia minima conocida por nodo.
- `predecessors`: predecesor usado para reconstruir rutas.
- `selectedPathEdges`: aristas de la ruta origen-destino.
- `settledNodes`: nodos procesados definitivamente.
- `relaxedEdges`: aristas que produjeron mejoras.
- `stepTable`: bitacora tabular de cada iteracion.

En cada paso, la tabla de distancias se presenta con el formato academico:

```text
Nodo: [Distancia, Predecesor]
```

Por ejemplo:

```text
R: [0, -], M: [6, R], N: [4, R]
```

El guion representa el origen o un nodo que aun no tiene predecesor.

### Proceso

1. Valida el origen y el destino.
2. Rechaza pesos no numericos, cero o negativos.
3. Construye una lista de adyacencia en ambas direcciones.
4. Inicializa la distancia del origen en cero y las demas en infinito.
5. Elige el nodo pendiente con menor distancia.
6. Relaja sus conexiones.
7. Actualiza distancias y predecesores.
8. Registra el paso.
9. Continua hasta terminar o alcanzar el destino.

### `validateWeights()`

Garantiza que todos los pesos sean finitos y mayores que cero, condicion requerida por Dijkstra.

### `buildAdjacency()`

Convierte las aristas en una estructura de adyacencia bidireccional para representar el modelo no dirigido del proyecto.

### `getClosestNode(unsettled, distances)`

Busca el nodo pendiente con la menor distancia conocida. En caso de empate conserva un desempate determinista basado en el orden de los nodos.

### `reconstructPath(startNodeId, targetNodeId, predecessors)`

Recorre los predecesores desde el destino hasta el origen y devuelve las aristas en orden origen-destino. Si el destino es inalcanzable, devuelve una lista vacia.

## Integracion

- `main.js` crea el solver al seleccionar el Taller 2.
- `GraphManager.highlightDijkstra()` pinta la ruta, nodos procesados y aristas relajadas.
- `main.js` renderiza `stepTable` con distancias y relajaciones.
- Las exportaciones Dijkstra incluyen `algorithm: "dijkstra"`.
- El importador reconoce el resultado y restaura la solucion especifica.

## Alcance actual

- Red no dirigida.
- Pesos estrictamente positivos.
- Origen-destino y origen-a-todos.
- Nodos inalcanzables representados con distancia infinita.
- Sin flechas ni modelo dirigido en esta version.
