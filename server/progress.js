export function buildTeamProgressRows(snapshot, workspace) {
  const state = snapshot?.state || snapshot || {};
  return (state.teams || []).flatMap((team) => {
    const boss = (state.bossProfiles || []).find(
      (item) => item.id === team.bossId,
    );
    if (!boss) return [];
    const parts = boss.parts || [];
    const mechanics = parts.flatMap((part) =>
      (part.mechanics || []).map((mechanic) => ({
        id: mechanic.id,
        label: `${part.name} / ${mechanic.shortName || mechanic.officialName}`,
      })),
    );
    const records = (state.mistakes || []).filter(
      (item) => item.teamId === team.id && !item.isCelebration,
    );
    const maxPart = records.reduce(
      (max, record) =>
        Math.max(
          max,
          parts.findIndex((part) => part.id === record.partId),
        ),
      -1,
    );
    const maxMechanic = records.reduce(
      (max, record) =>
        Math.max(
          max,
          mechanics.findIndex((mechanic) => mechanic.id === record.mechanicId),
        ),
      -1,
    );
    const dailyPulls = new Map();
    records.forEach((record) =>
      dailyPulls.set(
        record.date,
        Math.max(dailyPulls.get(record.date) || 0, record.pullNumber || 0),
      ),
    );
    return [
      {
        ...workspace,
        bossId: boss.id,
        bossName: boss.name,
        teamId: team.id,
        teamName: team.name,
        currentPart: parts[maxPart]?.name || "未开荒",
        currentMechanic: mechanics[maxMechanic]?.label || "未触达",
        activeDays: dailyPulls.size,
        totalPulls: [...dailyPulls.values()].reduce(
          (sum, value) => sum + value,
          0,
        ),
        progressScore: maxMechanic + 1,
        partScore: maxPart + 1,
      },
    ];
  });
}
