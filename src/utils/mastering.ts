import type { MasteringPresetId } from '../types/daw'

export type MasteringPresetDefinition = {
  id: MasteringPresetId
  label: string
  shortLabel: string
  description: string
  lowShelfGain: number
  highShelfGain: number
  threshold: number
  ratio: number
  attack: number
  release: number
  outputGainDb: number
}

export const MASTERING_PRESETS: Record<MasteringPresetId, MasteringPresetDefinition> = {
  studio: {
    id: 'studio',
    label: 'Studio Preset',
    shortLabel: 'Studio',
    description: 'Balanced vocal polish',
    lowShelfGain: 1.2,
    highShelfGain: 1.4,
    threshold: -16,
    ratio: 2.2,
    attack: 0.018,
    release: 0.18,
    outputGainDb: 0,
  },
  warm: {
    id: 'warm',
    label: 'Warm Tape',
    shortLabel: 'Warm',
    description: 'Rounder low mids',
    lowShelfGain: 2.4,
    highShelfGain: -0.6,
    threshold: -18,
    ratio: 1.8,
    attack: 0.028,
    release: 0.24,
    outputGainDb: -0.4,
  },
  bright: {
    id: 'bright',
    label: 'Bright Air',
    shortLabel: 'Bright',
    description: 'Clear top-end lift',
    lowShelfGain: -0.5,
    highShelfGain: 3,
    threshold: -15,
    ratio: 2,
    attack: 0.014,
    release: 0.16,
    outputGainDb: -0.2,
  },
  loud: {
    id: 'loud',
    label: 'Loud Finish',
    shortLabel: 'Loud',
    description: 'Tighter level control',
    lowShelfGain: 0.8,
    highShelfGain: 1.8,
    threshold: -22,
    ratio: 4,
    attack: 0.008,
    release: 0.12,
    outputGainDb: 1.2,
  },
  speech: {
    id: 'speech',
    label: 'Speech Focus',
    shortLabel: 'Speech',
    description: 'Forward voice clarity',
    lowShelfGain: -1.4,
    highShelfGain: 1.2,
    threshold: -20,
    ratio: 3.2,
    attack: 0.01,
    release: 0.15,
    outputGainDb: 0,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getMasterVolumeDb(volume: number): number {
  const clampedVolume = clamp(volume, 0, 100)

  if (clampedVolume === 0) {
    return Number.NEGATIVE_INFINITY
  }

  if (clampedVolume >= 78) {
    return ((clampedVolume - 78) / 22) * 6
  }

  return ((clampedVolume - 78) / 78) * 48
}

export function getMasterVolumeGain(volume: number): number {
  const db = getMasterVolumeDb(volume)

  if (!Number.isFinite(db)) {
    return 0
  }

  return Math.pow(10, db / 20)
}

export function formatMasterVolumeDb(volume: number): string {
  const db = getMasterVolumeDb(volume)

  if (!Number.isFinite(db)) {
    return '-∞ dB'
  }

  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}
