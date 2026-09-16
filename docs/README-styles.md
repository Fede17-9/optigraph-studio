# Documentacion de `css/styles.css`

## Responsabilidad

`css/styles.css` contiene los estilos propios de OptiGraph Studio. Complementa las clases de Tailwind sin reemplazar la estructura visual definida en `index.html`.

## Areas de estilo

### Lienzo

`#canvas-container` define el fondo oscuro, la cuadricula de puntos y el crecimiento flexible dentro del area central. La propiedad `min-height: 0` evita que el canvas fuerce el tamano del layout flex.

### Paneles y responsive

Las reglas de `@media (max-width: 1100px)` reorganizan la aplicacion en una columna:

1. Herramientas.
2. Lienzo.
3. Procedimiento.

Los paneles laterales se convierten en bloques de ancho completo. Los botones de `mobile-panel-controls` permiten plegar herramientas y procedimiento.

El breakpoint de `640px` compacta el encabezado, footer y metricas para telefonos.

### Footer

Las clases `.app-footer`, `.footer-metrics`, `.footer-metric`, `.footer-metric-label` y `.footer-metric-value` mantienen estables las metricas aun cuando aparecen valores como `40 u`, cantidades de nodos o mensajes de estado de dos lineas.

### Herramientas

`.tool-action-button` define los botones secundarios de importar, exportar, generar redes, historial y restablecimiento. Su estado deshabilitado utiliza menor opacidad y cursor de espera.

`.solve-button` reserva una altura y separacion estable para Resolver AEM, evitando que choque con el selector de presets cuando el panel tiene poco espacio vertical.

### Leyenda

`.graph-legend` es el panel flotante del lienzo. Las clases `.legend-line-mst`, `.legend-line-tie` y `.legend-line-other` representan los tres estilos de aristas.

### Modales

Las clases `og-modal`, `og-modal-title`, `og-modal-text`, `og-modal-input`, `og-modal-confirm`, `og-modal-cancel` y `og-modal-deny` son asignadas desde SweetAlert2 mediante `customClass`.

El estilo comun proporciona:

- Fondo oscuro.
- Borde superior verde.
- Bordes redondeados.
- Inputs compatibles con tema oscuro.
- Botones con forma de capsula.
- Colores semanticos para confirmar, cancelar y eliminar.

### Procedimiento

`.step-card` aplica la animacion `fadeIn` a cada tarjeta de iteracion.

## Buenas practicas

- Mantener los estilos compartidos en clases reutilizables.
- Usar los breakpoints existentes antes de crear nuevos.
- No fijar alturas que oculten el procedimiento o el lienzo.
- Mantener contraste suficiente entre aristas, nodos, metricas y fondo.
- Cuando se agregue una regla de escritorio, revisar tambien `1100px` y `640px`.
