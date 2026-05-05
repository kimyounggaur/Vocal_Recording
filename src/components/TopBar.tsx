import {
  ChevronDown,
  Circle,
  Cloud,
  Headphones,
  KeyRound,
  Menu,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings2,
  SkipBack,
  Square,
  Volume2,
} from 'lucide-react'
import type { Project, TransportState } from '../types/daw'

type TopBarProps = {
  project: Project
  transport: TransportState
}

export function TopBar({ project, transport }: TopBarProps) {
  const [beats, noteValue] = project.timeSignature

  return (
    <header className="topbar">
      <section className="brand-cluster" aria-label="Project menu">
        <button className="icon-button" aria-label="Open menu">
          <Menu size={21} />
        </button>
        <div className="app-mark" aria-hidden="true">
          <Mic2 size={18} />
        </div>
        <span className="app-name">Vocal Studio</span>
        <button className="upgrade-button">
          <Cloud size={15} />
          Sync
        </button>
      </section>

      <section className="project-title" aria-label="Project title">
        <strong>{project.name}</strong>
      </section>

      <section className="save-cluster" aria-label="Save status">
        <span className="save-state">
          <small>Last Saved</small>
          <strong>{project.lastSaved}</strong>
        </span>
        <button className="primary-pill">
          <Save size={17} />
          Save
        </button>
      </section>

      <section className="toolbar-row transport-row" aria-label="Transport controls">
        <div className="undo-redo">
          <button className="icon-button" aria-label="Undo">
            <RotateCcw size={18} />
          </button>
          <button className="icon-button is-disabled" aria-label="Redo" disabled>
            <RotateCcw className="flip-x" size={18} />
          </button>
        </div>

        <button className="metronome-button">
          <Headphones size={17} />
          <ChevronDown size={15} />
        </button>

        <div className="tempo-chip">
          <strong>{project.bpm}</strong>
          <span>bpm</span>
        </div>

        <div className="tempo-chip">
          <strong>
            {beats} / {noteValue}
          </strong>
        </div>

        <button className="key-chip">
          <KeyRound size={16} />
          {project.key}
        </button>

        <div className="transport-buttons">
          <button className="icon-button" aria-label="Play">
            {transport.isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-button" aria-label="Return to start">
            <SkipBack size={20} />
          </button>
          <button className="record-button" aria-label="Record">
            <Circle size={18} fill="currentColor" />
          </button>
          <button className="icon-button" aria-label="Stop">
            <Square size={16} fill="currentColor" />
          </button>
          <div className="time-display">{transport.displayTime}</div>
        </div>

        <button className="mastering-chip">
          <Settings2 size={17} />
          <span>
            <strong>Mastering</strong>
            <small>Studio Preset</small>
          </span>
          <ChevronDown size={15} />
        </button>

        <div className="master-volume">
          <Volume2 size={18} />
          <input aria-label="Master volume" defaultValue={78} max={100} min={0} type="range" />
          <strong>+0.0 dB</strong>
        </div>
      </section>
    </header>
  )
}
