export enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  TALKING = 'TALKING',
}

export enum ActionType {
  OPEN_URL = 'OPEN_URL',
  SEARCH = 'SEARCH',
  NONE = 'NONE',
}

export interface AIResponse {
  message: string;
  action: ActionType;
  value: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'user' | 'ai';
  text: string;
  action?: {
    type: ActionType;
    value: string;
  };
}