import { FileAudio, Search, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, DragEvent, MouseEvent } from 'react'
import deleteIcon from '../assets/track-icons/flicon_delete.png'
import menuIcon from '../assets/track-icons/flicon_menu.png'
import muteIcon from '../assets/track-icons/flicon_mute.png'
import paintIcon from '../assets/track-icons/flicon_paint.png'
import drawIcon from '../assets/track-icons/flicon_pencilup.png'
import moveIcon from '../assets/track-icons/flicon_move.png'
import playIcon from '../assets/track-icons/flicon_play.png'
import playSelectedIcon from '../assets/track-icons/flicon_playback.png'
import selectIcon from '../assets/track-icons/flicon_select.png'
import sliceIcon from '../assets/track-icons/flicon_slice.png'
import slipIcon from '../assets/track-icons/flicon_slip.png'
import snapIcon from '../assets/track-icons/flicon_snap.png'
import zoomIcon from '../assets/track-icons/flicon_zoom.png'
import deleteCursor from '../assets/track-cursors/flicon_delete.png'
import menuCursor from '../assets/track-cursors/flicon_menu.png'
import muteCursor from '../assets/track-cursors/flicon_mute.png'
import paintCursor from '../assets/track-cursors/flicon_paint.png'
import drawCursor from '../assets/track-cursors/flicon_pencilup.png'
import moveCursor from '../assets/track-cursors/flicon_move.png'
import playCursor from '../assets/track-cursors/flicon_play.png'
import playSelectedCursor from '../assets/track-cursors/flicon_playback.png'
import selectCursor from '../assets/track-cursors/flicon_select.png'
import sliceCursor from '../assets/track-cursors/flicon_slice.png'
import slipCursor from '../assets/track-cursors/flicon_slip.png'
import snapCursor from '../assets/track-cursors/flicon_snap.png'
import zoomCursor from '../assets/track-cursors/flicon_zoom.png'
import type { AudioClip, TimeSignature } from '../types/daw'
import { beatToPixels, getBarNumber, getBeatInBar, getBeatsPerBar, pixelsToBeat } from '../utils/time'
import { TimelineClip } from './TimelineClip'

type ClipEditMode = 'move' | 'trim-start' | 'trim-end'

type TrackToolId =
  | 'menu'
  | 'select'
  | 'move'
  | 'draw'
  | 'paint'
  | 'delete'
  | 'mute'
  | 'slip'
  | 'slice'
  | 'snap'
  | 'zoom'
  | 'play-selected'
  | 'play'

type TrackTool = {
  id: TrackToolId
  label: string
  shortcut: string
  description: string
  icon: string
  cursorIcon: string
}

type TimelineProps = {
  bars: number
  bpm: number
  timeSignature: TimeSignature
  currentBeat: number
  pixelsPerBeat: number
  snapToGrid: boolean
  clips: AudioClip[]
  selectedClipId: string | null
  onSeekToBeat: (beat: number) => void
  onSelectClip: (clipId: string | null) => void
  onClearClipSelection: () => void
  onMoveClip: (clipId: string, startBeat: number) => void
  onTrimClipStart: (clipId: string, startBeat: number) => void
  onTrimClipEnd: (clipId: string, durationBeats: number) => void
  onDeleteSelectedClip: () => void
  onImportAudioFiles: (files: File[], startBeat?: number) => void
  isImportDisabled: boolean
  isPlaying: boolean
  onToggleSnap: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onTogglePlay: () => void
}

type ClipEditSession = {
  clipId: string
  mode: ClipEditMode
  pointerStartX: number
  startBeat: number
  durationBeats: number
}

const subdivisions = 4
const emptyLaneRows = [
  'Voice Lane',
  'Double Lane',
  'Harmony Lane',
  'Comp Lane',
  'FX Automation',
  'Master Notes',
]

