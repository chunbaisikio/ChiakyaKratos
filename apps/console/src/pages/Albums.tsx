import { useEffect, useState } from "react";
import { Camera, FilePlus, Save, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchJson } from "../utils/http";
import { getWorkspaceSession } from "../utils/session";
import { privateImage, type Media } from "../utils/media";
import MediaPicker from "../components/MediaPicker";
type Photo = {
  mediaId: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  takenAt: string;
};
type Album = {
  slug: string;
  title: string;
  date: string;
  kind: "travel" | "daily";
  draft: boolean;
  location: string;
  description: string;
  note: string;
  coverId: string;
  postSlug: string;
  photos: Photo[];
  revision: string | null;
};
type Summary = {
  slug: string;
  title: string;
  date: string;
  draft: boolean;
  photoCount: number;
};
type Post = { slug: string; title: string; draft: boolean };
type Publication = { state: string; message: string; available: boolean };
const blank = (): Album => ({
  slug: `album-${Date.now()}`,
  title: "",
  date: new Date().toISOString(),
  kind: "daily",
  draft: true,
  location: "",
  description: "",
  note: "",
  coverId: "",
  postSlug: "",
  photos: [],
  revision: null,
});
const day = (value: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
function recovery(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const form = JSON.parse(raw) as Album;
      if (
        typeof form.title === "string" &&
        typeof form.slug === "string" &&
        typeof form.note === "string" &&
        Number.isFinite(Date.parse(form.date)) &&
        Array.isArray(form.photos)
      )
        return { form, dirty: true };
    }
  } catch {
    /* Ignore an invalid local recovery copy. */
  }
  return { form: blank(), dirty: false };
}
export default function Albums() {
  const session = getWorkspaceSession();
  const allowed = session?.siteRoles?.includes("editor");
  const recoveryKey = `chiakya-album-active:${session?.userId}`;
  const [initial] = useState(() => recovery(recoveryKey));
  const [form, setForm] = useState<Album>(initial.form);
  const [dirty, setDirty] = useState(initial.dirty);
  const [albums, setAlbums] = useState<Summary[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    initial.dirty ? "已恢复尚未保存的相册。" : "",
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
      fetchJson<{ albums: Summary[] }>("/api/site/albums"),
      fetchJson<{ posts: Post[] }>("/api/site/posts"),
      fetchJson<Publication>("/api/site/publication"),
    ])
      .then(([list, posts, publication]) => {
        if (active) {
          setAlbums(list.albums);
          setPosts(posts.posts);
          setPublication(publication);
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [allowed]);
  useEffect(() => {
    if (dirty)
      try {
        localStorage.setItem(recoveryKey, JSON.stringify(form));
        localStorage.setItem(
          `${recoveryKey}:${form.slug}`,
          JSON.stringify(form),
        );
      } catch {
        /* Local storage may be unavailable; explicit downloads remain available. */
      }
  }, [form, dirty, recoveryKey]);
  useEffect(() => {
    if (publication.state !== "building") return;
    const timer = setInterval(() => {
      fetchJson<Publication>("/api/site/publication")
        .then(setPublication)
        .catch((error) => setMessage(error.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [publication.state]);
  function edit(patch: Partial<Album>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setDirty(true);
  }
  function photo(id: string, patch: Partial<Photo>) {
    setForm((previous) => ({
      ...previous,
      photos: previous.photos.map((item) =>
        item.mediaId === id ? { ...item, ...patch } : item,
      ),
    }));
    setDirty(true);
  }
  async function open(id: string) {
    setBusy(true);
    try {
      const data = await fetchJson<Album>(
        `/api/site/albums/${encodeURIComponent(id)}`,
      );
      const cached = localStorage.getItem(`${recoveryKey}:${id}`);
      const local = cached ? (JSON.parse(cached) as Album) : null;
      if (local && local.revision === data.revision) {
        setForm(local);
        setDirty(true);
        setMessage("已恢复这个相册的未保存修改。");
      } else {
        setForm(data);
        setDirty(false);
        setMessage("");
        localStorage.removeItem(recoveryKey);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "相册读取失败。");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await fetchJson<Album>(
        `/api/site/albums/${encodeURIComponent(form.slug)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      setForm(saved);
      setDirty(false);
      localStorage.removeItem(recoveryKey);
      localStorage.removeItem(`${recoveryKey}:${form.slug}`);
      setAlbums(
        (await fetchJson<{ albums: Summary[] }>("/api/site/albums")).albums,
      );
      setMessage(
        saved.draft
          ? "相册草稿已保存，照片与随记仅编辑者可见。"
          : "相册已保存，更新公开页面后就会展示。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存失败，本地副本会保留。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    try {
      const result = await fetchJson<Publication>("/api/site/publication", {
        method: "POST",
      });
      setPublication({ ...result, available: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败。");
    } finally {
      setBusy(false);
    }
  }
  function add(items: Media[]) {
    setForm((previous) => {
      const photos = [
        ...previous.photos,
        ...items
          .filter(
            (item) =>
              !previous.photos.some((photo) => photo.mediaId === item.id),
          )
          .map((item) => ({
            mediaId: item.id,
            url: item.url,
            thumbnail: item.thumbnail,
            width: item.width,
            height: item.height,
            alt: item.name.replace(/\.[^.]+$/, ""),
            caption: "",
            takenAt: "",
          })),
      ];
      return {
        ...previous,
        photos,
        coverId: previous.coverId || photos[0]?.mediaId || "",
      };
    });
    setDirty(true);
    setPicker(false);
  }
  function reorder(index: number, delta: number) {
    const photos = [...form.photos];
    [photos[index], photos[index + delta]] = [
      photos[index + delta],
      photos[index],
    ];
    edit({ photos });
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(form, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!allowed) return <p>你没有相册编辑权限。</p>;
  const input =
    "block w-full mt-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50 text-sm";
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera size={25} className="text-blue-400" />
            相册与随记
          </h1>
          <p className="text-sm text-slate-400 mt-3">
            记下旅途和日常。照片可以继续用于博客文章，草稿保持私有。
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setForm(blank());
            setDirty(false);
            setMessage("");
            localStorage.removeItem(recoveryKey);
          }}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm flex items-center gap-2"
        >
          <FilePlus size={16} />
          新建相册
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-xs text-slate-400 mb-3">
            我的相册 · {albums.length}
          </h2>
          {albums.map((album) => (
            <button
              type="button"
              key={album.slug}
              disabled={busy}
              onClick={() => void open(album.slug)}
              className={`block w-full text-left rounded-lg p-3 mb-2 text-sm ${form.slug === album.slug ? "bg-blue-500/20" : "bg-slate-900"}`}
            >
              <span>{album.title}</span>
              <span className="block text-xs text-slate-500 mt-2">
                {album.draft ? "草稿" : "待发布 / 公开"} · {album.photoCount}{" "}
                张照片
              </span>
            </button>
          ))}
          <Link to="/posts" className="block text-xs text-blue-300 mt-5">
            前往文章工作台 ↗
          </Link>
          <a
            className="block text-xs text-blue-300 mt-3"
            href="/photos/"
            target="_blank"
            rel="noreferrer"
          >
            查看公开相册 ↗
          </a>
        </aside>
        <div className="min-w-0">
          <fieldset
            disabled={busy}
            className="rounded-xl border border-slate-700 bg-slate-800 p-5 grid gap-5 sm:grid-cols-2"
          >
            <label className="sm:col-span-2 text-sm text-slate-400">
              相册标题
              <input
                className={input}
                value={form.title}
                onChange={(e) => edit({ title: e.target.value })}
                placeholder="例如：秋日海边的两天"
              />
            </label>
            <label className="text-sm text-slate-400">
              相册标识
              <input
                className={input}
                value={form.slug}
                readOnly={form.revision !== null}
                onChange={(e) => edit({ slug: e.target.value })}
              />
              <span className="block text-xs mt-1">
                保存后成为固定的相册地址。
              </span>
            </label>
            <label className="text-sm text-slate-400">
              记录日期
              <input
                type="date"
                className={input}
                value={day(form.date)}
                onChange={(e) => {
                  if (e.target.value)
                    edit({ date: `${e.target.value}T00:00:00+08:00` });
                }}
              />
            </label>
            <label className="text-sm text-slate-400">
              相册分类
              <select
                aria-label="相册分类"
                className={input}
                value={form.kind}
                onChange={(e) =>
                  edit({ kind: e.target.value as Album["kind"] })
                }
              >
                <option value="daily">日常随记</option>
                <option value="travel">旅行</option>
              </select>
            </label>
            <label className="text-sm text-slate-400">
              地点
              <input
                className={input}
                value={form.location}
                onChange={(e) => edit({ location: e.target.value })}
                placeholder="例如：舟山 · 东极岛"
              />
            </label>
            <label className="sm:col-span-2 text-sm text-slate-400">
              相册简介
              <textarea
                aria-label="相册简介"
                rows={2}
                className={input}
                value={form.description}
                onChange={(e) => edit({ description: e.target.value })}
              />
            </label>
            <label className="sm:col-span-2 text-sm text-slate-400">
              这次的随记
              <textarea
                aria-label="这次的随记"
                rows={6}
                className={input}
                value={form.note}
                onChange={(e) => edit({ note: e.target.value })}
                placeholder="天气、遇见的人，或想记住的一件小事…"
              />
            </label>
            <label className="sm:col-span-2 text-sm text-slate-400">
              关联博客文章
              <select
                aria-label="关联博客文章"
                className={input}
                value={form.postSlug}
                onChange={(e) => edit({ postSlug: e.target.value })}
              >
                <option value="">暂不关联</option>
                {posts.map((post) => (
                  <option key={post.slug} value={post.slug}>
                    {post.title}
                    {post.draft ? "（草稿）" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2 text-sm text-slate-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.draft}
                onChange={(e) => edit({ draft: e.target.checked })}
              />
              相册保留为草稿
            </label>
          </fieldset>
          <div className="flex items-center justify-between gap-3 mt-6 mb-4">
            <h2 className="text-lg font-bold">照片 · {form.photos.length}</h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPicker(true)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
            >
              添加照片 / 图片库
            </button>
          </div>
          {form.photos.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              先写一段随记也可以。随时添加照片，再调整顺序和封面。
            </p>
          )}
          <div className="flex flex-col gap-4">
            {form.photos.map((item, index) => (
              <fieldset
                key={item.mediaId}
                disabled={busy}
                className="album-photo-editor rounded-xl border border-slate-700 bg-slate-800 p-4"
              >
                <div>
                  <img
                    src={privateImage(item.thumbnail)}
                    alt={item.alt}
                    className="w-full rounded-lg"
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      aria-label={`向前移动照片 ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => reorder(index, -1)}
                      className="p-2 rounded bg-slate-700 disabled:opacity-30"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`向后移动照片 ${index + 1}`}
                      disabled={index === form.photos.length - 1}
                      onClick={() => reorder(index, 1)}
                      className="p-2 rounded bg-slate-700 disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.coverId === item.mediaId}
                      onClick={() => edit({ coverId: item.mediaId })}
                      className="px-3 py-2 rounded bg-slate-700 text-xs"
                    >
                      {form.coverId === item.mediaId ? "当前封面" : "设为封面"}
                    </button>
                  </div>
                </div>
                <div className="min-w-0 flex flex-col gap-4">
                  <label className="text-sm text-slate-400">
                    照片描述 {index + 1}
                    <input
                      className={input}
                      value={item.alt}
                      onChange={(e) =>
                        photo(item.mediaId, { alt: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    照片随记 {index + 1}
                    <textarea
                      aria-label={`照片随记 ${index + 1}`}
                      rows={3}
                      className={input}
                      value={item.caption}
                      onChange={(e) =>
                        photo(item.mediaId, { caption: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    拍摄日期 {index + 1}
                    <input
                      type="date"
                      className={input}
                      value={item.takenAt}
                      onChange={(e) =>
                        photo(item.mediaId, { takenAt: e.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="self-start text-xs text-red-300"
                    onClick={() => {
                      const photos = form.photos.filter(
                        (photo) => photo.mediaId !== item.mediaId,
                      );
                      edit({
                        photos,
                        coverId:
                          form.coverId === item.mediaId
                            ? photos[0]?.mediaId || ""
                            : form.coverId,
                      });
                    }}
                  >
                    从相册移除
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <button
              type="button"
              disabled={busy || !dirty || !form.title.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-blue-600 disabled:bg-slate-700 px-4 py-2 text-sm flex items-center gap-2"
            >
              <Save size={16} />
              保存相册
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
            >
              下载相册编辑副本
            </button>
          </div>
          <p role="status" className="text-sm text-amber-300 mt-4">
            {message}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">更新公开页面</h2>
          <p className="text-xs text-slate-400 mt-2">
            只更新已保存的公开相册与文章。失败时继续展示上一版本。
          </p>
          <p className="text-sm text-emerald-300 mt-2" role="status">
            {publication.message}
          </p>
        </div>
        <button
          type="button"
          disabled={
            busy ||
            dirty ||
            !publication.available ||
            publication.state === "building"
          }
          onClick={() => void publish()}
          className="rounded-lg bg-emerald-700 disabled:bg-slate-700 px-4 py-2 text-sm"
        >
          更新公开页面
        </button>
      </div>
      {picker && (
        <MediaPicker onSelect={add} onClose={() => setPicker(false)} />
      )}
    </section>
  );
}
