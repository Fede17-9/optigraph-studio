# OptiGraph Studio

Plataforma web interactiva para construir, editar, visualizar y resolver problemas de Investigación de Operaciones sobre redes.

El proyecto implementa actualmente el **Taller 1: Árbol de Expansión Mínima (AEM)** mediante el algoritmo de Prim. La aplicación está pensada como herramienta educativa: permite crear una red desde cero, cargar ejemplos, generar redes aleatorias, editar conexiones, observar empates y estudiar el procedimiento paso a paso.

## Objetivos

- Representar grafos no dirigidos y ponderados de forma visual.
- Permitir la construcción y edición directa de redes.
- Resolver el AEM mediante Prim.
- Explicar cada iteración del algoritmo.
- Detectar y visualizar empates de peso mínimo.
- Guardar, importar y exportar redes y resultados.
- Ofrecer una experiencia útil en escritorio, tablet y móvil.

## Tecnologías y lenguajes

### HTML5

`index.html` define la estructura semántica de la aplicación: encabezado, herramientas, canvas del grafo, footer de métricas y panel de procedimiento.

Se utiliza HTML5 porque permite construir una interfaz web liviana, portable y compatible con los navegadores modernos sin requerir un framework de componentes.

### CSS3

`css/styles.css` contiene estilos personalizados, animaciones, tema visual, modales, leyenda, métricas y reglas responsive.

Se utiliza CSS3 para controlar con precisión la identidad visual de la aplicación y adaptar el layout a distintos tamaños de pantalla. Tailwind CSS complementa estos estilos mediante clases utilitarias cargadas desde CDN.

### JavaScript ES6+

Los archivos de `js/` usan JavaScript moderno:

- Clases ES6.
- `const` y `let`.
- Funciones flecha.
- `async`/`await`.
- `Set` y `Map`.
- `Promise`.
- `Blob` y APIs del navegador para descargas.
- JSDoc para contratos y documentación técnica.

JavaScript es adecuado porque permite manejar la interacción del usuario, modificar el grafo en tiempo real, ejecutar Prim en el navegador y coordinar librerías externas sin backend.

### Vis Network

Vis Network proporciona:

- `vis.Network` para renderizar el grafo.
- `vis.DataSet` para almacenar nodos y aristas de forma reactiva.
- Eventos de clic, clic derecho, arrastre y zoom.
- Posicionamiento y estilos de aristas.

Se eligió porque permite editar y visualizar grafos directamente en el navegador sin implementar manualmente el canvas ni el sistema de coordenadas.

### SweetAlert2

SweetAlert2 gestiona modales y mensajes para:

- Pesos de conexiones.
- Confirmación de eliminaciones.
- Selección del nodo inicial.
- Creación de redes.
- Errores de conexidad.
- Importación y exportación.

Los modales reciben clases propias para mantener la identidad visual de OptiGraph Studio.

### JSON

JSON se utiliza como formato de persistencia porque es legible, portable y puede guardar nodos, posiciones, conexiones, pesos y resultados del algoritmo sin depender de un servidor.

## Arquitectura

La aplicación sigue una arquitectura modular de tres capas principales:

```text
index.html + styles.css
               |
               v
         main.js
          /   \
         v     v
GraphManager  MSTSolver
         |          |
         v          v
   Vis Network  Prim / DFS
```

### Capa de interfaz

`index.html` define la estructura y los identificadores de los controles. `css/styles.css` aplica el tema visual y el responsive.

### Capa de orquestación

`js/main.js` conecta eventos de la interfaz con los servicios de grafo y algoritmo. También actualiza métricas, modales, historial visual y exportaciones.

### Capa de grafo

`js/graph-manager.js` administra Vis.js, los `DataSet`, la edición, los presets, la persistencia y los estilos visuales.

### Capa algorítmica

`js/mst-algorithm.js` valida conexidad y ejecuta Prim. No depende del DOM ni de Vis.js, por lo que puede probarse con arreglos simples de JavaScript.

## Archivos del proyecto

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Estructura principal, controles, lienzo y paneles. |
| `css/styles.css` | Tema visual, layout responsive, modales y animaciones. |
| `js/main.js` | Controlador de UI, modales, persistencia y flujo de resolución. |
| `js/graph-manager.js` | Administración del grafo Vis.js y operaciones de edición. |
| `js/mst-algorithm.js` | Conexidad, Prim, empates y tabla de iteraciones. |
| `js/dijkstra-algorithm.js` | Dijkstra, distancias, relajaciones y reconstruccion de rutas. |
| `README.md` | Guía general del proyecto. |
| `docs/README-index.md` | Documentación detallada de `index.html`. |
| `docs/README-styles.md` | Documentación detallada de `css/styles.css`. |
| `docs/README-main.md` | Documentación detallada de `js/main.js`. |
| `docs/README-graph-manager.md` | Documentación detallada de `js/graph-manager.js`. |
| `docs/README-mst-algorithm.md` | Documentación detallada de `js/mst-algorithm.js`. |
| `docs/README-dijkstra-algorithm.md` | Documentación detallada de `js/dijkstra-algorithm.js`. |

## Taller 1: Árbol de Expansión Mínima

El AEM es un subconjunto de aristas que conecta todos los nodos de una red conexa con el menor costo total posible y sin formar ciclos.

## Taller 2: Dijkstra

