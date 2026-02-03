import { useEffect, useRef, useCallback } from 'react';

interface RecoveryResult {
  message: string;
  recovered: number;
  failed: number;
  results?: Array<{
    jobId: string;
    status: string;
    message: string;
  }>;
}

/**
 * Hook to automatically recover stale scraper jobs
 *
 * Call this hook on pages where scrapers are displayed or managed.
 * It will automatically check for and recover any jobs that got stuck
 * due to webhook failures.
 *
 * @param projectId - Optional project ID to limit recovery scope
 * @param onRecovered - Optional callback when jobs are recovered
 */
export function useScraperRecovery(
  projectId?: string,
  onRecovered?: (result: RecoveryResult) => void
) {
  const hasRecoveredRef = useRef(false);
  const isRecoveringRef = useRef(false);

  const recoverStaleJobs = useCallback(async () => {
    if (isRecoveringRef.current) return;
    isRecoveringRef.current = true;

    try {
      const response = await fetch('/api/scraper/recover-stale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        const result = (await response.json()) as RecoveryResult;

        if (result.recovered > 0) {
          console.log(
            `[useScraperRecovery] Recovered ${result.recovered} stale scraper jobs`,
            result.results
          );
          onRecovered?.(result);
        } else if (result.failed > 0) {
          console.log(
            `[useScraperRecovery] ${result.failed} jobs failed during recovery`,
            result.results
          );
        }
      }
    } catch (error) {
      console.error('[useScraperRecovery] Error during recovery:', error);
    } finally {
      isRecoveringRef.current = false;
    }
  }, [projectId, onRecovered]);

  // Run recovery once on mount
  useEffect(() => {
    if (!hasRecoveredRef.current) {
      hasRecoveredRef.current = true;
      // Small delay to not block initial render
      const timer = setTimeout(recoverStaleJobs, 2000);
      return () => clearTimeout(timer);
    }
  }, [recoverStaleJobs]);

  // Return manual trigger for explicit recovery
  return { recoverStaleJobs };
}
