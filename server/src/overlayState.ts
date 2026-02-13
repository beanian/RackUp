import type { Response } from "express";

interface OverlayPlayer {
  id: string;
  name: string;
  nickname?: string;
  emoji?: string;
  score: number;
}

interface OverlayState {
  visible: boolean;
  isRecording: boolean;
  playerA: OverlayPlayer | null;
  playerB: OverlayPlayer | null;
  sessionDate: string | null;
  frameNumber: number;
  lastWinnerId: string | null;
}

export class OverlayStateManager {
  private state: OverlayState = {
    visible: false,
    isRecording: false,
    playerA: null,
    playerB: null,
    sessionDate: null,
    frameNumber: 0,
    lastWinnerId: null,
  };

  private clients: Set<Response> = new Set();
  private keepaliveInterval: NodeJS.Timeout | null = null;

  getState(): OverlayState {
    return { ...this.state };
  }

  addClient(res: Response): void {
    this.clients.add(res);

    if (this.clients.size === 1) {
      this.startKeepalive();
    }

    // Send current state as initial match_update event
    this.sendToClient(res, "match_update", this.state);
  }

  removeClient(res: Response): void {
    this.clients.delete(res);

    if (this.clients.size === 0) {
      this.stopKeepalive();
    }
  }

  private broadcast(eventType: string, data: OverlayState): void {
    for (const client of this.clients) {
      this.sendToClient(client, eventType, data);
    }
  }

  private sendToClient(res: Response, eventType: string, data: OverlayState): void {
    try {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(res);
    }
  }

  updateMatch(
    playerA: OverlayPlayer | null,
    playerB: OverlayPlayer | null,
    sessionDate: string | null,
    frameNumber: number,
  ): void {
    this.state.playerA = playerA;
    this.state.playerB = playerB;
    this.state.sessionDate = sessionDate;
    this.state.frameNumber = frameNumber;
    this.state.lastWinnerId = null;
    this.broadcast("match_update", this.state);
  }

  updateScore(winnerId: string, playerAScore: number, playerBScore: number): void {
    if (this.state.playerA) {
      this.state.playerA.score = playerAScore;
    }
    if (this.state.playerB) {
      this.state.playerB.score = playerBScore;
    }
    this.state.lastWinnerId = winnerId;
    this.broadcast("score_update", this.state);
  }

  setVisibility(visible: boolean): void {
    this.state.visible = visible;
    this.broadcast("visibility", this.state);
  }

  setRecording(isRecording: boolean): void {
    this.state.isRecording = isRecording;
    this.broadcast("recording_status", this.state);
  }

  updateFull(partial: Partial<OverlayState>): void {
    Object.assign(this.state, partial);
    this.broadcast("match_update", this.state);
  }

  private startKeepalive(): void {
    this.keepaliveInterval = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.write(":keepalive\n\n");
        } catch {
          this.clients.delete(client);
        }
      }
    }, 15_000);
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }
}

export const overlayState = new OverlayStateManager();
