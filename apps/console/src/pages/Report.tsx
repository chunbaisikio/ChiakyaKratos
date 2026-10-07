import { useMemo, useState } from "react";
import { FileDown, FileText, Copy, Package } from "lucide-react";
import { useAppStore } from "../store";
import { buildReport } from "../utils/report";

function download(value: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
export default function Report() {
  const { teams, activeTeamId, setActiveTeam, bossProfiles, mistakes } =
    useAppStore();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [includeNames, setIncludeNames] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const team = teams.find((team) => team.id === activeTeamId) || teams[0];
  const boss = bossProfiles.find((boss) => boss.id === team?.bossId);
  const invalidRange = Boolean(start && end && start > end);
  const report = useMemo(
    () =>
      team && boss && !invalidRange
        ? buildReport(team, boss, mistakes, start, end, includeNames, notes)
        : null,
    [team, boss, mistakes, start, end, includeNames, notes, invalidRange],
  );
  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setMessage("草稿已复制，可以继续补充文字。");
    } catch {
      setMessage("复制失败，请下载 Markdown 草稿。");
    }
  }
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText size={25} className="text-blue-400" />
          复盘手记
        </h1>
        <p className="text-sm text-slate-400 mt-3">
          把一次开荒的记录整理成文章草稿。草稿默认隐藏队员姓名，补充文字后再决定是否公开。
        </p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 grid gap-5 sm:grid-cols-3">
        <label className="text-sm text-slate-400">
          队伍
          <select
            className="mt-2 block w-full rounded bg-slate-900 border border-slate-600 px-3 py-2 text-slate-50"
            value={team?.id || ""}
            onChange={(event) => setActiveTeam(event.target.value)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-400">
          开始日期
          <input
            type="date"
            className="mt-2 block w-full rounded bg-slate-900 border border-slate-600 px-3 py-2 text-slate-50"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="text-sm text-slate-400">
          结束日期
          <input
            type="date"
            className="mt-2 block w-full rounded bg-slate-900 border border-slate-600 px-3 py-2 text-slate-50"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="sm:col-span-3 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={includeNames}
            onChange={(event) => setIncludeNames(event.target.checked)}
          />
          在草稿中包含队员姓名统计
        </label>
        <label className="sm:col-span-3 text-sm text-slate-400">
          下一次的计划
          <textarea
            rows={3}
            className="mt-2 w-full rounded bg-slate-900 border border-slate-600 p-3 text-slate-50"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="想再练哪些机制？有哪些细节需要调整？"
          />
        </label>
      </div>
      {invalidRange && (
        <p role="alert" className="text-amber-300">
          结束日期应晚于或等于开始日期。
        </p>
      )}
      {report ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              ["记录天数", report.days],
              ["记录覆盖把数", report.pulls],
              ["犯错记录", report.records],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-3xl text-slate-50 font-semibold mt-2">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm"
              onClick={() =>
                download(
                  report.markdown,
                  `ff14-review-${Date.now()}.md`,
                  "text/markdown;charset=utf-8",
                )
              }
            >
              <FileDown size={17} />
              下载 Markdown 草稿
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm"
              onClick={copy}
            >
              <Copy size={17} />
              复制草稿
            </button>
            {boss && (
              <button
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm"
                onClick={() =>
                  download(
                    JSON.stringify(boss, null, 2),
                    `ff14-template-${boss.id}.json`,
                    "application/json",
                  )
                }
              >
                <Package size={17} />
                导出配套副本模板
              </button>
            )}
          </div>
          <p className="text-sm text-emerald-300" role="status">
            {message}
          </p>
          <details
            className="rounded-xl border border-slate-700 bg-slate-950 p-5"
            open
          >
            <summary className="text-sm text-slate-300 cursor-pointer">
              查看文章草稿
            </summary>
            <pre className="mt-5 text-sm text-slate-400 whitespace-pre-wrap break-words leading-7">
              {report.markdown}
            </pre>
          </details>
        </>
      ) : (
        !invalidRange && (
          <p className="text-slate-400">
            先创建队伍并选择副本，再来整理复盘手记。
          </p>
        )
      )}
    </section>
  );
}
