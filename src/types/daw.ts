export type TimeSignature = [number, number]

export type ProjectKey =
  | 'C Major'
  | 'D Major'
  | 'E Major'
  | 'F Major'
  | 'G Major'
  | 'A Major'
  | 'B Major'
  | 'A Minor'
  | 'D Minor'
  | 'E Minor'

export type TrackType = 'voice-audio'

export type TransportState = {
  isPlaying: boolean
  isRecording: boolean
  currentBeat: number
  currentTimeSeconds: number
}

export type MixerState = {
  muted: boolean
  solo: boolean
  volume: number
  pan: number
  reverb: number
}

export type Track = {
  id: string
  index: number
  name: string
  type: TrackType
  armed: boolean
  mixer: MixerState
}

export type AudioClip = {
  id: string
  trackId: string
  name: string
  startBeat: number
  durationBeats: number
  offsetSeconds: number
  durationSeconds: number
  waveformPeaks: number[]
}

export type Project = {
  id: string
  name: string
  bpm: number
  timeSignature: TimeSignature
  key: ProjectKey
  lastSaved: string
}

export type AutoPitchSettings = {
  enabled: boolean
  category: string
  scale: string
  key: string
  amount: number
}

export type InputDevice = {
  id: string
  label: string
}

export type TimelineState = {
  pixelsPerBeat: number
  snapToGrid: boolean
}
