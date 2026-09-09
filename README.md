# Guía de usuario y documentación técnica para el usuario
# OptiGraph Studio - Plataforma de Algoritmos de Investigación de Operaciones

Bienvenido a **OptiGraph Studio**, una suite web interactiva diseñada para la construcción, análisis y resolución gráfica de modelos en redes.

---

## 🚀 Taller 1: Árbol de Expansión Mínima (AEM)

Este módulo permite diseñar redes no dirigidas personalizadas y resolver el Árbol de Expansión Mínima mediante un algoritmo analítico paso a paso.

### 📋 Guía de Uso del Sistema

1. **Construcción de la Red:**
   * **Agregar Nodo:** Haga clic en el botón `[+ Agregar Nodo]` de la barra de herramientas y seleccione cualquier punto sobre el lienzo visual para posicionarlo.
   * **Conectar Nodos (Arco):** Seleccione el modo `[+ Conectar Arco]`, haga clic en el nodo de origen y luego en el nodo de destino. Ingrese el peso/valor del arco en la ventana emergente.
   * **Editar o Eliminar:** Active el modo `[Editar / Eliminar]` para cambiar el valor de una rama o remover elementos no deseados.
   * **Carga Rápida (Ejemplos):** Utilice el desplegable `[Cargar Redes de Prueba]` para instanciar automáticamente las redes analizadas en clase (Red 1, Red 2 o Red 3).

2. **Ejecución y Resultados:**
   * Haga clic en `[⚡ Resolver AEM]`.
   * El sistema validará automáticamente la **conexidad** de la red. Si existen nodos aislados, se emitirá una alerta explicativa impidiendo la ejecución.
   * Si la red es conexa, se iluminarán en **verde fluorescente** los arcos seleccionados y en **gris tenue** los descartados.
   * En el panel derecho de **Pasos del Algoritmo**, se detallará la evolución formal de los conjuntos $k, C_k, \overline{C}_k$, el arco evaluado y su respectivo peso.
   * En el panel inferior se mostrará el **Peso Total Sumado** del árbol resultante.

---

## 🛠️ Especificaciones Técnicas

* **Lógica del Algoritmo:** Implementación del Algoritmo de Prim en JavaScript ES6 con verificación de conexidad vía Búsqueda en Profundidad (DFS).
* **Renderizado Gráfico:** Librería `Vis-Network` con motor de física y manipulación dinámicos.
* **Buenas Prácticas de Código:** Arquitectura modular orientada a objetos (JSDoc, estándar ES6 Clean Code equivalente a PEP-8).