import type { PresetId, Settings } from '../types'

const base: Settings = {
  binary: false,
  threshold: 128,
  invert: false,
  twoTone: false,
  mode: 'spline',
  colorPrecision: 6,
  layerDifference: 16,
  filterSpeckle: 4,
  cornerThreshold: 60,
  lengthThreshold: 4,
  spliceThreshold: 45,
  smooth: false,
  removeBackground: false,
  background: false,
  backgroundColor: '#ffffff',
  optimize: true,
}

export interface Preset {
  id: PresetId
  label: string
  hint: string
  settings: Settings
}

export const PRESETS: Preset[] = [
  {
    id: 'logo',
    label: 'Logo / icono',
    hint: 'Pocos colores y trazos limpios',
    settings: { ...base, colorPrecision: 5, layerDifference: 32, filterSpeckle: 8 },
  },
  {
    id: 'illustration',
    label: 'Ilustración',
    hint: 'Equilibrio entre fidelidad y peso',
    settings: base,
  },
  {
    id: 'photo',
    label: 'Foto',
    hint: 'Muchos colores; el SVG será pesado',
    settings: {
      ...base,
      colorPrecision: 8,
      layerDifference: 48,
      filterSpeckle: 10,
      cornerThreshold: 180,
    },
  },
  {
    id: 'bw',
    label: 'Blanco y negro',
    hint: 'Un solo color: firmas, texto, sellos',
    settings: { ...base, binary: true },
  },
]

export const DEFAULT_PRESET: PresetId = 'logo'

export function presetSettings(id: PresetId): Settings {
  return PRESETS.find((p) => p.id === id)!.settings
}
