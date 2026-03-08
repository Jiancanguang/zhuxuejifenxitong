import { Badge, HistoryRecord, Student, StudentSortMode } from '../types';
import { getPinyinInitials } from '../utils';

type StudentSortContext = {
  progress?: Record<string, number>;
  badges?: Record<string, Badge[]>;
  history?: HistoryRecord[];
};

const NAME_COLLATOR = new Intl.Collator('zh-Hans-CN-u-co-pinyin', {
  sensitivity: 'base',
  numeric: true,
});

const compareStudentName = (aName: string, bName: string): number => {
  const aInitials = getPinyinInitials(aName);
  const bInitials = getPinyinInitials(bName);
  const initialsCompare = aInitials.localeCompare(bInitials, 'en', { sensitivity: 'base' });
  if (initialsCompare !== 0) return initialsCompare;

  const collatorCompare = NAME_COLLATOR.compare(aName, bName);
  if (collatorCompare !== 0) return collatorCompare;

  return aName.localeCompare(bName, 'zh-CN');
};

const buildHistoryStats = (history: HistoryRecord[]) => {
  const lastActivityMap = new Map<string, number>();
  const checkinsByStudent = new Map<string, Array<{ timestamp: number; score: number }>>();

  for (const record of history) {
    const currentLastActivity = lastActivityMap.get(record.studentId) ?? 0;
    if (record.timestamp > currentLastActivity) {
      lastActivityMap.set(record.studentId, record.timestamp);
    }

    if (record.type === 'checkin') {
      const score = record.scoreValue ?? 1;
      const studentCheckins = checkinsByStudent.get(record.studentId) ?? [];
      studentCheckins.push({ timestamp: record.timestamp, score });
      checkinsByStudent.set(record.studentId, studentCheckins);
    }
  }

  for (const checkins of checkinsByStudent.values()) {
    checkins.sort((a, b) => a.timestamp - b.timestamp);
  }

  return { lastActivityMap, checkinsByStudent };
};

const getFirstReachTime = (
  checkins: Array<{ timestamp: number; score: number }> | undefined,
  progress: number
): number => {
  if (!checkins || checkins.length === 0 || progress <= 0) {
    return Infinity;
  }

  let cumulativeProgress = 0;
  for (const checkin of checkins) {
    cumulativeProgress += checkin.score;
    if (cumulativeProgress >= progress) {
      return checkin.timestamp;
    }
  }

  return checkins[checkins.length - 1].timestamp;
};

export const sortStudentsByMode = (
  students: Student[],
  mode: StudentSortMode,
  context: StudentSortContext = {}
): Student[] => {
  if (students.length <= 1) return [...students];

  const progressMap = context.progress ?? {};
  const badgesMap = context.badges ?? {};
  const history = context.history ?? [];
  const originalOrder = new Map<string, number>(students.map((student, index) => [student.id, index]));

  if (mode === 'manual') {
    return [...students];
  }

  if (mode === 'name') {
    return [...students].sort((a, b) => {
      const nameCompare = compareStudentName(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;
      return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    });
  }

  if (mode === 'progress') {
    return [...students].sort((a, b) => {
      const progressDiff = (progressMap[b.id] || 0) - (progressMap[a.id] || 0);
      if (progressDiff !== 0) return progressDiff;

      const badgeDiff = (badgesMap[b.id]?.length || 0) - (badgesMap[a.id]?.length || 0);
      if (badgeDiff !== 0) return badgeDiff;

      const nameCompare = compareStudentName(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;

      return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    });
  }

  const { lastActivityMap, checkinsByStudent } = buildHistoryStats(history);

  return [...students].sort((a, b) => {
    const aBadgeCount = badgesMap[a.id]?.length || 0;
    const bBadgeCount = badgesMap[b.id]?.length || 0;
    if (bBadgeCount !== aBadgeCount) return bBadgeCount - aBadgeCount;

    const aProgress = progressMap[a.id] || 0;
    const bProgress = progressMap[b.id] || 0;
    if (bProgress !== aProgress) return bProgress - aProgress;

    const aFirstReachTime = getFirstReachTime(checkinsByStudent.get(a.id), aProgress);
    const bFirstReachTime = getFirstReachTime(checkinsByStudent.get(b.id), bProgress);
    if (aFirstReachTime === Infinity && bFirstReachTime === Infinity) {
      const lastActivityDiff = (lastActivityMap.get(b.id) ?? 0) - (lastActivityMap.get(a.id) ?? 0);
      if (lastActivityDiff !== 0) return lastActivityDiff;
      const nameCompare = compareStudentName(a.name, b.name);
      if (nameCompare !== 0) return nameCompare;
      return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    }

    if (aFirstReachTime !== bFirstReachTime) {
      return aFirstReachTime - bFirstReachTime;
    }

    const nameCompare = compareStudentName(a.name, b.name);
    if (nameCompare !== 0) return nameCompare;

    return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
  });
};
