# Arquitectura y matemática de Programación Lineal

## Responsabilidades

- `js/pl-solver.js`: clase `LinearProgrammingSolver`, funciones matemáticas sin DOM,
  SVG ni límites del visor. Exportación CommonJS opcional solo para las pruebas.
- `js/pl-graph-manager.js`: clase `LinearProgrammingGraphManager`, dibujo SVG,
  escala uniforme, zoom, desplazamiento, capas y selección. Usa recorte de polígonos
  únicamente para representar lo que cabe en pantalla.
- `js/pl-controller.js`: clase `LinearProgrammingController`, formulario, validación
  localizada, debounce de 220 ms, ejemplos, explicación y archivos.
- `js/main.js`: incorpora el modo `pl`, alterna los espacios independientes y enruta
  importaciones/exportaciones. Resuelve PL **antes** de la validación de dos nodos.

No hay framework, build ni dependencia de optimización. Los tres scripts clásicos
se cargan después de los algoritmos de redes y antes de `main.js`. Las reglas CSS
propias usan el prefijo `pl-`; los paneles se apilan a partir de 1100 px.

## Contrato del motor

```js
const result = new LinearProgrammingSolver({
    objective: { sense: 'max', c1: 40, c2: 30 },
    constraints: [
        { id: 'R1', a: 2, b: 1, op: '<=', rhs: 40 },
        { id: 'R2', a: 1, b: 2, op: '<=', rhs: 50 },
        { id: 'R3', a: 1, b: 0, op: '<=', rhs: 15 }
    ]
}).solve();
// optimal-unique; (10,20); Z=1000, salvo representación flotante.
```

Los números deben ser finitos, los IDs únicos y los operadores `<=`, `>=` o `=`.
Los IDs `sign-x` y `sign-y` se reservan para la no negatividad. No se usa `eval`.

Campos principales del resultado:

- `status`: `optimal-unique`, `optimal-multiple`, `infeasible` o `unbounded`.
- `regionBounded`, `dimension`: acotación y dimensión 0, 1 o 2; null si infactible.
- `intercepts`: puntos de corte o casos de eje coincidente/sin corte/fuera de escala.
- `intersections`: todos los pares, incluidos paralelos y coincidentes.
- `candidates`: cruces únicos, fuentes, sustituciones y factibilidad.
- `vertices`: casco convexo, etiquetas, Z y `activeConstraintIds`.
- `rays`: direcciones normalizadas de recesión y su `deltaZ`.
- `improvingDirection`: testigo de falta de óptimo finito, si lo hay.
- `optimalValue`, `optimalPoints`, `optimalRays`, `optimalSet`: descripción del
  conjunto óptimo (punto, segmento, semirrecta o toda la región).
- `redundantConstraintIds`: redundancias individuales, sin retirar filas.
- `model`, `originals`, `halfplanes`, `lines`, `trivial`: datos para explicar y dibujar.

## Procedimiento matemático

1. Normaliza cada normal (a,b) a longitud 1. Convierte ≥ multiplicando por −1,
   incorpora −x≤0 y −y≤0 y representa cada igualdad con dos semiplanos opuestos.
   Las restricciones 0x+0y se deciden lógicamente; no definen rectas.
2. Para cada par de rectas calcula Δ=a₁b₂−a₂b₁. Si es distinto de cero,
   x=(c₁b₂−c₂b₁)/Δ, y=(a₁c₂−a₂c₁)/Δ. Los cálculos utilizan los coeficientes
   normalizados; la explicación de clase muestra la eliminación con los originales.
   Las rectas paralelas y coincidentes se registran sin dividir entre cero.
3. Sustituye cada cruce en **todas** las condiciones originales. Agrupa puntos
   repetidos y obtiene el casco convexo antihorario con inicio lexicográfico.
   Un punto de un lado colineal no se convierte en vértice nuevo.
4. Evalúa Z. Como x,y≥0 hacen al poliedro apuntado, toda región factible no vacía
   tiene algún vértice, incluso si es un segmento, punto o región no acotada.
5. Calcula el cono de recesión `A d ≤ 0`. Sus direcciones extremas en este alcance
   son ejes o vectores paralelos a rectas límite. Si una dirección mejora Z, el
   objetivo es no acotado. Si ninguna mejora, compara Z en los vértices. Un empate
   forma un segmento óptimo; una dirección de variación cero desde un óptimo forma
   una semirrecta óptima. Con objetivo nulo toda la región es óptima.
6. Para comprobar redundancia retira **una** restricción y maximiza su posible
   violación con `core()`. Una igualdad requiere probar ambos sentidos. Si el
   auxiliar mejora sin límite o permite superar el límite, la condición es necesaria.
   No se infiere redundancia a partir de la actividad en un solo óptimo.

No se usa una caja artificial para decidir factibilidad, acotación u optimalidad.
La intersección del visor con los semiplanos solo genera el polígono SVG visible.
Los vectores `rays` pueden incluir direcciones adicionales a los rayos extremos;
todos cumplen el cono y permiten justificar la clasificación.

## Precisión y coste

Las comparaciones usan `EPS=1e-9` relativo a magnitudes normalizadas. Para detectar
paralelismo se usa un umbral de 16 veces `Number.EPSILON` en el determinante
normalizado. La comparación de Z también se escala por la norma del objetivo,
evitando que un objetivo pequeño convierta cualquier punto en óptimo por tolerancia.
No se redondean coordenadas antes de comprobar restricciones o evaluar Z.

Se utiliza doble precisión de JavaScript, no aritmética racional exacta. Restricciones
casi paralelas, escalas extremas o valores muy próximos a la tolerancia pueden ser
numéricamente ambiguos. Los desbordamientos detectados generan un error de escala.
La interfaz no garantiza precisión arbitraria; los ejemplos académicos están probados.

Con m condiciones hay O(m²) pares y O(m³) comprobaciones de factibilidad. La búsqueda
de duplicados puede alcanzar O(m⁴) en este diseño simple; comprobar redundancias
repite el núcleo O(m) veces. El objetivo es un número reducido de restricciones
para uso académico, sin garantía de rendimiento para modelos masivos.

## Archivos y seguridad

El formato PL es `{type:'linear-programming',version:1,algorithm:'pl',model,result?}`.
El importador valida el modelo y recalcula. El estado de redes permanece separado.
Las etiquetas importadas se agregan mediante `textContent`/atributos; la gráfica usa
`createElementNS`. El reporte serializa nodos ya escapados y un SVG con estilos
internos, sin CDN. La gráfica exportada corresponde a la vista actual.

Consultar el [manual](MANUAL-PL.md), el [banco de pruebas](PRUEBAS-PL.md) y el
[guion de demostración](DEMOSTRACION-PL.md).
