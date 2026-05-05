export type TimeSignature = [number, number]

export type TransportState = {
  isPlaying: boolean
  isRecording: boolean
  currentBar: number
  currentBeat: number
  displayTime: string
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
  type: 'voice-audio'
  armed: boolean
  mixer: MixerState
}

export type Project = {
  name: string
  bpm: number
  timeSignature: TimeSignature
  key: string
  lastSaved: string
  tracks: Track[]
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
