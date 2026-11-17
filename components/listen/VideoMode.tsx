"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Languages,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import BackgroundCover from "@/components/qari/BackgroundCover";
import { NatureChip } from "@/components/listen/NatureControls";
import { SeekBar, SleepTopButton } from "@/components/listen/NowPlayingParts";
import VideoAyah from "@/components/listen/VideoAyah";
import SettingsSheet from "@/components/settings/SettingsSheet";
import { useAppSettings } from "@/hooks/useAppSettings";
import { setAppSettings } from "@/lib/app-settings";
import {
  DEFAULT_TRANSLATION_EDITION,
  TRANSLATION_LANGUAGES,
  translationLanguageLabel,
} from "@/lib/translations";
import { useListenProgress, useListenState } from "@/hooks/useListen";
import { tapFeedback } from "@/lib/haptics";
import { playNeighbour, togglePlay } from "@/lib/listen-player";
import { peekListenAudio } from "@/lib/listen-audio";
import {
  LISTEN_VIDEO_BACKGROUND,
  listenTimeline,
  setListenVideo,
} from "@/lib/listen-video";
import type { VerseTimelineEntry } from "@/lib/qari";
import { getQiraat, getReciterById } from "@/lib/reciters";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { useCloseOnBack } from "@/lib/native-back";

/**
 * Translation mode: the whole screen a slow nature clip, graded like the Qari videos, with the ayah
 * being recited and its translation in the middle. Nature mode and sleep stay at the top as in
 * Now playing, and the arrow there goes back to it. No player box: low on the screen, see-through
 * controls (previous, pause, next), then the surah with the translation's language, and the place
 * in the surah to drag.
 * For a reciter whose recording has no ayah timings, the surah's name stands in the middle.
 *
 * The tab bar hides while it is open (html.listen-video-on), so the clip covers the page and
 * the sheets opened from here (Nature mode, sleep) still come up over it.
 */
