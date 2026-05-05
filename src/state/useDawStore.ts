import { create } from 'zustand'
import type {
  AudioClip,
  AutoPitchSettings,
  InputDevice,
  MixerState,
  Project,
  ProjectKey,
  TimelineState,
  Track,
  TransportState,
} from '../types/daw'
import { beatToSeconds, clamp, MAX_BPM, MIN_BPM, secondsToBeat, snapBeatToGrid } from '../utils/time'

type MixerKey = keyof MixerState
type AutoPitchKey = keyof AutoPitchSettings

type DawState = {
  project: Project
  transport: TransportState
  tracks: Track[]
  clips: AudioClip[]
  selectedTrackId: string
  autopitch: AutoPitchSettings
  inputDevices: InputDevice[]
  selectedInputDeviceId: string
  selectedInputChannelId: string
  isMonitoring: boolean
  timeline: TimelineState
  selectTrack: (trackId: string) => void
  togglePlay: () => void
  toggleRecord: () => void
  stopTransport: () => void
  returnToStart: () => void
  seekToBeat: (beat: number) => void
  advanceTransport: (deltaSeconds: number) => void
  setProjectBpm: (bpm: number) => void
  setProjectKey: (key: ProjectKey) => void
  saveProject: () => void
  updateTrackMixer: <K extends MixerKey>(trackId: string, key: K, value: MixerState[K]) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackSolo: (trackId: string) => void
  updateAutoPitch: <K extends AutoPitchKey>(key: K, value: AutoPitchSettings[K]) => void
  toggleAutoPitch: () => void
  detectProjectKey: () => void
  setInputDevice: (deviceId: string) => void
  setInputChannel: (channelId: string) => void
  toggleMonitoring: () => void
  toggleSnapToGrid: () => void
  zoomTimeline: (direction: 'in' | 'out') => void
}

const defaultTrack: Track = {
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
}

const inputDevices: InputDevice[] = [
  {
    id: 'default',
    label: 'Default - Microphone input',
  },
  {
    id: 'channel-1',
    label: 'Channel 1',
  },
]

const initialProject: Project = {
  id: 'project-vocal-1',
  name: 'New Vocal Project',
  bpm: 120,
  timeSignature: [4, 4],
  key: 'C Major',
  lastSaved: 'Never',
}

const initialTransport: TransportState = {
  isPlaying: false,
  isRecording: false,
  currentBeat: 0,
  currentTimeSeconds: 0,
}

const initialAutoPitch: AutoPitchSettings = {
  enabled: false,
  category: 'Essentials',
  scale: 'Chromatic',
  key: 'C',
  amount: 64,
}

function formatSaveTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const useDawStore = create<DawState>((set, get) => ({
  project: initialProject,
  transport: initialTransport,
  tracks: [defaultTrack],
  clips: [],
  selectedTrackId: defaultTrack.id,
  autopitch: initialAutoPitch,
  inputDevices,
  selectedInputDeviceId: inputDevices[0].id,
  selectedInputChannelId: inputDevices[1].id,
  isMonitoring: false,
  timeline: {
    pixelsPerBeat: 24,
    snapToGrid: true,
  },
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  togglePlay: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        isPlaying: !transport.isPlaying,
        isRecording: transport.isPlaying ? false : transport.isRecording,
      },
    })),
  toggleRecord: () =>
    set(({ transport }) => {
      const nextRecording = !transport.isRecording

      return {
        transport: {
          ...transport,
          isPlaying: nextRecording,
          isRecording: nextRecording,
        },
      }
    }),
  stopTransport: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        isPlaying: false,
        isRecording: false,
        currentBeat: 0,
        currentTimeSeconds: 0,
      },
    })),
  returnToStart: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        currentBeat: 0,
        currentTimeSeconds: 0,
      },
    })),
  seekToBeat: (beat) =>
    set(({ project, timeline, transport }) => {
      const nextBeat = timeline.snapToGrid ? snapBeatToGrid(beat) : beat
      const clampedBeat = Math.max(0, nextBeat)

      return {
        transport: {
          ...transport,
          currentBeat: clampedBeat,
          currentTimeSeconds: beatToSeconds(clampedBeat, project.bpm),
        },
      }
    }),
  advanceTransport: (deltaSeconds) =>
    set(({ project, transport }) => {
      const nextSeconds = Math.max(0, transport.currentTimeSeconds + deltaSeconds)

      return {
        transport: {
          ...transport,
          currentTimeSeconds: nextSeconds,
          currentBeat: secondsToBeat(nextSeconds, project.bpm),
        },
      }
    }),
  setProjectBpm: (bpm) =>
    set(({ project, transport }) => {
      const nextBpm = Math.round(clamp(bpm, MIN_BPM, MAX_BPM))

      return {
        project: {
          ...project,
          bpm: nextBpm,
        },
        transport: {
          ...transport,
          currentBeat: secondsToBeat(transport.currentTimeSeconds, nextBpm),
        },
      }
    }),
  setProjectKey: (key) =>
    set(({ project }) => ({
      project: {
        ...project,
        key,
      },
    })),
  saveProject: () =>
    set(({ project }) => ({
      project: {
        ...project,
        lastSaved: formatSaveTime(new Date()),
      },
    })),
  updateTrackMixer: (trackId, key, value) =>
    set(({ tracks }) => ({
      tracks: tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              mixer: {
                ...track.mixer,
                [key]: value,
              },
            }
          : track,
      ),
    })),
  toggleTrackMute: (trackId) => {
    const track = get().tracks.find((item) => item.id === trackId)

    if (!track) {
      return
    }

    get().updateTrackMixer(trackId, 'muted', !track.mixer.muted)
  },
  toggleTrackSolo: (trackId) => {
    const track = get().tracks.find((item) => item.id === trackId)

    if (!track) {
      return
    }

    get().updateTrackMixer(trackId, 'solo', !track.mixer.solo)
  },
  updateAutoPitch: (key, value) =>
    set(({ autopitch }) => ({
      autopitch: {
        ...autopitch,
        [key]: value,
      },
    })),
  toggleAutoPitch: () =>
    set(({ autopitch }) => ({
      autopitch: {
        ...autopitch,
        enabled: !autopitch.enabled,
      },
    })),
  detectProjectKey: () =>
    set(({ autopitch, project }) => ({
      autopitch: {
        ...autopitch,
        key: project.key.split(' ')[0],
        scale: project.key.endsWith('Minor') ? 'Minor' : 'Major',
      },
    })),
  setInputDevice: (deviceId) => set({ selectedInputDeviceId: deviceId }),
  setInputChannel: (channelId) => set({ selectedInputChannelId: channelId }),
  toggleMonitoring: () => set(({ isMonitoring }) => ({ isMonitoring: !isMonitoring })),
  toggleSnapToGrid: () =>
    set(({ timeline }) => ({
      timeline: {
        ...timeline,
        snapToGrid: !timeline.snapToGrid,
      },
    })),
  zoomTimeline: (direction) =>
    set(({ timeline }) => ({
      timeline: {
        ...timeline,
        pixelsPerBeat: clamp(
          timeline.pixelsPerBeat + (direction === 'in' ? 8 : -8),
          16,
          56,
        ),
      },
    })),
}))
