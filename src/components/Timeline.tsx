import { FileAudio, Magnet, Search, ZoomIn, ZoomOut } from 'lucide-react'
import type { TimeSignature } from '../types/daw'

type TimelineProps = {
  bars: number
  bpm: number
  timeSignature: TimeSignature
}

const beatsPerBar = 4
const subdivisions = 4

export function Timeline({ bars, bpm, timeSignature }: TimelineProps) {
  const barItems = Array.from({ length: bars }, (_, index) => index + 1)
  const gridColumns = bars * beatsPerBar * subdivisions
  const [, noteValue] = timeSignature

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-tools">
        <div className="timeline-status">
          <strong>{bpm} bpm</strong>
          <span>{beatsPerBar} beats per bar</span>
          <span>1/{noteValue} note grid</span>
        </div>
        <div className="timeline-tool-buttons">
          <button className="mini-icon-button is-active" aria-label="Snap to grid">
            <Magnet size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Search timeline">
            <Search size={16} />
          </button>
        </div>
      </div>

      <div className="ruler" style={{ gridTemplateColumns: `repeat(${bars}, minmax(76px, 1fr))` }}>
        {barItems.map((bar) => (
          <div className={bar === 1 ? 'bar-label is-current' : 'bar-label'} key={bar}>
            {bar}
          </div>
        ))}
      </div>

      <div className="arrangement">
        <div className="playhead" aria-hidden="true">
          <span />
        </div>
        <div
          className="beat-grid"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(19px, 1fr))`,
          }}
        >
          {Array.from({ length: gridColumns }, (_, index) => (
            <span
              className={index % (beatsPerBar * subdivisions) === 0 ? 'grid-line is-bar' : 'grid-line'}
              key={index}
            />
          ))}
        </div>

        <div className="track-lane">
          <div className="record-region" />
          <div className="drop-zone">
            <FileAudio size={28} />
            <strong>Drop a loop or audio file</strong>
            <span>Recording and waveform clips will appear here in the next stage.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
