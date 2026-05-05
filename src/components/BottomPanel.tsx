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
import type { AutoPitchSettings, InputDevice, Track } from '../types/daw'

type BottomPanelProps = {
  autoPitch: AutoPitchSettings
  inputDevices: InputDevice[]
  track: Track
}

const pitchCategories = ['Essentials', 'Clean', 'Pop', 'Harmony']
const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export function BottomPanel({ autoPitch, inputDevices, track }: BottomPanelProps) {
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
            <select defaultValue={inputDevices[0].id}>
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
            <select defaultValue={inputDevices[1].id}>
              {inputDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>

          <div className="monitoring-row">
            <div>
              <strong>Input Level</strong>
              <span className="input-meter">
                <i />
              </span>
            </div>
            <button>
              <Headphones size={16} />
              Monitoring
            </button>
          </div>
        </aside>

        <article className="pitch-card" aria-label="Pitch Assist">
          <div className="pitch-card-top">
            <button className={autoPitch.enabled ? 'power-toggle is-on' : 'power-toggle'} aria-label="Enable pitch assist">
              <span />
            </button>
            <strong>Pitch Assist</strong>
            <button className="auto-detect-button">
              Auto Detect Key
              <SlidersHorizontal size={15} />
            </button>
          </div>

          <div className="pitch-grid">
            <div className="pitch-column">
              <label className="compact-label">
                Category
                <select defaultValue={autoPitch.category}>
                  {pitchCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <div className="preset-grid">
                {['Classic', 'Duet', 'Natural', 'Big Harmony', 'Tight', 'Chip'].map((preset, index) => (
                  <button className={index === 0 ? 'preset-button is-selected' : 'preset-button'} key={preset}>
                    {index === 0 ? <Wand2 size={18} /> : index === 1 ? <Music2 size={18} /> : <CircleSlashed size={18} />}
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="pitch-amount">
              <div className="large-knob">
                <span style={{ transform: `rotate(${-132 + (autoPitch.amount / 100) * 264}deg)` }} />
              </div>
              <strong>Heaviest</strong>
            </div>

            <div className="pitch-column">
              <label className="compact-label">
                Scale
                <select defaultValue={autoPitch.scale}>
                  <option>Chromatic</option>
                  <option>Major</option>
                  <option>Minor</option>
                </select>
              </label>
              <div className="key-grid" aria-label="Key selector">
                {keys.map((key) => (
                  <button className={key === autoPitch.key ? 'is-selected' : ''} key={key}>
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <aside className="mixer-strip">
          <div className="vertical-fader">
            <Gauge size={18} />
            <input aria-label="Track volume" aria-orientation="vertical" defaultValue={track.mixer.volume} max={100} min={0} type="range" />
            <strong>Volume</strong>
          </div>
          <div className="knob-row">
            <Knob label="Pan" value={50} />
            <Knob label="Reverb" value={track.mixer.reverb} suffix="%" />
          </div>
        </aside>
      </div>
    </section>
  )
}
