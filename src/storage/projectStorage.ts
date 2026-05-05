import type { AudioClip, AutoPitchSettings, Project, TimelineState, Track } from '../types/daw'

const DATABASE_NAME = 'voice-track-daw'
const DATABASE_VERSION = 1
const BLOB_STORE_NAME = 'audioBlobs'
const PROJECT_STORAGE_KEY = 'voice-track-daw:last-project'

export type PersistedAudioClip = Omit<AudioClip, 'objectUrl' | 'missingAudio'>

export type PersistedProjectState = {
  version: 1
  savedAt: string
  project: Project
  tracks: Track[]
  clips: PersistedAudioClip[]
  autopitch: AutoPitchSettings
  timeline: TimelineState
  selectedTrackId: string
  selectedClipId: string | null
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(BLOB_STORE_NAME)) {
        database.createObjectStore(BLOB_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runBlobTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(BLOB_STORE_NAME, mode)
        const store = transaction.objectStore(BLOB_STORE_NAME)
        const request = operation(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => database.close()
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      }),
  )
}

export async function saveAudioBlobs(audioBlobs: Record<string, Blob>): Promise<void> {
  const entries = Object.entries(audioBlobs)

  if (entries.length === 0) {
    return
  }

  const database = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BLOB_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(BLOB_STORE_NAME)

    for (const [blobId, blob] of entries) {
      store.put(blob, blobId)
    }

    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export function loadAudioBlob(blobId: string): Promise<Blob | undefined> {
  return runBlobTransaction<Blob | undefined>('readonly', (store) => store.get(blobId))
}

export function deleteAudioBlob(blobId: string): Promise<void> {
  return runBlobTransaction<undefined>('readwrite', (store) => store.delete(blobId)).then(
    () => undefined,
  )
}

export function saveProjectJson(projectState: PersistedProjectState): void {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projectState))
}

export function loadProjectJson(): PersistedProjectState | null {
  const rawProjectState = localStorage.getItem(PROJECT_STORAGE_KEY)

  if (!rawProjectState) {
    return null
  }

  try {
    return JSON.parse(rawProjectState) as PersistedProjectState
  } catch {
    return null
  }
}

export function toPersistedClip(clip: AudioClip): PersistedAudioClip {
  const { objectUrl: _objectUrl, missingAudio: _missingAudio, ...persistedClip } = clip

  return persistedClip
}
