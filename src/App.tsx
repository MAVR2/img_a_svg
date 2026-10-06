import { useCallback, useEffect, useMemo, useState } from 'react'
import { Compare } from './components/Compare'
import { Controls } from './components/Controls'
import { Dropzone, FileButton } from './components/Dropzone'
import { ModelExport } from './components/ModelExport'
import { Stats } from './components/Stats'
import { useFileDrop } from './hooks/useFileDrop'
import { useVectorizer } from './hooks/useVectorizer'
import { downloadSvg, withExtension } from './lib/download'
import { loadImage, SVG_TYPE, validateFile } from './lib/loadImage'
import { DEFAULT_PRESET, presetSettings } from './lib/presets'
import type { PresetId, Settings, SourceImage } from './types'

// En móvil hay menos memoria: se parte de un límite de resolución más bajo
const defaultMaxSize = () => (window.matchMedia('(pointer: coarse)').matches ? 1200 : 2000)

interface LoadedImage {
  file: File
  maxSize: number
  image: SourceImage
}

/** La vista previa del relieve muestra sus tres zonas: negro, blanco y transparente (sin material). */
const initialModelSettings = (): Settings => ({ ...presetSettings('bw'), twoTone: true })

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    // oxlint-disable-next-line react/set-state-in-effect -- la URL es un recurso externo ligado al blob
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return blob ? url : null
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [loaded, setLoaded] = useState<LoadedImage | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [preset, setPreset] = useState<PresetId | null>(DEFAULT_PRESET)
  const [settings, setSettings] = useState<Settings>(() => presetSettings(DEFAULT_PRESET))
  const [maxSize, setMaxSize] = useState(defaultMaxSize)
  const [copied, setCopied] = useState(false)
  const [modelSettings, setModelSettings] = useState<Settings>(initialModelSettings)
  const [wantsModel, setWantsModel] = useState(false)

  // Un SVG ya es un vector: va directo a las opciones del modelo 3D
  const isSvg = file?.type === SVG_TYPE
  const step = isSvg || wantsModel ? 'stl' : 'svg'

  // Mientras se decodifica otro archivo (o a otra resolución) no hay imagen vigente
  const image = loaded?.file === file && loaded.maxSize === maxSize ? loaded.image : null

  const { result, loading, error, cancel } = useVectorizer(
    image,
    step === 'stl' ? modelSettings : settings,
  )

  const handleFile = useCallback((next: File) => {
    const problem = validateFile(next)
    setFileError(problem)
    if (problem) return
    setFile(next)
    setWantsModel(false)
  }, [])
  const dragging = useFileDrop(handleFile)

  useEffect(() => {
    if (!file) return
    let stale = false
    loadImage(file, maxSize).then(
      (image) => {
        if (!stale) setLoaded({ file, maxSize, image })
      },
      (reason: Error) => {
        if (stale) return
        setFileError(reason.message)
        setFile(null)
      },
    )
    return () => {
      stale = true
    }
  }, [file, maxSize])

  const svgBlob = useMemo(
    () => (result ? new Blob([result.svg], { type: 'image/svg+xml' }) : null),
    [result],
  )
  const originalUrl = useObjectUrl(file)
  const svgUrl = useObjectUrl(svgBlob)

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.svg)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setFileError('El navegador no permitió copiar al portapapeles.')
    }
  }

  const primaryButton =
    'cursor-pointer rounded-lg bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-default disabled:opacity-40'
  const secondaryButton =
    'cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-default disabled:opacity-40'

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Imagen a SVG</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Convierte imágenes JPG, PNG y WebP a SVG, y cualquiera de ellas (o un SVG) a un modelo 3D
          en STL. Todo ocurre en tu navegador: la imagen nunca sale de
          tu equipo.
        </p>
      </header>

      {fileError && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {fileError}
        </p>
      )}

      {!file || !originalUrl ? (
        <>
          <Dropzone onFile={handleFile} dragging={dragging} />
          <p className="text-center text-sm text-zinc-500">
            Funciona mejor con logos, iconos, texto, firmas e ilustraciones planas. Con fotografías
            el resultado es pesado y de aspecto posterizado.
          </p>
        </>
      ) : (
        <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-4">
            <Compare
              key={originalUrl}
              originalUrl={originalUrl}
              svgUrl={svgUrl}
              resultLabel={step === 'stl' ? 'Relieve' : 'SVG'}
              busy={loading || !image}
            />
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </p>
            )}
            {step === 'svg' && result && svgBlob && image && (
              <Stats
                svgBytes={svgBlob.size}
                originalBytes={file.size}
                paths={result.paths}
                ms={result.ms}
                width={image.width}
                height={image.height}
              />
            )}
          </div>

          {step === 'svg' ? (
            <aside className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!result}
                  onClick={() => result && downloadSvg(result.svg, withExtension(file.name, 'svg'))}
                  className={primaryButton}
                >
                  Descargar SVG
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={!result} onClick={copy} className={secondaryButton}>
                    {copied ? '¡Copiado!' : 'Copiar código'}
                  </button>
                  {loading ? (
                    <button type="button" onClick={cancel} className={secondaryButton}>
                      Cancelar
                    </button>
                  ) : (
                    <FileButton onFile={handleFile} className={secondaryButton}>
                      Otra imagen
                    </FileButton>
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500" title={file.name}>
                  {file.name}
                </p>
              </div>

              <Controls
                preset={preset}
                settings={settings}
                maxSize={maxSize}
                onPreset={(id) => {
                  setPreset(id)
                  // El fondo elegido no depende del tipo de imagen: se conserva al cambiar de preset
                  setSettings((current) => ({
                    ...presetSettings(id),
                    background: current.background,
                    backgroundColor: current.backgroundColor,
                  }))
                }}
                onChange={(patch) => {
                  if (!('background' in patch)) setPreset(null)
                  setSettings((current) => ({ ...current, ...patch }))
                }}
                onMaxSize={setMaxSize}
              />

              <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3">
                <p className="text-sm text-zinc-200">¿Quieres convertirlo también en un modelo 3D?</p>
                <p className="text-xs text-zinc-400">
                  Un relieve STL de dos alturas, listo para imprimir.
                </p>
                <button type="button" onClick={() => setWantsModel(true)} className={secondaryButton}>
                  Convertir a STL
                </button>
              </div>
            </aside>
          ) : (
            <aside className="flex flex-col gap-4">
              <ModelExport
                image={image}
                settings={modelSettings}
                fileName={file.name}
                onChange={(patch) => setModelSettings((current) => ({ ...current, ...patch }))}
              />
              <div className={`grid gap-2 ${isSvg ? '' : 'grid-cols-2'}`}>
                {!isSvg && (
                  <button type="button" onClick={() => setWantsModel(false)} className={secondaryButton}>
                    ← Volver al SVG
                  </button>
                )}
                <FileButton onFile={handleFile} className={secondaryButton}>
                  Otra imagen
                </FileButton>
              </div>
              <p className="truncate text-xs text-zinc-500" title={file.name}>
                {file.name}
              </p>
            </aside>
          )}
        </main>
      )}

      {dragging && file && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center border-4 border-dashed border-emerald-400 bg-zinc-950/80 text-xl font-medium text-emerald-200">
          Suelta la imagen para convertirla
        </div>
      )}

      <footer className="mt-auto pt-4 text-center text-xs text-zinc-600">
        Vectorización con VTracer (WebAssembly) · Optimización con SVGO · Sin servidor
      </footer>
    </div>
  )
}
