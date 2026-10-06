import { optimize } from 'svgo/browser'
import init, { to_svg } from 'vtracer-wasm'
import wasmUrl from 'vtracer-wasm/vtracer.wasm?url'
import { hardenAlpha, removeBackground, smooth, toBinary, toTwoTone } from '../lib/preprocess'
import type { Settings, SourceImage, WorkerRequest, WorkerResponse } from '../types'

let ready: Promise<unknown> | null = null
let image: SourceImage | null = null

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Traduce las opciones de la UI a las que espera el wrapper WASM, que las pasa sin
 * convertir al núcleo de VTracer: ángulos en radianes, manchas como área y la
 * precisión de color como bits *descartados* (8 haría entrar en pánico al WASM).
 */
function toVtracerConfig(s: Settings) {
  return {
    // En dos tonos el blanco también es un trazo, así que se usa el modo de color
    binary: s.binary && !s.twoTone,
    mode: s.mode,
    hierarchical: 'stacked',
    colorPrecision: 8 - Math.min(8, Math.max(1, s.colorPrecision)),
    layerDifference: s.layerDifference,
    filterSpeckle: s.filterSpeckle * s.filterSpeckle,
    cornerThreshold: toRadians(s.cornerThreshold),
    spliceThreshold: toRadians(s.spliceThreshold),
    lengthThreshold: s.lengthThreshold,
    maxIterations: 10,
    pathPrecision: 2,
  }
}

async function trace(source: SourceImage, settings: Settings): Promise<string> {
  await (ready ??= init({ module_or_path: wasmUrl }))

  // Copia: el preprocesado modifica los píxeles y la imagen se reutiliza en cada ajuste
  const px = new Uint8Array(source.data)
  if (settings.binary && settings.twoTone) {
    toTwoTone(px, source.width, source.height, settings)
  } else {
    hardenAlpha(px)
    if (settings.smooth) smooth(px, source.width, source.height)
    if (settings.binary) toBinary(px, settings.threshold, settings.invert)
    else if (settings.removeBackground) removeBackground(px, source.width, source.height)
  }

  let svg = to_svg(px, source.width, source.height, toVtracerConfig(settings))

  // Sin viewBox el SVG no escala al cambiarle el tamaño
  svg = svg.replace(
    /<svg([^>]*?) width="(\d+)" height="(\d+)"/,
    '<svg$1 width="$2" height="$3" viewBox="0 0 $2 $3"',
  )
  if (settings.background && /^#[0-9a-f]{6}$/i.test(settings.backgroundColor)) {
    svg = svg.replace(
      /<svg[^>]*>/,
      `$&<rect width="100%" height="100%" fill="${settings.backgroundColor}"/>`,
    )
  }
  if (settings.optimize) {
    svg = optimize(svg, { floatPrecision: 2 }).data
  }
  return svg
}

const post = (message: WorkerResponse) => self.postMessage(message)

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'image') {
    image = request.image
    return
  }

  const { id, settings } = request
  try {
    if (!image) throw new Error('No hay ninguna imagen cargada.')
    const start = performance.now()
    const svg = await trace(image, settings)
    post({
      type: 'result',
      id,
      svg,
      paths: svg.match(/<path/g)?.length ?? 0,
      ms: performance.now() - start,
    })
  } catch (error) {
    console.error(error)
    post({
      type: 'error',
      id,
      message:
        error instanceof WebAssembly.RuntimeError || error instanceof RangeError
          ? 'El vectorizador falló con esta imagen. Prueba con menos resolución o menos colores.'
          : 'No se pudo vectorizar la imagen.',
    })
  }
}
