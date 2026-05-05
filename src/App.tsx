import { BottomPanel } from './components/BottomPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { autoPitch, inputDevices, project, transport } from './data/mockProject'

export default function App() {
  const selectedTrack = project.tracks[0]

  return (
    <main className="daw-shell" aria-label="Voice track digital audio workstation">
      <TopBar project={project} transport={transport} />
      <div className="workspace-grid">
        <Sidebar track={selectedTrack} />
        <Timeline bars={20} bpm={project.bpm} timeSignature={project.timeSignature} />
      </div>
      <BottomPanel
        autoPitch={autoPitch}
        inputDevices={inputDevices}
        track={selectedTrack}
      />
    </main>
  )
}
