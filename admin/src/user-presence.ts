export function watchUserPresence(
  load: (signal: AbortSignal) => Promise<{ isOnline: boolean }>,
  update: (online: boolean) => void,
) {
  let stopped = false;
  let pending: AbortController | undefined;
  const refresh = async () => {
    if (stopped || pending || document.visibilityState !== "visible") return;
    const controller = new AbortController();
    pending = controller;
    try {
      const value = await load(controller.signal);
      if (!stopped && !controller.signal.aborted && typeof value.isOnline === "boolean") update(value.isOnline);
    } catch {
      // Keep the last known state on temporary connection failures.
    } finally { if (pending === controller) pending = undefined; }
  };
  const resume = () => { void refresh(); };
  const timer = window.setInterval(resume, 15_000);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  resume();
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", resume);
    pending?.abort();
  };
}
