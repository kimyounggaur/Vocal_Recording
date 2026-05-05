import type { TimeSignature } from '../types/daw'

export const MIN_BPM = 40
export const MAX_BPM = 240

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getBeatsPerBar(timeSignature: TimeSignature): number {
  return timeSignature[0]
}

export function secondsToBeat(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60
}

export function beatToSeconds(beat: number, bpm: number): number {
  return (beat * 60) / bpm
}

export function beatToPixels(beat: number, pixelsPerBeat: number): number {
  return beat * pixelsPerBeat
}

export function pixelsToBeat(pixels: number, pixelsPerBeat: number): number {
  return pixels / pixelsPerBeat
}

export function snapBeatToGrid(beat: number, subdivision = 0.25): number {
  return Math.round(beat / subdivision) * subdivision
}

export function getBarNumber(beat: number, timeSignature: TimeSignature): number {
  return Math.floor(beat / getBeatsPerBar(timeSignature)) + 1
}

export function getBeatInBar(beat: number, timeSignature: TimeSignature): number {
  return Math.floor(beat % getBeatsPerBar(timeSignature)) + 1
}

export function formatTransportTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const wholeSeconds = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds % 1) * 10)

  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`
}
