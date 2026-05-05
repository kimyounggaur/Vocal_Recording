export function getPreferredRecordingMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

export async function decodeAudioBlob(
  blob: Blob,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()

  return audioContext.decodeAudioData(arrayBuffer.slice(0))
}

export function buildWaveformPeaks(audioBuffer: AudioBuffer, peakCount = 180): number[] {
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex),
  )
  const samplesPerPeak = Math.max(1, Math.floor(audioBuffer.length / peakCount))
  const peaks: number[] = []

  for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
    const start = peakIndex * samplesPerPeak
    const end = Math.min(audioBuffer.length, start + samplesPerPeak)
    let peak = 0

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      for (const channel of channelData) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0))
      }
    }

    peaks.push(Number(peak.toFixed(4)))
  }

  const maxPeak = Math.max(...peaks, 0.01)

  return peaks.map((peak) => Number((peak / maxPeak).toFixed(4)))
}
