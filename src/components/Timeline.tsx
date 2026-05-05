import { FileAudio, Magnet, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, MouseEvent } from 'react'
import type { AudioClip, TimeSignature } from '../types/daw'
import { beatToPixels, getBarNumber, getBeatInBar, getBeatsPerBar, pixelsToBeat } from '../utils/time'
import { TimelineClip } from './TimelineClip'

type ClipEditMode = 'move' | 'trim-start' | 'trim-end'

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
  onToggleSnap: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

type ClipEditSession = {
  clipId: string
  mode: ClipEditMode
  pointerStartX: number
  startBeat: number
  durationBeats: number
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
  selectedClipId,
  onSeekToBeat,
  onSelectClip,
  onClearClipSelection,
  onMoveClip,
  onTrimClipStart,
  onTrimClipEnd,
  onDeleteSelectedClip,
  onImportAudioFiles,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
}: TimelineProps) {
  const arrangementRef = useRef<HTMLDivElement | null>(null)
  const editSessionRef = useRef<ClipEditSession | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDraggingAudio, setIsDraggingAudio] = useState(false)
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
    event.dataTransfer.dropEffect = 'copy'
    setIsDraggingAudio(true)
  }, [])

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
      onImportAudioFiles(Array.from(event.dataTransfer.files), getDropBeat(event))
    },
    [getDropBeat, onImportAudioFiles],
  )

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])

    if (files.length > 0) {
      onImportAudioFiles(files)
    }

    event.currentTarget.value = ''
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
            className="mini-icon-button"
            aria-label="Import audio"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileAudio size={16} />
          </button>
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
            <input
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
              className="visually-hidden"
              onChange={handleFileSelect}
              ref={fileInputRef}
              type="file"
            />
            {clips.map((clip) => (
              <TimelineClip
                clip={clip}
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
                <strong>Drop a loop or audio file</strong>
                <span>MP3, WAV, M4A, OGG, WEBM, or FLAC will be imported at the playhead.</span>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  Browse audio
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
