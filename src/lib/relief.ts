import earcut from 'earcut'

// Relieve 3D a partir de una máscara de tres valores: blanco, negro o vacío (sin material).
// La malla sale de los contornos exactos de los píxeles, así que es cerrada: las tapas,
// los suelos y las paredes comparten los mismos vértices.

export const WHITE = 0
export const BLACK = 1
/** Zonas transparentes de la imagen: ahí no se crea nada. */
export const EMPTY = 2

export interface ReliefOptions {
  /** Ancho de la imagen completa en milímetros; el alto se deduce de su proporción. */
  widthMm: number
  /** Altura de las zonas negras, en milímetros. */
  blackMm: number
  /** Altura de las zonas blancas, en milímetros. */
  whiteMm: number
}

// Lados de un píxel en orden antihorario (visto en pantalla): abajo, derecha, arriba, izquierda
/** Dirección en la que se recorre cada lado. */
const DIR = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
]
/** Vecino que queda al otro lado de cada lado. */
const OUT = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
]
/** Esquina donde empieza cada lado. */
const CORNER = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
]

/** Etiqueta las regiones conexas (4 vecinos) del mismo valor. */
function labelRegions(mask: Uint8Array, width: number, height: number) {
  const labels = new Int32Array(width * height).fill(-1)
  const areas: number[] = []
  /** Valor de la máscara de cada región. */
  const values: number[] = []
  /** Valor de alguna región vecina, o -1 si la región ocupa toda la imagen. */
  const surroundings: number[] = []
  const stack = new Int32Array(width * height)
  for (let start = 0; start < mask.length; start++) {
    if (labels[start] !== -1) continue
    const label = areas.length
    const value = mask[start]
    let area = 0
    let around = -1
    let top = 0
    labels[start] = label
    stack[top++] = start
    while (top > 0) {
      const p = stack[--top]
      area++
      const x = p % width
      const visit = (q: number) => {
        if (mask[q] !== value) {
          around = mask[q]
        } else if (labels[q] === -1) {
          labels[q] = label
          stack[top++] = q
        }
      }
      if (x > 0) visit(p - 1)
      if (x < width - 1) visit(p + 1)
      if (p >= width) visit(p - width)
      if (p < mask.length - width) visit(p + width)
    }
    areas.push(area)
    values.push(value)
    surroundings.push(around)
  }
  return { labels, areas, values, surroundings }
}

/** Funde con su entorno las regiones de menos de `minArea` píxeles (islas y poros imposibles de imprimir). */
export function despeckle(mask: Uint8Array, width: number, height: number, minArea: number): void {
  if (minArea <= 1) return
  const { labels, areas, surroundings } = labelRegions(mask, width, height)
  for (let p = 0; p < mask.length; p++) {
    const label = labels[p]
    if (areas[label] < minArea && surroundings[label] !== -1) mask[p] = surroundings[label]
  }
}

interface Loop {
  /** Vértices x0, y0, x1, y1… en coordenadas de esquina de píxel. */
  points: number[]
  /** Por vértice: etiqueta de la región al otro lado de la arista que sale de él (-1 = fuera de la imagen). */
  neighbors: number[]
}

/**
 * Contornos de cada región, con la región siempre a la izquierda del sentido de avance.
 * Devuelve, por etiqueta, sus contornos (exterior y huecos).
 */
function traceLoops(mask: Uint8Array, labels: Int32Array, width: number, height: number) {
  /** Etiqueta del vecino al otro lado de `side`, -1 si cae fuera, o -2 si es la misma región. */
  const across = (x: number, y: number, side: number) => {
    const nx = x + OUT[side][0]
    const ny = y + OUT[side][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return -1
    return mask[ny * width + nx] === mask[y * width + x] ? -2 : labels[ny * width + nx]
  }

  const loops = new Map<number, Loop[]>()
  const visited = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let side = 0; side < 4; side++) {
        if (visited[y * width + x] & (1 << side) || across(x, y, side) === -2) continue

        const points: number[] = []
        const neighbors: number[] = []
        let cx = x
        let cy = y
        let cs = side
        do {
          visited[cy * width + cx] |= 1 << cs
          points.push(cx + CORNER[cs][0], cy + CORNER[cs][1])
          neighbors.push(across(cx, cy, cs))
          const left = (cs + 1) & 3
          if (across(cx, cy, left) !== -2) {
            cs = left
            continue
          }
          // El píxel de delante es de la misma región: se sigue recto o se gira a la derecha.
          // Girar siempre hacia el propio píxel separa las regiones que solo se tocan en diagonal.
          const ax = cx + DIR[cs][0]
          const ay = cy + DIR[cs][1]
          if (across(ax, ay, cs) !== -2) {
            cx = ax
            cy = ay
          } else {
            cx = ax + OUT[cs][0]
            cy = ay + OUT[cs][1]
            cs = (cs + 3) & 3
          }
        } while (cx !== x || cy !== y || cs !== side)

        const label = labels[y * width + x]
        const loop = simplify(points, neighbors)
        const list = loops.get(label)
        if (list) list.push(loop)
        else loops.set(label, [loop])
      }
    }
  }
  return loops
}