const trackTools: TrackTool[] = [
  {
    id: 'menu',
    label: 'Tool Guide',
    shortcut: 'Menu',
    description: 'Open the track tool guide and review the available editing modes.',
    icon: menuIcon,
    cursorIcon: menuCursor,
  },
  {
    id: 'select',
    label: 'Select',
    shortcut: 'E',
    description: 'Click clips or drag across the lane to make a selection. Hold Shift to add or remove clips.',
    icon: selectIcon,
    cursorIcon: selectCursor,
  },
  {
    id: 'move',
    label: 'Move Tool',
    shortcut: 'V',
    description: 'Drag clips left or right on the timeline to move them while respecting the current snap setting.',
    icon: moveIcon,
    cursorIcon: moveCursor,
  },
  {
    id: 'draw',
    label: 'Draw',
    shortcut: 'P',
    description: 'Add the selected clip with a click, drag before release to position it, or hold Alt to draw with snap off.',
    icon: drawIcon,
    cursorIcon: drawCursor,
  },
  {
    id: 'paint',
    label: 'Paint',
    shortcut: 'B',
    description: 'Paint repeated clips by dragging across the lane. Hold Shift to copy the selected clip.',
    icon: paintIcon,
    cursorIcon: paintCursor,
  },
  {
    id: 'delete',
    label: 'Delete',
    shortcut: 'D',
    description: 'Delete the selected clip, or use Delete/Backspace after selecting clips on the timeline.',
    icon: deleteIcon,
    cursorIcon: deleteCursor,
  },
  {
    id: 'mute',
    label: 'Mute Clip',
    shortcut: 'T',
    description: 'Mute individual clips independently of the track mute switch. This mode is prepared for clip-level mute editing.',
    icon: muteIcon,
    cursorIcon: muteCursor,
  },
  {
    id: 'slip',
    label: 'Slip Edit',
    shortcut: 'S',
    description: 'Slide clip content left or right while keeping the clip start and end points in place.',
    icon: slipIcon,
    cursorIcon: slipCursor,
  },
  {
    id: 'slice',
    label: 'Slice',
    shortcut: 'C',
    description: 'Slice clips vertically at the edit point. Hold Shift in DAW-style workflows for alternate slice behavior.',
    icon: sliceIcon,
    cursorIcon: sliceCursor,
  },
  {
    id: 'snap',
    label: 'Track Snap',
    shortcut: 'Alt: temporary off',
    description: 'Toggle grid snap so clip moves and trims align to the beat grid.',
    icon: snapIcon,
    cursorIcon: snapCursor,
  },
  {
    id: 'zoom',
    label: 'Zoom to Selection',
    shortcut: 'Shift+Z',
    description: 'Zoom toward the selected content or current timeline area for closer editing.',
    icon: zoomIcon,
    cursorIcon: zoomCursor,
  },
  {
    id: 'play-selected',
    label: 'Play Selected',
    shortcut: 'Y',
    description: 'Move the playhead to the selected clip and start playback from that take.',
    icon: playSelectedIcon,
    cursorIcon: playSelectedCursor,
  },
  {
    id: 'play',
    label: 'Play / Pause',
    shortcut: 'Space',
    description: 'Start or pause timeline playback. Right-click behavior from desktop DAWs is represented by the Stop control.',
    icon: playIcon,
    cursorIcon: playCursor,
  },
]

