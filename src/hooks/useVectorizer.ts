import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings, SourceImage, TraceResult, WorkerRequest, WorkerResponse } from '../types'

const DEBOUNCE_MS = 250

interface Vectorizer {
  result: TraceResult | null
  loading: boolean
  error: string | null
  /** Aborta la conversión en curso. */
  cancel: () => void
}

/**
 * Vectoriza `image` con `settings` en un Web Worker y re-vectoriza cuando cambian.
 * Solo hay una conversión en vuelo: si llegan ajustes nuevos mientras tanto, se
 * guarda únicamente el último y se lanza al terminar la actual.
 */
export function useVectorizer(image: SourceImage | null, settings: Settings): Vectorizer {
  const [result, setResult] = useState<TraceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const worker = useRef<Worker | null>(null)
  /** Imagen que ya tiene el worker actual. */
  const sentImage = useRef<SourceImage | null>(null)
  const currentImage = useRef<SourceImage | null>(null)
  const inFlight = useRef<number | null>(null)
  const pending = useRef<Settings | null>(null)
  const lastId = useRef(0)
  const handleMessage = useRef<(response: WorkerResponse) => void>(() => {})

  const reset = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    sentImage.current = null
    inFlight.current = null
    pending.current = null
  }, [])

  const run = useCallback((next: Settings) => {
    const source = currentImage.current
    if (!source) return
    setLoading(true)
    setError(null)
    if (inFlight.current !== null) {
      pending.current = next
      return
    }

    if (!worker.current) {
      worker.current = new Worker(new URL('../workers/vectorizer.worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.current.onmessage = (event: MessageEvent<WorkerResponse>) =>
        handleMessage.current(event.data)
      worker.current.onerror = () =>
        handleMessage.current({
          type: 'error',
          id: inFlight.current ?? -1,
          message: 'No se pudo iniciar el vectorizador.',
        })
    }
    const send = (message: WorkerRequest) => worker.current!.postMessage(message)
    if (sentImage.current !== source) {
      // Se copia una vez por imagen (no se transfiere): hace falta para reenviarla tras cancelar
      send({ type: 'image', image: source })
      sentImage.current = source
    }
    inFlight.current = ++lastId.current
    send({ type: 'trace', id: inFlight.current, settings: next })
  }, [])

  useEffect(() => {
    handleMessage.current = (response) => {
      if (response.id !== inFlight.current) return
      inFlight.current = null
      const queued = pending.current
      pending.current = null

      if (response.type === 'error') {
        // Tras un fallo del WASM su memoria queda inservible: se parte de un worker nuevo
        reset()
        if (queued) {
          run(queued)
        } else {
          setError(response.message)
          setLoading(false)
        }
        return
      }
      setResult({ svg: response.svg, paths: response.paths, ms: response.ms })
      if (queued) run(queued)
      else setLoading(false)
    }
  }, [reset, run])

  useEffect(() => {
    if (currentImage.current !== image) {
      currentImage.current = image
      reset()
      setResult(null)
      setError(null)
      setLoading(image !== null)
      run(settings)
      return
    }
    const timer = setTimeout(() => run(settings), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [image, settings, reset, run])

  useEffect(() => reset, [reset])

  const cancel = useCallback(() => {
    reset()
    setLoading(false)
  }, [reset])

  return { result, loading, error, cancel }
}
