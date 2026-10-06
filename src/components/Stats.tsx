import { formatBytes } from '../lib/download'

interface StatsProps {
  svgBytes: number
  originalBytes: number
  paths: number
  ms: number
  width: number
  height: number
}

export function Stats({
  svgBytes,
  originalBytes,
  paths,
  ms,
  width,
  height,
}: StatsProps) {
  const heavier = svgBytes > originalBytes
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat
          label="Tamaño SVG"
          value={formatBytes(svgBytes)}
          detail={`original: ${formatBytes(originalBytes)}`}
          warn={heavier}
        />
        <Stat label="Trazos" value={paths.toLocaleString('es')} />
        <Stat label="Tiempo" value={ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`} />
        <Stat label="Dimensiones" value={`${width} × ${height}`} />
      </dl>
      {heavier && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          El SVG pesa más que la imagen original. Suele pasar con fotos: prueba con menos colores o
          un filtro de manchas más alto.
        </p>
      )}
    </div>
  )
}

interface StatProps {
  label: string
  value: string
  detail?: string
  warn?: boolean
}

function Stat({ label, value, detail, warn = false }: StatProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className={`font-medium tabular-nums ${warn ? 'text-amber-300' : 'text-zinc-100'}`}>
        {value}
      </dd>
      {detail && <dd className="text-xs text-zinc-500">{detail}</dd>}
    </div>
  )
}