export default function VideoMode({
  onOpenSleep,
  onOpenNature,
}: {
  onOpenSleep: () => void;
  onOpenNature: () => void;
}) {
  const t = useT();
  const { surah, reciterId, status, error } = useListenState();
  const { position, duration } = useListenProgress();
  const playing = status === "playing";
  const translationLanguage = useAppSettings().translationLanguage;
  const [languageOpen, setLanguageOpen] = useState(false);
  // The audio's own clock, read every frame while it plays: the player reports its place only a few
  // times a second, which made the ayah change up to a quarter of a second behind the voice.
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    if (!playing) {
      setClock(null);
      return;
    }
    let frame = 0;
    let last = -1;
    const tick = () => {
      const at = peekListenAudio()?.currentTime;
      if (at !== undefined && Math.abs(at - last) >= 0.03) {
        last = at;
        setClock(at);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  // undefined while it loads, null when this recording has none.
  const [timeline, setTimeline] = useState<
    { key: string; entries: VerseTimelineEntry[] | null } | undefined
  >(undefined);
  const timelineKey = surah && reciterId ? `${reciterId}:${surah.id}` : "";

  const exit = () => setListenVideo(false);
  useCloseOnBack(true, exit);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("listen-video-on");
    const onKey = (e: KeyboardEvent) => {
      // A sheet opened over it closes first.
      if (
        e.key === "Escape" &&
        document.querySelectorAll('[role="dialog"]').length <= 2
      )
        setListenVideo(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.classList.remove("listen-video-on");
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!surah || !reciterId) return;
    let cancelled = false;
    void listenTimeline(reciterId, surah.id).then((entries) => {
      if (!cancelled) setTimeline({ key: `${reciterId}:${surah.id}`, entries });
    });
    return () => {
      cancelled = true;
    };
  }, [surah, reciterId]);

  if (!surah || !reciterId || typeof document === "undefined") return null;
  const reciter = getReciterById(reciterId);
  const entries = timeline?.key === timelineKey ? timeline.entries : undefined;

  return createPortal(
    <>
      <div
        className="listen-video fixed inset-0 z-[45] overflow-hidden bg-black text-white"
        role="dialog"
        aria-modal="true"
        aria-label={t("Translation mode")}
      >
        <BackgroundCover
          background={LISTEN_VIDEO_BACKGROUND}
          moving
          paused={!playing}
        />
        <div className={cn("qari-mist", !playing && "is-paused")} aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/80"
          aria-hidden
        />
        {/* The darker edges of a film frame, as in the Qari videos. */}
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_45%,transparent_55%,rgba(0,0,0,0.5))]"
          aria-hidden
        />

        <div className="relative mx-auto flex h-full w-full max-w-lg flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* Three columns, so Nature mode stays centred, as in Now playing. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                exit();
              }}
              className="home-round ed-focus justify-self-start"
              aria-label={t("Turn off translation mode")}
            >
              <ChevronDown className="h-5 w-5" strokeWidth={1.9} />
            </button>
            <NatureChip onOpen={onOpenNature} />
            <span className="justify-self-end">
              <SleepTopButton onOpen={onOpenSleep} />
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            {entries ? (
              <VideoAyah
                timeline={entries}
                position={clock ?? position}
                durationSec={duration}
                paused={!playing}
              />
            ) : entries === null ? (
              <div className="text-center">
                <h2
                  className="home-serif text-[2.125rem] font-semibold leading-tight tracking-[-0.02em]"
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}
                >
                  {surah.englishName}
                </h2>
                <p
                  className="amiri !text-center mt-1 text-[1.5rem] leading-normal text-white/90"
                  lang="ar"
                >
                  {surah.name}
                </p>
              </div>
            ) : (
              <Loader2
                className="h-6 w-6 animate-spin text-white/70"
                strokeWidth={2}
                aria-hidden
              />
            )}
          </div>

          {error ? (
            <p
              className="mb-3 text-center text-sm font-medium text-rose-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {/* Low on the screen and see-through: previous, pause, next. */}
          <div className="flex items-center justify-center gap-9">
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                void playNeighbour(-1);
              }}
              className="listen-video__button ed-focus"
              aria-label={t("Previous surah")}
            >
              <SkipBack
                className="h-[22px] w-[22px] fill-current rtl:-scale-x-100"
                strokeWidth={1.6}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                togglePlay();
              }}
              className="listen-video__play ed-focus"
              aria-label={
                playing || status === "loading" ? t("Pause") : t("Play")
              }
            >
              {status === "loading" ? (
                <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} />
              ) : playing ? (
                <Pause className="h-7 w-7 fill-current" strokeWidth={0} />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" strokeWidth={0} />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                void playNeighbour(1);
              }}
              className="listen-video__button ed-focus"
              aria-label={t("Next surah")}
            >
              <SkipForward
                className="h-[22px] w-[22px] fill-current rtl:-scale-x-100"
                strokeWidth={1.6}
              />
            </button>
          </div>

          <div className="mt-5 flex min-w-0 items-center justify-between gap-3">
            <p
              className="min-w-0 truncate text-[0.8125rem] text-white/85"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
            >
              <span className="font-semibold text-white">
                {surah.englishName}
              </span>{" "}
              · {reciter.name} · {getQiraat(reciter.qiraat).short}
            </p>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                setLanguageOpen(true);
              }}
              className="listen-video__chip ed-focus"
              aria-label={`${t("Translation language")}: ${t(
                translationLanguageLabel(translationLanguage)
              )}`}
            >
              <Languages
                className="h-[15px] w-[15px] shrink-0"
                strokeWidth={2}
              />
              <span className="truncate">
                {t(translationLanguageLabel(translationLanguage))}
              </span>
            </button>
          </div>

          <SeekBar className="mt-2" />
        </div>
      </div>

      <SettingsSheet
        open={languageOpen}
        title={t("Translation language")}
        onClose={() => setLanguageOpen(false)}
      >
        <div className="home-card overflow-hidden rounded-2xl">
          {TRANSLATION_LANGUAGES.map((lang) => {
            const on = lang === translationLanguage;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  tapFeedback();
                  setAppSettings({
                    translationLanguage: lang,
                    translationEditionId: DEFAULT_TRANSLATION_EDITION[lang],
                  });
                  setLanguageOpen(false);
                }}
                className="set-row w-full"
                aria-pressed={on}
              >
                <span className="set-row__label">
                  {t(translationLanguageLabel(lang))}
                </span>
                {on ? (
                  <Check
                    className="h-[18px] w-[18px] shrink-0"
                    strokeWidth={2.4}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </SettingsSheet>
    </>,
    document.body
  );
}