/**
 * Quita los vértices intermedios de los tramos rectos, salvo donde cambia la región vecina:
 * ahí termina un contorno ajeno y las tres regiones tienen que compartir el vértice.
 */
function simplify(points: number[], neighbors: number[]): Loop {
  const n = neighbors.length
  const out: Loop = { points: [], neighbors: [] }
  for (let i = 0; i < n; i++) {
    const before = (i + n - 1) % n
    const prev = before * 2
    const next = ((i + 1) % n) * 2
    const cur = i * 2
    const cross =
      (points[cur] - points[prev]) * (points[next + 1] - points[cur + 1]) -
      (points[cur + 1] - points[prev + 1]) * (points[next] - points[cur])
    if (cross !== 0 || neighbors[before] !== neighbors[i]) {
      out.points.push(points[cur], points[cur + 1])
      out.neighbors.push(neighbors[i])
    }
  }
  return out
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b]
  return a
}

function signedArea(loop: number[]): number {
  let sum = 0
  for (let i = 0; i < loop.length; i += 2) {
    const j = (i + 2) % loop.length
    sum += loop[i] * loop[j + 1] - loop[j] * loop[i + 1]
  }
  return sum / 2
}

/** Lista de triángulos que crece según haga falta (9 números por triángulo). */
class TriangleBuffer {
  data = new Float32Array(9 * 4096)
  length = 0

  push(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ): void {
    if (this.length + 9 > this.data.length) {
      const grown = new Float32Array(this.data.length * 2)
      grown.set(this.data)
      this.data = grown
    }
    const d = this.data
    let i = this.length
    d[i++] = ax; d[i++] = ay; d[i++] = az
    d[i++] = bx; d[i++] = by; d[i++] = bz
    d[i++] = cx; d[i++] = cy; d[i++] = cz
    this.length = i
  }
}

/**
 * Genera la malla del relieve. Devuelve los triángulos (9 números cada uno, en mm) con
 * el origen en la esquina inferior izquierda de la imagen y Z hacia arriba.
 */
