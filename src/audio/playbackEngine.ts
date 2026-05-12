import type { AudioClip, MasteringState, Track } from '../types/daw'
import { getMasterVolumeGain, MASTERING_PRESETS } from '../utils/mastering'
import { beatToSeconds } from '../utils/time'

type PlaybackSnapshot = {
  bpm: number
  playheadSeconds: number
  clips: AudioClip[]
  audioBlobs: Record<string, Blob>
  tracks: Track[]
  mastering: MasteringState
}

type MasterNodes = {
  input: GainNode
  lowShelf: BiquadFilterNode
  highShelf: BiquadFilterNode
  compressor: DynamicsCompressorNode
  output: GainNode
}

type TrackNodes = {
  input: GainNode
  eqFilters: BiquadFilterNode[]
  compressor: DynamicsCompressorNode
  dry: GainNode
  delay: DelayNode
  delayFeedback: GainNode
  delayWet: GainNode
  reverbDelay: DelayNode
  reverbFeedback: GainNode
  reverbHighPass: BiquadFilterNode
  reverbTone: BiquadFilterNode
  reverbEq: BiquadFilterNode
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

function getOutputGain(output: number): number {
  return Math.pow(10, clamp(output, -18, 18) / 20)
}

function getMakeupGain(makeupGain: number): number {
  return Math.pow(10, clamp(makeupGain, -12, 12) / 20)
}

function getReverbFeedbackGain(size: number): number {
  return 0.18 + clamp(size / 100, 0, 1) * 0.42
}

function getReverbDelayTime(size: number, preDelay: number): number {
  return clamp(preDelay / 1000 + 0.035 + clamp(size / 100, 0, 1) * 0.12, 0.01, 0.38)
}

function getReverbToneFrequency(tone: number): number {
  return 900 + clamp(tone / 100, 0, 1) * 7600
}

function getReverbDriveGain(drive: number): number {
  return 1 + clamp(drive / 100, 0, 1) * 0.35
}

class PlaybackEngine {
  private audioContext: AudioContext | null = null

  private masterNodes: MasterNodes | null = null

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

    this.updateMastering(snapshot.mastering)
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
        isAudible
          ? getVolumeGain(track.mixer.volume) *
            getOutputGain(track.mixer.delay.output) *
            getMakeupGain(track.mixer.compressor.makeupGain)
          : 0,
        this.getContext().currentTime,
        0.01,
      )
      nodes.compressor.threshold.setTargetAtTime(
        track.mixer.compressor.enabled ? track.mixer.compressor.threshold : 0,
        this.getContext().currentTime,
        0.02,
      )
      nodes.compressor.ratio.setTargetAtTime(
        track.mixer.compressor.enabled ? track.mixer.compressor.ratio : 1,
        this.getContext().currentTime,
        0.02,
      )
      nodes.compressor.knee.setTargetAtTime(track.mixer.compressor.enabled ? 18 : 0, this.getContext().currentTime, 0.02)
      nodes.compressor.attack.setTargetAtTime(track.mixer.compressor.attackMs / 1000, this.getContext().currentTime, 0.02)
      nodes.compressor.release.setTargetAtTime(track.mixer.compressor.releaseMs / 1000, this.getContext().currentTime, 0.02)
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
        getReverbDelayTime(track.mixer.reverbSize, track.mixer.reverbPreDelay),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbFeedback.gain.setTargetAtTime(
        getReverbFeedbackGain(track.mixer.reverbSize) +
          (track.mixer.reverbModEnabled ? clamp(track.mixer.reverbModAmount / 100, 0, 1) * 0.08 : 0),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbHighPass.frequency.setTargetAtTime(
        track.mixer.reverbHpFilter,
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbTone.frequency.setTargetAtTime(
        getReverbToneFrequency(track.mixer.reverbTone),
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbEq.frequency.setTargetAtTime(track.mixer.reverbEqFrequency, this.getContext().currentTime, 0.02)
      nodes.reverbEq.gain.setTargetAtTime(
        track.mixer.reverbEqEnabled ? track.mixer.reverbEqGain : 0,
        this.getContext().currentTime,
        0.02,
      )
      nodes.reverbWet.gain.setTargetAtTime(
        track.mixer.reverbEnabled ? getReverbWetGain(track.mixer.reverb) * getReverbDriveGain(track.mixer.reverbDrive) : 0,
        this.getContext().currentTime,
        0.02,
      )
      nodes.eqFilters[0]?.gain.setTargetAtTime(track.mixer.eqBands.low, this.getContext().currentTime, 0.02)
      nodes.eqFilters[1]?.gain.setTargetAtTime(track.mixer.eqBands.lowMid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[2]?.gain.setTargetAtTime(track.mixer.eqBands.mid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[3]?.gain.setTargetAtTime(track.mixer.eqBands.highMid, this.getContext().currentTime, 0.02)
      nodes.eqFilters[4]?.gain.setTargetAtTime(track.mixer.eqBands.high, this.getContext().currentTime, 0.02)
    }
  }

  updateMastering(mastering: MasteringState): void {
    const nodes = this.ensureMasterNodes()
    const preset = MASTERING_PRESETS[mastering.presetId]
    const contextTime = this.getContext().currentTime
    const outputGain = getMasterVolumeGain(mastering.volume) * Math.pow(10, (mastering.enabled ? preset.outputGainDb : 0) / 20)

    nodes.lowShelf.gain.setTargetAtTime(mastering.enabled ? preset.lowShelfGain : 0, contextTime, 0.02)
    nodes.highShelf.gain.setTargetAtTime(mastering.enabled ? preset.highShelfGain : 0, contextTime, 0.02)
    nodes.compressor.threshold.setTargetAtTime(mastering.enabled ? preset.threshold : 0, contextTime, 0.02)
    nodes.compressor.ratio.setTargetAtTime(mastering.enabled ? preset.ratio : 1, contextTime, 0.02)
    nodes.compressor.attack.setTargetAtTime(mastering.enabled ? preset.attack : 0.003, contextTime, 0.02)
    nodes.compressor.release.setTargetAtTime(mastering.enabled ? preset.release : 0.25, contextTime, 0.02)
    nodes.compressor.knee.setTargetAtTime(mastering.enabled ? 20 : 0, contextTime, 0.02)
    nodes.output.gain.setTargetAtTime(outputGain, contextTime, 0.01)
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    return this.audioContext
  }

  private ensureMasterNodes(): MasterNodes {
    if (this.masterNodes) {
      return this.masterNodes
    }

    const context = this.getContext()
    const input = context.createGain()
    const lowShelf = context.createBiquadFilter()
    const highShelf = context.createBiquadFilter()
    const compressor = context.createDynamicsCompressor()
    const output = context.createGain()

    lowShelf.type = 'lowshelf'
    lowShelf.frequency.value = 120
    highShelf.type = 'highshelf'
    highShelf.frequency.value = 7200
    compressor.threshold.value = -16
    compressor.ratio.value = 2
    compressor.knee.value = 20
    compressor.attack.value = 0.018
    compressor.release.value = 0.18
    output.gain.value = 1

    input.connect(lowShelf)
    lowShelf.connect(highShelf)
    highShelf.connect(compressor)
    compressor.connect(output)
    output.connect(context.destination)

    this.masterNodes = {
      input,
      lowShelf,
      highShelf,
      compressor,
      output,
    }

    return this.masterNodes
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
    const masterNodes = this.ensureMasterNodes()

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
      const compressor = context.createDynamicsCompressor()
      const dry = context.createGain()
      const delay = context.createDelay(1)
      const delayFeedback = context.createGain()
      const delayWet = context.createGain()
      const reverbDelay = context.createDelay(0.4)
      const reverbFeedback = context.createGain()
      const reverbHighPass = context.createBiquadFilter()
      const reverbTone = context.createBiquadFilter()
      const reverbEq = context.createBiquadFilter()
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
      compressor.threshold.value = track.mixer.compressor.enabled ? track.mixer.compressor.threshold : 0
      compressor.ratio.value = track.mixer.compressor.enabled ? track.mixer.compressor.ratio : 1
      compressor.knee.value = track.mixer.compressor.enabled ? 18 : 0
      compressor.attack.value = track.mixer.compressor.attackMs / 1000
      compressor.release.value = track.mixer.compressor.releaseMs / 1000
      delay.delayTime.value = track.mixer.delay.timeMs / 1000
      delayFeedback.gain.value = track.mixer.delay.enabled ? getDelayFeedbackGain(track.mixer.delay.feedback) : 0
      delayWet.gain.value = track.mixer.delay.enabled ? getDelayMixGain(track.mixer.delay.mix) : 0
      reverbDelay.delayTime.value = getReverbDelayTime(track.mixer.reverbSize, track.mixer.reverbPreDelay)
      reverbFeedback.gain.value = getReverbFeedbackGain(track.mixer.reverbSize)
      reverbHighPass.type = 'highpass'
      reverbHighPass.frequency.value = track.mixer.reverbHpFilter
      reverbTone.type = 'lowpass'
      reverbTone.frequency.value = getReverbToneFrequency(track.mixer.reverbTone)
      reverbEq.type = 'peaking'
      reverbEq.frequency.value = track.mixer.reverbEqFrequency
      reverbEq.Q.value = 0.8
      reverbEq.gain.value = track.mixer.reverbEqEnabled ? track.mixer.reverbEqGain : 0
      reverbWet.gain.value = track.mixer.reverbEnabled
        ? getReverbWetGain(track.mixer.reverb) * getReverbDriveGain(track.mixer.reverbDrive)
        : 0
      dry.gain.value = 1
      pan.pan.value = getPanValue(track.mixer.pan)
      output.gain.value = getVolumeGain(track.mixer.volume)

      input.connect(eqFilters[0])
      eqFilters[0].connect(eqFilters[1])
      eqFilters[1].connect(eqFilters[2])
      eqFilters[2].connect(eqFilters[3])
      eqFilters[3].connect(eqFilters[4])
      eqFilters[4].connect(compressor)
      compressor.connect(dry)
      dry.connect(pan)
      compressor.connect(delay)
      delay.connect(delayFeedback)
      delayFeedback.connect(delay)
      delay.connect(delayWet)
      delayWet.connect(pan)
      compressor.connect(reverbHighPass)
      reverbHighPass.connect(reverbDelay)
      reverbDelay.connect(reverbFeedback)
      reverbFeedback.connect(reverbDelay)
      reverbDelay.connect(reverbTone)
      reverbTone.connect(reverbEq)
      reverbEq.connect(reverbWet)
      reverbWet.connect(pan)
      pan.connect(output)
      output.connect(masterNodes.input)

      this.trackNodes.set(track.id, {
        input,
        eqFilters,
        compressor,
        dry,
        delay,
        delayFeedback,
        delayWet,
        reverbDelay,
        reverbFeedback,
        reverbHighPass,
        reverbTone,
        reverbEq,
        reverbWet,
        pan,
        output,
      })
    }
  }
}

export const playbackEngine = new PlaybackEngine()
