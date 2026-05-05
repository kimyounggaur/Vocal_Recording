import type { AutoPitchSettings, InputDevice, Project, TransportState } from '../types/daw'

export const project: Project = {
  name: 'New Vocal Project',
  bpm: 120,
  timeSignature: [4, 4],
  key: 'C Major',
  lastSaved: 'Never',
  tracks: [
    {
      id: 'track-voice-1',
      index: 1,
      name: 'Voice/Audio',
      type: 'voice-audio',
      armed: true,
      mixer: {
        muted: false,
        solo: false,
        volume: 72,
        pan: 0,
        reverb: 18,
      },
    },
  ],
}

export const transport: TransportState = {
  isPlaying: false,
  isRecording: false,
  currentBar: 1,
  currentBeat: 1,
  displayTime: '00:00.0',
}

export const autoPitch: AutoPitchSettings = {
  enabled: false,
  category: 'Essentials',
  scale: 'Chromatic',
  key: 'C',
  amount: 64,
}

export const inputDevices: InputDevice[] = [
  {
    id: 'default',
    label: 'Default - Microphone input',
  },
  {
    id: 'channel-1',
    label: 'Channel 1',
  },
]
