import { useEffect, useState } from "react";
import {
  changeMonth,
  monthDays,
  occursOn,
  shanghaiDate,
} from "../lib/calendar.mjs";

type Entry = {
  id: string;
  title: string;
  description?: string;
  type: string;
  mode: string;
  dayOfWeek?: number[];
  startDate?: string;
  endDate?: string;
};
export default function Calendar({
  entries,
  initialDate,
}: {
  entries: Entry[];
  initialDate: string;
}) {
  const [today, setToday] = useState(initialDate);
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<Entry | null>(null);
  useEffect(() => {
    const current = shanghaiDate();
    setToday(current);
    setMonth(current.slice(0, 7));
  }, []);
  const visible = entries.filter(
    (entry) => type === "all" || entry.type === type,
  );
  const days = monthDays(month);
  const count = days.filter(
    (day) => !day.outside && visible.some((entry) => occursOn(entry, day.date)),
  ).length;
  return (
    <section aria-label="追番日历">
      <div className="calendar-controls">
        <h2>{month.replace("-", " 年 ")} 月</h2>
        <div>
          <button
            onClick={() => {
              setMonth(changeMonth(month, -1));
              setSelected(null);
            }}
            aria-label="上个月"
          >
            ←
          </button>
          <button
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(null);
            }}
          >
            本月
          </button>
          <button
            onClick={() => {
              setMonth(changeMonth(month, 1));
              setSelected(null);
            }}
            aria-label="下个月"
          >
            →
          </button>
          <label className="sr-only" htmlFor="calendar-type">
            剧集类型
          </label>
          <select
            id="calendar-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setSelected(null);
            }}
          >
            <option value="all">全部剧集</option>
            <option value="japanese">日番 / 日剧</option>
            <option value="korean">韩剧</option>
            <option value="chinese">国剧 / 国漫</option>
          </select>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>周{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <div
            key={day.date}
            className={`calendar-day${day.outside ? " is-outside" : ""}${day.date === today ? " is-today" : ""}`}
          >
            <time className="calendar-day-number" dateTime={day.date}>
              {Number(day.date.slice(-2))}
              {day.date === today ? " · 今天" : ""}
            </time>
            {visible
              .filter((entry) => occursOn(entry, day.date))
              .map((entry) => (
                <button
                  key={entry.id}
                  className={`calendar-event ${entry.type}`}
                  onClick={() => setSelected(entry)}
                  aria-label={`${day.date} ${entry.title}，查看详情`}
                >
                  {entry.title}
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="watch-dot japanese" />
          日番 / 日剧
        </span>
        <span>
          <i className="watch-dot korean" />
          韩剧
        </span>
        <span>
          <i className="watch-dot chinese" />
          国剧 / 国漫
        </span>
      </div>
      {!count && (
        <p className="calendar-empty">
          这个月还没有追番安排。切换月份，可以查看之前的记录。
        </p>
      )}
      {selected && (
        <div
          className="calendar-detail"
          role="region"
          aria-label={`${selected.title}详情`}
        >
          <button onClick={() => setSelected(null)}>收起 ×</button>
          <h3>{selected.title}</h3>
          <p>{selected.description || "暂时还没有简介。"}</p>
          <p>
            {selected.mode === "weekly"
              ? `每周${selected.dayOfWeek?.map((day) => ["日", "一", "二", "三", "四", "五", "六"][day]).join("、")}更新`
              : `${selected.startDate} 至 ${selected.endDate}`}
          </p>
        </div>
      )}
    </section>
  );
}
