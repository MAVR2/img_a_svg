import { toTwoTone } from '../lib/preprocess'
import { BLACK, buildRelief, despeckle, EMPTY, encodeStl, WHITE } from '../lib/relief'
import type { ModelRequest, ModelResponse } from '../types'

const post = (message: ModelResponse, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer })

self.onmessage = (event: MessageEvent<ModelRequest>) => {
  const { image, settings, widthMm, blackMm, whiteMm } = event.data
  try {
    // Mismo preprocesado que la vista previa, para que el relieve coincida con ella
    const px = new Uint8Array(image.data)
    toTwoTone(px, image.width, image.height, settings)

    const mask = new Uint8Array(image.width * image.height)
    for (let p = 0; p < mask.length; p++) {
      mask[p] = px[p * 4 + 3] === 0 ? EMPTY : px[p * 4] === 0 ? BLACK : WHITE
    }
    if (!mask.includes(BLACK) && !mask.includes(WHITE)) {
      post({ type: 'error', message: 'No queda nada que convertir: toda la imagen es transparente.' })
      return
    }
    despeckle(mask, image.width, image.height, settings.filterSpeckle * settings.filterSpeckle)

    const triangles = buildRelief(mask, image.width, image.height, { widthMm, blackMm, whiteMm })
    const stl = encodeStl(triangles)
    // Tamaño real de la pieza: sin las zonas transparentes puede ser menor que la imagen
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < triangles.length; i += 3) {
      minX = Math.min(minX, triangles[i])
      maxX = Math.max(maxX, triangles[i])
      minY = Math.min(minY, triangles[i + 1])
      maxY = Math.max(maxY, triangles[i + 1])
    }
    post(
      {
        type: 'result',
        stl,
        triangles: triangles.length / 9,
        widthMm: maxX - minX,
        depthMm: maxY - minY,
      },
      [stl],
    )
  } catch (error) {
    console.error(error)
    post({
      type: 'error',
      message: 'No se pudo generar el modelo 3D. Prueba con menos resolución o más filtro de manchas.',
    })
  }
}
