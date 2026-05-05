type KnobProps = {
  label: string
  value: number
  suffix?: string
}

export function Knob({ label, value, suffix = '' }: KnobProps) {
  const rotation = -132 + (value / 100) * 264

  return (
    <div className="knob-control">
      <div
        aria-label={`${label} ${value}${suffix}`}
        className="knob"
        role="slider"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value}
        tabIndex={0}
      >
        <span style={{ transform: `rotate(${rotation}deg)` }} />
      </div>
      <strong>{label}</strong>
      <small>
        {value}
        {suffix}
      </small>
    </div>
  )
}