Dijkstra calcula distancias mínimas desde un nodo de origen en la misma red no dirigida y ponderada del proyecto.

Tiene dos modos:

- **Origen a destino:** muestra la ruta mínima y su distancia.
- **Origen a todos:** muestra la tabla de distancias hacia todos los nodos.

La visualización activa reemplaza la anterior. La ruta mínima se muestra en naranja, los nodos procesados en amarillo y las aristas relajadas en azul.

### Flujo del algoritmo

1. Se valida que la red sea conexa mediante DFS.
2. El usuario selecciona un nodo de origen.
3. Prim inicializa `C_k` con ese nodo.
4. `C_bar_k` contiene los nodos aún no visitados.
5. Se buscan aristas que crucen la frontera entre ambos conjuntos.
6. Se elige la arista de menor peso.
7. Si hay varias con el mismo peso, se registra el empate.
8. Se incorpora el nuevo nodo y se actualiza el costo total.
9. Se repite hasta cubrir todos los nodos.

## Funcionalidades

### Edición manual

- Agregar nodos en cualquier punto del lienzo.
- Conectar dos nodos e ingresar el peso.
- Editar el peso de una conexión.
- Eliminar un nodo y sus conexiones.
- Eliminar una conexión individual.
- Arrastrar nodos y hacer zoom.

### Redes incluidas

- Red 1 basada en el diagrama de clase.
- Red 2 basada en el diagrama de clase.
- Red 3 con 15 nodos.

### Redes nuevas

#### Red vacía

Crea entre 2 y 50 nodos distribuidos en el lienzo sin conexiones. El usuario debe conectar los nodos manualmente.

#### Red aleatoria

Permite indicar:

- Cantidad de nodos.
- Densidad adicional.
- Peso máximo.

La red siempre es conexa porque primero se crea un árbol base y luego se agregan conexiones adicionales.

### Empates

Cuando dos o más aristas candidatas tienen el mismo peso mínimo:

- Una se selecciona de forma determinista para el AEM.
- Las demás se guardan como alternativas.
- Las alternativas aparecen como aristas azules punteadas.
- La bitácora muestra los pares de nodos involucrados.

### Persistencia

#### Exportar red

Guarda la estructura editable:

- Nodos.
- Etiquetas.
- Posiciones.
- Aristas.
- Pesos.

#### Exportar AEM

Guarda la red y la solución:

- Nodo inicial.
- Aristas seleccionadas.
- Aristas empatadas.
- Peso total.
- Historial paso a paso.

#### Importar

Un único botón detecta automáticamente si el JSON es una red simple o una exportación AEM. En el segundo caso restaura también las métricas, los estilos y la bitácora.

#### Reporte

Genera un HTML imprimible con nodo inicial, peso total, iteraciones, empates y tabla de pasos. El navegador permite guardarlo como PDF.

### Historial

Deshacer y Rehacer conservan snapshots de las modificaciones principales: ediciones, cargas, importaciones y generación de redes.

### Métricas

El footer muestra el estado de la red, cantidad de nodos, peso total del AEM, iteraciones y empates.

## Guía de uso

1. Seleccionar un preset o crear una red vacía/aleatoria.
2. Editar nodos y conexiones si es necesario.
3. Verificar que la red sea conexa.
4. Pulsar `Resolver AEM`.
5. Seleccionar el nodo inicial.
6. Revisar el grafo resaltado, las métricas y el procedimiento.
7. Exportar la red, el resultado AEM o el reporte.

## Validaciones de entrada

- Los pesos deben ser números mayores que cero.
- La red debe tener al menos dos nodos para resolver.
- Prim requiere conexidad.
- Las redes generadas admiten entre 2 y 50 nodos.
- La densidad aleatoria se expresa entre 0% y 100%.
- El peso máximo aleatorio admite valores enteros positivos.

## Responsive

En escritorio se muestran simultáneamente herramientas, lienzo y procedimiento. En pantallas pequeñas:

- Los paneles se apilan verticalmente.
- Herramientas y procedimiento pueden plegarse.
- Las métricas se reorganizan en una cuadrícula.
- El encabezado y la navegación se adaptan al ancho disponible.

## Documentación por archivo

- [Documentación de `index.html`](docs/README-index.md)
- [Documentación de `css/styles.css`](docs/README-styles.md)
- [Documentación de `js/main.js`](docs/README-main.md)
- [Documentación de `js/graph-manager.js`](docs/README-graph-manager.md)
- [Documentación de `js/mst-algorithm.js`](docs/README-mst-algorithm.md)

## Ejecución local

El proyecto es estático y no necesita un servidor backend. Puede abrirse `index.html` directamente, aunque un servidor HTTP local ofrece una experiencia más consistente para importar archivos y probar descargas.

Ejemplo con Python:

```powershell
python -m http.server 8000
```

Luego abrir:

```text
http://localhost:8000/index.html
```

## Buenas prácticas del proyecto

- Mantener separadas la UI, la visualización y la lógica algorítmica.
- Preferir métodos pequeños con una responsabilidad clara.
- Validar datos antes de cargarlos en Vis.js.
- Mantener los contratos JSON versionados.
- Documentar nuevos métodos con JSDoc.
- Probar los flujos de escritorio y móvil después de cada cambio visual.
- No mezclar manipulación del DOM dentro de `MSTSolver`.