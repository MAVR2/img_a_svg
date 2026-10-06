interface SliderProps {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function Slider({ label, hint, value, min, max, step = 1, unit = '', onChange }: SliderProps) {
  return (
    <label className="block text-sm text-zinc-200" title={hint}>
      <span className="mb-1.5 flex justify-between">
        {label}
        <span className="text-zinc-400 tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

interface ToggleProps {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between gap-3 text-sm text-zinc-200"
      title={hint}
    >
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-emerald-400"
      />
    </label>
  )
}