export function buildRelief(
  mask: Uint8Array,
  width: number,
  height: number,
  options: ReliefOptions,
): Float32Array {
  const scale = options.widthMm / width
  const tris = new TriangleBuffer()

  const { labels, values } = labelRegions(mask, width, height)
  const loopsByLabel = traceLoops(mask, labels, width, height)

  const heightOf = (label: number) =>
    label === -1 || values[label] === EMPTY
      ? 0
      : values[label] === BLACK
        ? options.blackMm
        : options.whiteMm
  // Las paredes se cortan en cada nivel para que sus aristas verticales coincidan allí
  // donde se juntan tres alturas distintas
  const levels = [...new Set([0, options.blackMm, options.whiteMm])].sort((a, b) => a - b)

  // Píxel → mm, con Y hacia arriba
  const mmX = (x: number) => x * scale
  const mmY = (y: number) => (height - y) * scale
  const key = (x: number, y: number) => y * (width + 1) + x

  for (const [label, unsorted] of loopsByLabel) {
    const z = heightOf(label)
    if (z === 0) continue
    // Con Y hacia abajo el contorno exterior es el único de área negativa: va primero
    const loops = unsorted.sort((a, b) => signedArea(a.points) - signedArea(b.points))

    // Paredes: las pone la región más alta de las dos, desde la altura de la vecina hasta la suya.
    // Miran hacia la derecha del sentido de avance, es decir, hacia fuera.
    for (const { points, neighbors } of loops) {
      for (let i = 0; i < neighbors.length; i++) {
        const j = ((i + 1) % neighbors.length) * 2
        const ax = mmX(points[i * 2])
        const ay = mmY(points[i * 2 + 1])
        const bx = mmX(points[j])
        const by = mmY(points[j + 1])
        const from = heightOf(neighbors[i])
        for (let l = 1; l < levels.length; l++) {
          const z0 = levels[l - 1]
          const z1 = levels[l]
          if (z0 < from || z1 > z) continue
          tris.push(ax, ay, z0, bx, by, z0, bx, by, z1)
          tris.push(ax, ay, z0, bx, by, z1, ax, ay, z1)
        }
      }
    }

    const coords = loops.flatMap((loop) => loop.points)
    const holes: number[] = []
    let offset = 0
    for (const loop of loops.slice(0, -1)) {
      offset += loop.neighbors.length
      holes.push(offset)
    }
    const vertices = new Set<number>()
    for (let i = 0; i < coords.length; i += 2) vertices.add(key(coords[i], coords[i + 1]))

    /** Vértice del contorno que cae dentro del segmento p→q, si lo hay. */
    const vertexInside = (px: number, py: number, qx: number, qy: number) => {
      const steps = gcd(Math.abs(qx - px), Math.abs(qy - py))
      const dx = (qx - px) / steps
      const dy = (qy - py) / steps
      for (let k = 1; k < steps; k++) {
        if (vertices.has(key(px + dx * k, py + dy * k))) return [px + dx * k, py + dy * k]
      }
      return null
    }

    /** Tapa a la altura de la región y, debajo, su trozo de suelo. */
    const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      tris.push(mmX(ax), mmY(ay), z, mmX(bx), mmY(by), z, mmX(cx), mmY(cy), z)
      tris.push(mmX(bx), mmY(by), 0, mmX(ax), mmY(ay), 0, mmX(cx), mmY(cy), 0)
    }

    const indices = earcut(coords, holes)
    const pending: number[][] = []
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 2
      const b = indices[i + 1] * 2
      const c = indices[i + 2] * 2
      const cross =
        (coords[b] - coords[a]) * (coords[c + 1] - coords[a + 1]) -
        (coords[b + 1] - coords[a + 1]) * (coords[c] - coords[a])
      // earcut no garantiza el sentido de giro. Con Y hacia abajo, un producto negativo
      // es antihorario una vez volteado, que es lo que hace que la tapa mire hacia arriba.
      pending.push(
        cross < 0
          ? [coords[a], coords[a + 1], coords[b], coords[b + 1], coords[c], coords[c + 1]]
          : [coords[b], coords[b + 1], coords[a], coords[a + 1], coords[c], coords[c + 1]],
      )
    }
    // earcut descarta vértices alineados, así que un lado de triángulo puede pasar por encima
    // de un vértice que las paredes sí usan. Se parte ahí para que la malla quede cerrada.
    while (pending.length > 0) {
      const [ax, ay, bx, by, cx, cy] = pending.pop()!
      let m = vertexInside(ax, ay, bx, by)
      if (m) {
        pending.push([ax, ay, m[0], m[1], cx, cy], [m[0], m[1], bx, by, cx, cy])
        continue
      }
      m = vertexInside(bx, by, cx, cy)
      if (m) {
        pending.push([ax, ay, bx, by, m[0], m[1]], [ax, ay, m[0], m[1], cx, cy])
        continue
      }
      m = vertexInside(cx, cy, ax, ay)
      if (m) {
        pending.push([ax, ay, bx, by, m[0], m[1]], [m[0], m[1], bx, by, cx, cy])
        continue
      }
      emit(ax, ay, bx, by, cx, cy)
    }
  }

  return tris.data.slice(0, tris.length)
}

/** Triángulos → archivo STL binario. */
export function encodeStl(triangles: Float32Array): ArrayBuffer {
  const count = triangles.length / 9
  const buffer = new ArrayBuffer(84 + count * 50)
  const view = new DataView(buffer)
  view.setUint32(80, count, true)
  let offset = 84
  for (let t = 0; t < triangles.length; t += 9) {
    const ux = triangles[t + 3] - triangles[t]
    const uy = triangles[t + 4] - triangles[t + 1]
    const uz = triangles[t + 5] - triangles[t + 2]
    const vx = triangles[t + 6] - triangles[t]
    const vy = triangles[t + 7] - triangles[t + 1]
    const vz = triangles[t + 8] - triangles[t + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz) || 1
    view.setFloat32(offset, nx / length, true)
    view.setFloat32(offset + 4, ny / length, true)
    view.setFloat32(offset + 8, nz / length, true)
    for (let i = 0; i < 9; i++) {
      view.setFloat32(offset + 12 + i * 4, triangles[t + i], true)
    }
    offset += 50
  }
  return buffer
}
