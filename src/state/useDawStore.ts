import { create } from 'zustand'
import type {
  AudioClip,
  AutoPitchSettings,
  InputChannel,
  InputDevice,
  MixerState,
  PersistenceState,
  PitchKey,
  Project,
  ProjectKey,
  RecordingPermissionState,
  RecordingState,
  RecordingStatus,
  TimelineState,
  Track,
  TransportState,
} from '../types/daw'
import {
  deleteAudioBlob,
  loadAudioBlob,
  loadProjectJson,
  saveAudioBlobs,
  saveProjectJson,
  toPersistedClip,
} from '../storage/projectStorage'
import { beatToSeconds, clamp, MAX_BPM, MIN_BPM, secondsToBeat, snapBeatToGrid } from '../utils/time'

type MixerKey = keyof MixerState
type AutoPitchKey = keyof AutoPitchSettings

type DawState = {
  project: Project
  transport: TransportState
  tracks: Track[]
  clips: AudioClip[]
  audioBlobs: Record<string, Blob>
  selectedTrackId: string
  selectedClipId: string | null
  autopitch: AutoPitchSettings
  inputDevices: InputDevice[]
  inputChannels: InputChannel[]
  selectedInputDeviceId: string
  selectedInputChannelId: string
  isMonitoring: boolean
  recording: RecordingState
  persistence: PersistenceState
  timeline: TimelineState
  selectTrack: (trackId: string) => void
  selectClip: (clipId: string | null) => void
  togglePlay: () => void
  toggleRecord: () => void
  startRecordingTransport: () => void
  finishRecordingTransport: () => void
  finishPlaybackTransport: () => void
  stopTransport: () => void
  returnToStart: () => void
  seekToBeat: (beat: number) => void
  setTransportPosition: (seconds: number, bpm?: number) => void
  advanceTransport: (deltaSeconds: number) => void
  setProjectBpm: (bpm: number) => void
  setProjectKey: (key: ProjectKey) => void
  saveProject: () => Promise<void>
  restoreLastProject: () => Promise<void>
  updateTrackMixer: <K extends MixerKey>(trackId: string, key: K, value: MixerState[K]) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackSolo: (trackId: string) => void
  updateAutoPitch: <K extends AutoPitchKey>(key: K, value: AutoPitchSettings[K]) => void
  toggleAutoPitch: () => void
  detectProjectKey: () => void
  addRecordedClip: (clip: AudioClip, blob: Blob) => void
  moveClip: (clipId: string, startBeat: number) => void
  trimClipStart: (clipId: string, startBeat: number) => void
  trimClipEnd: (clipId: string, durationBeats: number) => void
  deleteClip: (clipId: string) => void
  deleteSelectedClip: () => void
  setInputDevices: (devices: InputDevice[]) => void
  setInputDevice: (deviceId: string) => void
  setInputChannel: (channelId: string) => void
  setMonitoring: (enabled: boolean) => void
  toggleMonitoring: () => void
  setRecordingPermission: (permission: RecordingPermissionState) => void
  setRecordingStatus: (status: RecordingStatus) => void
  setRecordingError: (message: string | null) => void
  setInputLevel: (level: number) => void
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
]

