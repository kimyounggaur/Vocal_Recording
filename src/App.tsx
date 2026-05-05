import { useEffect } from 'react'
import { BottomPanel } from './components/BottomPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { useDawStore } from './state/useDawStore'

export default function App() {
  const project = useDawStore((state) => state.project)
  const transport = useDawStore((state) => state.transport)
  const tracks = useDawStore((state) => state.tracks)
  const clips = useDawStore((state) => state.clips)
  const selectedTrackId = useDawStore((state) => state.selectedTrackId)
  const autopitch = useDawStore((state) => state.autopitch)
  const inputDevices = useDawStore((state) => state.inputDevices)
  const selectedInputDeviceId = useDawStore((state) => state.selectedInputDeviceId)
  const selectedInputChannelId = useDawStore((state) => state.selectedInputChannelId)
  const isMonitoring = useDawStore((state) => state.isMonitoring)
  const timeline = useDawStore((state) => state.timeline)
  const selectTrack = useDawStore((state) => state.selectTrack)
  const togglePlay = useDawStore((state) => state.togglePlay)
  const toggleRecord = useDawStore((state) => state.toggleRecord)
  const stopTransport = useDawStore((state) => state.stopTransport)
  const returnToStart = useDawStore((state) => state.returnToStart)
  const seekToBeat = useDawStore((state) => state.seekToBeat)
  const advanceTransport = useDawStore((state) => state.advanceTransport)
  const setProjectBpm = useDawStore((state) => state.setProjectBpm)
  const setProjectKey = useDawStore((state) => state.setProjectKey)
  const saveProject = useDawStore((state) => state.saveProject)
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

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0]

  useEffect(() => {
    if (!transport.isPlaying && !transport.isRecording) {
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
        onStop={stopTransport}
        onTogglePlay={togglePlay}
        onToggleRecord={toggleRecord}
        project={project}
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
          onSeekToBeat={seekToBeat}
          onToggleSnap={toggleSnapToGrid}
          onZoomIn={() => zoomTimeline('in')}
          onZoomOut={() => zoomTimeline('out')}
          pixelsPerBeat={timeline.pixelsPerBeat}
          snapToGrid={timeline.snapToGrid}
          timeSignature={project.timeSignature}
        />
      </div>
      <BottomPanel
        autoPitch={autopitch}
        inputDevices={inputDevices}
        isMonitoring={isMonitoring}
        onDetectKey={detectProjectKey}
        onSetInputChannel={setInputChannel}
        onSetInputDevice={setInputDevice}
        onToggleAutoPitch={toggleAutoPitch}
        onToggleMonitoring={toggleMonitoring}
        onUpdateAutoPitch={updateAutoPitch}
        onUpdateMixer={updateTrackMixer}
        selectedInputChannelId={selectedInputChannelId}
        selectedInputDeviceId={selectedInputDeviceId}
        track={selectedTrack}
      />
    </main>
  )
}
