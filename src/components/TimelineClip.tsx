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
      className={[
        'audio-clip',
        isSelected ? 'is-selected' : '',
        clip.missingAudio ? 'is-missing' : '',
      ].filter(Boolean).join(' ')}
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
      <span className="clip-name">{clip.missingAudio ? `${clip.name} missing audio` : clip.name}</span>
      <WaveformCanvas
        color={clip.missingAudio ? '#ffb8af' : '#8af8e2'}
        peaks={clip.waveformPeaks}
        redrawKey={`${width}-${pixelsPerBeat}-${clip.missingAudio ? 'missing' : 'ready'}`}
      />
      <span className="clip-meta">
        {pixelsToBeat(width, pixelsPerBeat).toFixed(1)} beats
      </span>
    </button>
  )
}
