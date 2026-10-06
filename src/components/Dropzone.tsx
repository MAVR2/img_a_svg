import { useRef } from 'react'
import { ACCEPTED_TYPES } from '../lib/loadImage'

const ACCEPT = ACCEPTED_TYPES.join(',')

interface FileButtonProps {
  onFile: (file: File) => void
  className?: string
  children: React.ReactNode
}

/** Botón que abre el selector de archivos. */
export function FileButton({ onFile, className, children }: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          // Permite volver a elegir el mismo archivo
          e.target.value = ''
        }}
      />
    </>
  )
}

interface DropzoneProps {
  onFile: (file: File) => void
  dragging: boolean
}

export function Dropzone({ onFile, dragging }: DropzoneProps) {
  return (
    <FileButton
      onFile={onFile}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-20 text-center transition-colors ${
        dragging
          ? 'border-emerald-400 bg-emerald-400/10'
          : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-12 w-12 text-emerald-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      <span className="text-lg font-medium text-zinc-100">
        Arrastra una imagen aquí o haz clic para elegirla
      </span>
      <span className="text-sm text-zinc-400">
        JPG, PNG, WebP o SVG · también puedes pegarla con Ctrl/⌘ + V
      </span>
    </FileButton>
  )
}
