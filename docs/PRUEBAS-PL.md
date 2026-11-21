# Banco de pruebas de PL y regresión

## Ejecución reproducible

Desde la raíz, con Node.js 20 o posterior:

```powershell
node --test
```

No requiere instalar dependencias ni iniciar un navegador. Hay **28 pruebas**:
24 del motor de PL y 4 de regresión de redes. Los resultados de referencia son
independientes de los valores calculados; se comparan con tolerancia de punto flotante.

## Casos académicos: esperado y obtenido

En la validación del 21 de noviembre de 2026 todos los siguientes casos coincidieron:

- Especificaciones: máximo de 40x+30y, con 2x+y≤40, x+2y≤50, x≤15.
  Esperado y obtenido: (10,20), Z=1000; óptimo único.
- Computadores: máximo de 180000x+250000y, con 2x+3y≤36, 4x+2y≤40,
  x+y≤14. Esperado y obtenido: (6,8), Z=$3.080.000; óptimo único.
- Contratos: máximo de 50000x+90000y, con 2x+5y≤100, x+2y≤40,
  x+y≤30. Esperado y obtenido: (20,10), Z=$1.900.000; óptimo único.
- Módulos: mínimo de 4x+3y, con 3x+2y≥24, x+2y≥16, x+y≤20.
  Esperado y obtenido: (4,6), Z=34; óptimo único.
- Centro de datos: máximo de 7x+5y, con 3x+2y≤30, 2x+4y≤32,
  x+y≤12. Esperado y obtenido: (7,4.5), Z=71.5; óptimo único.
  Los cruces (6,6) y (8,4) se rechazan; x+y≤12 es redundante.
- Profesora: mínimo de 3x+2y, con 3x+4y≤12 y 3x+2y≥2.
  Esperado y obtenido: Z=2 en **todo** el segmento (0,1)—(2/3,0).

Todos incorporan x,y≥0. Las pruebas verifican también que cada vértice cumpla todas
las restricciones, que no haya duplicados relevantes y que se registren candidatos descartados.

## Casos especiales

Se comprobaron infactibilidad (x+y≤1 y x+y≥3), función objetivo no acotada con
dirección testigo, región no acotada con mínimo finito (x,y≥1; min x+y=2), semirrecta
óptima (x≥1; min x), igualdad x+y=2, punto x=1,y=2, objetivo nulo, restricciones
redundantes incluso activas, condición inactiva pero necesaria, interceptos verticales
y horizontales, rectas coincidentes, triples cruces, tautologías y contradicciones
0x+0y, primer cuadrante sin condiciones adicionales, reescalado, negativos y
minimización no acotada. También se rechazan valores no finitos, operadores/IDs
inválidos y normalizaciones que desbordan la doble precisión.

La regresión usa A—B de peso 2, B—C de peso 3 y A—C de peso 10:
Prim conserva el AEM de costo 5; Dijkstra y ambos Floyd encuentran A—B—C con costo 5.
Se revisan además desconexión y respeto de dirección en ambos Floyd.

## Interfaz

El script opcional `scripts/check-ui.cjs` sirve la aplicación y utiliza Playwright
con Chrome instalado. Solo es una herramienta de desarrollo; no se publica como
dependencia de ejecución. Para repetirlo:

```powershell
npm install --no-save --package-lock=false playwright
node scripts/check-ui.cjs
```

Necesita conexión para los CDN existentes. Guarda capturas, reporte y registro JSON
en `output/pl-validation/` (ignorado por Git). Se revisan presets, actualización
automática, campos vacíos, coma decimal, agregar/eliminar, IDs importados, selección,
zoom, capas, archivos, recálculo de resultados importados, navegación y resolución
de una red en AEM/Dijkstra/ambos Floyd, y pantallas de 1600×1000 y 390×844.
Las capturas de referencia están en [evidence](evidence/).

La revisión visual comprende ejes y escala, sombreado, etiquetas, óptimo, distribución
en móvil y reporte autónomo. No se afirma cobertura exhaustiva de todos los tamaños,
tecnologías de asistencia ni casos numéricos mal condicionados.