const inputChannels: InputChannel[] = [
  {
    id: 'mono',
    label: 'Channel 1',
  },
  {
    id: 'stereo',
    label: 'Stereo input',
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

const initialRecording: RecordingState = {
  permission: 'idle',
  status: 'idle',
  inputLevel: 0,
  errorMessage: null,
}

const initialPersistence: PersistenceState = {
  isSaving: false,
  isRestoring: false,
  errorMessage: null,
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
  audioBlobs: {},
  selectedTrackId: defaultTrack.id,
  selectedClipId: null,
  autopitch: initialAutoPitch,
  inputDevices,
  inputChannels,
  selectedInputDeviceId: inputDevices[0].id,
  selectedInputChannelId: inputChannels[0].id,
  isMonitoring: false,
  recording: initialRecording,
  persistence: initialPersistence,
  timeline: {
    pixelsPerBeat: 24,
    snapToGrid: true,
  },
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  selectClip: (clipId) => set({ selectedClipId: clipId }),
  togglePlay: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        isPlaying: transport.isRecording ? transport.isPlaying : !transport.isPlaying,
        isRecording: transport.isRecording ? true : false,
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
  startRecordingTransport: () =>
    set(({ recording, transport }) => ({
      recording: {
        ...recording,
        status: 'recording',
        errorMessage: null,
      },
      transport: {
        ...transport,
        isPlaying: true,
        isRecording: true,
      },
    })),
  finishRecordingTransport: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        isPlaying: false,
        isRecording: false,
      },
    })),
  finishPlaybackTransport: () =>
    set(({ transport }) => ({
      transport: {
        ...transport,
        isPlaying: false,
        isRecording: false,
      },
    })),
  stopTransport: () =>
    set(({ recording, transport }) => ({
      recording: {
        ...recording,
        status: 'idle',
      },
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
        isPlaying: false,
        isRecording: false,
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
  setTransportPosition: (seconds, bpm) =>
    set(({ project, transport }) => {
      const nextSeconds = Math.max(0, seconds)
      const nextBpm = bpm ?? project.bpm

      return {
        transport: {
          ...transport,
          currentTimeSeconds: nextSeconds,
          currentBeat: secondsToBeat(nextSeconds, nextBpm),
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
      const nextBpm = Number.isFinite(bpm)
        ? Math.round(clamp(bpm, MIN_BPM, MAX_BPM))
        : project.bpm

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
  saveProject: async () => {
    const savedAt = new Date()

    set(({ persistence }) => ({
      persistence: {
        ...persistence,
        isSaving: true,
        errorMessage: null,
      },
    }))

    try {
      const state = get()
      const project = {
        ...state.project,
        lastSaved: formatSaveTime(savedAt),
      }

      await saveAudioBlobs(state.audioBlobs)
      saveProjectJson({
        version: 1,
        savedAt: savedAt.toISOString(),
        project,
        tracks: state.tracks,
        clips: state.clips.map(toPersistedClip),
        autopitch: state.autopitch,
        timeline: state.timeline,
        selectedTrackId: state.selectedTrackId,
        selectedClipId: state.selectedClipId,
      })

      set(({ persistence }) => ({
        project,
        persistence: {
          ...persistence,
          isSaving: false,
          errorMessage: null,
        },
      }))
    } catch {
      set(({ persistence }) => ({
        persistence: {
          ...persistence,
          isSaving: false,
          errorMessage: 'Project could not be saved.',
        },
      }))
    }
  },
  restoreLastProject: async () => {
    set(({ persistence }) => ({
      persistence: {
        ...persistence,
        isRestoring: true,
        errorMessage: null,
      },
    }))

    try {
      const persistedProject = loadProjectJson()

      if (!persistedProject) {
        set(({ persistence }) => ({
          persistence: {
            ...persistence,
            isRestoring: false,
          },
        }))
        return
      }

      const blobEntries = await Promise.all(
        persistedProject.clips.map(async (clip) => [clip.blobId, await loadAudioBlob(clip.blobId)] as const),
      )
      const nextAudioBlobs: Record<string, Blob> = {}
      const nextTracks = persistedProject.tracks.length > 0 ? persistedProject.tracks : [defaultTrack]
      const nextClips: AudioClip[] = persistedProject.clips
        .filter((clip) => nextTracks.some((track) => track.id === clip.trackId))
        .map((clip) => {
        const blob = blobEntries.find(([blobId]) => blobId === clip.blobId)?.[1]

        if (!blob) {
          return {
            ...clip,
            objectUrl: '',
            missingAudio: true,
          }
        }

        nextAudioBlobs[clip.blobId] = blob

        return {
          ...clip,
          objectUrl: URL.createObjectURL(blob),
          missingAudio: false,
        }
      })
      const nextSelectedTrackId = nextTracks.some((track) => track.id === persistedProject.selectedTrackId)
        ? persistedProject.selectedTrackId
        : nextTracks[0].id
      const nextSelectedClipId = nextClips.some((clip) => clip.id === persistedProject.selectedClipId)
        ? persistedProject.selectedClipId
        : null

      set(({ persistence, transport }) => ({
        project: persistedProject.project,
        tracks: nextTracks,
        clips: nextClips,
        audioBlobs: nextAudioBlobs,
        selectedTrackId: nextSelectedTrackId,
        selectedClipId: nextSelectedClipId,
        autopitch: persistedProject.autopitch,
        timeline: persistedProject.timeline,
        transport: {
          ...transport,
          isPlaying: false,
          isRecording: false,
          currentBeat: 0,
          currentTimeSeconds: 0,
        },
        persistence: {
          ...persistence,
          isRestoring: false,
          errorMessage: null,
        },
      }))
    } catch {
      set(({ persistence }) => ({
        persistence: {
          ...persistence,
          isRestoring: false,
          errorMessage: 'Last project could not be restored.',
        },
      }))
    }
  },
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
        key: project.key.split(' ')[0] as PitchKey,
        scale: project.key.endsWith('Minor') ? 'Minor' : 'Major',
      },
    })),
  addRecordedClip: (clip, blob) =>
    set(({ audioBlobs, clips }) => ({
      audioBlobs: {
        ...audioBlobs,
        [clip.blobId]: blob,
      },
      clips: [...clips, clip],
      selectedClipId: clip.id,
    })),
  moveClip: (clipId, startBeat) =>
    set(({ clips, timeline }) => ({
      clips: clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              startBeat: Math.max(0, timeline.snapToGrid ? snapBeatToGrid(startBeat) : startBeat),
            }
          : clip,
      ),
    })),
  trimClipStart: (clipId, startBeat) =>
    set(({ clips, project, timeline }) => ({
      clips: clips.map((clip) => {
        if (clip.id !== clipId) {
          return clip
        }

        const clipEndBeat = clip.startBeat + clip.durationBeats
        const snappedStartBeat = timeline.snapToGrid ? snapBeatToGrid(startBeat) : startBeat
        const nextStartBeat = clamp(snappedStartBeat, 0, clipEndBeat - 0.25)
        const beatDelta = nextStartBeat - clip.startBeat
        const nextDurationBeats = Math.max(0.25, clip.durationBeats - beatDelta)

        return {
          ...clip,
          startBeat: nextStartBeat,
          durationBeats: nextDurationBeats,
          offsetSeconds: Math.max(0, clip.offsetSeconds + beatToSeconds(beatDelta, project.bpm)),
          durationSeconds: beatToSeconds(nextDurationBeats, project.bpm),
        }
      }),
    })),
  trimClipEnd: (clipId, durationBeats) =>
    set(({ clips, project, timeline }) => ({
      clips: clips.map((clip) => {
        if (clip.id !== clipId) {
          return clip
        }

        const snappedDuration = timeline.snapToGrid ? snapBeatToGrid(durationBeats) : durationBeats
        const nextDurationBeats = Math.max(0.25, snappedDuration)

        return {
          ...clip,
          durationBeats: nextDurationBeats,
          durationSeconds: beatToSeconds(nextDurationBeats, project.bpm),
        }
      }),
    })),
  deleteClip: (clipId) =>
    set(({ audioBlobs, clips, selectedClipId }) => {
      const clip = clips.find((item) => item.id === clipId)
      const nextAudioBlobs = { ...audioBlobs }

      if (clip) {
        if (clip.objectUrl) {
          URL.revokeObjectURL(clip.objectUrl)
        }
        delete nextAudioBlobs[clip.blobId]
        void deleteAudioBlob(clip.blobId)
      }

      return {
        audioBlobs: nextAudioBlobs,
        clips: clips.filter((item) => item.id !== clipId),
        selectedClipId: selectedClipId === clipId ? null : selectedClipId,
      }
    }),
  deleteSelectedClip: () => {
    const clipId = get().selectedClipId

    if (clipId) {
      get().deleteClip(clipId)
    }
  },
  setInputDevices: (devices) =>
    set(({ selectedInputDeviceId }) => {
      const nextDevices =
        devices.length > 0
          ? devices
          : [
              {
                id: 'default',
                label: 'Default microphone',
              },
            ]
      const selectedDeviceExists = nextDevices.some((device) => device.id === selectedInputDeviceId)

      return {
        inputDevices: nextDevices,
        selectedInputDeviceId: selectedDeviceExists ? selectedInputDeviceId : nextDevices[0].id,
      }
    }),
  setInputDevice: (deviceId) => set({ selectedInputDeviceId: deviceId }),
  setInputChannel: (channelId) => set({ selectedInputChannelId: channelId }),
  setMonitoring: (enabled) => set({ isMonitoring: enabled }),
  toggleMonitoring: () => set(({ isMonitoring }) => ({ isMonitoring: !isMonitoring })),
  setRecordingPermission: (permission) =>
    set(({ recording }) => ({
      recording: {
        ...recording,
        permission,
      },
    })),
  setRecordingStatus: (status) =>
    set(({ recording }) => ({
      recording: {
        ...recording,
        status,
      },
    })),
  setRecordingError: (message) =>
    set(({ recording }) => ({
      recording: {
        ...recording,
        errorMessage: message,
      },
    })),
  setInputLevel: (level) =>
    set(({ recording }) => ({
      recording: {
        ...recording,
        inputLevel: clamp(level, 0, 100),
      },
    })),
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
