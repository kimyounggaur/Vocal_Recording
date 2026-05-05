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
  eqFilters: BiquadFilterNode[]
  dry: GainNode
  delay: DelayNode
  delayFeedback: GainNode
  delayWet: GainNode
  reverbDelay: DelayNode
  reverbFeedback: GainNode
  reverbTone: BiquadFilterNode
  reverbWet: GainNode
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getDelayMixGain(mix: number): number {
  return clamp(mix / 100, 0, 1) * 0.55
}

function getDelayFeedbackGain(feedback: number): number {
  return clamp(feedback / 100, 0, 1) * 0.75
}

function getReverbFeedbackGain(size: number): number {
  return 0.18 + clamp(size / 100, 0, 1) * 0.42
}

function getReverbDelayTime(size: number): number {
  return 0.045 + clamp(size / 100, 0, 1) * 0.18
}

function getReverbToneFrequency(tone: number): number {
  return 900 + clamp(tone / 100, 0, 1) * 7600
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
      nodes.dry.gain.setTargetAtTime(1, this.getContext().currentTime, 0.02)
      nodes.delay.delayTime.setTargetAtTime(track.mixer.delay.timeMs / 1000, this.getContext().currentTime, 0.02)
      nodes.delayWet.gain.setTargetAtTime(
        track.mixer.delay.enabled ? getDelayMixGain(track.mixer.delay.mix) : 0,
        this.getContext().currentTime,
        0.02,
      )
      nodes.delayFeedback.gain.setTargetAtTime(
        track.mixer.delay.enabled ? getDelayFeedbackGain(track.mixer.delay.feedback) : 0,
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbDelay.delayTime.setTargetAtTime(
        getReverbDelayTime(track.mixer.reverbSize),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbFeedback.gain.setTargetAtTime(
        getReverbFeedbackGain(track.mixer.reverbSize),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbTone.frequency.setTargetAtTime(
        getReverbToneFrequency(track.mixer.reverbTone),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbWet.gain.setTargetAtTime(getReverbWetGain(track.mixer.reverb), this.getContext().currentTime, 0.02)
      nodes.eqFilters[0]?.gain.setTargetAtTime(track.mixer.eqBands.low, this.getContext().currentTime, 0.02)
      nodes.eqFilters[1]?.gain.setTargetAtTime(track.mixer.eqBands.lowMid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[2]?.gain.setTargetAtTime(track.mixer.eqBands.mid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[3]?.gain.setTargetAtTime(track.mixer.eqBands.highMid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[4]?.gain.setTargetAtTime(track.mixer.eqBands.high, this.getContext().currentTime, 0.02)
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

    if (clip.missingAudio || !blob || !track) {
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
      const eqFilters = [
        context.createBiquadFilter(),
        context.createBiquadFilter(),
        context.createBiquadFilter(),
        context.createBiquadFilter(),
        context.createBiquadFilter(),
      ]
      const dry = context.createGain()
      const delay = context.createDelay(1)
      const delayFeedback = context.createGain()
      const delayWet = context.createGain()
      const reverbDelay = context.createDelay(0.4)
      const reverbFeedback = context.createGain()
      const reverbTone = context.createBiquadFilter()
      const reverbWet = context.createGain()
      const pan = context.createStereoPanner()
      const output = context.createGain()

      eqFilters[0].type = 'lowshelf'
      eqFilters[0].frequency.value = 100
      eqFilters[1].type = 'peaking'
      eqFilters[1].frequency.value = 250
      eqFilters[1].Q.value = 1
      eqFilters[2].type = 'peaking'
      eqFilters[2].frequency.value = 1000
      eqFilters[2].Q.value = 1
      eqFilters[3].type = 'peaking'
      eqFilters[3].frequency.value = 4000
      eqFilters[3].Q.value = 1
      eqFilters[4].type = 'highshelf'
      eqFilters[4].frequency.value = 10000

      eqFilters[0].gain.value = track.mixer.eqBands.low
      eqFilters[1].gain.value = track.mixer.eqBands.lowMid
      eqFilters[2].gain.value = track.mixer.eqBands.mid
      eqFilters[3].gain.value = track.mixer.eqBands.highMid
      eqFilters[4].gain.value = track.mixer.eqBands.high
      delay.delayTime.value = track.mixer.delay.timeMs / 1000
      delayFeedback.gain.value = track.mixer.delay.enabled ? getDelayFeedbackGain(track.mixer.delay.feedback) : 0
      delayWet.gain.value = track.mixer.delay.enabled ? getDelayMixGain(track.mixer.delay.mix) : 0
      reverbDelay.delayTime.value = getReverbDelayTime(track.mixer.reverbSize)
      reverbFeedback.gain.value = getReverbFeedbackGain(track.mixer.reverbSize)
      reverbTone.type = 'lowpass'
      reverbTone.frequency.value = getReverbToneFrequency(track.mixer.reverbTone)
      reverbWet.gain.value = getReverbWetGain(track.mixer.reverb)
      dry.gain.value = 1
      pan.pan.value = getPanValue(track.mixer.pan)
      output.gain.value = getVolumeGain(track.mixer.volume)

      input.connect(eqFilters[0])
      eqFilters[0].connect(eqFilters[1])
      eqFilters[1].connect(eqFilters[2])
      eqFilters[2].connect(eqFilters[3])
      eqFilters[3].connect(eqFilters[4])
      eqFilters[4].connect(dry)
      dry.connect(pan)
      eqFilters[4].connect(delay)
      delay.connect(delayFeedback)
      delayFeedback.connect(delay)
      delay.connect(delayWet)
      delayWet.connect(pan)
      eqFilters[4].connect(reverbDelay)
      reverbDelay.connect(reverbFeedback)
      reverbFeedback.connect(reverbDelay)
      reverbDelay.connect(reverbTone)
      reverbTone.connect(reverbWet)
      reverbWet.connect(pan)
      pan.connect(output)
      output.connect(context.destination)

      this.trackNodes.set(track.id, {
        input,
        eqFilters,
        dry,
        delay,
        delayFeedback,
        delayWet,
        reverbDelay,
        reverbFeedback,
        reverbTone,
        reverbWet,
        pan,
        output,
      })
    }
  }
}

export const playbackEngine = new PlaybackEngine()
