export interface EventLogEntry {
  timestamp: number;
  action: string;
  selector?: string;
  text?: string;
}

export interface NarrationSegment {
  start: number;
  end: number;
  text: string;
}

export interface PRInfo {
  branch: string;
  commitMessage: string;
}

export interface RunOptions {
  projectDir: string;
  startCmd: string;
  readyUrl: string;
  port: number;
}
