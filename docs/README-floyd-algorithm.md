# Documentación de `js/floyd-algorithm.js` (FloydJuanManager)

## Responsabilidad y Contexto Académico

Este módulo implementa el **Algoritmo de Floyd-Warshall** para encontrar las rutas más cortas entre **todos los pares de nodos** en redes dirigidas o no dirigidas con pesos estrictamente positivos ($> 0$). 

Ha sido diseñado como un motor matemático desacoplado de la interfaz gráfica y de librerías externas, facilitando la sustentación académica y el cumplimiento estricto de las reglas del curso de Investigación de Operaciones.

---

## Principio Teórico y Formulación Matemática

El algoritmo de Floyd-Warshall es un método de **Programación Dinámica** que evalúa progresivamente si un nodo intermedio $k$ ofrece un camino más corto entre cualquier par de nodos $(i, j)$.

Sea $V = \{1, 2, \dots, N\}$ el conjunto de vértices de la red.
Se definen dos secuencias de matrices para cada iteración $k \in \{0, 1, \dots, N\}$:
1. $D^{(k)}[i][j]$: Longitud del camino más corto desde el nodo $i$ hasta el nodo $j$, utilizando únicamente vértices intermedios del subconjunto $\{1, 2, \dots, k\}$.
2. $P^{(k)}[i][j]$: Etiqueta del pivote intermedio que produjo una mejora del camino de $i$ a $j$. En el estado inicial contiene la etiqueta del destino fuera de la diagonal y `-` en la diagonal. Esta implementación no utiliza la convención de predecesor inmediato.

### Ecuación de Recurrencia (Paso Inductivo)

Para cada iteración $k \in \{1, \dots, N\}$ y para todo par $(i, j)$:

$$D^{(k)}[i][j] = \min \Big( D^{(k-1)}[i][j], \; D^{(k-1)}[i][k] + D^{(k-1)}[k][j] \Big)$$

Si $D^{(k-1)}[i][k] + D^{(k-1)}[k][j] < D^{(k-1)}[i][j]$:
- Se actualiza la distancia: $D^{(k)}[i][j] = D^{(k-1)}[i][k] + D^{(k-1)}[k][j]$
- Se registra la etiqueta del pivote: $P^{(k)}[i][j] = \operatorname{etiqueta}(k)$.

---

## Reglas de Construcción de Matrices Iniciales ($k = 0$)

1. **Diagonal Principal en 0**:
   $$D^{(0)}[i][i] = 0, \quad \forall i \in \{1, \dots, N\}$$
2. **Aristas Dirigidas ($u \to v$ con peso $W$)**:
   $$D^{(0)}[u][v] = W, \quad D^{(0)}[v][u] = \infty \quad (\text{salvo que exista arco } v \to u)$$
3. **Aristas No Dirigidas / Bidireccionales ($u \leftrightarrow v$ con peso $W$)**:
   $$D^{(0)}[u][v] = W, \quad D^{(0)}[v][u] = W$$
4. **Ausencia de Conexión**:
   $$D^{(0)}[i][j] = \infty \quad (\text{si } i \neq j \text{ y no existe conexión directa})$$
5. **Matriz de Recorridos Inicial $P^{(0)}$**:
   - $P^{(0)}[i][j] = \operatorname{etiqueta}(j)$ para toda celda fuera de la diagonal, incluso si no existe conexión directa.
   - $P^{(0)}[i][i]$ contiene `-`.
   - La matriz de distancias determina si el par es alcanzable; una etiqueta en `P` no demuestra que exista camino.

---

## Métodos de la Clase `FloydJuanManager`

### `validateNetwork()`
- Comprueba que la red posea al menos dos nodos.
- Comprueba que todos los pesos de las aristas sean valores numéricos finitos y mayores que cero ($W > 0$).
- Lanza un error explicativo en caso de pesos negativos, nulos o no numéricos.

### `buildInitialMatrices()`
- Construye y retorna las matrices $D^{(0)}$ y $P^{(0)}$ siguiendo las reglas de inicialización para redes dirigidas y no dirigidas.

### `solve()`
- Ejecuta los **tres bucles anidados manuales**:
  - Bucle exterior: $k$ de $0$ a $N-1$ (nodo pivote).
  - Bucle intermedio: $i$ de $0$ a $N-1$ (nodo origen/fila).
  - Bucle interior: $j$ de $0$ a $N-1$ (nodo destino/columna).
- Guarda en `stepHistory` el estado inmutable de $D^{(k)}$ y $P^{(k)}$ en cada iteración, junto con las celdas actualizadas (`updatedCells`) para resaltar cambios en la interfaz.

### `reconstructPath(startNodeId, targetNodeId)`
- Reconstruye la ruta óptima de forma **estrictamente recursiva**:
  ```javascript
  const recursiveBuild = (srcIdx, destIdx) => {
      if (srcIdx === destIdx) return [destIdx];
      const pivot = this.finalP[srcIdx][destIdx];
      if (!pivot || pivot === '-') return null;
      const pivotIdx = this.nodeIndexByLabel.get(pivot);
      if (pivotIdx === undefined) return null;
      if (pivotIdx === destIdx) return [srcIdx, destIdx];
      const left = recursiveBuild(srcIdx, pivotIdx);
      const right = recursiveBuild(pivotIdx, destIdx);
      if (!left || !right) return null;
      return [...left, ...right.slice(1)];
  };
  ```
- Si $D[u][v] = \infty$, retorna `reachable: false` (camino inalcanzable).
- Si existe camino, retorna los nodos y aristas de Vis.js correspondientes para resaltado visual.
- Requiere etiquetas únicas para que el mapeo de pivotes a índices sea inequívoco. El fragmento anterior resume la función interna de `reconstructPath()`; no es una API independiente.

---

## Visualización UI tipo Plantilla Excel

La interfaz gráfica implementa los requerimientos pedagógicos:
1. **Bloques por Iteración**: Cada paso se presenta bajo el título `Iteración k (Nodo Pivote X)`.
2. **Tablas Gemelas**:
   - **Matriz de Distancias**: Encabezado azul marino.
   - **Matriz de Recorridos**: Encabezado verde esmeralda.
3. **Resaltado de Fila y Columna Pivote**: En la matriz de distancias, la fila $k$ y la columna $k$ se iluminan en amarillo suave para evidenciar visualmente el cruce $D[i][k] + D[k][j]$.
4. **Celdas Actualizadas**: Las celdas que sufren mejoras de costo se destacan con texto en negrita y borde luminoso celeste.
5. **Red de Ejemplo de 8 Nodos**: Preset `Red 4: Floyd 8 Nodos (Juan)` cargable con un solo clic.

## Persistencia y límites

`main.js` exporta el resultado con `algorithm: "floyd"` y genera un reporte HTML con las matrices. La serialización JSON actual convierte `Infinity` en `null` y no lo restaura al importar. Después de editar la red se debe volver a resolver: la edición manual no invalida automáticamente la instancia anterior. Consulta las [limitaciones generales](../README.md#limitaciones-conocidas).
