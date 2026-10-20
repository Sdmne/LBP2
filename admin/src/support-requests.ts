export class SupportRequests {
  private controller: AbortController | undefined;
  private pending = false;

  get inFlight() { return this.pending; }

  begin() {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.pending = true;
    return controller;
  }

  isCurrent(controller: AbortController) {
    return this.controller === controller && !controller.signal.aborted;
  }

  finish(controller: AbortController) {
    if (this.controller === controller) this.pending = false;
  }

  invalidate() {
    this.controller?.abort();
    this.controller = undefined;
    this.pending = false;
  }
}

export function startSupportRefresh(refresh: () => void) {
  const visible = () => { if (document.visibilityState === "visible") refresh(); };
  const timer = window.setInterval(visible, 10_000);
  window.addEventListener("focus", visible);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", visible);
    document.removeEventListener("visibilitychange", visible);
  };
}
