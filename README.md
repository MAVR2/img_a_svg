# Imagen a SVG

Web que vectoriza imágenes **JPG, PNG y WebP** a SVG. Todo corre en el navegador (VTracer en
WebAssembly dentro de un Web Worker); no hay backend y la imagen nunca sale del equipo.

```sh
npm install
npm run dev      # desarrollo
npm run build    # genera dist/ (sitio estático)
npm run preview  # sirve dist/ en local
```

## Flujo

1. Se pide una imagen.
2. Si es un **SVG**, va directo a las opciones del modelo 3D (STL).
3. Si es **JPG, PNG o WebP**, se convierte a SVG; desde ahí se ofrece convertirla también a STL
   (y se puede volver al SVG sin perder los ajustes).

## Qué hace

- Cargar por clic, arrastrar y soltar, o pegar (Ctrl/⌘ + V). También acepta SVG: se dibuja a la
  resolución máxima y sirve para volver a trazarlo, cambiarle el fondo o sacar el modelo 3D.
- Presets (logo, ilustración, foto, blanco y negro) y ajustes avanzados.
- Los PNG conservan su transparencia; "Quitar fondo" la crea a partir de un fondo de color uniforme.
- "Color de fondo" rellena el SVG con el color elegido; sin marcar, el fondo queda transparente.
- Comparador antes/después con zoom (botones o Ctrl/⌘ + rueda) y desplazamiento.
- Tamaño, número de trazos y tiempo; aviso si el SVG pesa más que el original.
- Descargar el `.svg` o copiar su código. Optimización con SVGO.
- **Modelo 3D (STL)**: relieve de dos alturas con el ancho en mm que se elija. Por defecto el
  negro es la base (3 mm) y lo claro sobresale (5 mm). Las zonas transparentes no generan
  material, así que la pieza sigue la silueta del dibujo; "Quitar fondo" hace lo mismo con un
  fondo de color uniforme. La vista previa muestra las tres zonas: negro, blanco y vacío.

## Estructura

```
src/
  App.tsx
  components/   Dropzone, Controls, Compare, Stats, ModelExport, Fields
  hooks/        useVectorizer (habla con el worker), useFileDrop (soltar y pegar)
  lib/          loadImage (archivo → píxeles), preprocess, presets, download,
                relief (máscara → malla cerrada → STL), buildModel
  workers/      vectorizer.worker.ts (preprocesado + VTracer + SVGO)
                model.worker.ts (relieve 3D)
  types.ts      opciones y contrato de mensajes
```

Los componentes solo consumen `useVectorizer`; cambiar de motor implica tocar el hook y el worker.

## Notas sobre `vtracer-wasm`

El paquete pasa las opciones sin convertir al núcleo de VTracer, así que no usan las mismas
unidades que la CLI. `toVtracerConfig` (en el worker) hace la traducción:

- `colorPrecision` son los bits **descartados** (8 − precisión). El valor 8 hace fallar al WASM.
- `cornerThreshold` y `spliceThreshold` van en radianes.
- `filterSpeckle` es un área en píxeles (se envía N²).
- El modo binario solo mira el canal rojo, por eso el umbral de blanco y negro se calcula antes
  por luminancia (`toBinary`).
- Siempre se usa el modo `stacked`; `cutout` pierde regiones con esta versión.

Si el WASM falla, su memoria queda inservible: el hook descarta el worker y crea uno nuevo.
