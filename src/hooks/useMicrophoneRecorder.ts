import { useCallback, useEffect, useRef } from 'react'
import type { AudioClip, InputDevice, RecordingPermissionState, RecordingStatus } from '../types/daw'
import { buildWaveformPeaks, decodeAudioBlob, getPreferredRecordingMimeType } from '../audio/waveform'
import { useDawStore } from '../state/useDawStore'
import { secondsToBeat } from '../utils/time'

type RecorderControls = {
  startRecording: () => Promise<void>
  stopRecording: () => void
  toggleRecording: () => Promise<void>
  stopAllInput: () => void
}

function createId(prefix: string): string {
  if (crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone permission was denied.'
    }

    if (error.name === 'NotFoundError') {
      return 'No microphone input device was found.'
    }

    if (error.name === 'NotReadableError') {
      return 'The microphone is already in use by another app.'
    }
  }

  return 'Microphone recording could not be started.'
}

function mapAudioInputs(devices: MediaDeviceInfo[]): InputDevice[] {
  const audioInputs = devices.filter((device) => device.kind === 'audioinput')

  if (audioInputs.length === 0) {
    return [
      {
        id: 'default',
        label: 'Default microphone',
      },
    ]
  }

  return audioInputs.map((device, index) => ({
    id: device.deviceId || `audio-input-${index + 1}`,
    label: device.label || `Microphone ${index + 1}`,
  }))
}

