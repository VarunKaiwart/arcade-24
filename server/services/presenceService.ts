/**
 * Tracks active Socket.io connections per authenticated user (Section 9.3).
 * Supports multiple browser tabs: a user remains online while at least one socket is connected.
 */
export class PresenceService {
  private readonly userSockets = new Map<string, Set<string>>();

  public registerSocket(userId: string, socketId: string): { isFirstConnection: boolean; count: number } {
    let set = this.userSockets.get(userId);
    const isFirstConnection = !set || set.size === 0;
    if (!set) {
      set = new Set<string>();
      this.userSockets.set(userId, set);
    }
    set.add(socketId);
    return { isFirstConnection, count: set.size };
  }

  public unregisterSocket(userId: string, socketId: string): { isLastConnection: boolean; count: number } {
    const set = this.userSockets.get(userId);
    if (!set) {
      return { isLastConnection: true, count: 0 };
    }
    set.delete(socketId);
    if (set.size === 0) {
      this.userSockets.delete(userId);
      return { isLastConnection: true, count: 0 };
    }
    return { isLastConnection: false, count: set.size };
  }

  public isOnline(userId: string): boolean {
    const set = this.userSockets.get(userId);
    return Boolean(set && set.size > 0);
  }

  public getSocketIds(userId: string): string[] {
    const set = this.userSockets.get(userId);
    return set ? Array.from(set) : [];
  }

  public getOnlineCount(): number {
    return this.userSockets.size;
  }
}
