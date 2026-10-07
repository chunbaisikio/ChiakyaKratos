import { describe, it, expect } from 'vitest';
import { buildReport } from './report';
import type { Team, BossProfile, MistakeRecord } from '../store';
const team: Team = { id: 't', name: '测试队', bossId: 'b', players: [{ id: 'u', name: '私密姓名', role: 'MT', job: 'DRK', status: 'on_field' }] };
const boss: BossProfile = { id: 'b', name: '测试副本', parts: [{ id: 'p', name: 'P1', maxDuration: '', mechanics: [{ id: 'm', shortName: '机制|A', officialName: '', startTime: '', endTime: '', notes: '', errorPoints: [] }] }] };
const record = (date: string, pullNumber: number, extras = {}): MistakeRecord => ({ id: `${date}-${pullNumber}`, teamId: 't', date, timestamp: 1, partId: 'p', mechanicId: 'm', errorPointId: '', playerId: 'u', roundTime: '', note: '不应公开的备注', pullNumber, ...extras });
describe('review drafts', () => {
  it('filters team/date, sums daily pulls and excludes celebrations from mistake counts', () => {
    const report = buildReport(team, boss, [record('2026-10-01', 4), record('2026-10-01', 6), record('2026-10-02', 3), record('2026-10-02', 5, { isCelebration: true }), record('2026-09-30', 8), record('2026-10-01', 100, { teamId: 'other' })], '2026-10-01', '2026-10-02');
    expect(report.records).toBe(3); expect(report.days).toBe(2); expect(report.pulls).toBe(11);
    expect(report.markdown).toContain('机制\\|A'); expect(report.markdown).toContain('draft: true');
    expect(report.markdown).not.toContain('私密姓名'); expect(report.markdown).not.toContain('不应公开的备注');
  });
  it('only includes player names when explicitly selected', () => { expect(buildReport(team, boss, [record('2026-10-01', 1)], '', '', true).markdown).toContain('私密姓名'); });
});
