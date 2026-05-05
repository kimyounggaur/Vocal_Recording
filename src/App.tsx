import { useEffect } from 'react'
import { BottomPanel } from './components/BottomPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { useMicrophoneRecorder } from './hooks/useMicrophoneRecorder'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { useDawStore } from './state/useDawStore'

export default function App() {
  const project = useDawStore((state) => state.project)
  const transport = useDawStore((state) => state.transport)
  const tracks = useDawStore((state) => state.tracks)
  const clips = useDawStore((state) => state.clips)
  const selectedTrackId = useDawStore((state) => state.selectedTrackId)
  const selectedClipId = useDawStore((state) => state.selectedClipId)
  const autopitch = useDawStore((state) => state.autopitch)
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
  const setInputDevice = useDawStore((state) => state.setInputDevice)
  const setInputChannel = useDawStore((state) => state.setInputChannel)
  const toggleMonitoring = useDawStore((state) => state.toggleMonitoring)
  const toggleSnapToGrid = useDawStore((state) => state.toggleSnapToGrid)
  const zoomTimeline = useDawStore((state) => state.zoomTimeline)
  const moveClip = useDawStore((state) => state.moveClip)
  const trimClipStart = useDawStore((state) => state.trimClipStart)
  const trimClipEnd = useDawStore((state) => state.trimClipEnd)
  const deleteSelectedClip = useDawStore((state) => state.deleteSelectedClip)

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0]
  const recorder = useMicrophoneRecorder()
  usePlaybackEngine()

  useEffect(() => {
    void restoreLastProject()
  }, [restoreLastProject])

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
        onSetProjectKey={setProjectKey}
        onStop={handleStop}
        onTogglePlay={togglePlay}
        onToggleRecord={recorder.toggleRecording}
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
          onMoveClip={moveClip}
          onSeekToBeat={seekToBeat}
          onSelectClip={selectClip}
          onTrimClipEnd={trimClipEnd}
          onTrimClipStart={trimClipStart}
          onToggleSnap={toggleSnapToGrid}
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
