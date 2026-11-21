# Manual de Programación Lineal

## Abrir y formular

Selecciona **PL · Método gráfico** en el menú. No necesitas crear nodos ni arcos.
La sección conserva su modelo al navegar a redes y volver. Todo permanece en memoria:
exporta el modelo antes de cerrar o recargar la página.

1. Elige maximizar o minimizar y escribe los coeficientes de `Z = c1 x + c2 y`.
2. Agrega las restricciones. En cada fila escribe los coeficientes de x e y,
   selecciona ≤, ≥ o = y completa el término independiente.
3. Las condiciones `x ≥ 0`, `y ≥ 0` siempre están incorporadas. Si un término no
   aparece, escribe **0** en su coeficiente. Un campo vacío no equivale a cero.
4. Usa **Resolver modelo** para calcular y ajustar la vista. Al editar también se
   recalcula después de una pausa breve. Un campo inválido retira el resultado anterior.

Se aceptan negativos y decimales con punto o coma: `4.5` y `4,5` son equivalentes.
No uses separadores de miles: para ciento ochenta mil escribe `180000`.
Las variables son continuas. Por ejemplo, el centro de datos obtiene `y = 4,5`;
redondearlo cambia el problema. No se resuelven variables libres ni enteras.

## Leer la gráfica y el procedimiento

- Izquierda: formulario y archivos. Centro: plano, resumen y vértice seleccionado.
  Derecha: las seis etapas del procedimiento. En móvil se apilan en ese orden.
- Cada restricción tiene un color y un identificador. **Mostrar semiplanos** permite
  inspeccionar los lados que satisface cada desigualdad. Una igualdad se dibuja como recta.
- El verde es la intersección que satisface **todas** las condiciones. No siempre
  corresponde al triángulo que forman tres rectas.
- Los vértices incluyen coordenadas. Selecciónalos en la gráfica o en la tabla de Z
  para consultar su sustitución y las restricciones activas.
- El lila identifica los óptimos, los segmentos o semirrectas óptimas y la recta de Z.
- Arrastra el plano para desplazarlo; usa la rueda o los botones +/− para acercar y
  alejar. **Ajustar** recupera una vista de los vértices e interceptos.
- Las flechas verdes y el aviso de continuidad indican una región no acotada.
  **El borde del visor no es una restricción**, aunque el sombreado termine allí.

Abre cada etapa del panel derecho: modelo; interceptos con sustituciones; sistemas
de dos ecuaciones y eliminación; comprobación de candidatos; tabla de Z; conclusión.
Los cruces descartados se conservan para explicar qué condición incumplen.
Las coordenadas mostradas usan hasta seis decimales, o notación científica en escalas
pequeñas/grandes; las operaciones conservan los valores internos.

## Interpretar el resultado

- **Óptimo único:** un punto alcanza el mejor valor.
- **Óptimos múltiples:** el mejor valor se alcanza en todo un segmento, semirrecta
  o región. No basta con escoger arbitrariamente un vértice empatado.
- **Sin región factible:** ninguna combinación cumple simultáneamente las condiciones.
- **Función objetivo no acotada:** existe una dirección factible que mejora Z sin límite.
- **Región no acotada con óptimo finito:** el sombreado continúa, pero Z alcanza su
  mínimo o máximo. Ejemplo: minimizar x+y con x,y ≥ 1 da (1,1), Z=2.

Una restricción **activa** se cumple con igualdad en el punto seleccionado. Una
**redundante** puede retirarse sin cambiar la región; también puede estar activa.
El programa señala redundancias individuales y conserva las restricciones. Si hay
duplicadas, no las elimines todas a la vez basándote en ese señalamiento.

## Ejemplos y archivos

El selector incluye los cuatro problemas del taller, el ejemplo de la profesora,
el ejemplo de las especificaciones y casos especiales. **Limpiar** vacía el modelo.

- **Exportar modelo:** descarga `optigraph-pl-modelo.json`, editable y reutilizable.
- **Exportar resultado:** añade candidatos, verificaciones, vértices, direcciones,
  restricciones activas, redundancias y el conjunto óptimo al JSON.
- **Importar modelo:** reconoce `type: "linear-programming"`, versión 1. Recalcula
  siempre; un resultado adjunto no se toma como verdad. El importador de redes
  sigue aceptando los formatos anteriores y puede cambiar al editor correspondiente.
- **Reporte imprimible:** descarga un HTML autónomo con la gráfica visible y todas
  las etapas abiertas. Ábrelo y pulsa **Imprimir o guardar como PDF**. Antes de
  exportar, pulsa Ajustar si habías desplazado el óptimo fuera de la ventana.

El reporte no necesita Internet. La aplicación completa conserva las dependencias
CDN de redes, por lo que su carga inicial sí necesita conexión.
