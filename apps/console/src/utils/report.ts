import type { BossProfile, MistakeRecord, Team } from "../store";

const cell = (value: string) =>
  value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
export function buildReport(
  team: Team,
  boss: BossProfile,
  allRecords: MistakeRecord[],
  start: string,
  end: string,
  includeNames = false,
  notes = "",
) {
  const selected = allRecords.filter(
    (record) =>
      record.teamId === team.id &&
      (!start || record.date >= start) &&
      (!end || record.date <= end),
  );
  const records = selected.filter((record) => !record.isCelebration);
  const days = new Map<string, number>();
  selected.forEach((record) =>
    days.set(
      record.date,
      Math.max(days.get(record.date) || 0, record.pullNumber || 0),
    ),
  );
  const mechanics = new Map<string, { name: string; count: number }>();
  records.forEach((record) => {
    const part = boss.parts.find((part) => part.id === record.partId);
    const mechanic = part?.mechanics.find(
      (mechanic) => mechanic.id === record.mechanicId,
    );
    const key = `${record.partId}:${record.mechanicId}`;
    const previous = mechanics.get(key);
    mechanics.set(key, {
      name: `${part?.name || "未分类阶段"} / ${mechanic?.shortName || mechanic?.officialName || "未分类机制"}`,
      count: (previous?.count || 0) + 1,
    });
  });
  const ranked = [...mechanics.values()].sort((a, b) => b.count - a.count);
  const title = `${boss.name} · ${team.name} 复盘手记`;
  const date = new Date().toISOString();
  const header = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${JSON.stringify(date)}`,
    "categories:",
    "  - 游戏随笔",
    "tags:",
    "  - FF14",
    "  - 固定队",
    "  - 复盘",
    "draft: true",
    "---",
    "",
  ];
  const lines = [
    ...header,
    `记录范围：${start || "最早记录"} 至 ${end || "最新记录"}。`,
    "",
    "## 这次开荒",
    "",
    `- 副本：${cell(boss.name)}`,
    `- 记录天数：${days.size}`,
    `- 记录覆盖把数：${[...days.values()].reduce((sum, value) => sum + value, 0)}`,
    `- 犯错记录：${records.length}`,
    "",
    "> 把数按每天记录中的最大把数汇总，仅反映已记录的数据。庆祝记录不计入犯错统计。",
    "",
    "## 需要再练一练的机制",
    "",
    "| 阶段 / 机制 | 记录次数 |",
    "| --- | ---: |",
    ...ranked.map((item) => `| ${cell(item.name)} | ${item.count} |`),
    ...(ranked.length ? [] : ["| 暂无犯错记录 | 0 |"]),
    "",
  ];
  if (includeNames) {
    lines.push("## 队员记录", "", "| 队员 | 犯错记录 |", "| --- | ---: |");
    const counts = new Map<string, number>();
    records.forEach((record) =>
      counts.set(record.playerId, (counts.get(record.playerId) || 0) + 1),
    );
    counts.forEach((count, id) =>
      lines.push(
        `| ${cell(team.players.find((player) => player.id === id)?.name || "已离队 / 未知队员")} | ${count} |`,
      ),
    );
    lines.push("");
  }
  lines.push(
    "## 下一次的计划",
    "",
    notes.trim() || "补充这次的发现、需要调整的细节，以及下一次的练习计划。",
    "",
    "## 一起走过的日子",
    "",
    "在这里写下那些统计之外的共同经历。",
    "",
  );
  return {
    title,
    markdown: lines.join("\n"),
    records: records.length,
    days: days.size,
    pulls: [...days.values()].reduce((sum, value) => sum + value, 0),
  };
}
