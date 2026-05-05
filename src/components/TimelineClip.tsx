import type { PointerEvent } from 'react'
import type { AudioClip } from '../types/daw'
import { beatToPixels, pixelsToBeat } from '../utils/time'
import { WaveformCanvas } from './WaveformCanvas'

type ClipEditMode = 'move' | 'trim-start' | 'trim-end'

type TimelineClipProps = {
  clip: AudioClip
  isSelected: boolean
  pixelsPerBeat: number
  onSelect: (clipId: string) => void
  onEditStart: (clip: AudioClip, mode: ClipEditMode, pointerX: number) => void
}

export function TimelineClip({
  clip,
  isSelected,
  pixelsPerBeat,
  onSelect,
  onEditStart,
}: TimelineClipProps) {
  const left = beatToPixels(clip.startBeat, pixelsPerBeat)
  const width = Math.max(80, beatToPixels(clip.durationBeats, pixelsPerBeat))

  const handlePointerDown = (mode: ClipEditMode) => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect(clip.id)
    onEditStart(clip, mode, event.clientX)
  }

  return (
    <button
      className={isSelected ? 'audio-clip is-selected' : 'audio-clip'}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(clip.id)
      }}
      onPointerDown={handlePointerDown('move')}
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
      title={`${clip.name} (${clip.durationSeconds.toFixed(1)}s)`}
    >
      <span
        className="clip-trim-handle is-left"
        onPointerDown={handlePointerDown('trim-start')}
      />
      <span
        className="clip-trim-handle is-right"
        onPointerDown={handlePointerDown('trim-end')}
      />
      <span className="clip-name">{clip.name}</span>
      <WaveformCanvas peaks={clip.waveformPeaks} redrawKey={`${width}-${pixelsPerBeat}`} />
      <span className="clip-meta">
        {pixelsToBeat(width, pixelsPerBeat).toFixed(1)} beats
      </span>
    </button>
  )
}
