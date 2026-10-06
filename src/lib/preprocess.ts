// Operaciones sobre píxeles RGBA previas al trazado. Todas modifican el buffer que reciben.

/** VTracer solo distingue transparente/opaco: los bordes semitransparentes de un PNG se deciden aquí. */
export function hardenAlpha(px: Uint8Array): void {
  for (let i = 3; i < px.length; i += 4) {
    px[i] = px[i] < 128 ? 0 : 255
  }
}

/** Desenfoque leve (núcleo 1-2-1 en cada eje) que borra los artefactos de compresión JPG. */
export function smooth(px: Uint8Array, width: number, height: number): void {
  const tmp = new Uint8Array(px.length)
  blurPass(px, tmp, width, height, true)
  blurPass(tmp, px, width, height, false)
}

function blurPass(
  src: Uint8Array,
  dst: Uint8Array,
  width: number,
  height: number,
  horizontal: boolean,
): void {
  const step = horizontal ? 4 : width * 4
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      dst[i + 3] = src[i + 3]
      if (src[i + 3] === 0) {
        dst[i] = src[i]
        dst[i + 1] = src[i + 1]
        dst[i + 2] = src[i + 2]
        continue
      }
      let r = 2 * src[i]
      let g = 2 * src[i + 1]
      let b = 2 * src[i + 2]
      let weight = 2
      const hasPrev = horizontal ? x > 0 : y > 0
      const hasNext = horizontal ? x < width - 1 : y < height - 1
      // Los vecinos transparentes no aportan color: evita halos en los bordes de un PNG
      if (hasPrev && src[i - step + 3] !== 0) {
        r += src[i - step]
        g += src[i - step + 1]
        b += src[i - step + 2]
        weight++
      }
      if (hasNext && src[i + step + 3] !== 0) {
        r += src[i + step]
        g += src[i + step + 1]
        b += src[i + step + 2]
        weight++
      }
      dst[i] = Math.round(r / weight)
      dst[i + 1] = Math.round(g / weight)
      dst[i + 2] = Math.round(b / weight)
    }
  }
}

/**
 * Vuelve transparente el fondo: toma el color dominante de las esquinas y hace un
 * relleno por inundación desde los bordes, así no se borran zonas interiores del mismo color.
 */
export function removeBackground(
  px: Uint8Array,
  width: number,
  height: number,
  tolerance = 32,
): void {
  const total = width * height
  const corners = [0, width - 1, total - width, total - 1]
  const similar = (p: number, r: number, g: number, b: number) =>
    px[p * 4 + 3] !== 0 &&
    Math.abs(px[p * 4] - r) <= tolerance &&
    Math.abs(px[p * 4 + 1] - g) <= tolerance &&
    Math.abs(px[p * 4 + 2] - b) <= tolerance

  let bg = -1
  let bestVotes = 0
  for (const c of corners) {
    if (px[c * 4 + 3] === 0) continue
    const votes = corners.filter((o) => similar(o, px[c * 4], px[c * 4 + 1], px[c * 4 + 2])).length
    if (votes > bestVotes) {
      bestVotes = votes
      bg = c
    }
  }
  if (bg === -1) return
  const r = px[bg * 4]
  const g = px[bg * 4 + 1]
  const b = px[bg * 4 + 2]

  const queued = new Uint8Array(total)
  const stack = new Int32Array(total)
  let top = 0
  const push = (p: number) => {
    if (queued[p] === 0 && similar(p, r, g, b)) {
      queued[p] = 1
      stack[top++] = p
    }
  }

  for (let x = 0; x < width; x++) {
    push(x)
    push(total - width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (top > 0) {
    const p = stack[--top]
    const x = p % width
    if (x > 0) push(p - 1)
    if (x < width - 1) push(p + 1)
    if (p >= width) push(p - width)
    if (p < total - width) push(p + width)
  }
  // Se borra al final: `similar` necesita los píxeles intactos mientras dura la inundación
  for (let p = 0; p < total; p++) {
    if (queued[p] === 1) px[p * 4 + 3] = 0
  }
}

/**
 * Preprocesado del relieve 3D y de su vista previa: cada píxel queda negro, blanco o
 * transparente (alfa 0), que es donde no habrá material.
 */
export function toTwoTone(
  px: Uint8Array,
  width: number,
  height: number,
  settings: { smooth: boolean; removeBackground: boolean; threshold: number; invert: boolean },
): void {
  hardenAlpha(px)
  if (settings.smooth) smooth(px, width, height)
  if (settings.removeBackground) removeBackground(px, width, height)
  toBinary(px, settings.threshold, settings.invert, true)
}

/**
 * Deja cada píxel en negro (tinta) o blanco según su luminancia. El modo binario de
 * VTracer solo mira el canal rojo, así que la decisión se toma aquí.
 * Con `keepAlpha` los píxeles transparentes siguen siéndolo; si no, pasan a blanco.
 */
export function toBinary(
  px: Uint8Array,
  threshold: number,
  invert: boolean,
  keepAlpha = false,
): void {
  for (let i = 0; i < px.length; i += 4) {
    const luma = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    const ink = px[i + 3] !== 0 && luma < threshold !== invert
    const v = ink ? 0 : 255
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
    if (!keepAlpha) px[i + 3] = 255
  }
}
