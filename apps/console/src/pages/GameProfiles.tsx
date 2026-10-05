import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Gamepad2, Plus, Save, Trash2 } from "lucide-react";
import { fetchJson } from "../utils/http";
import { getWorkspaceSession } from "../utils/session";
import { privateImage } from "../utils/media";
import MediaPicker from "../components/MediaPicker";

type Profile = {
  id: string;
  title: string;
  identity: string;
  description: string;
  emblem: string;
  accent: string;
  image: string;
  visible: boolean;
  details: { label: string; value: string }[];
  links: { label: string; url: string }[];
};
type Catalog = { version: 1; profiles: Profile[]; revision: string | null };
type Publication = { state: string; message: string; available: boolean };
const input =
  "block w-full mt-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50 text-sm";
const button =
  "rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-40 hover:bg-slate-800";

function recover(key: string): Catalog | null {
  try {
    const raw = localStorage.getItem(key);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.version === 1 && Array.isArray(saved.profiles)) return saved;
  } catch {
    /* A damaged recovery copy should not block loading the editor. */
  }
  return null;
}
export default function GameProfiles() {
  const session = getWorkspaceSession();
  const allowed = session?.siteRoles?.includes("editor");
  const recoveryKey = `chiakya-game-profiles:${session?.userId}`;
  const [initial] = useState(() => recover(recoveryKey));
  const [catalog, setCatalog] = useState<Catalog>(
    initial || { version: 1, profiles: [], revision: null },
  );
  const [dirty, setDirty] = useState(Boolean(initial));
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [message, setMessage] = useState(
    initial ? "已恢复尚未保存的名片。" : "",
  );
  const [publication, setPublication] = useState<Publication>({
    state: "idle",
    message: "",
    available: false,
  });
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    Promise.all([
      fetchJson<Catalog>("/api/site/game-profiles"),
      fetchJson<Publication>("/api/site/publication"),
    ])
      .then(([saved, state]) => {
        if (!active) return;
        if (!initial) setCatalog(saved);
        else if (initial.revision !== saved.revision)
          setMessage(
            "本地修改已恢复，但服务器名片已更新。请下载副本，再重新读取后合并。 ",
          );
        setPublication(state);
        setLoaded(true);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [allowed, initial]);
  useEffect(() => {
    if (dirty)
      try {
        localStorage.setItem(recoveryKey, JSON.stringify(catalog));
      } catch {
        /* Downloads remain available when local storage is unavailable. */
      }
  }, [catalog, dirty, recoveryKey]);
  useEffect(() => {
    if (publication.state !== "building") return;
    const timer = setInterval(() => {
      fetchJson<Publication>("/api/site/publication")
        .then(setPublication)
        .catch((error) => setMessage(error.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [publication.state]);
  function edit(id: string, patch: Partial<Profile>) {
    setCatalog((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch } : profile,
      ),
    }));
    setDirty(true);
  }
  function add() {
    setCatalog((previous) => ({
      ...previous,
      profiles: [
        ...previous.profiles,
        {
          id: `game-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`,
          title: "新的游戏",
          identity: "",
          description: "",
          emblem: "",
          accent: "#d2e9a3",
          image: "",
          visible: false,
          details: [],
          links: [],
        },
      ],
    }));
    setDirty(true);
  }
  function move(index: number, delta: number) {
    const profiles = [...catalog.profiles];
    [profiles[index], profiles[index + delta]] = [
      profiles[index + delta],
      profiles[index],
    ];
    setCatalog((previous) => ({ ...previous, profiles }));
    setDirty(true);
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(catalog, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "games.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function reload() {
    if (
      dirty &&
      !window.confirm(
        "重新读取会放弃当前未保存的修改。建议先下载副本，确定继续吗？",
      )
    )
      return;
    setBusy(true);
    try {
      setCatalog(await fetchJson<Catalog>("/api/site/game-profiles"));
      setDirty(false);
      setLoaded(true);
      localStorage.removeItem(recoveryKey);
      setMessage("已读取服务器上的名片。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败。");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const saved = await fetchJson<Catalog>("/api/site/game-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog),
      });
      setCatalog(saved);
      setDirty(false);
      localStorage.removeItem(recoveryKey);
      setMessage("名片已保存，更新公开页面后生效。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存失败，本地修改会保留。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    try {
      setPublication({
        ...(await fetchJson<Publication>("/api/site/publication", {
          method: "POST",
        })),
        available: true,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败。");
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return <p>你没有名片编辑权限。</p>;
  const locked = busy || !loaded || publication.state === "building";
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gamepad2 size={25} className="text-blue-400" />
            游戏名片
          </h1>
          <p className="text-sm text-slate-400 mt-3">
            添加你想展示的游戏和信息。首页展示前三张公开名片，游戏页展示全部公开名片。
          </p>
        </div>
        <a href="/games/" target="_blank" rel="noreferrer" className={button}>
          查看公开页面 ↗
        </a>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          className={`${button} flex gap-2 items-center`}
          disabled={locked || catalog.profiles.length >= 40}
          onClick={add}
        >
          <Plus size={17} />
          添加游戏名片
        </button>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm flex gap-2 items-center disabled:opacity-40"
          disabled={locked || !dirty}
          onClick={() => void save()}
        >
          <Save size={17} />
          保存名片
        </button>
        <button
          type="button"
          className={button}
          disabled={locked || dirty || !publication.available}
          onClick={() => void publish()}
        >
          更新公开页面
        </button>
        <button type="button" className={button} onClick={download}>
          下载副本
        </button>
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => void reload()}
        >
          重新读取
        </button>
        {dirty && (
          <span className="text-xs text-amber-300">有未保存的修改</span>
        )}
      </div>
      <div role="status" className="text-sm text-amber-300 whitespace-pre-wrap">
        {message && <p>{message}</p>}
        {publication.message && <p className="mt-2">{publication.message}</p>}
      </div>
      {!loaded && <p className="text-slate-400">正在读取名片…</p>}
      {loaded && !catalog.profiles.length && (
        <p className="text-slate-400">还没有名片，添加一个喜欢的游戏吧。</p>
      )}
      {catalog.profiles.map((profile, index) => (
        <fieldset
          key={profile.id}
          data-profile-editor={profile.id}
          disabled={locked}
          className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:p-6"
        >
          <legend className="px-2 font-semibold text-blue-300">
            {index + 1}. {profile.title || "新的游戏"}
          </legend>
          <div className="flex flex-wrap justify-between gap-3 mb-5">
            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={profile.visible}
                onChange={(event) =>
                  edit(profile.id, { visible: event.target.checked })
                }
              />
              公开展示这张名片
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className={button}
                aria-label={`上移${profile.title}`}
                disabled={locked || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className={button}
                aria-label={`下移${profile.title}`}
                disabled={locked || index === catalog.profiles.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className={button}
                aria-label={`删除${profile.title}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      `删除「${profile.title}」名片？保存并更新公开页面后生效。`,
                    )
                  )
                    return;
                  setCatalog((previous) => ({
                    ...previous,
                    profiles: previous.profiles.filter(
                      (item) => item.id !== profile.id,
                    ),
                  }));
                  setDirty(true);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              游戏名称
              <input
                className={input}
                maxLength={100}
                value={profile.title}
                onChange={(event) =>
                  edit(profile.id, { title: event.target.value })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              昵称或角色
              <input
                className={input}
                maxLength={120}
                value={profile.identity}
                onChange={(event) =>
                  edit(profile.id, { identity: event.target.value })
                }
              />
            </label>
            <div className="sm:col-span-2">
              <label
                htmlFor={`description-${profile.id}`}
                className="text-sm text-slate-300"
              >
                名片简介
              </label>
              <textarea
                id={`description-${profile.id}`}
                className={input}
                rows={2}
                maxLength={500}
                value={profile.description}
                onChange={(event) =>
                  edit(profile.id, { description: event.target.value })
                }
              />
            </div>
            <label className="text-sm text-slate-300">
              文字标记
              <input
                className={input}
                maxLength={8}
                placeholder="例如 XIV / HBR"
                value={profile.emblem}
                onChange={(event) =>
                  edit(profile.id, { emblem: event.target.value })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              名片颜色
              <input
                type="color"
                className="block mt-2 h-10 w-20 rounded bg-slate-950"
                value={profile.accent}
                onChange={(event) =>
                  edit(profile.id, { accent: event.target.value })
                }
              />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-4 items-center">
              {profile.image && (
                <img
                  src={privateImage(profile.image)}
                  alt={`${profile.title}头像预览`}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-xl object-cover"
                />
              )}
              <button
                type="button"
                className={button}
                onClick={() => setPicker(profile.id)}
              >
                选择或上传头像
              </button>
              {profile.image && (
                <button
                  type="button"
                  className={button}
                  onClick={() => edit(profile.id, { image: "" })}
                >
                  移除头像
                </button>
              )}
              <label className="text-sm text-slate-300 min-w-0 flex-1 basis-64">
                头像地址
                <input
                  className={input}
                  maxLength={2000}
                  placeholder="图片库地址或 HTTPS 链接"
                  value={profile.image}
                  onChange={(event) =>
                    edit(profile.id, { image: event.target.value })
                  }
                />
              </label>
            </div>
          </div>
          <div className="mt-6">
            <h2 className="font-semibold text-sm">自定义信息</h2>
            <p className="text-xs text-slate-400 mt-2">
              按需添加服务器、UID、公会等。公开名片上的信息可以一键复制。
            </p>
            {profile.details.map((detail, fieldIndex) => (
              <div key={fieldIndex} className="flex items-end gap-2 mt-3">
                <label className="text-xs text-slate-300 w-1/3">
                  信息名称
                  <input
                    className={input}
                    maxLength={40}
                    value={detail.label}
                    onChange={(event) =>
                      edit(profile.id, {
                        details: profile.details.map((item, i) =>
                          i === fieldIndex
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300 flex-1 min-w-0">
                  信息内容
                  <input
                    className={input}
                    maxLength={300}
                    value={detail.value}
                    onChange={(event) =>
                      edit(profile.id, {
                        details: profile.details.map((item, i) =>
                          i === fieldIndex
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={button}
                  aria-label={`删除信息 ${fieldIndex + 1}`}
                  onClick={() =>
                    edit(profile.id, {
                      details: profile.details.filter(
                        (_, i) => i !== fieldIndex,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={`${button} mt-3`}
              disabled={locked || profile.details.length >= 12}
              onClick={() =>
                edit(profile.id, {
                  details: [...profile.details, { label: "", value: "" }],
                })
              }
            >
              添加信息
            </button>
          </div>
          <div className="mt-6">
            <h2 className="font-semibold text-sm">名片链接</h2>
            <p className="text-xs text-slate-400 mt-2">
              填写 HTTPS 地址或本站路径，例如 Steam 主页、图鉴、游戏博客。
            </p>
            {profile.links.map((entry, linkIndex) => (
              <div
                key={linkIndex}
                className="flex flex-wrap items-end gap-2 mt-3"
              >
                <label className="text-xs text-slate-300 flex-1 min-w-0 basis-32">
                  链接名称
                  <input
                    className={input}
                    maxLength={60}
                    value={entry.label}
                    onChange={(event) =>
                      edit(profile.id, {
                        links: profile.links.map((item, i) =>
                          i === linkIndex
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-slate-300 flex-1 min-w-0 basis-64">
                  链接地址
                  <input
                    className={input}
                    maxLength={2000}
                    value={entry.url}
                    onChange={(event) =>
                      edit(profile.id, {
                        links: profile.links.map((item, i) =>
                          i === linkIndex
                            ? { ...item, url: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={button}
                  aria-label={`删除链接 ${linkIndex + 1}`}
                  onClick={() =>
                    edit(profile.id, {
                      links: profile.links.filter((_, i) => i !== linkIndex),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={`${button} mt-3`}
              disabled={locked || profile.links.length >= 4}
              onClick={() =>
                edit(profile.id, {
                  links: [...profile.links, { label: "", url: "" }],
                })
              }
            >
              添加链接
            </button>
          </div>
        </fieldset>
      ))}
      {picker && (
        <MediaPicker
          multiple={false}
          onClose={() => setPicker(null)}
          onSelect={(items) => {
            if (items[0]) edit(picker, { image: items[0].thumbnail });
            setPicker(null);
          }}
        />
      )}
    </section>
  );
}
