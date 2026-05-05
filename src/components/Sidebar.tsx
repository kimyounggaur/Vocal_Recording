import {
  AudioLines,
  ChevronDown,
  MoreVertical,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Volume1,
} from 'lucide-react'
import type { Track } from '../types/daw'

type SidebarProps = {
  track: Track
}

export function Sidebar({ track }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Track list">
      <div className="track-actions">
        <button className="add-track-button">
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

      <article className="track-card is-selected">
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
            <button className={track.mixer.muted ? 'toggle is-on' : 'toggle'}>M</button>
            <button className={track.mixer.solo ? 'toggle is-on' : 'toggle'}>S</button>
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
            <i style={{ width: `${track.mixer.volume}%` }} />
          </span>
          <span className="pan-readout">
            <Volume1 size={14} />
            {track.mixer.pan === 0 ? 'C' : track.mixer.pan > 0 ? `R${track.mixer.pan}` : `L${Math.abs(track.mixer.pan)}`}
          </span>
        </div>
      </article>

      <button className="automation-row">
        <SlidersHorizontal size={17} />
        <strong>Auto Mix</strong>
        <span>AI</span>
        <ChevronDown size={16} />
      </button>
    </aside>
  )
}
