import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 32

interface View {
  zoom: number
  x: number
  y: number
}

interface CompareProps {
  originalUrl: string
  /** null mientras no haya terminado la primera conversión. */
  svgUrl: string | null
  /** Rótulo del lado derecho de la barra. */
  resultLabel: string
  busy: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Comparador antes/después: original a la izquierda de la barra, SVG a la derecha. */
export function Compare({ originalUrl, svgUrl, resultLabel, busy }: CompareProps) {
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'divider' | 'pan'; x: number; y: number } | null>(null)
  const [divider, setDivider] = useState(0.5)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })

  /** Zoom manteniendo fijo el punto (px, py), medido desde el centro del contenedor. */
  const zoomBy = useCallback((factor: number, px = 0, py = 0) => {
    const el = container.current
    if (!el) return
    setView((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const ratio = zoom / v.zoom
      const maxX = ((zoom - 1) * el.clientWidth) / 2
      const maxY = ((zoom - 1) * el.clientHeight) / 2
      return {
        zoom,
        x: clamp(px - (px - v.x) * ratio, -maxX, maxX),
        y: clamp(py - (py - v.y) * ratio, -maxY, maxY),
      }
    })
  }, [])

  // React registra `wheel` como pasivo; para poder hacer preventDefault hay que escucharlo a mano
  useEffect(() => {
    const el = container.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Ctrl/⌘ + rueda (o pellizco en trackpad); la rueda sola sigue desplazando la página
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomBy(
        Math.exp(-e.deltaY * 0.01),
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2,
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  const moveDivider = (clientX: number) => {
    const rect = container.current!.getBoundingClientRect()
    setDivider(clamp((clientX - rect.left) / rect.width, 0, 1))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const onHandle = (e.target as HTMLElement).closest('[data-handle]') !== null
    // Sin zoom no hay nada que desplazar, así que arrastrar en cualquier punto mueve la barra
    const mode = onHandle || view.zoom === 1 ? 'divider' : 'pan'
    drag.current = { mode, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (mode === 'divider') moveDivider(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    if (state.mode === 'divider') {
      moveDivider(e.clientX)
      return
    }
    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    state.x = e.clientX
    state.y = e.clientY
    const el = e.currentTarget
    setView((v) => {
      const maxX = ((v.zoom - 1) * el.clientWidth) / 2
      const maxY = ((v.zoom - 1) * el.clientHeight) / 2
      return { ...v, x: clamp(v.x + dx, -maxX, maxX), y: clamp(v.y + dy, -maxY, maxY) }
    })
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
  const imageClass = 'h-full w-full object-contain p-3 select-none'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-400">
          {svgUrl ? 'Arrastra la barra para comparar' : 'Vectorizando…'}
        </span>
        <div className="flex items-center gap-1">
          <ZoomButton label="Alejar" onClick={() => zoomBy(1 / 1.5)} disabled={view.zoom <= MIN_ZOOM}>
            −
          </ZoomButton>
          <button
            type="button"
            title="Restablecer zoom"
            onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
            className="w-16 cursor-pointer rounded-md px-2 py-1 text-zinc-300 tabular-nums hover:bg-zinc-800"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <ZoomButton label="Acercar" onClick={() => zoomBy(1.5)} disabled={view.zoom >= MAX_ZOOM}>
            +
          </ZoomButton>
        </div>
      </div>

      <div
        ref={container}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`checkerboard relative h-[58vh] min-h-72 touch-none overflow-hidden rounded-xl border border-zinc-800 ${
          view.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-ew-resize'
        }`}
      >
        <img
          src={originalUrl}
          alt="Imagen original"
          draggable={false}
          className={`absolute inset-0 ${imageClass}`}
          style={{ transform, imageRendering: view.zoom >= 3 ? 'pixelated' : 'auto' }}
        />

        {svgUrl && (
          <>
            <div
              className="checkerboard absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${divider * 100}%)` }}
            >
              <img
                src={svgUrl}
                alt="Resultado vectorizado"
                draggable={false}
                className={imageClass}
                style={{ transform }}
              />
            </div>

            <div
              data-handle
              role="slider"
              tabIndex={0}
              aria-label="Posición del comparador"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(divider * 100)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setDivider((d) => clamp(d - 0.02, 0, 1))
                if (e.key === 'ArrowRight') setDivider((d) => clamp(d + 0.02, 0, 1))
              }}
              className="absolute inset-y-0 -ml-4 flex w-8 cursor-ew-resize justify-center outline-none"
              style={{ left: `${divider * 100}%` }}
            >
              <div className="h-full w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
              <div className="absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 7-5 5 5 5m6-10 5 5-5 5" />
                </svg>
              </div>
            </div>

            <Badge className="left-3">Original</Badge>
            <Badge className="right-3">{resultLabel}</Badge>
          </>
        )}

        {busy && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-200">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400" />
            Vectorizando…
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`pointer-events-none absolute top-3 rounded-md bg-zinc-950/70 px-2 py-0.5 text-xs font-medium text-zinc-200 ${className}`}
    >
      {children}
    </span>
  )
}

interface ZoomButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}

function ZoomButton({ label, disabled, onClick, children }: ZoomButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 text-lg leading-none text-zinc-200 hover:border-zinc-500 disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}