export function Timeline({
  bars,
  bpm,
  timeSignature,
  currentBeat,
  pixelsPerBeat,
  snapToGrid,
  clips,
  selectedClipId,
  onSeekToBeat,
  onSelectClip,
  onClearClipSelection,
  onMoveClip,
  onTrimClipStart,
  onTrimClipEnd,
  onDeleteSelectedClip,
  onImportAudioFiles,
  isImportDisabled,
  isPlaying,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
  onTogglePlay,
}: TimelineProps) {
  const arrangementRef = useRef<HTMLDivElement | null>(null)
  const editSessionRef = useRef<ClipEditSession | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDraggingAudio, setIsDraggingAudio] = useState(false)
  const [activeTrackToolId, setActiveTrackToolId] = useState<TrackToolId>('move')
  const [cursorTrackToolId, setCursorTrackToolId] = useState<TrackToolId>('move')
  const [openTrackToolId, setOpenTrackToolId] = useState<TrackToolId | null>(null)
  const beatsPerBar = getBeatsPerBar(timeSignature)
  const barItems = Array.from({ length: bars }, (_, index) => index + 1)
  const gridColumns = bars * beatsPerBar * subdivisions
  const [, noteValue] = timeSignature
  const totalBeats = bars * beatsPerBar
  const timelineWidth = beatToPixels(totalBeats, pixelsPerBeat)
  const playheadX = beatToPixels(Math.min(currentBeat, totalBeats), pixelsPerBeat)
  const currentBar = getBarNumber(currentBeat, timeSignature)
  const currentBeatInBar = getBeatInBar(currentBeat, timeSignature)
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null
  const openTrackTool = trackTools.find((tool) => tool.id === openTrackToolId) ?? null
  const cursorTrackTool = trackTools.find((tool) => tool.id === cursorTrackToolId) ?? trackTools[2]
  const timelineCursorStyle = {
    '--track-tool-cursor': `url(${cursorTrackTool.cursorIcon}) 12 12, auto`,
  } as CSSProperties & { '--track-tool-cursor': string }

  const handleSeek = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    onClearClipSelection()
    onSeekToBeat(pixelsToBeat(x, pixelsPerBeat))
  }

  const getDropBeat = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - bounds.left

      return pixelsToBeat(x, pixelsPerBeat)
    },
    [pixelsPerBeat],
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = isImportDisabled ? 'none' : 'copy'
    setIsDraggingAudio(!isImportDisabled)
  }, [isImportDisabled])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }

    setIsDraggingAudio(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.files.length) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setIsDraggingAudio(false)

      if (isImportDisabled) {
        return
      }

      onImportAudioFiles(Array.from(event.dataTransfer.files), getDropBeat(event))
    },
    [getDropBeat, isImportDisabled, onImportAudioFiles],
  )

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])

    if (files.length > 0 && !isImportDisabled) {
      onImportAudioFiles(files)
    }

    event.currentTarget.value = ''
  }

  const handleTrackToolClick = (tool: TrackTool) => {
    setOpenTrackToolId(tool.id)
    setCursorTrackToolId(tool.id)

    if (tool.id !== 'menu' && tool.id !== 'snap' && tool.id !== 'zoom' && tool.id !== 'play' && tool.id !== 'play-selected') {
      setActiveTrackToolId(tool.id)
    }

    if (tool.id === 'snap') {
      onToggleSnap()
      return
    }

    if (tool.id === 'zoom') {
      onZoomIn()
      return
    }

    if (tool.id === 'delete') {
      if (selectedClipId) {
        onDeleteSelectedClip()
      }
      return
    }

    if (tool.id === 'play-selected') {
      if (selectedClip) {
        onSeekToBeat(selectedClip.startBeat)
      }

      if (!isPlaying) {
        onTogglePlay()
      }
      return
    }

    if (tool.id === 'play') {
      onTogglePlay()
    }
  }

  const handleEditStart = useCallback((clip: AudioClip, mode: ClipEditMode, pointerX: number) => {
    editSessionRef.current = {
      clipId: clip.id,
      mode,
      pointerStartX: pointerX,
      startBeat: clip.startBeat,
      durationBeats: clip.durationBeats,
    }
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = editSessionRef.current

      if (!session) {
        return
      }

      const beatDelta = pixelsToBeat(event.clientX - session.pointerStartX, pixelsPerBeat)

      if (session.mode === 'move') {
        onMoveClip(session.clipId, session.startBeat + beatDelta)
        return
      }

      if (session.mode === 'trim-start') {
        onTrimClipStart(session.clipId, session.startBeat + beatDelta)
        return
      }

      onTrimClipEnd(session.clipId, session.durationBeats + beatDelta)
    }

    const handlePointerUp = () => {
      editSessionRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [onMoveClip, onTrimClipEnd, onTrimClipStart, pixelsPerBeat])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (isTyping || !selectedClipId) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onDeleteSelectedClip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDeleteSelectedClip, selectedClipId])

  return (
    <section className="timeline" aria-label="Timeline" style={timelineCursorStyle}>
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
        <div className="track-tool-palette" aria-label="Track edit tools">
          {trackTools.map((tool) => {
            const isActive =
              tool.id === activeTrackToolId ||
              (tool.id === 'snap' && snapToGrid) ||
              (tool.id === 'play' && isPlaying)
            const buttonClassName = [
              'track-tool-button',
              isActive ? 'is-active' : '',
              tool.id === cursorTrackToolId ? 'is-cursor-tool' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                aria-label={`${tool.label} (${tool.shortcut})`}
                aria-pressed={isActive}
                className={buttonClassName}
                disabled={(tool.id === 'play' || tool.id === 'play-selected') && isImportDisabled}
                key={tool.id}
                onClick={() => handleTrackToolClick(tool)}
                onFocus={() => setOpenTrackToolId(tool.id)}
                title={`${tool.label}: ${tool.description}`}
                type="button"
              >
                <img alt="" src={tool.icon} />
              </button>
            )
          })}
          {openTrackTool ? (
            <div className="track-tool-popover" role="status">
              <strong>{openTrackTool.label}</strong>
              <span>{openTrackTool.shortcut}</span>
              <p>{openTrackTool.description}</p>
            </div>
          ) : null}
        </div>
        <div className="timeline-tool-buttons">
          <button
            className="mini-icon-button"
            aria-label="Import audio"
            disabled={isImportDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileAudio size={16} />
          </button>
          <button className="mini-icon-button" aria-label="Zoom out" onClick={onZoomOut}>
            <ZoomOut size={16} />
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
          className={isDraggingAudio ? 'arrangement is-dragging-audio' : 'arrangement'}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleSeek}
          ref={arrangementRef}
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
            <div className="lane-fill" aria-hidden="true">
              {emptyLaneRows.map((label, index) => (
                <div className="lane-row" key={label}>
                  <span className="lane-row-label">{label}</span>
                  <span className={`lane-row-activity lane-row-activity-${index + 1}`} />
                </div>
              ))}
            </div>
            <input
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
              className="visually-hidden"
              disabled={isImportDisabled}
              onChange={handleFileSelect}
              ref={fileInputRef}
              type="file"
            />
            {clips.map((clip) => (
              <TimelineClip
                clip={clip}
                canMoveClip={activeTrackToolId === 'move'}
                isSelected={clip.id === selectedClipId}
                key={clip.id}
                onEditStart={handleEditStart}
                onSelect={onSelectClip}
                pixelsPerBeat={pixelsPerBeat}
              />
            ))}
            {clips.length === 0 ? (
              <div className="drop-zone">
                <FileAudio size={28} />
                <strong>Drop audio here or start recording</strong>
                <span>Recorded takes and imported files appear here as waveforms.</span>
                <button disabled={isImportDisabled} type="button" onClick={() => fileInputRef.current?.click()}>
                  Browse Audio
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
