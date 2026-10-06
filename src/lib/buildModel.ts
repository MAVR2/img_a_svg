import type { ModelRequest, ModelResponse } from '../types'

export type Model = Extract<ModelResponse, { type: 'result' }>

/** Genera el STL del relieve en un worker de un solo uso. */
export function buildModel(request: ModelRequest): Promise<Model> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/model.worker.ts', import.meta.url), {
      type: 'module',
    })
    const finish = (settle: () => void) => {
      worker.terminate()
      settle()
    }
    worker.onmessage = (event: MessageEvent<ModelResponse>) => {
      const response = event.data
      finish(() =>
        response.type === 'result' ? resolve(response) : reject(new Error(response.message)),
      )
    }
    worker.onerror = () => finish(() => reject(new Error('No se pudo iniciar el generador 3D.')))
    worker.postMessage(request)
  })
}
