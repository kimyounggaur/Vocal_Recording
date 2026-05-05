import { FileAudio, Magnet, Search, ZoomIn, ZoomOut } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { AudioClip, TimeSignature } from '../types/daw'
import { beatToPixels, getBarNumber, getBeatInBar, getBeatsPerBar, pixelsToBeat } from '../utils/time'

type TimelineProps = {
  bars: number
  bpm: number
  timeSignature: TimeSignature
  currentBeat: number
  pixelsPerBeat: number
  snapToGrid: boolean
  clips: AudioClip[]
  onSeekToBeat: (beat: number) => void
  onToggleSnap: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

const subdivisions = 4

export function Timeline({
  bars,
  bpm,
  timeSignature,
  currentBeat,
  pixelsPerBeat,
  snapToGrid,
  clips,
  onSeekToBeat,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
}: TimelineProps) {
  const beatsPerBar = getBeatsPerBar(timeSignature)
  const barItems = Array.from({ length: bars }, (_, index) => index + 1)
  const gridColumns = bars * beatsPerBar * subdivisions
  const [, noteValue] = timeSignature
  const totalBeats = bars * beatsPerBar
  const timelineWidth = beatToPixels(totalBeats, pixelsPerBeat)
  const playheadX = beatToPixels(Math.min(currentBeat, totalBeats), pixelsPerBeat)
  const currentBar = getBarNumber(currentBeat, timeSignature)
  const currentBeatInBar = getBeatInBar(currentBeat, timeSignature)

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    onSeekToBeat(pixelsToBeat(x, pixelsPerBeat))
  }

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-tools">
        <div className="timeline-status">
          <strong>{bpm} bpm</strong>
          <span>{beatsPerBar} beats per bar</span>
          <span>1/{noteValue} note grid</span>
          <span>
            Bar {currentBar}.{currentBeatInBar}
          </span>
          <span>{clips.length} clips</span>
        </div>
        <div className="timeline-tool-buttons">
          <button
            className={snapToGrid ? 'mini-icon-button is-active' : 'mini-icon-button'}
            aria-label="Snap to grid"
            onClick={onToggleSnap}
          >
            <Magnet size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Zoom out" onClick={onZoomOut}>
            <ZoomOut size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Zoom in" onClick={onZoomIn}>
            <ZoomIn size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Search timeline">
            <Search size={16} />
          </button>
        </div>
      </div>

      <div className="timeline-scroll">
        <div
          className="ruler"
          style={{
            gridTemplateColumns: `repeat(${bars}, ${beatsPerBar * pixelsPerBeat}px)`,
            width: `${timelineWidth}px`,
          }}
        >
          {barItems.map((bar) => (
            <div className={bar === currentBar ? 'bar-label is-current' : 'bar-label'} key={bar}>
              {bar}
            </div>
          ))}
        </div>

        <div
          className="arrangement"
          onClick={handleSeek}
          style={{
            width: `${timelineWidth}px`,
          }}
        >
          <div className="playhead" aria-hidden="true" style={{ left: `${playheadX}px` }}>
            <span />
          </div>
          <div
            className="beat-grid"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, ${pixelsPerBeat / subdivisions}px)`,
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
      </div>
    </section>
  )
}
