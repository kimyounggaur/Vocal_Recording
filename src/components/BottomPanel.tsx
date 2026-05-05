import {
  ChevronDown,
  CircleSlashed,
  Gauge,
  Headphones,
  Music2,
  PanelBottom,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { Knob } from './Knob'
import type {
  AutoPitchSettings,
  InputChannel,
  InputDevice,
  MixerState,
  PitchCategory,
  PitchKey,
  PitchScale,
  RecordingState,
  Track,
} from '../types/daw'

type BottomPanelProps = {
  autoPitch: AutoPitchSettings
  inputDevices: InputDevice[]
  inputChannels: InputChannel[]
  isMonitoring: boolean
  recording: RecordingState
  selectedInputDeviceId: string
  selectedInputChannelId: string
  track: Track
  onSetInputDevice: (deviceId: string) => void
  onSetInputChannel: (channelId: string) => void
  onToggleMonitoring: () => void
  onToggleAutoPitch: () => void
  onDetectKey: () => void
  onUpdateAutoPitch: <K extends keyof AutoPitchSettings>(
    key: K,
    value: AutoPitchSettings[K],
  ) => void
  onUpdateMixer: <K extends keyof MixerState>(
    trackId: string,
    key: K,
    value: MixerState[K],
  ) => void
}

const pitchCategories: PitchCategory[] = ['Essentials', 'Pop', 'Rap', 'Natural']
const pitchScales: PitchScale[] = ['Chromatic', 'Major', 'Minor']
const keys: PitchKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function getPanLabel(value: number): string {
  if (value === 0) {
    return 'C'
  }

  return value > 0 ? `R${value}` : `L${Math.abs(value)}`
}

function getPitchAmountLabel(value: number): string {
  if (value < 25) {
    return 'Light'
  }

  if (value < 55) {
    return 'Balanced'
  }

  if (value < 80) {
    return 'Heavy'
  }

  return 'Heaviest'
}

export function BottomPanel({
  autoPitch,
  inputDevices,
  inputChannels,
  isMonitoring,
  recording,
  selectedInputDeviceId,
  selectedInputChannelId,
  track,
  onSetInputDevice,
  onSetInputChannel,
  onToggleMonitoring,
  onToggleAutoPitch,
  onDetectKey,
  onUpdateAutoPitch,
  onUpdateMixer,
}: BottomPanelProps) {
  const pitchAmountLabel = getPitchAmountLabel(autoPitch.amount)

  return (
    <section className="bottom-panel" aria-label="Voice and audio controls">
      <div className="panel-header">
        <div className="panel-title">
          <button className="close-panel" aria-label="Close panel">
            <X size={18} />
          </button>
          <Music2 size={17} />
          <strong>{track.name}</strong>
        </div>
        <nav className="panel-tabs" aria-label="Editor tabs">
          <button className="is-active">
            <Wand2 size={16} />
            Pitch Assist
          </button>
          <button>
            <Sparkles size={16} />
            Effects
          </button>
          <button>
            <PanelBottom size={16} />
            Editor
          </button>
        </nav>
      </div>

      <div className="panel-content">
        <aside className="input-section">
          <strong className="section-title">Input</strong>
          <label className="select-field">
            <span>Device</span>
            <select
              onChange={(event) => onSetInputDevice(event.currentTarget.value)}
              value={selectedInputDeviceId}
            >
              {inputDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>

          <label className="select-field">
            <span>Channel</span>
            <select
              onChange={(event) => onSetInputChannel(event.currentTarget.value)}
              value={selectedInputChannelId}
            >
              {inputChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>

          <div className="monitoring-row">
            <div>
              <strong>Input Level</strong>
              <span className="input-meter">
                <i style={{ width: `${recording.inputLevel}%` }} />
              </span>
            </div>
            <button className={isMonitoring ? 'is-active' : ''} onClick={onToggleMonitoring}>
              <Headphones size={16} />
              Monitoring
            </button>
          </div>

          <div className={recording.errorMessage ? 'input-alert is-error' : 'input-alert'}>
            {recording.errorMessage ??
              (recording.status === 'recording'
                ? 'Recording'
                : recording.status === 'encoding'
                  ? 'Creating waveform'
                  : recording.permission === 'granted'
                    ? 'Microphone ready'
                    : 'Microphone idle')}
          </div>
        </aside>

        <article className="pitch-card" aria-label="Pitch Assist">
          <div className="pitch-card-top">
            <button
              className={autoPitch.enabled ? 'power-toggle is-on' : 'power-toggle'}
              aria-label="Enable pitch assist"
              onClick={onToggleAutoPitch}
            >
              <span />
            </button>
            <strong>Pitch Assist</strong>
            <button className="auto-detect-button" onClick={onDetectKey}>
              Auto Detect Key
              <SlidersHorizontal size={15} />
            </button>
          </div>

          <div className="pitch-grid">
            <div className="pitch-column">
              <label className="compact-label">
                Category
                <select
                  onChange={(event) =>
                    onUpdateAutoPitch('category', event.currentTarget.value as PitchCategory)
                  }
                  value={autoPitch.category}
                >
                  {pitchCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <div className="preset-grid">
                {pitchCategories.map((preset, index) => (
                  <button
                    className={preset === autoPitch.category ? 'preset-button is-selected' : 'preset-button'}
                    key={preset}
                    onClick={() => onUpdateAutoPitch('category', preset)}
                  >
                    {index === 0 ? <Wand2 size={18} /> : index === 1 ? <Music2 size={18} /> : <CircleSlashed size={18} />}
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <label className="pitch-amount">
                <span className="large-knob">
                  <span style={{ transform: `rotate(${-132 + (autoPitch.amount / 100) * 264}deg)` }} />
                  <input
                  aria-label="Pitch assist amount"
                  className="large-knob-input"
                  max={100}
                  min={0}
                  onChange={(event) => onUpdateAutoPitch('amount', Number(event.currentTarget.value))}
                  type="range"
                  value={autoPitch.amount}
                  />
                </span>
              <span className="amount-scale" aria-hidden="true">
                <small>Light</small>
                <small>Heavy</small>
              </span>
              <strong>{pitchAmountLabel}</strong>
            </label>

            <div className="pitch-column">
              <label className="compact-label">
                Scale
                <select
                  onChange={(event) =>
                    onUpdateAutoPitch('scale', event.currentTarget.value as PitchScale)
                  }
                  value={autoPitch.scale}
                >
                  {pitchScales.map((scale) => (
                    <option key={scale}>{scale}</option>
                  ))}
                </select>
              </label>
              <div className="key-grid" aria-label="Key selector">
                {keys.map((key) => (
                  <button
                    className={key === autoPitch.key ? 'is-selected' : ''}
                    key={key}
                    onClick={() => onUpdateAutoPitch('key', key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <aside className="mixer-strip">
          <label className="vertical-fader">
            <Gauge size={18} />
            <input
              aria-label="Track volume"
              aria-orientation="vertical"
              max={100}
              min={0}
              onChange={(event) => onUpdateMixer(track.id, 'volume', Number(event.currentTarget.value))}
              type="range"
              value={track.mixer.volume}
            />
            <strong>Volume {track.mixer.volume}</strong>
          </label>
          <div className="knob-row">
            <Knob
              displayValue={getPanLabel(track.mixer.pan)}
              label="Pan"
              max={100}
              min={-100}
              onChange={(value) => onUpdateMixer(track.id, 'pan', value)}
              value={track.mixer.pan}
            />
            <Knob
              label="Reverb"
              onChange={(value) => onUpdateMixer(track.id, 'reverb', value)}
              suffix="%"
              value={track.mixer.reverb}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
