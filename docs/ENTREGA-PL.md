# Entrega, PR y GitHub Pages

## Rama y trabajo conservado

La sección se desarrolla sobre `feature/fede`, después de integrar `origin/main`
mediante merge. Ese historial conserva la documentación previa y Floyd de Isac.
No se necesita rebase ni force push.

Antes de empezar una nueva sesión, con el árbol limpio:

```powershell
git fetch origin
git switch feature/fede
git merge origin/main
```

Después de revisar los cambios, ejecuta `node --test`, la verificación de sintaxis
y, si cambia la interfaz, `node scripts/check-ui.cjs` con Playwright disponible.
Consulta [PRUEBAS-PL.md](PRUEBAS-PL.md) para el entorno y las expectativas.

## Publicar la rama y revisar

```powershell
git add <archivos-revisados>
git commit -m "Añade programación lineal por método gráfico"
git push origin feature/fede
```

Crea el PR con **base `main`** y **compare `feature/fede`**. La descripción debe
incluir el comportamiento nuevo, las pruebas, los casos especiales y capturas.
Usa **Create a merge commit** para mantener la relación entre ambas ramas.
La publicación de Pages ocurre al integrar en `main`; publicar solo `feature/fede`
no modifica la aplicación principal.

## Después de fusionar

Sin nuevos commits locales en `feature/fede`:

```powershell
git switch main
git pull --ff-only origin main
git switch feature/fede
git merge --ff-only main
git push origin feature/fede
git status --short
git rev-parse main feature/fede origin/main origin/feature/fede
```

Los cuatro hashes deben coincidir y `git status --short` quedar vacío. Si el avance
rápido falla, revisa los commits adicionales antes de decidir cómo integrarlos;
no uses reset o force push para ocultarlos.

Revisa **Actions → pages build and deployment** y confirma que terminó en éxito
para el commit integrado. Después abre la
[aplicación publicada](https://fede17-9.github.io/optigraph-studio/), entra a PL,
carga Computadores y Centro de datos y verifica los valores 3.080.000 y 71,5.
Comprueba también los modos de redes. Conserva la configuración actual de Pages.
