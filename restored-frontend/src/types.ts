export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export type KickReason = 'disabled' | 'kicked' | null;

export type StudentSortMode = 'manual' | 'name' | 'leaderboard' | 'progress';

export type ReuseConfigField = 'scoreItems' | 'storeItems' | 'levelConfig';

export interface PetBreed {
  id: string;
  name: string;
  folder: string;
  [key: string]: any;
}

export interface Badge {
  id: string;
  petId: string;
  petName?: string | null;
  earnedAt: number;
  [key: string]: any;
}

export interface ScoreItem {
  id: string;
  name: string;
  icon: string;
  score: number;
  [key: string]: any;
}

export interface RewardItem {
  id: string;
  name: string;
  description?: string;
  cost: number;
  icon: string;
  color?: string;
  [key: string]: any;
}

export interface Student {
  id: string;
  name: string;
  groupId?: string | null;
  petNickname?: string | null;
  petId?: string;
  petStage?: number;
  foodCount?: number;
  spentFood?: number;
  badges?: Badge[];
  [key: string]: any;
}

export interface Group {
  id: string;
  name: string;
  colorToken?: string | null;
  order?: number;
  sortOrder?: number;
  [key: string]: any;
}

export interface HistoryRecord {
  id: string;
  type: 'checkin' | 'graduate' | 'redeem' | 'revoke' | 'rename' | string;
  timestamp: number;
  studentId: string;
  studentName: string;
  scoreItemName?: string;
  scoreValue?: number;
  taskName?: string;
  petId?: string;
  rewardId?: string;
  rewardName?: string;
  cost?: number;
  batchId?: string;
  revokedRecordId?: string;
  revokedScoreItemName?: string;
  revokedScoreValue?: number;
  renameFrom?: string;
  renameTo?: string;
  [key: string]: any;
}

export interface RedemptionRecord extends HistoryRecord {
  type: 'redeem' | string;
}

export interface ClassState {
  id: string;
  title: string;
  students: Student[];
  groups: Group[];
  progress: Record<string, number>;
  petSelections: Record<string, string>;
  petStages: Record<string, number>;
  badges: Record<string, Badge[]>;
  history: HistoryRecord[];
  redemptions: RedemptionRecord[];
  inventory: Record<string, number>;
  rewards: RewardItem[];
  scoreItems: ScoreItem[];
  targetCount: number;
  stageThresholds: number[];
  studentSortMode?: StudentSortMode;
  themeId: string;
  [key: string]: any;
}

export interface GlobalState {
  systemTitle: string;
  currentClassId: string;
  classes: Record<string, ClassState>;
  [key: string]: any;
}

export interface User {
  id: string;
  username: string;
  isActivated: boolean;
  currentClassId?: string | null;
  systemTitle?: string;
  created?: string;
  [key: string]: any;
}

export interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  kickReason: KickReason;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearKickReason: () => void;
}

export interface CreateHistoryRecord {
  studentId: string;
  studentName?: string;
  type?: HistoryRecord['type'];
  scoreItemName?: string;
  scoreValue?: number;
  taskName?: string;
  petId?: string;
  rewardId?: string;
  rewardName?: string;
  cost?: number;
  batchId?: string;
  [key: string]: any;
}

export interface RevokeStudentState {
  id: string;
  foodCount: number;
  spentFood?: number;
  petStage: number;
  petId?: string;
  badges?: Badge[];
  [key: string]: any;
}

export interface RevokeResult {
  alreadyRevoked?: boolean;
  revokeRecord: HistoryRecord;
  student?: RevokeStudentState;
  [key: string]: any;
}

export interface RevokeBatchResult {
  revokeRecords: HistoryRecord[];
  students: RevokeStudentState[];
  skippedCount: number;
  [key: string]: any;
}

export interface ResetClassProgressResult {
  [key: string]: any;
}
