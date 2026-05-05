import type { AudioClip, Track } from '../types/daw'
import { beatToSeconds } from '../utils/time'

type PlaybackSnapshot = {
  bpm: number
  playheadSeconds: number
  clips: AudioClip[]
  audioBlobs: Record<string, Blob>
  tracks: Track[]
}

type TrackNodes = {
  input: GainNode
  dry: GainNode
  delay: DelayNode
  feedback: GainNode
  wet: GainNode
  pan: StereoPannerNode
  output: GainNode
}

type ScheduledSource = {
  clipId: string
  source: AudioBufferSourceNode
}

function getTrackIsAudible(track: Track, tracks: Track[]): boolean {
  const hasSolo = tracks.some((item) => item.mixer.solo)

  return !track.mixer.muted && (!hasSolo || track.mixer.solo)
}

function getVolumeGain(volume: number): number {
  return Math.min(Math.max(volume / 100, 0), 1)
}

function getPanValue(pan: number): number {
  return Math.min(Math.max(pan / 100, -1), 1)
}

function getReverbWetGain(reverb: number): number {
  return Math.min(Math.max(reverb / 100, 0), 1) * 0.45
}

class PlaybackEngine {
  private audioContext: AudioContext | null = null

  private bufferCache = new Map<string, AudioBuffer>()

  private trackNodes = new Map<string, TrackNodes>()

  private sources: ScheduledSource[] = []

  private playbackStartContextTime = 0

  private playbackStartSeconds = 0

  private playbackEndSeconds = 0

  private isPlaying = false

  private playToken = 0

  get contextTime(): number {
    return this.getContext().currentTime
  }

  get elapsedPlaybackSeconds(): number {
    if (!this.isPlaying) {
      return this.playbackStartSeconds
    }

    return this.playbackStartSeconds + (this.contextTime - this.playbackStartContextTime)
  }

  get scheduledEndSeconds(): number {
    return this.playbackEndSeconds
  }

  get playing(): boolean {
    return this.isPlaying
  }

  async start(snapshot: PlaybackSnapshot): Promise<void> {
    const context = this.getContext()
    await context.resume()
    this.stop()
    const token = ++this.playToken

    this.playbackStartContextTime = context.currentTime
    this.playbackStartSeconds = snapshot.playheadSeconds
    this.playbackEndSeconds = snapshot.playheadSeconds
    this.isPlaying = true

    this.ensureTrackNodes(snapshot.tracks)
    this.updateMixer(snapshot.tracks)

    const sortedClips = [...snapshot.clips].sort((first, second) => first.startBeat - second.startBeat)

    await Promise.all(
      sortedClips.map((clip) => this.scheduleClip(clip, snapshot, context, token)),
    )
  }

  stop(): void {
    this.playToken += 1

    for (const { source } of this.sources) {
      try {
        source.stop()
      } catch {
        // Already-ended one-shot sources throw if stopped twice.
      }

      source.disconnect()
    }

    this.sources = []
    this.isPlaying = false
  }

  updateMixer(tracks: Track[]): void {
    this.ensureTrackNodes(tracks)

    for (const track of tracks) {
      const nodes = this.trackNodes.get(track.id)

      if (!nodes) {
        continue
      }

      const isAudible = getTrackIsAudible(track, tracks)
      nodes.output.gain.setTargetAtTime(
        isAudible ? getVolumeGain(track.mixer.volume) : 0,
        this.getContext().currentTime,
        0.01,
      )
      nodes.pan.pan.setTargetAtTime(getPanValue(track.mixer.pan), this.getContext().currentTime, 0.01)
      nodes.wet.gain.setTargetAtTime(getReverbWetGain(track.mixer.reverb), this.getContext().currentTime, 0.02)
      nodes.dry.gain.setTargetAtTime(1 - getReverbWetGain(track.mixer.reverb) * 0.7, this.getContext().currentTime, 0.02)
    }
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    return this.audioContext
  }

  private async scheduleClip(
    clip: AudioClip,
    snapshot: PlaybackSnapshot,
    context: AudioContext,
    token: number,
  ): Promise<void> {
    const clipStartSeconds = beatToSeconds(clip.startBeat, snapshot.bpm)
    const clipEndSeconds = clipStartSeconds + beatToSeconds(clip.durationBeats, snapshot.bpm)

    if (clipEndSeconds <= snapshot.playheadSeconds) {
      return
    }

    const blob = snapshot.audioBlobs[clip.blobId]
    const track = snapshot.tracks.find((item) => item.id === clip.trackId)

    if (!blob || !track) {
      return
    }

    const buffer = await this.getAudioBuffer(clip.blobId, blob, context)

    if (!this.isPlaying || token !== this.playToken) {
      return
    }

    const source = context.createBufferSource()
    const trackNodes = this.trackNodes.get(track.id)

    if (!trackNodes) {
      return
    }

    const seekIntoClipSeconds = Math.max(0, snapshot.playheadSeconds - clipStartSeconds)
    const sourceOffset = Math.min(buffer.duration, clip.offsetSeconds + seekIntoClipSeconds)
    const visibleDuration = beatToSeconds(clip.durationBeats, snapshot.bpm) - seekIntoClipSeconds
    const sourceDuration = Math.max(0, Math.min(visibleDuration, buffer.duration - sourceOffset))

    if (sourceDuration <= 0) {
      return
    }

    const startDelay = Math.max(0, clipStartSeconds - snapshot.playheadSeconds)
    const sourceStartTime = context.currentTime + startDelay

    source.buffer = buffer
    source.connect(trackNodes.input)
    source.onended = () => {
      this.sources = this.sources.filter((item) => item.source !== source)
      source.disconnect()
    }

    source.start(sourceStartTime, sourceOffset, sourceDuration)
    this.sources.push({ clipId: clip.id, source })
    this.playbackEndSeconds = Math.max(this.playbackEndSeconds, clipStartSeconds + seekIntoClipSeconds + sourceDuration)
  }

  private async getAudioBuffer(
    blobId: string,
    blob: Blob,
    context: AudioContext,
  ): Promise<AudioBuffer> {
    const cachedBuffer = this.bufferCache.get(blobId)

    if (cachedBuffer) {
      return cachedBuffer
    }

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0))
    this.bufferCache.set(blobId, buffer)

    return buffer
  }

  private ensureTrackNodes(tracks: Track[]): void {
    const context = this.getContext()

    for (const track of tracks) {
      if (this.trackNodes.has(track.id)) {
        continue
      }

      const input = context.createGain()
      const dry = context.createGain()
      const delay = context.createDelay(1)
      const feedback = context.createGain()
      const wet = context.createGain()
      const pan = context.createStereoPanner()
      const output = context.createGain()

      delay.delayTime.value = 0.095
      feedback.gain.value = 0.22
      wet.gain.value = getReverbWetGain(track.mixer.reverb)
      dry.gain.value = 1 - getReverbWetGain(track.mixer.reverb) * 0.7
      pan.pan.value = getPanValue(track.mixer.pan)
      output.gain.value = getVolumeGain(track.mixer.volume)

      input.connect(dry)
      dry.connect(pan)
      input.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wet)
      wet.connect(pan)
      pan.connect(output)
      output.connect(context.destination)

      this.trackNodes.set(track.id, {
        input,
        dry,
        delay,
        feedback,
        wet,
        pan,
        output,
      })
    }
  }
}

export const playbackEngine = new PlaybackEngine()
