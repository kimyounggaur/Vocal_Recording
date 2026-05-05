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

export type RecordingPermissionState = 'idle' | 'requesting' | 'granted' | 'denied'

export type RecordingStatus = 'idle' | 'arming' | 'recording' | 'encoding'

export type PitchCategory = 'Essentials' | 'Pop' | 'Rap' | 'Natural'

export type PitchScale = 'Chromatic' | 'Major' | 'Minor'

export type PitchKey =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B'

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
  blobId: string
  name: string
  startBeat: number
  durationBeats: number
  offsetSeconds: number
  durationSeconds: number
  waveformPeaks: number[]
  objectUrl: string
  mimeType: string
  createdAt: string
  missingAudio?: boolean
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
  category: PitchCategory
  scale: PitchScale
  key: PitchKey
  amount: number
}

export type InputDevice = {
  id: string
  label: string
}

export type InputChannel = {
  id: string
  label: string
}

export type TimelineState = {
  pixelsPerBeat: number
  snapToGrid: boolean
}

export type RecordingState = {
  permission: RecordingPermissionState
  status: RecordingStatus
  inputLevel: number
  errorMessage: string | null
}

export type PersistenceState = {
  isSaving: boolean
  isRestoring: boolean
  errorMessage: string | null
}
