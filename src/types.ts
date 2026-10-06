export type TraceMode = 'spline' | 'polygon' | 'pixel'

export type PresetId = 'logo' | 'illustration' | 'photo' | 'bw'

/** Opciones tal como las ve el usuario; el worker las traduce a las de VTracer. */
export interface Settings {
  /** Blanco y negro (un solo color de trazo). */
  binary: boolean
  /** Solo B/N: luminancia (0–255) por debajo de la cual un píxel es tinta. */
  threshold: number
  /** Solo B/N: traza las zonas claras en vez de las oscuras. */
  invert: boolean
  /**
   * Solo B/N: además del negro traza el blanco como color propio y deja sin trazar lo
   * transparente. Es la vista previa del relieve 3D, que distingue esas tres zonas.
   */
  twoTone: boolean
  mode: TraceMode
  /** Bits de color significativos (1–8). Más = más colores. */
  colorPrecision: number
  /** Diferencia mínima de color entre capas (controla el bandeo de degradados). */
  layerDifference: number
  /** Descarta manchas de menos de N×N píxeles. */
  filterSpeckle: number
  /** Ángulo (grados) a partir del cual algo se considera esquina. */
  cornerThreshold: number
  /** Longitud mínima de segmento, en píxeles. */
  lengthThreshold: number
  /** Ángulo (grados) para empalmar curvas. */
  spliceThreshold: number
  /** Suavizado leve previo: ayuda con JPG muy comprimidos, estorba en imágenes limpias. */
  smooth: boolean
  /** Vuelve transparente el fondo de color uniforme que toca los bordes. */
  removeBackground: boolean
  /** Pinta un rectángulo de `backgroundColor` detrás de los trazos. */
  background: boolean
  /** Color de fondo en formato #rrggbb. */
  backgroundColor: string
  /** Pasa el resultado por SVGO. */
  optimize: boolean
}

/** Píxeles RGBA ya decodificados y reescalados. */
export interface SourceImage {
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}

export interface TraceResult {
  svg: string
  paths: number
  /** Tiempo de conversión en milisegundos. */
  ms: number
}

// Contrato de mensajes UI ⇄ worker

export type WorkerRequest =
  | { type: 'image'; image: SourceImage }
  | { type: 'trace'; id: number; settings: Settings }

export type WorkerResponse =
  | ({ type: 'result'; id: number } & TraceResult)
  | { type: 'error'; id: number; message: string }

// Exportación del relieve 3D (worker aparte, una petición por instancia)

export interface ModelRequest {
  image: SourceImage
  settings: Settings
  /** Ancho que ocupa la imagen completa y altura de cada color, en milímetros. */
  widthMm: number
  blackMm: number
  whiteMm: number
}

export type ModelResponse =
  /** `widthMm` y `depthMm` son el tamaño real de la pieza, sin las zonas vacías. */
  | { type: 'result'; stl: ArrayBuffer; triangles: number; widthMm: number; depthMm: number }
  | { type: 'error'; message: string }
