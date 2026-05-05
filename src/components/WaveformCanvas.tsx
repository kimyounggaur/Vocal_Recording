import { useEffect, useRef } from 'react'

type WaveformCanvasProps = {
  peaks: number[]
  redrawKey?: number | string
  color?: string
  backgroundColor?: string
}

export function WaveformCanvas({
  peaks,
  redrawKey,
  color = '#8af8e2',
  backgroundColor = 'transparent',
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const bounds = canvas.getBoundingClientRect()
    const pixelRatio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(bounds.width * pixelRatio))
    const height = Math.max(1, Math.floor(bounds.height * pixelRatio))
    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    canvas.width = width
    canvas.height = height
    context.scale(pixelRatio, pixelRatio)
    context.clearRect(0, 0, bounds.width, bounds.height)
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, bounds.width, bounds.height)

    if (peaks.length === 0) {
      return
    }

    const centerY = bounds.height / 2
    const step = bounds.width / peaks.length
    const barWidth = Math.max(1, step * 0.72)

    context.fillStyle = color

    peaks.forEach((peak, index) => {
      const normalizedPeak = Math.min(Math.max(peak, 0), 1)
      const barHeight = Math.max(2, normalizedPeak * bounds.height * 0.86)
      const x = index * step
      const y = centerY - barHeight / 2
      context.fillRect(x, y, barWidth, barHeight)
    })
  }, [backgroundColor, color, peaks, redrawKey])

  return <canvas className="waveform-canvas" ref={canvasRef} />
}
