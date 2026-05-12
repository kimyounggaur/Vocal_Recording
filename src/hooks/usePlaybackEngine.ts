import { useEffect, useRef } from 'react'
import { playbackEngine } from '../audio/playbackEngine'
import { useDawStore } from '../state/useDawStore'

export function usePlaybackEngine() {
  const transport = useDawStore((state) => state.transport)
  const tracks = useDawStore((state) => state.tracks)
  const mastering = useDawStore((state) => state.mastering)
  const setTransportPosition = useDawStore((state) => state.setTransportPosition)
  const finishPlaybackTransport = useDawStore((state) => state.finishPlaybackTransport)
  const lastPlayingRef = useRef(false)

  useEffect(() => {
    playbackEngine.updateMixer(tracks)
  }, [tracks])

  useEffect(() => {
    playbackEngine.updateMastering(mastering)
  }, [mastering])

  useEffect(() => {
    if (!transport.isPlaying || transport.isRecording) {
      playbackEngine.stop()
      lastPlayingRef.current = false
      return
    }

    if (lastPlayingRef.current) {
      return
    }

    lastPlayingRef.current = true
    const state = useDawStore.getState()

    void playbackEngine.start({
      bpm: state.project.bpm,
      playheadSeconds: state.transport.currentTimeSeconds,
      clips: state.clips,
      audioBlobs: state.audioBlobs,
      tracks: state.tracks,
      mastering: state.mastering,
    })
  }, [transport.isPlaying, transport.isRecording])

  useEffect(() => {
    if (!transport.isPlaying || transport.isRecording) {
      return undefined
    }

    let animationFrameId = 0

    const tick = () => {
      const nextSeconds = playbackEngine.elapsedPlaybackSeconds

      const bpm = useDawStore.getState().project.bpm
      setTransportPosition(nextSeconds, bpm)

      if (
        playbackEngine.playing &&
        playbackEngine.scheduledEndSeconds > 0 &&
        nextSeconds >= playbackEngine.scheduledEndSeconds
      ) {
        playbackEngine.stop()
        finishPlaybackTransport()
        return
      }

      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [
    finishPlaybackTransport,
    setTransportPosition,
    transport.isPlaying,
    transport.isRecording,
  ])

  useEffect(() => {
    return () => {
      playbackEngine.stop()
    }
  }, [])
}
