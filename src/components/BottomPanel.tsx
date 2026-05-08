import {
  ChevronDown,
  CircleSlashed,
  Gauge,
  Headphones,
  Mic2,
  Music2,
  PanelBottom,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Knob } from './Knob'
import type {
  AutoPitchSettings,
  CompressorSettings,
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
  onToggleRecord: () => void | Promise<void>
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

type PanelTab = 'record' | 'pitch' | 'effects' | 'mixer'
type EffectId = 'compressor' | 'eq' | 'delay' | 'reverb'

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
  onToggleRecord,
  onToggleAutoPitch,
  onDetectKey,
  onUpdateAutoPitch,
  onUpdateMixer,
}: BottomPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelTab>('record')
  const [activeEffect, setActiveEffect] = useState<EffectId>('compressor')
  const pitchAmountLabel = getPitchAmountLabel(autoPitch.amount)
  const isRecordingActive = recording.status === 'arming' || recording.status === 'recording'
  const isRecordButtonDisabled = recording.status === 'encoding'
  const recordActionLabel =
    recording.status === 'recording'
      ? 'Stop Recording'
      : recording.status === 'arming'
        ? 'Preparing Mic'
        : recording.status === 'encoding'
          ? 'Creating Clip'
          : 'Record Voice'
  const updateDelay = <K extends keyof DelaySettings>(key: K, value: DelaySettings[K]) => {
    onUpdateMixer(track.id, 'delay', {
      ...track.mixer.delay,
      [key]: value,
    })
  }
  const updateCompressor = <K extends keyof CompressorSettings>(key: K, value: CompressorSettings[K]) => {
    onUpdateMixer(track.id, 'compressor', {
      ...track.mixer.compressor,
      [key]: value,
    })
  }
  const updateEqBand = (band: EqBand, value: number) => {
    onUpdateMixer(track.id, 'eqBands', {
      ...track.mixer.eqBands,
      [band]: value,
    })
  }
  const compressor = track.mixer.compressor
  const compressorReduction = compressor.enabled
    ? Math.min(100, Math.abs(compressor.threshold) * 1.25 + compressor.ratio * 2.4)
    : 3
  const compressorNeedle = compressor.enabled
    ? -42 + (compressorReduction / 100) * 84
    : -48
  const effectChain: Array<{ id: EffectId; label: string; detail: string; enabled: boolean }> = [
    {
      id: 'compressor',
      label: 'Compressor',
      detail: compressor.enabled ? `${compressor.ratio}:1 / ${compressor.threshold} dB` : 'Off',
      enabled: compressor.enabled,
    },
    {
      id: 'eq',
      label: 'Graphic EQ',
      detail: Object.values(track.mixer.eqBands).some((value) => value !== 0) ? 'Custom curve' : 'Flat',
      enabled: Object.values(track.mixer.eqBands).some((value) => value !== 0),
    },
    {
      id: 'delay',
      label: 'Hybrid Delay',
      detail: track.mixer.delay.enabled ? `${track.mixer.delay.timeMs} ms / ${track.mixer.delay.mix}%` : 'Off',
      enabled: track.mixer.delay.enabled,
    },
    {
      id: 'reverb',
      label: 'Plate Reverb',
      detail: track.mixer.reverbEnabled ? `${track.mixer.reverb}% wet / ${track.mixer.reverbSize}% size` : 'Off',
      enabled: track.mixer.reverbEnabled,
    },
  ]

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
          <button
            aria-pressed={activePanel === 'record'}
            className={activePanel === 'record' ? 'is-active' : ''}
            onClick={() => setActivePanel('record')}
          >
            <Mic2 size={16} />
            Record
          </button>
          <button
            aria-pressed={activePanel === 'pitch'}
            className={activePanel === 'pitch' ? 'is-active' : ''}
            onClick={() => setActivePanel('pitch')}
          >
            <Wand2 size={16} />
            Pitch
          </button>
          <button
            aria-pressed={activePanel === 'effects'}
            className={activePanel === 'effects' ? 'is-active' : ''}
            onClick={() => setActivePanel('effects')}
          >
            <Sparkles size={16} />
            Effects
          </button>
          <button
            aria-pressed={activePanel === 'mixer'}
            className={activePanel === 'mixer' ? 'is-active' : ''}
            onClick={() => setActivePanel('mixer')}
          >
            <PanelBottom size={16} />
            Mixer
          </button>
        </nav>
      </div>

      <div className={`panel-content panel-content-${activePanel}`}>
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

          <div className="record-control-card">
            <button
              className={recording.status === 'recording' ? 'record-action is-recording' : 'record-action'}
              disabled={isRecordButtonDisabled}
              onClick={onToggleRecord}
              type="button"
            >
              <span />
              {recordActionLabel}
            </button>
            <div className="record-state-grid">
              <span>
                <strong>Permission</strong>
                <em>{recording.permission}</em>
              </span>
              <span>
                <strong>Status</strong>
                <em>{recording.status}</em>
              </span>
              <span>
                <strong>Monitoring</strong>
                <em>{isMonitoring ? 'On' : 'Off'}</em>
              </span>
            </div>
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
          <aside className="effect-chain" aria-label="Effect chain">
            <strong>Effect Chain</strong>
            {effectChain.map((effect, index) => (
              <button
                className={activeEffect === effect.id ? 'effect-chain-button is-selected' : 'effect-chain-button'}
                key={effect.id}
                onClick={() => setActiveEffect(effect.id)}
                type="button"
              >
                <span className={effect.enabled ? 'effect-chain-led is-on' : 'effect-chain-led'} />
                <em>{String(index + 1).padStart(2, '0')}</em>
                <span>
                  <strong>{effect.label}</strong>
                  <small>{effect.detail}</small>
                </span>
              </button>
            ))}
          </aside>

          <article
            className={activeEffect === 'delay' ? 'h-delay-panel' : 'h-delay-panel is-effect-hidden'}
            aria-label="Hybrid Delay"
          >
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

          <article
            className={activeEffect === 'reverb' ? 'plate-reverb-panel' : 'plate-reverb-panel is-effect-hidden'}
            aria-label="Plate Reverb"
          >
            <div className="plate-main">
              <div className="plate-brand">
                <strong>PLATE ROOM-40</strong>
                <span>REVERB PLATE UNIT</span>
                <button
                  aria-label="Enable plate reverb"
                  className={track.mixer.reverbEnabled ? 'plate-power is-on' : 'plate-power'}
                  onClick={() => onUpdateMixer(track.id, 'reverbEnabled', !track.mixer.reverbEnabled)}
                >
                  <span />
                </button>
                <small>POWER</small>
                <em>STUDIO CIRCUITS</em>
              </div>

              <div className="plate-tube-panel">
                <div className="tube-window" aria-hidden="true">
                  <span />
                  <i />
                </div>
                <label className="plate-control">
                  <span className="plate-knob">
                    <span style={{ transform: `rotate(${-132 + (track.mixer.reverbDrive / 100) * 264}deg)` }} />
                    <input
                      aria-label="Reverb drive"
                      max={100}
                      min={0}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbDrive', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverbDrive}
                    />
                  </span>
                  <strong>DRIVE</strong>
                </label>
              </div>

              <div className="plate-decay-panel">
                <label className="plate-control">
                  <span className="plate-knob large">
                    <span style={{ transform: `rotate(${-132 + (track.mixer.reverbSize / 100) * 264}deg)` }} />
                    <input
                      aria-label="Reverb model"
                      max={100}
                      min={0}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbSize', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverbSize}
                    />
                  </span>
                  <strong>MODEL</strong>
                  <small>{Math.max(1, Math.round(track.mixer.reverbSize / 18))}</small>
                </label>
                <label className="decay-slider">
                  <strong>DECAY TIME</strong>
                  <input
                    aria-label="Reverb decay time"
                    max={100}
                    min={0}
                    onChange={(event) => onUpdateMixer(track.id, 'reverbSize', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.reverbSize}
                  />
                  <span>{Math.round(1 + (track.mixer.reverbSize / 100) * 5)}s</span>
                </label>
              </div>

              <div className="plate-blend-panel">
                <label className="plate-control">
                  <span className="plate-knob">
                    <span style={{ transform: `rotate(${-132 + (track.mixer.reverb / 100) * 264}deg)` }} />
                    <input
                      aria-label="Reverb blend"
                      max={100}
                      min={0}
                      onChange={(event) => onUpdateMixer(track.id, 'reverb', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverb}
                    />
                  </span>
                  <strong>BLEND</strong>
                  <small>DRY / WET</small>
                </label>
                <label className="plate-control">
                  <span className="plate-knob">
                    <span style={{ transform: `rotate(${-132 + (track.mixer.reverbWidth / 100) * 264}deg)` }} />
                    <input
                      aria-label="Reverb width"
                      max={100}
                      min={0}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbWidth', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverbWidth}
                    />
                  </span>
                  <strong>WIDTH</strong>
                  <small>{track.mixer.reverbWidth}%</small>
                </label>
              </div>
            </div>

            <div className="plate-bottom">
              <label className="plate-mini-control">
                <span className="plate-knob mini">
                  <span style={{ transform: `rotate(${-132 + (track.mixer.reverbPreDelay / 250) * 264}deg)` }} />
                  <input
                    aria-label="Reverb pre delay"
                    max={250}
                    min={0}
                    onChange={(event) => onUpdateMixer(track.id, 'reverbPreDelay', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.reverbPreDelay}
                  />
                </span>
                <strong>PRE-DELAY</strong>
                <small>{track.mixer.reverbPreDelay} ms</small>
              </label>

              <label className="plate-mini-control">
                <span className="plate-knob mini">
                  <span style={{ transform: `rotate(${-132 + ((track.mixer.reverbHpFilter - 20) / 680) * 264}deg)` }} />
                  <input
                    aria-label="Reverb HP filter"
                    max={700}
                    min={20}
                    onChange={(event) => onUpdateMixer(track.id, 'reverbHpFilter', Number(event.currentTarget.value))}
                    type="range"
                    value={track.mixer.reverbHpFilter}
                  />
                </span>
                <strong>HP FILTER</strong>
                <small>{track.mixer.reverbHpFilter} Hz</small>
              </label>

              <div className="plate-mod-section">
                <button
                  aria-label="Enable reverb modulation"
                  className={track.mixer.reverbModEnabled ? 'plate-led-toggle is-on' : 'plate-led-toggle'}
                  onClick={() => onUpdateMixer(track.id, 'reverbModEnabled', !track.mixer.reverbModEnabled)}
                >
                  <span />
                  ACTIVE
                </button>
                <label className="plate-mini-control">
                  <span className="plate-knob mini">
                    <span style={{ transform: `rotate(${-132 + (track.mixer.reverbModAmount / 100) * 264}deg)` }} />
                    <input
                      aria-label="Reverb modulation amount"
                      max={100}
                      min={0}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbModAmount', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverbModAmount}
                    />
                  </span>
                  <strong>AMOUNT</strong>
                </label>
              </div>

              <div className="plate-eq-section">
                <button
                  aria-label="Enable reverb post EQ"
                  className={track.mixer.reverbEqEnabled ? 'plate-led-toggle is-on' : 'plate-led-toggle'}
                  onClick={() => onUpdateMixer(track.id, 'reverbEqEnabled', !track.mixer.reverbEqEnabled)}
                >
                  <span />
                  ACTIVE
                </button>
                <label className="plate-mini-control">
                  <span className="plate-knob mini">
                    <span style={{ transform: `rotate(${-132 + ((track.mixer.reverbEqGain + 24) / 48) * 264}deg)` }} />
                    <input
                      aria-label="Reverb EQ gain"
                      max={24}
                      min={-24}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbEqGain', Number(event.currentTarget.value))}
                      type="range"
                      value={track.mixer.reverbEqGain}
                    />
                  </span>
                  <strong>GAIN</strong>
                  <small>{formatDb(track.mixer.reverbEqGain)}</small>
                </label>
                <label className="plate-mini-control">
                  <span className="plate-knob mini">
                    <span style={{ transform: `rotate(${-132 + ((track.mixer.reverbEqFrequency - 200) / 7800) * 264}deg)` }} />
                    <input
                      aria-label="Reverb EQ frequency"
                      max={8000}
                      min={200}
                      onChange={(event) => onUpdateMixer(track.id, 'reverbEqFrequency', Number(event.currentTarget.value))}
                      step={50}
                      type="range"
                      value={track.mixer.reverbEqFrequency}
                    />
                  </span>
                  <strong>FREQ</strong>
                  <small>{track.mixer.reverbEqFrequency} Hz</small>
                </label>
              </div>
            </div>
          </article>

          <article
            className={activeEffect === 'compressor' ? 'tube-compressor-panel' : 'tube-compressor-panel is-effect-hidden'}
            aria-label="Compressor"
          >
            <aside className="tube-comp-side">
              <button className="tube-comp-pill" type="button">PRESETS</button>
              <span>MODE</span>
              <strong>STD</strong>
            </aside>

            <div className="tube-comp-main">
              <div className="tube-comp-bay" aria-hidden="true">
                <span className="tube-can tube-can-left" />
                <span className="tube-bottle tube-bottle-sm" />
                <div className="tube-comp-vu">
                  <span className="vu-scale">
                    <i>-20</i>
                    <i>-10</i>
                    <i>-5</i>
                    <i>0</i>
                  </span>
                  <strong>DB GAIN REDUCTION</strong>
                  <span
                    className="tube-vu-needle"
                    style={{ transform: `translateX(-50%) rotate(${compressorNeedle}deg)` }}
                  />
                </div>
                <span className="tube-glass" />
                <span className="tube-can tube-can-right" />
              </div>

              <div className="tube-comp-controls">
                <label className="tube-comp-knob-control large">
                  <span className="tube-comp-knob">
                    <span style={{ transform: `rotate(${-132 + ((compressor.threshold + 60) / 60) * 264}deg)` }} />
                    <input
                      aria-label="Compressor threshold"
                      max={0}
                      min={-60}
                      onChange={(event) => updateCompressor('threshold', Number(event.currentTarget.value))}
                      type="range"
                      value={compressor.threshold}
                    />
                  </span>
                  <strong>THRESHOLD</strong>
                  <small>{compressor.threshold} dB</small>
                </label>

                <label className="tube-comp-knob-control large">
                  <span className="tube-comp-knob">
                    <span style={{ transform: `rotate(${-132 + ((compressor.ratio - 1) / 19) * 264}deg)` }} />
                    <input
                      aria-label="Compressor ratio"
                      max={20}
                      min={1}
                      onChange={(event) => updateCompressor('ratio', Number(event.currentTarget.value))}
                      step={0.5}
                      type="range"
                      value={compressor.ratio}
                    />
                  </span>
                  <strong>RATIO</strong>
                  <small>{compressor.ratio}:1</small>
                </label>

                <label className="tube-comp-knob-control">
                  <span className="tube-comp-knob small">
                    <span style={{ transform: `rotate(${-132 + (compressor.attackMs / 100) * 264}deg)` }} />
                    <input
                      aria-label="Compressor attack"
                      max={100}
                      min={1}
                      onChange={(event) => updateCompressor('attackMs', Number(event.currentTarget.value))}
                      type="range"
                      value={compressor.attackMs}
                    />
                  </span>
                  <strong>ATTACK</strong>
                  <small>{compressor.attackMs} ms</small>
                </label>

                <label className="tube-comp-knob-control">
                  <span className="tube-comp-knob small">
                    <span style={{ transform: `rotate(${-132 + (compressor.releaseMs / 500) * 264}deg)` }} />
                    <input
                      aria-label="Compressor release"
                      max={500}
                      min={20}
                      onChange={(event) => updateCompressor('releaseMs', Number(event.currentTarget.value))}
                      type="range"
                      value={compressor.releaseMs}
                    />
                  </span>
                  <strong>RELEASE</strong>
                  <small>{compressor.releaseMs} ms</small>
                </label>

                <label className="tube-comp-knob-control">
                  <span className="tube-comp-knob small">
                    <span style={{ transform: `rotate(${-132 + ((compressor.makeupGain + 12) / 24) * 264}deg)` }} />
                    <input
                      aria-label="Compressor makeup"
                      max={12}
                      min={-12}
                      onChange={(event) => updateCompressor('makeupGain', Number(event.currentTarget.value))}
                      type="range"
                      value={compressor.makeupGain}
                    />
                  </span>
                  <strong>MAKE UP</strong>
                  <small>{formatDb(compressor.makeupGain)} dB</small>
                </label>

                <button
                  aria-label="Enable compressor"
                  className={compressor.enabled ? 'tube-comp-power is-on' : 'tube-comp-power'}
                  onClick={() => updateCompressor('enabled', !compressor.enabled)}
                  type="button"
                >
                  <span />
                  POWER
                </button>
              </div>

              <div className="tube-comp-name">
                <span>{Math.round(compressorReduction)} GR</span>
                <strong>ROYAL TUBE</strong>
                <em>COMP-76</em>
              </div>
            </div>

            <aside className="tube-comp-side right">
              <button className="tube-comp-pill" type="button">SIZE</button>
              <span>OVS</span>
              <strong>1X</strong>
            </aside>
          </article>

          <article className={activeEffect === 'eq' ? 'effect-card eq-card' : 'effect-card eq-card is-effect-hidden'}>
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

          <aside className="effect-macro-strip" aria-label="Selected track macros">
            <strong>Track Macros</strong>
            <Knob
              displayValue={getPanLabel(track.mixer.pan)}
              label="Pan"
              max={100}
              min={-100}
              onChange={(value) => onUpdateMixer(track.id, 'pan', value)}
              value={track.mixer.pan}
            />
            <Knob
              label="Volume"
              onChange={(value) => onUpdateMixer(track.id, 'volume', value)}
              suffix="%"
              value={track.mixer.volume}
            />
            <Knob
              label="Room"
              onChange={(value) => onUpdateMixer(track.id, 'reverb', value)}
              suffix="%"
              value={track.mixer.reverb}
            />
          </aside>
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
