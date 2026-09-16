# Documentacion de `js/mst-algorithm.js`

## Responsabilidad

Este archivo contiene la logica matematica del Taller 1. Define la clase `MSTSolver`, que valida la conexidad y ejecuta el algoritmo de Prim sobre una red no dirigida y ponderada.

El modulo no conoce el DOM, Vis.js ni SweetAlert2. Recibe datos simples y devuelve un resultado que luego consume `main.js`.

## Modelo de datos

### `GraphNode`

Representa un nodo:

- `id`: identificador unico, de tipo texto o numero.
- `label`: etiqueta visible opcional.

### `WeightedEdge`

Representa una arista no dirigida:

- `id`: identificador de la arista.
- `from`: primer extremo.
- `to`: segundo extremo.
- `weight`: costo positivo utilizado por Prim.

## Clase `MSTSolver`

### Constructor

`constructor(nodes, edges)` guarda referencias a las listas de nodos y aristas que seran analizadas.

### `isConnected()`

Determina si todos los nodos pertenecen al mismo componente conexo.

Proceso:

1. Si no hay nodos, devuelve `false`.
2. Crea un `Map` de adyacencia para cada nodo.
3. Agrega cada arista en ambas direcciones porque la red es no dirigida.
4. Ejecuta una busqueda en profundidad DFS desde el primer nodo.
5. Compara la cantidad de nodos visitados con la cantidad total de nodos.

Si la cantidad coincide, la red es conexa y Prim puede construir un AEM completo.

### `solvePrim(startNodeId)`

Ejecuta Prim y devuelve:

```js
{
  selectedEdges: [],
  tiedEdges: [],
  totalWeight: 0,
  stepTable: []
}
```

#### Seleccion del nodo de origen

Usa `startNodeId` si existe. Si no existe o no se proporciona, usa el primer nodo disponible.

#### Conjuntos del algoritmo

- `C_k`: nodos que ya pertenecen a la expansion actual.
- `C_bar`: nodos que aun no han sido incorporados.

La ejecucion termina cuando `C_bar` queda vacio.

#### Evaluacion de candidatos

En cada iteracion se recorren todas las aristas. Solo se consideran las que cruzan la frontera entre `C_k` y `C_bar`, es decir, una arista que conecta un nodo visitado con uno no visitado.

#### Seleccion y empates

1. Se calcula `minWeight` con el menor peso entre los candidatos.
2. `minimumEdges` conserva todas las aristas que tienen ese peso.
3. La primera arista se elige de forma determinista para continuar la construccion del AEM.
4. Las restantes se guardan como `alternativeEdges` y se acumulan en `tiedEdges`.
5. `tieDescription` genera la explicacion textual para la bitacora.

Esto permite diferenciar entre el arco seleccionado y otras alternativas validas con el mismo costo.

#### Actualizacion

Despues de registrar el paso:

- Se incorpora el nuevo nodo a `C_k`.
- Se elimina de `C_bar`.
- Se agrega la arista elegida a `selectedEdges`.
- Se suma su peso a `totalWeight`.
- Se incrementa el numero de iteracion.

## `PrimStep`

Cada registro de `stepTable` contiene:

- `iteration`: numero de paso.
- `Ck`: contenido de `C_k` antes de seleccionar.
- `Cbar`: contenido de `C_bar` antes de seleccionar.
- `selectedEdge`: arista elegida.
- `weight`: peso de la arista elegida.
- `tieEdges`: alternativas del empate de esa iteracion.
- `tieDescription`: texto explicativo o `null`.

## Integracion con otros archivos

- `main.js` crea `MSTSolver` al pulsar Resolver AEM.
- `main.js` envia los nodos y aristas actuales.
- `main.js` recibe el resultado y actualiza metricas, historial visual y panel de pasos.
- `graph-manager.js` utiliza `selectedEdges` y `tiedEdges` para pintar el grafo.

## Consideraciones

- Prim requiere pesos numericos positivos.
- La red debe ser conexa para que el AEM cubra todos los nodos.
- El algoritmo soporta identificadores de letras, numeros o textos.
- El archivo no modifica los DataSet de Vis.js ni el DOM.
