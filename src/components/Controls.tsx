import { PRESETS } from '../lib/presets'
import { Slider, Toggle } from './Fields'
import type { PresetId, Settings, TraceMode } from '../types'

const MAX_SIZES = [800, 1200, 2000, 3000]

interface ControlsProps {
  /** null cuando el usuario ya tocó algún ajuste de trazado a mano. */
  preset: PresetId | null
  settings: Settings
  maxSize: number
  onPreset: (id: PresetId) => void
  onChange: (patch: Partial<Settings>) => void
  onMaxSize: (size: number) => void
}

export function Controls({
  preset,
  settings,
  maxSize,
  onPreset,
  onChange,
  onMaxSize,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          Tipo de imagen
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              aria-pressed={preset === p.id}
              onClick={() => onPreset(p.id)}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                preset === p.id
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500'
              }`}
            >
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-zinc-400">{p.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {settings.binary ? (
          <>
            <Slider
              label="Umbral"
              hint="Qué tan oscuro debe ser un píxel para contar como tinta"
              value={settings.threshold}
              min={1}
              max={255}
              onChange={(threshold) => onChange({ threshold })}
            />
            <Toggle
              label="Invertir"
              hint="Traza las zonas claras en vez de las oscuras"
              checked={settings.invert}
              onChange={(invert) => onChange({ invert })}
            />
          </>
        ) : (
          <>
            <Slider
              label="Colores"
              hint="Menos colores = SVG más limpio y ligero"
              value={settings.colorPrecision}
              min={1}
              max={8}
              onChange={(colorPrecision) => onChange({ colorPrecision })}
            />
            <Toggle
              label="Quitar fondo"
              hint="Vuelve transparente el color uniforme de los bordes"
              checked={settings.removeBackground}
              onChange={(removeBackground) => onChange({ removeBackground })}
            />
          </>
        )}
        <div
          className="flex items-center justify-between gap-3 text-sm text-zinc-200"
          title="Rellena el fondo del SVG con un color; sin marcar queda transparente"
        >
          <label htmlFor="background-toggle" className="cursor-pointer">
            Color de fondo
          </label>
          <span className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Elegir color de fondo"
              value={settings.backgroundColor}
              onChange={(e) => onChange({ background: true, backgroundColor: e.target.value })}
              className={`h-6 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent ${
                settings.background ? '' : 'opacity-40'
              }`}
            />
            <input
              id="background-toggle"
              type="checkbox"
              checked={settings.background}
              onChange={(e) => onChange({ background: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-emerald-400"
            />
          </span>
        </div>
        <Slider
          label="Filtro de manchas"
          hint="Descarta manchas más chicas que este tamaño"
          value={settings.filterSpeckle}
          min={0}
          max={32}
          unit=" px"
          onChange={(filterSpeckle) => onChange({ filterSpeckle })}
        />
      </section>

      <details className="group rounded-lg border border-zinc-800 bg-zinc-900/50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-300 select-none">
          Ajustes avanzados
        </summary>
        <div className="flex flex-col gap-3 border-t border-zinc-800 px-3 py-3">
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-200">
            Trazado
            <select
              value={settings.mode}
              onChange={(e) => onChange({ mode: e.target.value as TraceMode })}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            >
              <option value="spline">Curvas suaves</option>
              <option value="polygon">Polígonos</option>
              <option value="pixel">Píxeles</option>
            </select>
          </label>
          {!settings.binary && (
            <Slider
              label="Separación de capas"
              hint="Más alto = menos bandas en los degradados"
              value={settings.layerDifference}
              min={0}
              max={128}
              onChange={(layerDifference) => onChange({ layerDifference })}
            />
          )}
          {settings.mode === 'spline' && (
            <>
              <Slider
                label="Esquinas"
                hint="Más bajo = más esquinas marcadas; más alto = todo curvas"
                value={settings.cornerThreshold}
                min={0}
                max={180}
                unit="°"
                onChange={(cornerThreshold) => onChange({ cornerThreshold })}
              />
              <Slider
                label="Segmento mínimo"
                hint="Más alto = curvas más simples y menos detalle"
                value={settings.lengthThreshold}
                min={3.5}
                max={10}
                step={0.5}
                unit=" px"
                onChange={(lengthThreshold) => onChange({ lengthThreshold })}
              />
              <Slider
                label="Empalme de curvas"
                hint="Más bajo = más puntos de control (más fiel, más pesado)"
                value={settings.spliceThreshold}
                min={0}
                max={180}
                unit="°"
                onChange={(spliceThreshold) => onChange({ spliceThreshold })}
              />
            </>
          )}
          <Toggle
            label="Suavizar antes de trazar"
            hint="Actívalo si el JPG está muy comprimido y salen manchitas; en imágenes limpias añade trazos"
            checked={settings.smooth}
            onChange={(smooth) => onChange({ smooth })}
          />
          <Toggle
            label="Optimizar con SVGO"
            hint="Reduce el peso del archivo final"
            checked={settings.optimize}
            onChange={(optimize) => onChange({ optimize })}
          />
          <label className="flex items-center justify-between gap-3 text-sm text-zinc-200">
            <span title="Más píxeles no dan mejor vector, solo más tiempo y más ruido">
              Resolución máxima
            </span>
            <select
              value={maxSize}
              onChange={(e) => onMaxSize(Number(e.target.value))}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            >
              {MAX_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  )
}
