import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { saveDraftRemote } from '../../store/slices/reportSlice';

const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * Pushes the in-progress report to the server whenever it changes, debounced so
 * typing does not fire a request per keystroke. Every field value and every
 * uploaded photo URL is persisted, so a report can be interrupted and finished
 * later. Entries always survive locally via redux-persist; this makes them
 * survive the device too.
 */
export function useDraftAutosave() {
  const dispatch = useDispatch<AppDispatch>();
  const currentDraft = useSelector((s: RootState) => s.reports.currentDraft);

  // Snapshot of what the server has accepted — only advanced on success, so a
  // failed save is retried by the next edit or by the flush on unmount.
  const savedSnapshot = useRef<string | null>(null);
  const pendingSnapshot = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (snapshot: string) => {
    dispatch(saveDraftRemote())
      .unwrap()
      .then(() => { savedSnapshot.current = snapshot; })
      .catch(() => { /* left unsaved so the next change retries */ });
  };

  useEffect(() => {
    if (!currentDraft?.date) return;

    // `computed`/`flags` are derived on every edit — ignore them when deciding
    // whether anything the staff actually entered changed.
    const { computed, flags, ...entered } = currentDraft as any;
    const snapshot = JSON.stringify(entered);
    pendingSnapshot.current = snapshot;
    if (snapshot === savedSnapshot.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(snapshot), AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [currentDraft, dispatch]);

  // Leaving the screen mid-edit (e.g. off to the camera) should not drop the
  // debounced save that was still pending.
  useEffect(() => () => {
    const pending = pendingSnapshot.current;
    if (pending && pending !== savedSnapshot.current) save(pending);
  }, []);
}
