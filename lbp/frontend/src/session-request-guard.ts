export class SessionRequestGuard {
  private revision = 0;

  begin(): number {
    return ++this.revision;
  }

  invalidate(): void {
    ++this.revision;
  }

  isCurrent(request: number): boolean {
    return request === this.revision;
  }
}
