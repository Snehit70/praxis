import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getEnrolledCourses, saveEnrolledCourses, type EnrolledCourses } from '@/lib/api';
import { logger } from '@/lib/logger';

interface UseEnrolledCourses {
  level: string | null;
  courseKeys: string[];
  /** Fast membership lookup for "is this course enrolled". */
  enrolled: Set<string>;
  loading: boolean;
  failed: boolean;
  saving: boolean;
  save: (next: EnrolledCourses) => Promise<boolean>;
  reload: () => void;
}

/** Loads (and persists) the courses the signed-in user is taking this term. */
export function useEnrolledCourses(): UseEnrolledCourses {
  const { getToken, isSignedIn } = useAuth();
  const [level, setLevel] = useState<string | null>(null);
  const [courseKeys, setCourseKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nonce, setNonce] = useState(0);
  const saveQueue = useRef(Promise.resolve());
  const activeSaves = useRef(0);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    getEnrolledCourses(getToken)
      .then((data) => {
        if (!active) return;
        setLevel(data.level);
        setCourseKeys(data.courseKeys);
      })
      .catch((error) => {
        logger.error('Failed to load enrolled courses', error);
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getToken, isSignedIn, nonce]);

  const save = useCallback(
    async (next: EnrolledCourses) => {
      // Course saves replace the whole user selection. Optimistically update
      // locally, then serialize writes so rapid toggles cannot arrive out of order.
      setLevel(next.level);
      setCourseKeys(next.courseKeys);
      setSaving(true);
      activeSaves.current += 1;

      const request = saveQueue.current.then(async () => {
        try {
          await saveEnrolledCourses(next, getToken);
          return true;
        } catch (error) {
          logger.error('Failed to save enrolled courses', error);
          return false;
        } finally {
          activeSaves.current -= 1;
          if (activeSaves.current === 0) setSaving(false);
        }
      });

      saveQueue.current = request.then(
        () => undefined,
        () => undefined,
      );

      return request;
    },
    [getToken],
  );

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    level,
    courseKeys,
    enrolled: new Set(courseKeys),
    loading,
    failed,
    saving,
    save,
    reload,
  };
}
