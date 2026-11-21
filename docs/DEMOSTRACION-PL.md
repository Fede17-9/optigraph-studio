# Guion de demostración y sustentación

## Recorrido de cinco minutos

1. Abre **PL · Método gráfico**. Explica las dos variables continuas, las condiciones
   de signo y la separación entre formulario, plano y procedimiento.
2. Carga **Taller 1 · Computadores**. Lee Z y las restricciones. Abre los interceptos
   de R1 y muestra cómo sustituir x=0 o y=0 para dibujar en el cuaderno.
3. Abre R1∩R2: al resolver 2x+3y=36 y 4x+2y=40 se obtiene (6,8).
   Revisa sus comprobaciones y selecciona ese vértice en el plano.
   Sustituye Z=180000(6)+250000(8)=3.080.000. R1, R2 y R3 están activas;
   R3 es además redundante: (1/4)R1+(1/8)R2 da x+y≤9+5=14;
   por tanto, R1 y R2 ya implican esa condición en toda la región.
4. Cambia el coeficiente de x en Z a **600000**. La gráfica y tabla se actualizan:
   el óptimo pasa a (10,0), Z=6.000.000. Las restricciones siguen iguales;
   cambia la pendiente de la recta objetivo. Recupera el ejemplo desde el selector.
5. Carga **Profesora · Óptimos múltiples**. Los extremos (0,1) y (2/3,0) dan Z=2.
   Por linealidad todas sus combinaciones convexas también dan 2. Señala el segmento lila.
6. Carga **Región no acotada · Óptimo finito**. El verde continúa con flechas,
   pero el mínimo está en (1,1), Z=2. Compáralo con **Z no acotada**:
   allí existe una dirección factible que mejora Z sin límite.
7. Exporta el modelo y el reporte HTML. Abre el reporte y muestra que contiene
   gráfica, sistemas, verificaciones y tabla, listo para imprimir. Regresa al menú
   de redes y muestra que AEM, Dijkstra y ambas versiones de Floyd siguen disponibles.

## Preguntas para sustentar

- **¿Por qué no se sombrea siempre el triángulo?** Se necesita la intersección de
  los semiplanos que satisfacen todas las desigualdades. Un cruce de rectas puede
  incumplir otra condición; por eso se comprueba cada candidato.
- **¿Cómo se decide que Z es no acotada?** Se busca d con A d≤0 y variación de Z
  favorable. Desde un punto factible, p+t d permanece factible para todo t≥0.
  El tamaño de la pantalla no interviene en esa conclusión.
- **¿Activa significa necesaria?** No. Activa significa igualdad en un punto;
  redundante significa que retirarla individualmente no amplía la región.
- **¿Por qué no se redondea el centro de datos?** El modelo es continuo: (7,4.5)
  da 71.5. Exigir enteros requiere otro modelo y otro método.
- **¿Cómo se mantiene modular?** El solver devuelve datos puros; el gestor SVG
  dibuja; el controlador administra formulario y procedimiento. `main.js` coordina
  la navegación sin introducir nodos o arcos en la matemática de PL.
- **¿Cómo se verificó?** Ejecuta `node --test`; muestra el banco académico y las
  pruebas de casos especiales. La revisión de navegador comprueba los flujos de uso.
