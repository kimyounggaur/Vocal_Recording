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
import { useState } from 'react'
import type {
  MasteringPresetId,
  MasteringState,
  PersistenceState,
  Project,
  ProjectKey,
  TransportState,
} from '../types/daw'
import type { RecordingStatus } from '../types/daw'
import { formatMasterVolumeDb, MASTERING_PRESETS } from '../utils/mastering'
import { formatTransportTime, MAX_BPM, MIN_BPM } from '../utils/time'

type TopBarProps = {
  project: Project
  transport: TransportState
  recordingStatus: RecordingStatus
  persistence: PersistenceState
  mastering: MasteringState
  onTogglePlay: () => void
  onToggleRecord: () => void | Promise<void>
  onStop: () => void
  onReturnToStart: () => void
  onSave: () => void | Promise<void>
  onSetBpm: (bpm: number) => void
  onSetProjectKey: (key: ProjectKey) => void
  onSetMasteringPreset: (presetId: MasteringPresetId) => void
  onSetMasterVolume: (volume: number) => void
  onToggleMastering: () => void
}

const projectKeys: ProjectKey[] = [
  'C Major',
  'D Major',
  'E Major',
  'F Major',
  'G Major',
  'A Major',
  'B Major',
  'A Minor',
  'D Minor',
  'E Minor',
]

const masteringPresetOptions = Object.values(MASTERING_PRESETS)

export function TopBar({
  project,
  transport,
  recordingStatus,
  persistence,
  mastering,
  onTogglePlay,
  onToggleRecord,
  onStop,
  onReturnToStart,
  onSave,
  onSetBpm,
  onSetProjectKey,
  onSetMasteringPreset,
  onSetMasterVolume,
  onToggleMastering,
}: TopBarProps) {
  const [isMasteringOpen, setIsMasteringOpen] = useState(false)
  const [beats, noteValue] = project.timeSignature
  const isRecordingBusy = recordingStatus === 'arming' || recordingStatus === 'encoding'
  const isTransportLocked = transport.isRecording || isRecordingBusy
  const isSaveDisabled = persistence.isSaving || persistence.isRestoring || isTransportLocked
  const activePreset = MASTERING_PRESETS[mastering.presetId]
  const masteringSummary = mastering.enabled ? activePreset.label : 'Bypassed'
  const saveLabel = persistence.isSaving ? 'Saving...' : 'Save'

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
        <span className="save-state" aria-live="polite">
          <small>Last Saved</small>
          <strong>
            {persistence.isRestoring ? 'Restoring...' : persistence.isSaving ? 'Saving...' : project.lastSaved}
          </strong>
          {persistence.errorMessage ? <em>{persistence.errorMessage}</em> : null}
        </span>
        <button
          className="primary-pill save-button"
          disabled={isSaveDisabled}
          onClick={() => void onSave()}
          title="Save project locally (Ctrl+S)"
        >
          <Save size={17} />
          {saveLabel}
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

        <label className="tempo-chip tempo-input-chip">
          <input
            aria-label="Project tempo"
            disabled={isTransportLocked}
            max={MAX_BPM}
            min={MIN_BPM}
            onChange={(event) => onSetBpm(Number(event.currentTarget.value))}
            type="number"
            value={project.bpm}
          />
          <span>bpm</span>
        </label>

        <div className="tempo-chip">
          <strong>
            {beats} / {noteValue}
          </strong>
        </div>

        <label className="key-chip key-select-chip">
          <KeyRound size={16} />
          <select
            aria-label="Project key"
            disabled={isTransportLocked}
            onChange={(event) => onSetProjectKey(event.currentTarget.value as ProjectKey)}
            value={project.key}
          >
            {projectKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <div className="transport-buttons">
          <button className="icon-button" aria-label="Play" disabled={isTransportLocked} onClick={onTogglePlay}>
            {transport.isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            aria-label="Return to start"
            disabled={isTransportLocked}
            onClick={onReturnToStart}
          >
            <SkipBack size={20} />
          </button>
          <button
            className={transport.isRecording ? 'record-button is-active' : 'record-button'}
            aria-label="Record"
            disabled={isRecordingBusy}
            onClick={onToggleRecord}
          >
            <Circle size={18} fill="currentColor" />
          </button>
          <button className="icon-button" aria-label="Stop" onClick={onStop}>
            <Square size={16} fill="currentColor" />
          </button>
          <div className="time-display">{formatTransportTime(transport.currentTimeSeconds)}</div>
        </div>

        <div className="mastering-control">
          <button
            aria-expanded={isMasteringOpen}
            className={mastering.enabled ? 'mastering-chip is-active' : 'mastering-chip'}
            onClick={() => setIsMasteringOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Settings2 size={17} />
            <span>
              <strong>Mastering</strong>
              <small>{masteringSummary}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {isMasteringOpen ? (
            <div className="mastering-popover" role="menu">
              <div className="mastering-popover-head">
                <span>
                  <strong>Mastering</strong>
                  <small>{mastering.enabled ? activePreset.description : 'Master chain bypassed'}</small>
                </span>
                <button
                  className={mastering.enabled ? 'mastering-bypass is-on' : 'mastering-bypass'}
                  onClick={onToggleMastering}
                  type="button"
                >
                  {mastering.enabled ? 'On' : 'Off'}
                </button>
              </div>
              <div className="mastering-preset-list">
                {masteringPresetOptions.map((preset) => (
                  <button
                    className={preset.id === mastering.presetId && mastering.enabled ? 'is-selected' : ''}
                    key={preset.id}
                    onClick={() => {
                      onSetMasteringPreset(preset.id)
                      setIsMasteringOpen(false)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="master-volume">
          <Volume2 size={18} />
          <input
            aria-label="Master volume"
            max={100}
            min={0}
            onChange={(event) => onSetMasterVolume(Number(event.currentTarget.value))}
            type="range"
            value={mastering.volume}
          />
          <strong>{formatMasterVolumeDb(mastering.volume)}</strong>
        </div>
      </section>
    </header>
  )
}