export function useMicrophoneRecorder(): RecorderControls {
  const selectedInputDeviceId = useDawStore((state) => state.selectedInputDeviceId)
  const isMonitoring = useDawStore((state) => state.isMonitoring)
  const recordingStatus = useDawStore((state) => state.recording.status)
  const setInputDevices = useDawStore((state) => state.setInputDevices)
  const setRecordingStatus = useDawStore((state) => state.setRecordingStatus)
  const setRecordingPermission = useDawStore((state) => state.setRecordingPermission)
  const setRecordingError = useDawStore((state) => state.setRecordingError)
  const setInputLevel = useDawStore((state) => state.setInputLevel)
  const addRecordedClip = useDawStore((state) => state.addRecordedClip)
  const startRecordingTransport = useDawStore((state) => state.startRecordingTransport)
  const finishRecordingTransport = useDawStore((state) => state.finishRecordingTransport)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const monitorGainRef = useRef<GainNode | null>(null)
  const meterFrameRef = useRef(0)
  const lastLevelRef = useRef(0)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartBeatRef = useRef(0)
  const selectedInputDeviceIdRef = useRef(selectedInputDeviceId)
  const previousInputDeviceIdRef = useRef(selectedInputDeviceId)
  const isMonitoringRef = useRef(isMonitoring)

  selectedInputDeviceIdRef.current = selectedInputDeviceId
  isMonitoringRef.current = isMonitoring

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    return audioContextRef.current
  }, [])

  const refreshInputDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setInputDevices([])
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setInputDevices(mapAudioInputs(devices))
    } catch {
      setInputDevices([])
    }
  }, [setInputDevices])

  const stopMeter = useCallback(() => {
    if (meterFrameRef.current) {
      cancelAnimationFrame(meterFrameRef.current)
      meterFrameRef.current = 0
    }

    lastLevelRef.current = 0
    setInputLevel(0)
  }, [setInputLevel])

  const startMeter = useCallback(() => {
    const analyser = analyserRef.current

    if (!analyser) {
      return
    }

    const samples = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(samples)

      let squareSum = 0
      for (const sample of samples) {
        const centered = (sample - 128) / 128
        squareSum += centered * centered
      }

      const rms = Math.sqrt(squareSum / samples.length)
      const nextLevel = Math.min(100, Math.round(rms * 180))

      if (Math.abs(nextLevel - lastLevelRef.current) >= 1) {
        lastLevelRef.current = nextLevel
        setInputLevel(nextLevel)
      }

      meterFrameRef.current = requestAnimationFrame(tick)
    }

    if (!meterFrameRef.current) {
      meterFrameRef.current = requestAnimationFrame(tick)
    }
  }, [setInputLevel])

  const disconnectMonitorOutput = useCallback(() => {
    try {
      monitorGainRef.current?.disconnect()
    } catch {
      // The node can already be disconnected when the stream is rebuilt.
    }
  }, [])

  const connectMonitorOutput = useCallback(async () => {
    const audioContext = getAudioContext()
    await audioContext.resume()

    disconnectMonitorOutput()
    try {
      if (sourceRef.current && monitorGainRef.current) {
        sourceRef.current.connect(monitorGainRef.current)
      }
    } catch {
      // The source can already be connected when monitoring is toggled repeatedly.
    }
    monitorGainRef.current?.connect(audioContext.destination)
  }, [disconnectMonitorOutput, getAudioContext])

  const stopStream = useCallback(() => {
    sourceRef.current?.disconnect()
    analyserRef.current?.disconnect()
    disconnectMonitorOutput()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    sourceRef.current = null
    analyserRef.current = null
    monitorGainRef.current = null
    stopMeter()
  }, [disconnectMonitorOutput, stopMeter])

  const buildAudioGraph = useCallback(
    async (stream: MediaStream) => {
      const audioContext = getAudioContext()
      await audioContext.resume()

      sourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
      disconnectMonitorOutput()

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      const monitorGain = audioContext.createGain()

      analyser.fftSize = 1024
      monitorGain.gain.value = 0.75

      source.connect(analyser)

      sourceRef.current = source
      analyserRef.current = analyser
      monitorGainRef.current = monitorGain

      if (isMonitoringRef.current) {
        source.connect(monitorGain)
        monitorGain.connect(audioContext.destination)
      }

      startMeter()
    },
    [disconnectMonitorOutput, getAudioContext, startMeter],
  )

  const requestInputStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError('This browser does not support microphone recording.')
      setRecordingPermission('denied')
      throw new Error('Media devices are not available.')
    }

    const activeTrack = streamRef.current?.getAudioTracks()[0]
    if (streamRef.current && activeTrack?.readyState === 'live') {
      return streamRef.current
    }

    setRecordingPermission('requesting')
    setRecordingError(null)

    const deviceId = selectedInputDeviceIdRef.current
    const constraints: MediaStreamConstraints = {
      audio:
        deviceId && deviceId !== 'default'
          ? {
              deviceId: {
                exact: deviceId,
              },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setRecordingPermission('granted')
      await refreshInputDevices()
      await buildAudioGraph(stream)

      return stream
    } catch (error) {
      const message = getMicrophoneErrorMessage(error)
      const permission: RecordingPermissionState = message.includes('denied') ? 'denied' : 'idle'
      setRecordingPermission(permission)
      setRecordingStatus('idle')
      setRecordingError(message)
      if (isMonitoringRef.current) {
        useDawStore.getState().setMonitoring(false)
      }
      throw error
    }
  }, [
    buildAudioGraph,
    refreshInputDevices,
    setRecordingError,
    setRecordingPermission,
    setRecordingStatus,
  ])

  const finishBlobRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      try {
        const audioContext = getAudioContext()
        const audioBuffer = await decodeAudioBlob(blob, audioContext)
        const waveformPeaks = buildWaveformPeaks(audioBuffer)
        const state = useDawStore.getState()
        const blobId = createId('blob')
        const clipId = createId('clip')
        const durationSeconds = audioBuffer.duration
        const clip: AudioClip = {
          id: clipId,
          trackId: state.selectedTrackId,
          blobId,
          name: `Take ${state.clips.length + 1}`,
          startBeat: recordingStartBeatRef.current,
          durationBeats: secondsToBeat(durationSeconds, state.project.bpm),
          offsetSeconds: 0,
          durationSeconds,
          waveformPeaks,
          objectUrl: URL.createObjectURL(blob),
          mimeType,
          createdAt: new Date().toISOString(),
        }

        addRecordedClip(clip, blob)
        setRecordingError(null)
      } catch (error) {
        setRecordingError(getMicrophoneErrorMessage(error))
      } finally {
        finishRecordingTransport()
        setRecordingStatus('idle')

        if (!useDawStore.getState().isMonitoring) {
          stopStream()
        }
      }
    },
    [addRecordedClip, finishRecordingTransport, getAudioContext, setRecordingError, setRecordingStatus, stopStream],
  )

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === 'recording' || recordingStatus === 'arming') {
      return
    }

    setRecordingStatus('arming')

    try {
      const stream = await requestInputStream()
      if (typeof MediaRecorder === 'undefined') {
        setRecordingError('This browser does not support MediaRecorder.')
        finishRecordingTransport()
        setRecordingStatus('idle')
        return
      }

      const mimeType = getPreferredRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      chunksRef.current = []
      recordingStartBeatRef.current = useDawStore.getState().transport.currentBeat

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        setRecordingError('The recording session stopped unexpectedly.')
        finishRecordingTransport()
        setRecordingStatus('idle')
      }

      recorder.onstop = () => {
        const blobType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: blobType })
        chunksRef.current = []
        recorderRef.current = null

        if (blob.size === 0) {
          setRecordingError('No audio was captured.')
          finishRecordingTransport()
          setRecordingStatus('idle')
          return
        }

        void finishBlobRecording(blob, blobType)
      }

      recorderRef.current = recorder
      recorder.start(250)
      startRecordingTransport()
      setRecordingStatus('recording')
    } catch {
      finishRecordingTransport()
      setRecordingStatus('idle')
    }
  }, [
    finishBlobRecording,
    finishRecordingTransport,
    recordingStatus,
    requestInputStream,
    setRecordingError,
    setRecordingStatus,
    startRecordingTransport,
  ])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current

    if (recorder?.state === 'recording') {
      setRecordingStatus('encoding')
      recorder.stop()
      finishRecordingTransport()
    }
  }, [finishRecordingTransport, setRecordingStatus])

  const toggleRecording = useCallback(async () => {
    const recorder = recorderRef.current

    if (recorder?.state === 'recording') {
      stopRecording()
      return
    }

    await startRecording()
  }, [startRecording, stopRecording])

  const stopAllInput = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      recorderRef.current = null
    }

    stopStream()
    finishRecordingTransport()
    setRecordingStatus('idle')
  }, [finishRecordingTransport, setRecordingStatus, stopStream])

  useEffect(() => {
    void refreshInputDevices()

    navigator.mediaDevices?.addEventListener?.('devicechange', refreshInputDevices)

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshInputDevices)
    }
  }, [refreshInputDevices])

  useEffect(() => {
    if (isMonitoring) {
      void requestInputStream()
        .then(() => connectMonitorOutput())
        .catch(() => undefined)
      return
    }

    disconnectMonitorOutput()

    if (recorderRef.current?.state !== 'recording') {
      stopStream()
    }
  }, [connectMonitorOutput, disconnectMonitorOutput, isMonitoring, requestInputStream, stopStream])

  useEffect(() => {
    if (previousInputDeviceIdRef.current === selectedInputDeviceId) {
      return
    }

    previousInputDeviceIdRef.current = selectedInputDeviceId

    if (recorderRef.current?.state === 'recording') {
      return
    }

    if (isMonitoring) {
      stopStream()
      void requestInputStream().catch(() => undefined)
      return
    }

    stopStream()
  }, [requestInputStream, selectedInputDeviceId, isMonitoring, stopStream])

  useEffect(() => stopAllInput, [stopAllInput])

  return {
    startRecording,
    stopRecording,
    toggleRecording,
    stopAllInput,
  }
}
