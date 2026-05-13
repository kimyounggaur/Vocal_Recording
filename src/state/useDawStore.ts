import { create } from 'zustand'
import type {
  AudioClip,
  AutoMixPreset,
  AutoPitchSettings,
  CompressorSettings,
  DelaySettings,
  EqSettings,
  InputChannel,
  InputDevice,
  MasteringPresetId,
  MasteringState,
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
import { createId } from '../utils/id'
import { beatToSeconds, clamp, MAX_BPM, MIN_BPM, secondsToBeat, snapBeatToGrid } from '../utils/time'

type MixerKey = keyof MixerState
type AutoPitchKey = keyof AutoPitchSettings
type MasteringKey = keyof MasteringState

const defaultDelaySettings: DelaySettings = {
  enabled: false,
  loFi: false,
  pingPong: false,
  timeMs: 240,
  feedback: 28,
  mix: 18,
  modulationDepth: 18,
  modulationRate: 22,
  hiPass: 20,
  loPass: 78,
  output: 0,
  analog: 1,
}

const defaultEqBands: EqSettings = {
  low: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  high: 0,
}

const defaultCompressorSettings: CompressorSettings = {
  enabled: false,
  threshold: -18,
  ratio: 3,
  attackMs: 12,
  releaseMs: 180,
  makeupGain: 0,
}

const defaultMixer: MixerState = {
  muted: false,
  solo: false,
  volume: 72,
  pan: 0,
  reverbEnabled: true,
  reverb: 18,
  reverbSize: 52,
  reverbTone: 58,
  reverbDrive: 28,
  reverbWidth: 62,
  reverbPreDelay: 48,
  reverbHpFilter: 180,
  reverbModEnabled: true,
  reverbModAmount: 22,
  reverbEqEnabled: true,
  reverbEqGain: 0,
  reverbEqFrequency: 2600,
  delay: defaultDelaySettings,
  compressor: defaultCompressorSettings,
  eqBands: defaultEqBands,
}

function createDefaultMixer(): MixerState {
  return {
    ...defaultMixer,
    delay: {
      ...defaultDelaySettings,
    },
    compressor: {
      ...defaultCompressorSettings,
    },
    eqBands: {
      ...defaultEqBands,
    },
  }
}

type DawState = {
  project: Project
  transport: TransportState
  tracks: Track[]
  clips: AudioClip[]
  audioBlobs: Record<string, Blob>
  selectedTrackId: string
  selectedClipId: string | null
  autopitch: AutoPitchSettings
  mastering: MasteringState
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
  addTrack: () => void
  updateTrackMixer: <K extends MixerKey>(trackId: string, key: K, value: MixerState[K]) => void
  applyAutoMix: (trackId: string, preset: AutoMixPreset) => void
  toggleTrackMute: (trackId: string) => void
  toggleTrackSolo: (trackId: string) => void
  updateAutoPitch: <K extends AutoPitchKey>(key: K, value: AutoPitchSettings[K]) => void
  toggleAutoPitch: () => void
  detectProjectKey: () => void
  updateMastering: <K extends MasteringKey>(key: K, value: MasteringState[K]) => void
  setMasteringPreset: (presetId: MasteringPresetId) => void
  toggleMastering: () => void
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
  mixer: createDefaultMixer(),
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

const initialMastering: MasteringState = {
  enabled: true,
  presetId: 'studio',
  volume: 78,
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

function normalizeTrack(track: Track): Track {
  return {
    ...track,
    mixer: {
      ...defaultMixer,
      ...track.mixer,
      delay: {
        ...defaultDelaySettings,
        ...track.mixer.delay,
      },
      compressor: {
        ...defaultCompressorSettings,
        ...track.mixer.compressor,
      },
      eqBands: {
        ...defaultEqBands,
        ...track.mixer.eqBands,
      },
    },
  }
}

function createTrack(index: number): Track {
  return {
    id: createId('track'),
    index,
    name: `Voice/Audio ${String(index).padStart(2, '0')}`,
    type: 'voice-audio',
    armed: true,
    mixer: createDefaultMixer(),
  }
}

type AutoMixAnalysis = {
  averagePeak: number
  dynamics: number
  maxPeak: number
  presence: number
}

function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * percentile)))

  return values[index]
}

