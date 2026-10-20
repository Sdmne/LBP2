export function startSessionPresence(heartbeat: (signal: AbortSignal) => Promise<unknown>) {
  let stopped = false;
  let pending: AbortController | undefined;
  const pulse = async () => {
    if (stopped || pending || document.visibilityState !== "visible") return;
    const controller = new AbortController();
    pending = controller;
    try {
      await heartbeat(controller.signal);
    } catch {
      // Authentication errors use the API client's session-expired event.
      // Temporary connection failures are retried on the next pulse.
    } finally {
      if (pending === controller) pending = undefined;
    }
  };
  const resume = () => { void pulse(); };
  const timer = window.setInterval(resume, 30_000);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  resume();
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", resume);
    pending?.abort();
  };
}
