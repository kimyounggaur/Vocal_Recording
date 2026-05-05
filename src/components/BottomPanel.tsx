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
  DelaySettings,
  EqBand,
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
const eqBands: Array<{ key: EqBand; label: string }> = [
  { key: 'low', label: '100' },
  { key: 'lowMid', label: '250' },
  { key: 'mid', label: '1k' },
  { key: 'highMid', label: '4k' },
  { key: 'high', label: '10k' },
]

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

function getDelayDisplay(timeMs: number): string {
  return String(Math.round(timeMs)).padStart(4, '0')
}

function formatDb(value: number): string {
  if (value > 0) {
    return `+${value}`
  }

  return String(value)
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
  const isRecordingActive = recording.status === 'arming' || recording.status === 'recording'
  const updateDelay = <K extends keyof DelaySettings>(key: K, value: DelaySettings[K]) => {
    onUpdateMixer(track.id, 'delay', {
      ...track.mixer.delay,
      [key]: value,
    })
  }
  const updateEqBand = (band: EqBand, value: number) => {
    onUpdateMixer(track.id, 'eqBands', {
      ...track.mixer.eqBands,
      [band]: value,
    })
  }

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
              disabled={isRecordingActive}
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
              disabled={isRecordingActive}
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

        <section className="effects-rack" aria-label="Track effects">
          <article className="h-delay-panel" aria-label="Hybrid Delay">
            <div className="delay-tap-section">
              <button
                aria-label="Enable delay"
                className={track.mixer.delay.enabled ? 'delay-power is-on' : 'delay-power'}
                onClick={() => updateDelay('enabled', !track.mixer.delay.enabled)}
              >
                <span />
              </button>
              <button
                className={track.mixer.delay.loFi ? 'delay-mode-button is-on' : 'delay-mode-button'}
                onClick={() => updateDelay('loFi', !track.mixer.delay.loFi)}
              >
                LoFi
              </button>
              <strong>HYBRID</strong>
            </div>

            <label className="delay-big-control">
              <span className="hardware-knob big">
                <span style={{ transform: `rotate(${-132 + ((track.mixer.delay.timeMs - 40) / 660) * 264}deg)` }} />
                <input
                  aria-label="Delay time"
                  max={700}
                  min={40}
                  onChange={(event) => updateDelay('timeMs', Number(event.currentTarget.value))}
                  step={5}
                  type="range"
                  value={track.mixer.delay.timeMs}
                />
              </span>
              <strong>DELAY</strong>
              <small>40 - 700 ms</small>
            </label>

            <div className="delay-center">
              <div className="delay-mode-row">
                <button className="delay-mode-button">ØL</button>
                <button
                  className={track.mixer.delay.pingPong ? 'delay-mode-button is-on' : 'delay-mode-button'}
                  onClick={() => updateDelay('pingPong', !track.mixer.delay.pingPong)}
                >
                  PING PONG
                </button>
                <button className="delay-mode-button">ØR</button>
              </div>
              <div className="delay-led" aria-label="Delay time display">{getDelayDisplay(track.mixer.delay.timeMs)}</div>
              <div className="delay-unit-row">
                <button className="delay-mode-button is-on">BPM</button>
                <button className="delay-mode-button">MS</button>
              </div>
            </div>

            <label className="delay-big-control">
              <span className="hardware-knob big">
                <span style={{ transform: `rotate(${-132 + (track.mixer.delay.feedback / 90) * 264}deg)` }} />
                <input
                  aria-label="Delay feedback"
                  max={90}
                  min={0}
                  onChange={(event) => updateDelay('feedback', Number(event.currentTarget.value))}
                  type="range"
                  value={track.mixer.delay.feedback}
                />
              </span>
              <strong>FEEDBACK</strong>
              <small>{track.mixer.delay.feedback}%</small>
            </label>

            <div className="delay-meter" aria-hidden="true">
              {[-0, -3, -6, -12, -24, -36, -48].map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
              <i style={{ height: `${Math.max(8, track.mixer.delay.mix)}%` }} />
            </div>

            <div className="delay-side-controls">
              <label className="hardware-mini-control">
                <span className="hardware-knob small">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.mix / 100) * 264}deg)` }} />
                  <input
                    aria-label="Delay mix"
                    max={100}
                    min={0}
                    onChange={(event) => updateDelay('mix', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.mix}
                  />
                </span>
                <strong>DRY/WET</strong>
                <small>{track.mixer.delay.mix}</small>
              </label>
              <label className="hardware-mini-control">
                <span className="hardware-knob small">
                  <span style={{ transform: `rotate(${-132 + ((track.mixer.delay.output + 18) / 36) * 264}deg)` }} />
                  <input
                    aria-label="Delay output"
                    max={18}
                    min={-18}
                    onChange={(event) => updateDelay('output', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.output}
                  />
                </span>
                <strong>OUTPUT</strong>
                <small>{formatDb(track.mixer.delay.output)}</small>
              </label>
              <label className="hardware-mini-control">
                <span className="hardware-knob small">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.analog / 4) * 264}deg)` }} />
                  <input
                    aria-label="Delay analog"
                    max={4}
                    min={0}
                    onChange={(event) => updateDelay('analog', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.analog}
                  />
                </span>
                <strong>ANALOG</strong>
                <small>{track.mixer.delay.analog === 0 ? 'OFF' : track.mixer.delay.analog}</small>
              </label>
            </div>

            <div className="delay-bottom-controls">
              <label className="hardware-mini-control">
                <span className="hardware-knob medium">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.modulationDepth / 100) * 264}deg)` }} />
                  <input
                    aria-label="Delay modulation depth"
                    max={100}
                    min={0}
                    onChange={(event) => updateDelay('modulationDepth', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.modulationDepth}
                  />
                </span>
                <strong>DEPTH</strong>
                <small>MODULATION</small>
              </label>
              <label className="hardware-mini-control">
                <span className="hardware-knob medium">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.modulationRate / 100) * 264}deg)` }} />
                  <input
                    aria-label="Delay modulation rate"
                    max={100}
                    min={0}
                    onChange={(event) => updateDelay('modulationRate', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.modulationRate}
                  />
                </span>
                <strong>RATE</strong>
                <small>{track.mixer.delay.modulationRate}%</small>
              </label>
              <label className="hardware-mini-control">
                <span className="hardware-knob medium">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.hiPass / 100) * 264}deg)` }} />
                  <input
                    aria-label="Delay hi pass"
                    max={100}
                    min={0}
                    onChange={(event) => updateDelay('hiPass', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.hiPass}
                  />
                </span>
                <strong>HIPASS</strong>
                <small>FILTERS</small>
              </label>
              <label className="hardware-mini-control">
                <span className="hardware-knob medium">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.delay.loPass / 100) * 264}deg)` }} />
                  <input
                    aria-label="Delay lo pass"
                    max={100}
                    min={0}
                    onChange={(event) => updateDelay('loPass', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.delay.loPass}
                  />
                </span>
                <strong>LOPASS</strong>
                <small>{track.mixer.delay.loPass}%</small>
              </label>
            </div>
          </article>

          <article className="effect-card">
            <div className="effect-card-head">
              <span>
                <Sparkles size={14} />
                Reverb
              </span>
              <small>{track.mixer.reverb}%</small>
            </div>
            <label className="effect-slider">
              <span>
                <strong>Mix</strong>
                <em>{track.mixer.reverb}%</em>
              </span>
              <input
                aria-label="Reverb mix"
                max={100}
                min={0}
                onChange={(event) => onUpdateMixer(track.id, 'reverb', Number(event.currentTarget.value))}
                type="range"
                value={track.mixer.reverb}
              />
            </label>
            <label className="effect-slider">
              <span>
                <strong>Size</strong>
                <em>{track.mixer.reverbSize}%</em>
              </span>
              <input
                aria-label="Reverb size"
                max={100}
                min={0}
                onChange={(event) => onUpdateMixer(track.id, 'reverbSize', Number(event.currentTarget.value))}
                type="range"
                value={track.mixer.reverbSize}
              />
            </label>
            <label className="effect-slider">
              <span>
                <strong>Tone</strong>
                <em>{track.mixer.reverbTone}%</em>
              </span>
              <input
                aria-label="Reverb tone"
                max={100}
                min={0}
                onChange={(event) => onUpdateMixer(track.id, 'reverbTone', Number(event.currentTarget.value))}
                type="range"
                value={track.mixer.reverbTone}
              />
            </label>
          </article>

          <article className="effect-card eq-card">
            <div className="effect-card-head">
              <span>
                <SlidersHorizontal size={14} />
                Graphic EQ
              </span>
              <small>dB</small>
            </div>
            <div className="eq-bands" aria-label="Graphic EQ bands">
              {eqBands.map((band) => (
                <label className="eq-band" key={band.key}>
                  <small>{formatDb(track.mixer.eqBands[band.key])}</small>
                  <input
                    aria-label={`EQ ${band.label}`}
                    aria-orientation="vertical"
                    max={12}
                    min={-12}
                    onChange={(event) => updateEqBand(band.key, Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.eqBands[band.key]}
                  />
                  <strong>{band.label}</strong>
                </label>
              ))}
            </div>
          </article>
        </section>

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