function analyzeTrackForAutoMix(trackId: string, clips: AudioClip[]): AutoMixAnalysis {
  const peaks: number[] = []

  clips.forEach((clip) => {
    if (clip.trackId !== trackId || clip.missingAudio) {
      return
    }

    clip.waveformPeaks.forEach((peak) => {
      const absolutePeak = Math.abs(peak)

      if (Number.isFinite(absolutePeak)) {
        peaks.push(absolutePeak)
      }
    })
  })

  if (peaks.length === 0) {
    return {
      averagePeak: 0.34,
      dynamics: 0.48,
      maxPeak: 0.72,
      presence: 0.42,
    }
  }

  const sortedPeaks = [...peaks].sort((a, b) => a - b)
  const peakTotal = peaks.reduce(
    (summary, peak) => ({
      activeCount: summary.activeCount + (peak > 0.08 ? 1 : 0),
      maxPeak: Math.max(summary.maxPeak, peak),
      total: summary.total + peak,
    }),
    { activeCount: 0, maxPeak: 0, total: 0 },
  )
  const averagePeak = peakTotal.total / peaks.length
  const p50 = getPercentile(sortedPeaks, 0.5)
  const p90 = getPercentile(sortedPeaks, 0.9)

  return {
    averagePeak: clamp(averagePeak, 0, 1),
    dynamics: clamp((p90 - p50) / Math.max(0.08, p90), 0, 1),
    maxPeak: clamp(peakTotal.maxPeak, 0, 1),
    presence: clamp(peakTotal.activeCount / peaks.length, 0, 1),
  }
}

function getAutoMixDelayTime(bpm: number, beatMultiplier: number): number {
  return Math.round(clamp((60000 / bpm) * beatMultiplier, 90, 640) / 5) * 5
}

