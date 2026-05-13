import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  ChevronDown,
  MoreVertical,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Volume1,
} from 'lucide-react'
import type { AutoMixPreset, Track } from '../types/daw'

type SidebarProps = {
  tracks: Track[]
  selectedTrackId: string
  onAddTrack: () => void
  onApplyAutoMix: (trackId: string, preset: AutoMixPreset) => void
  onSelectTrack: (trackId: string) => void
  onToggleMute: (trackId: string) => void
  onToggleSolo: (trackId: string) => void
}

const autoMixPresets: Array<{ label: string; preset: AutoMixPreset; tag: string }> = [
  { label: 'Clean Vocal', preset: 'balanced', tag: 'Smart' },
  { label: 'Broadcast', preset: 'broadcast', tag: 'Tight' },
  { label: 'Wide Hook', preset: 'wideHook', tag: 'Space' },
  { label: 'Dry Focus', preset: 'dryFocus', tag: 'Dry' },
  { label: 'Reset Mix', preset: 'reset', tag: 'Reset' },
]

export function Sidebar({
  tracks,
  selectedTrackId,
  onAddTrack,
  onApplyAutoMix,
  onSelectTrack,
  onToggleMute,
  onToggleSolo,
}: SidebarProps) {
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0]
  const [isAutoMixOpen, setIsAutoMixOpen] = useState(false)
  const [autoMixStatus, setAutoMixStatus] = useState<string | null>(null)
  const statusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  const applyAutoMixPreset = (preset: AutoMixPreset) => {
    const option = autoMixPresets.find((item) => item.preset === preset)

    if (!selectedTrack) {
      return
    }

    onApplyAutoMix(selectedTrack.id, preset)
    setIsAutoMixOpen(false)
    setAutoMixStatus(option?.tag ?? 'Done')

    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current)
    }

    statusTimeoutRef.current = window.setTimeout(() => {
      setAutoMixStatus(null)
    }, 2200)
  }

  return (
    <aside className="sidebar" aria-label="Track list">
      <div className="track-actions">
        <button className="add-track-button" onClick={onAddTrack} type="button">
          <Plus size={18} />
          Add Track
        </button>
        <button className="round-tool" aria-label="Route tracks">
          <AudioLines size={18} />
        </button>
        <button className="round-tool" aria-label="Mixer settings">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="track-list" aria-label="Tracks">
        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId

          return (
            <article
              className={isSelected ? 'track-card is-selected' : 'track-card'}
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
            >
              <div className="track-card-header">
                <div className="record-dot" aria-hidden="true" />
                <strong>{String(track.index).padStart(2, '0')}</strong>
                <span>{track.name}</span>
                <button className="mini-icon-button" aria-label="Track menu">
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="track-card-controls">
                <div className="track-toggles" aria-label="Track toggles">
                  <button
                    className={track.mixer.muted ? 'toggle is-on' : 'toggle'}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleMute(track.id)
                    }}
                  >
                    M
                  </button>
                  <button
                    className={track.mixer.solo ? 'toggle is-on' : 'toggle'}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleSolo(track.id)
                    }}
                  >
                    S
                  </button>
                  <button className="toggle">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button className="fx-pill">
                  <Sparkles size={14} />
                  Fx
                </button>
              </div>

              <div className="track-meter-row">
                <span className="track-meter">
                  <i style={{ width: `${track.mixer.muted ? 0 : track.mixer.volume}%` }} />
                </span>
                <span className="pan-readout">
                  <Volume1 size={14} />
                  {track.mixer.pan === 0 ? 'C' : track.mixer.pan > 0 ? `R${track.mixer.pan}` : `L${Math.abs(track.mixer.pan)}`}
                </span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="automation-panel">
        <div className={isAutoMixOpen ? 'automation-row is-open' : 'automation-row'}>
          <button
            aria-label="Apply auto mix"
            className="auto-mix-main"
            onClick={() => applyAutoMixPreset('balanced')}
            type="button"
          >
            <SlidersHorizontal size={17} />
            <strong>Auto Mix</strong>
            {autoMixStatus ? <em>{autoMixStatus}</em> : null}
          </button>
          <span className="ai-badge">AI</span>
          <button
            aria-expanded={isAutoMixOpen}
            aria-haspopup="menu"
            aria-label="Auto mix presets"
            className="auto-mix-menu-button"
            onClick={() => setIsAutoMixOpen(!isAutoMixOpen)}
            type="button"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {isAutoMixOpen ? (
          <div className="auto-mix-menu" role="menu">
            {autoMixPresets.map((option) => (
              <button
                className={option.preset === 'reset' ? 'auto-mix-preset is-reset' : 'auto-mix-preset'}
                key={option.preset}
                onClick={() => applyAutoMixPreset(option.preset)}
                role="menuitem"
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.tag}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
