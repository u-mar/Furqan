'use client'

import { useSyncExternalStore } from 'react'
import {
  getListenProgress,
  getListenState,
  getServerListenProgress,
  getServerListenState,
  subscribeListen,
  subscribeListenProgress,
} from '@/lib/listen-player'
import {
  NOT_DOWNLOADED,
  getDownloadsVersion,
  subscribeDownloads,
  surahDownload,
} from '@/lib/listen-downloads'

/** The surah, play state, error and sleep timer — not the position. */
export function useListenState() {
  return useSyncExternalStore(subscribeListen, getListenState, getServerListenState)
}

/** Position and length, which change several times a second. */
export function useListenProgress() {
  return useSyncExternalStore(subscribeListenProgress, getListenProgress, getServerListenProgress)
}

export function useSurahDownload(reciterId: string, surahId: number) {
  return useSyncExternalStore(
    subscribeDownloads,
    () => surahDownload(reciterId, surahId),
    () => NOT_DOWNLOADED
  )
}

/** Changes when a download ends — for counts across the list. */
export function useDownloadsVersion() {
  return useSyncExternalStore(subscribeDownloads, getDownloadsVersion, () => 0)
}