function buildAutoMixMixer(
  currentMixer: MixerState,
  preset: AutoMixPreset,
  analysis: AutoMixAnalysis,
  bpm: number,
): MixerState {
  if (preset === 'reset') {
    return {
      ...createDefaultMixer(),
      muted: currentMixer.muted,
      solo: currentMixer.solo,
    }
  }

  const levelBoost = (0.58 - analysis.maxPeak) * 22 + (0.34 - analysis.averagePeak) * 12
  const volume = Math.round(clamp(74 + levelBoost, 58, 90))
  const compressorThreshold = Math.round(clamp(-16 - analysis.dynamics * 12 - (analysis.maxPeak > 0.86 ? 3 : 0), -34, -12))
  const compressorRatio = Number(clamp(2.4 + analysis.dynamics * 2.6 + (analysis.maxPeak > 0.9 ? 0.8 : 0), 2.2, 6).toFixed(1))
  const makeupGain = Math.round(clamp((0.46 - analysis.averagePeak) * 10, -2, 6))
  const lowCut = analysis.presence < 0.24 ? -2 : -4
  const lowMidCut = analysis.averagePeak > 0.34 ? -3 : -2
  const highLift = analysis.presence < 0.32 ? 2 : 3

  const baseMixer: MixerState = {
    ...currentMixer,
    volume,
    pan: 0,
    reverbEnabled: true,
    reverb: 16,
    reverbSize: 46,
    reverbTone: 62,
    reverbDrive: 22,
    reverbWidth: 58,
    reverbPreDelay: 38,
    reverbHpFilter: 190,
    reverbModEnabled: true,
    reverbModAmount: 16,
    reverbEqEnabled: true,
    reverbEqGain: -1,
    reverbEqFrequency: 2800,
    delay: {
      ...currentMixer.delay,
      enabled: false,
      loFi: false,
      pingPong: false,
      timeMs: getAutoMixDelayTime(bpm, 0.5),
      feedback: 20,
      mix: 10,
      modulationDepth: 12,
      modulationRate: 18,
      hiPass: 36,
      loPass: 72,
      output: -2,
      analog: 1,
    },
    compressor: {
      enabled: true,
      threshold: compressorThreshold,
      ratio: compressorRatio,
      attackMs: analysis.dynamics > 0.62 ? 8 : 14,
      releaseMs: analysis.presence > 0.58 ? 150 : 210,
      makeupGain,
    },
    eqBands: {
      low: lowCut,
      lowMid: lowMidCut,
      mid: 1,
      highMid: 3,
      high: highLift,
    },
  }

  if (preset === 'broadcast') {
    return {
      ...baseMixer,
      volume: Math.round(clamp(volume + 3, 62, 92)),
      reverbEnabled: false,
      reverb: 5,
      reverbSize: 24,
      reverbDrive: 12,
      reverbWidth: 34,
      reverbPreDelay: 18,
      delay: {
        ...baseMixer.delay,
        enabled: false,
        mix: 0,
        feedback: 8,
      },
      compressor: {
        ...baseMixer.compressor,
        threshold: Math.round(clamp(compressorThreshold - 5, -38, -16)),
        ratio: Number(clamp(compressorRatio + 1.4, 3.4, 7).toFixed(1)),
        attackMs: 7,
        releaseMs: 135,
        makeupGain: Math.round(clamp(makeupGain + 2, 0, 7)),
      },
      eqBands: {
        low: -5,
        lowMid: -3,
        mid: 2,
        highMid: 3,
        high: 1,
      },
    }
  }

  if (preset === 'wideHook') {
    return {
      ...baseMixer,
      volume: Math.round(clamp(volume - 2, 56, 88)),
      reverb: 26,
      reverbSize: 68,
      reverbTone: 66,
      reverbDrive: 30,
      reverbWidth: 82,
      reverbPreDelay: 64,
      reverbModAmount: 30,
      delay: {
        ...baseMixer.delay,
        enabled: true,
        pingPong: true,
        timeMs: getAutoMixDelayTime(bpm, 0.375),
        feedback: 32,
        mix: 18,
        modulationDepth: 26,
        modulationRate: 24,
        hiPass: 42,
        loPass: 64,
        output: -3,
        analog: 2,
      },
      compressor: {
        ...baseMixer.compressor,
        ratio: Number(clamp(compressorRatio - 0.4, 2.2, 4.8).toFixed(1)),
        attackMs: 18,
        releaseMs: 230,
      },
      eqBands: {
        low: -4,
        lowMid: -2,
        mid: 1,
        highMid: 4,
        high: 4,
      },
    }
  }

  if (preset === 'dryFocus') {
    return {
      ...baseMixer,
      volume: Math.round(clamp(volume + 1, 58, 90)),
      reverb: 8,
      reverbSize: 30,
      reverbTone: 56,
      reverbDrive: 16,
      reverbWidth: 42,
      reverbPreDelay: 22,
      reverbModEnabled: false,
      delay: {
        ...baseMixer.delay,
        enabled: false,
        mix: 0,
        feedback: 10,
      },
      compressor: {
        ...baseMixer.compressor,
        threshold: Math.round(clamp(compressorThreshold - 2, -34, -14)),
        ratio: Number(clamp(compressorRatio + 0.7, 2.8, 6).toFixed(1)),
        attackMs: 10,
        releaseMs: 165,
      },
      eqBands: {
        low: -4,
        lowMid: -3,
        mid: 2,
        highMid: 2,
        high: 0,
      },
    }
  }

  return baseMixer
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
  mastering: initialMastering,
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
        mastering: state.mastering,
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
      const nextTracks = (persistedProject.tracks.length > 0 ? persistedProject.tracks : [defaultTrack])
        .map(normalizeTrack)
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
        mastering: {
          ...initialMastering,
          ...persistedProject.mastering,
        },
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
  addTrack: () =>
    set(({ tracks }) => {
      const nextIndex = Math.max(0, ...tracks.map((track) => track.index)) + 1
      const track = createTrack(nextIndex)

      return {
        tracks: [...tracks, track],
        selectedTrackId: track.id,
        selectedClipId: null,
      }
    }),
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
  applyAutoMix: (trackId, preset) =>
    set(({ clips, project, tracks }) => ({
      tracks: tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              mixer: buildAutoMixMixer(
                track.mixer,
                preset,
                analyzeTrackForAutoMix(trackId, clips),
                project.bpm,
              ),
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
  updateMastering: (key, value) =>
    set(({ mastering }) => ({
      mastering: {
        ...mastering,
        [key]: value,
      },
    })),
  setMasteringPreset: (presetId) =>
    set(({ mastering }) => ({
      mastering: {
        ...mastering,
        enabled: true,
        presetId,
      },
    })),
  toggleMastering: () =>
    set(({ mastering }) => ({
      mastering: {
        ...mastering,
        enabled: !mastering.enabled,
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
