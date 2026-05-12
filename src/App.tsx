import { useCallback, useEffect, useRef } from 'react'
import { buildWaveformPeaks, decodeAudioBlob } from './audio/waveform'
import { BottomPanel } from './components/BottomPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { useMicrophoneRecorder } from './hooks/useMicrophoneRecorder'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { useDawStore } from './state/useDawStore'
import type { AudioClip } from './types/daw'
import { createId } from './utils/id'
import { secondsToBeat } from './utils/time'

export default function App() {
  const project = useDawStore((state) => state.project)
  const transport = useDawStore((state) => state.transport)
  const tracks = useDawStore((state) => state.tracks)
  const clips = useDawStore((state) => state.clips)
  const selectedTrackId = useDawStore((state) => state.selectedTrackId)
  const selectedClipId = useDawStore((state) => state.selectedClipId)
  const autopitch = useDawStore((state) => state.autopitch)
  const mastering = useDawStore((state) => state.mastering)
  const inputDevices = useDawStore((state) => state.inputDevices)
  const inputChannels = useDawStore((state) => state.inputChannels)
  const selectedInputDeviceId = useDawStore((state) => state.selectedInputDeviceId)
  const selectedInputChannelId = useDawStore((state) => state.selectedInputChannelId)
  const isMonitoring = useDawStore((state) => state.isMonitoring)
  const recording = useDawStore((state) => state.recording)
  const persistence = useDawStore((state) => state.persistence)
  const timeline = useDawStore((state) => state.timeline)
  const selectTrack = useDawStore((state) => state.selectTrack)
  const selectClip = useDawStore((state) => state.selectClip)
  const togglePlay = useDawStore((state) => state.togglePlay)
  const stopTransport = useDawStore((state) => state.stopTransport)
  const returnToStart = useDawStore((state) => state.returnToStart)
  const seekToBeat = useDawStore((state) => state.seekToBeat)
  const advanceTransport = useDawStore((state) => state.advanceTransport)
  const setProjectBpm = useDawStore((state) => state.setProjectBpm)
  const setProjectKey = useDawStore((state) => state.setProjectKey)
  const saveProject = useDawStore((state) => state.saveProject)
  const restoreLastProject = useDawStore((state) => state.restoreLastProject)
  const updateTrackMixer = useDawStore((state) => state.updateTrackMixer)
  const toggleTrackMute = useDawStore((state) => state.toggleTrackMute)
  const toggleTrackSolo = useDawStore((state) => state.toggleTrackSolo)
  const updateAutoPitch = useDawStore((state) => state.updateAutoPitch)
  const toggleAutoPitch = useDawStore((state) => state.toggleAutoPitch)
  const detectProjectKey = useDawStore((state) => state.detectProjectKey)
  const updateMastering = useDawStore((state) => state.updateMastering)
  const setMasteringPreset = useDawStore((state) => state.setMasteringPreset)
  const toggleMastering = useDawStore((state) => state.toggleMastering)
  const setInputDevice = useDawStore((state) => state.setInputDevice)
  const setInputChannel = useDawStore((state) => state.setInputChannel)
  const toggleMonitoring = useDawStore((state) => state.toggleMonitoring)
  const toggleSnapToGrid = useDawStore((state) => state.toggleSnapToGrid)
  const zoomTimeline = useDawStore((state) => state.zoomTimeline)
  const moveClip = useDawStore((state) => state.moveClip)
  const trimClipStart = useDawStore((state) => state.trimClipStart)
  const trimClipEnd = useDawStore((state) => state.trimClipEnd)
  const deleteSelectedClip = useDawStore((state) => state.deleteSelectedClip)
  const addRecordedClip = useDawStore((state) => state.addRecordedClip)
  const setRecordingStatus = useDawStore((state) => state.setRecordingStatus)
  const setRecordingError = useDawStore((state) => state.setRecordingError)

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0]
  const isAudioImportDisabled =
    transport.isRecording ||
    recording.status === 'arming' ||
    recording.status === 'recording' ||
    recording.status === 'encoding'
  const recorder = useMicrophoneRecorder()
  const importAudioContextRef = useRef<AudioContext | null>(null)
  usePlaybackEngine()

  useEffect(() => {
    void restoreLastProject()
  }, [restoreLastProject])

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
        return
      }

      event.preventDefault()
      const state = useDawStore.getState()
      const isLocked =
        state.persistence.isSaving ||
        state.persistence.isRestoring ||
        state.transport.isRecording ||
        state.recording.status === 'arming' ||
        state.recording.status === 'recording' ||
        state.recording.status === 'encoding'

      if (!isLocked) {
        void state.saveProject()
      }
    }

    window.addEventListener('keydown', handleSaveShortcut)

    return () => {
      window.removeEventListener('keydown', handleSaveShortcut)
    }
  }, [])

  useEffect(() => {
    const preventBrowserFileOpen = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) {
        return
      }

      event.preventDefault()
    }

    window.addEventListener('dragover', preventBrowserFileOpen)
    window.addEventListener('drop', preventBrowserFileOpen)

    return () => {
      window.removeEventListener('dragover', preventBrowserFileOpen)
      window.removeEventListener('drop', preventBrowserFileOpen)
    }
  }, [])

  const getImportAudioContext = useCallback(() => {
    if (!importAudioContextRef.current) {
      importAudioContextRef.current = new AudioContext()
    }

    return importAudioContextRef.current
  }, [])

  const importAudioFiles = useCallback(
    async (files: File[], startBeat?: number) => {
      const state = useDawStore.getState()

      if (state.transport.isRecording || state.recording.status === 'arming' || state.recording.status === 'encoding') {
        setRecordingError('Stop recording before importing audio.')
        return
      }

      if (state.transport.isPlaying) {
        stopTransport()
      }

      const audioFiles = files.filter((file) => {
        const hasAudioMime = file.type.startsWith('audio/')
        const hasAudioExtension = /\.(aac|aif|aiff|flac|m4a|mp3|ogg|wav|webm)$/i.test(file.name)

        return hasAudioMime || hasAudioExtension
      })

      if (audioFiles.length === 0) {
        setRecordingError('Drop or choose a supported audio file.')
        return
      }

      setRecordingStatus('encoding')
      setRecordingError(null)

      try {
        const audioContext = getImportAudioContext()
        await audioContext.resume()

        let nextStartBeat = Math.max(0, startBeat ?? state.transport.currentBeat)
        let importedCount = 0

        for (const file of audioFiles) {
          const audioBuffer = await decodeAudioBlob(file, audioContext)
          const durationSeconds = audioBuffer.duration
          const durationBeats = secondsToBeat(durationSeconds, state.project.bpm)
          const blobId = createId('blob')
          const clipId = createId('clip')
          const clip: AudioClip = {
            id: clipId,
            trackId: state.selectedTrackId,
            blobId,
            name: file.name.replace(/\.[^.]+$/, '') || `Import ${state.clips.length + importedCount + 1}`,
            startBeat: nextStartBeat,
            durationBeats,
            offsetSeconds: 0,
            durationSeconds,
            waveformPeaks: buildWaveformPeaks(audioBuffer),
            objectUrl: URL.createObjectURL(file),
            mimeType: file.type || 'audio/mpeg',
            createdAt: new Date().toISOString(),
          }

          addRecordedClip(clip, file)
          nextStartBeat += durationBeats
          importedCount += 1
        }

        setRecordingError(null)
      } catch {
        setRecordingError('Audio import failed. Try an MP3, WAV, M4A, OGG, WEBM, or FLAC file.')
      } finally {
        setRecordingStatus('idle')
      }
    },
    [
      addRecordedClip,
      getImportAudioContext,
      setRecordingError,
      setRecordingStatus,
      stopTransport,
    ],
  )

  const handleStop = () => {
    if (transport.isRecording) {
      recorder.stopRecording()
      return
    }

    stopTransport()
  }

  useEffect(() => {
    if (!transport.isRecording) {
      return undefined
    }

    let animationFrameId = 0
    let lastTimestamp = performance.now()

    const tick = (timestamp: number) => {
      const deltaSeconds = (timestamp - lastTimestamp) / 1000
      lastTimestamp = timestamp
      advanceTransport(deltaSeconds)
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [advanceTransport, transport.isPlaying, transport.isRecording])

  return (
    <main className="daw-shell" aria-label="Voice track digital audio workstation">
      <TopBar
        onReturnToStart={returnToStart}
        onSave={saveProject}
        onSetBpm={setProjectBpm}
        onSetMasteringPreset={setMasteringPreset}
        onSetMasterVolume={(volume) => updateMastering('volume', volume)}
        onSetProjectKey={setProjectKey}
        onStop={handleStop}
        onToggleMastering={toggleMastering}
        onTogglePlay={togglePlay}
        onToggleRecord={recorder.toggleRecording}
        mastering={mastering}
        persistence={persistence}
        project={project}
        recordingStatus={recording.status}
        transport={transport}
      />
      <div className="workspace-grid">
        <Sidebar
          onSelectTrack={selectTrack}
          onToggleMute={toggleTrackMute}
          onToggleSolo={toggleTrackSolo}
          selectedTrackId={selectedTrackId}
          track={selectedTrack}
        />
        <Timeline
          bars={20}
          bpm={project.bpm}
          clips={clips}
          currentBeat={transport.currentBeat}
          onClearClipSelection={() => selectClip(null)}
          onDeleteSelectedClip={deleteSelectedClip}
          onImportAudioFiles={importAudioFiles}
          isImportDisabled={isAudioImportDisabled}
          isPlaying={transport.isPlaying}
          onMoveClip={moveClip}
          onSeekToBeat={seekToBeat}
          onSelectClip={selectClip}
          onTrimClipEnd={trimClipEnd}
          onTrimClipStart={trimClipStart}
          onToggleSnap={toggleSnapToGrid}
          onTogglePlay={togglePlay}
          onZoomIn={() => zoomTimeline('in')}
          onZoomOut={() => zoomTimeline('out')}
          pixelsPerBeat={timeline.pixelsPerBeat}
          selectedClipId={selectedClipId}
          snapToGrid={timeline.snapToGrid}
          timeSignature={project.timeSignature}
        />
      </div>
      <BottomPanel
        autoPitch={autopitch}
        inputChannels={inputChannels}
        inputDevices={inputDevices}
        isMonitoring={isMonitoring}
        onDetectKey={detectProjectKey}
        onSetInputChannel={setInputChannel}
        onSetInputDevice={setInputDevice}
        onToggleAutoPitch={toggleAutoPitch}
        onToggleMonitoring={toggleMonitoring}
        onToggleRecord={recorder.toggleRecording}
        onUpdateAutoPitch={updateAutoPitch}
        onUpdateMixer={updateTrackMixer}
        recording={recording}
        selectedInputChannelId={selectedInputChannelId}
        selectedInputDeviceId={selectedInputDeviceId}
        track={selectedTrack}
      />
    </main>
  )
}
