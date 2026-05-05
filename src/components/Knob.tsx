type KnobProps = {
  label: string
  value: number
  min?: number
  max?: number
  suffix?: string
  displayValue?: string
  onChange: (value: number) => void
}

export function Knob({
  label,
  value,
  min = 0,
  max = 100,
  suffix = '',
  displayValue,
  onChange,
}: KnobProps) {
  const normalizedValue = ((value - min) / (max - min)) * 100
  const rotation = -132 + (normalizedValue / 100) * 264

  return (
    <label className="knob-control">
      <span className="knob">
        <span style={{ transform: `rotate(${rotation}deg)` }} />
        <input
          aria-label={label}
          className="knob-input"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          type="range"
          value={value}
        />
      </span>
      <strong>{label}</strong>
      <small>{displayValue ?? `${value}${suffix}`}</small>
    </label>
  )
}
