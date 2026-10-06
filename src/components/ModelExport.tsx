import { useState } from 'react'
import { buildModel } from '../lib/buildModel'
import { downloadBlob, formatBytes, withExtension } from '../lib/download'
import type { Settings, SourceImage } from '../types'
import { Slider, Toggle } from './Fields'

interface ModelExportProps {
  /** null mientras la imagen se está decodificando. */
  image: SourceImage | null
  /** Ajustes de blanco y negro: deciden qué zonas cuentan como negro. */
  settings: Settings
  fileName: string
  onChange: (patch: Partial<Settings>) => void
}

const round = (value: number) => Math.round(value * 10) / 10

/** Opciones y descarga del relieve 3D (STL) de dos alturas: una para el negro y otra para el blanco. */
export function ModelExport({ image, settings, fileName, onChange }: ModelExportProps) {
  // Se guardan como texto para poder dejar el campo vacío mientras se escribe
  const [width, setWidth] = useState('100')
  const [black, setBlack] = useState('3')
  const [white, setWhite] = useState('5')
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const widthMm = Number(width)
  const blackMm = Number(black)
  const whiteMm = Number(white)
  const problem = !(widthMm > 0)
    ? 'El ancho debe ser mayor que 0.'
    : !(blackMm >= 0 && whiteMm >= 0)
      ? 'Las alturas no pueden ser negativas.'
      : blackMm === 0 && whiteMm === 0
        ? 'Al menos una altura debe ser mayor que 0.'
        : null

  const exportModel = async () => {
    if (!image || problem) return
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      const model = await buildModel({ image, settings, widthMm, blackMm, whiteMm })
      downloadBlob(new Blob([model.stl], { type: 'model/stl' }), withExtension(fileName, 'stl'))
      setSummary(
        `Pieza de ${round(model.widthMm)} × ${round(model.depthMm)} × ${round(Math.max(blackMm, whiteMm))} mm · ` +
          `${model.triangles.toLocaleString('es')} triángulos · ${formatBytes(model.stl.byteLength)}`,
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar el modelo 3D.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Modelo 3D (STL)</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Relieve de dos alturas para imprimir en 3D. En la vista previa, el negro y el blanco son
          las dos alturas; donde se ven cuadros (transparente) no se crea nada.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Medidas</h3>
        <NumberField
          label="Ancho de la imagen"
          hint="Lo que mide la imagen completa, contando sus zonas transparentes"
          value={width}
          onChange={setWidth}
        />
        <NumberField label="Altura del negro" value={black} onChange={setBlack} />
        <NumberField label="Altura del blanco" value={white} onChange={setWhite} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          Zonas
        </h3>
        <Slider
          label="Umbral"
          hint="Qué tan oscuro debe ser un píxel para contar como negro"
          value={settings.threshold}
          min={1}
          max={255}
          onChange={(threshold) => onChange({ threshold })}
        />
        <Toggle
          label="Invertir"
          hint="Intercambia las zonas negras y blancas"
          checked={settings.invert}
          onChange={(invert) => onChange({ invert })}
        />
        <Toggle
          label="Quitar fondo"
          hint="No crea material en el color uniforme que rodea al dibujo"
          checked={settings.removeBackground}
          onChange={(removeBackground) => onChange({ removeBackground })}
        />
        <Slider
          label="Filtro de manchas"
          hint="Elimina islas más chicas que este tamaño, imposibles de imprimir"
          value={settings.filterSpeckle}
          min={0}
          max={32}
          unit=" px"
          onChange={(filterSpeckle) => onChange({ filterSpeckle })}
        />
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!image || busy || problem !== null}
          onClick={exportModel}
          className="cursor-pointer rounded-lg bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-default disabled:opacity-40"
        >
          {busy ? 'Generando…' : 'Descargar STL'}
        </button>
        {(problem ?? error) && (
          <p role="alert" className="text-xs text-red-300">
            {problem ?? error}
          </p>
        )}
        {summary && <p className="text-xs text-zinc-400">{summary}</p>}
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}

function NumberField({ label, hint, value, onChange }: NumberFieldProps) {
  return (
    <label
      className="flex items-center justify-between gap-3 text-sm text-zinc-200"
      title={hint}
    >
      {label}
      <span className="flex items-center gap-1.5 text-zinc-400">
        <input
          type="number"
          min={0}
          step={0.1}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 tabular-nums"
        />
        mm
      </span>
    </label>
  )
}
