import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FilePlus,
  Save,
  Eye,
  ImagePlus,
  Globe,
  Download,
} from "lucide-react";
import { fetchJson } from "../utils/http";
import { getWorkspaceSession } from "../utils/session";
import { Link } from "react-router-dom";
import MediaPicker from "../components/MediaPicker";
import { markdownImage, type Media } from "../utils/media";

type Form = {
  slug: string;
  title: string;
  body: string;
  date: string;
  draft: boolean;
  cover: string;
  template: string;
  tags: string;
  categories: string;
  revision: string | null;
};
type Post = { slug: string; title: string; date: string; draft: boolean };
type Document = {
  slug: string;
  metadata: Record<string, unknown>;
  body: string;
  revision: string;
};
type Publication = {
  state: "idle" | "building" | "complete" | "failed";
  message: string;
  available: boolean;
};
const dateInput = (value: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(value))
    .replace(" ", "T");
const blank = (): Form => ({
  slug: `note-${Date.now()}`,
  title: "",
  body: "",
  date: new Date().toISOString(),
  draft: true,
  cover: "",
  template: "",
  tags: "",
  categories: "",
  revision: null,
});
const joinList = (value: unknown) =>
  Array.isArray(value)
    ? value.join(", ")
    : typeof value === "string"
      ? value
      : "";
const splitList = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

function recoverDraft(userId?: string): { form: Form; dirty: boolean } {
  try {
    const raw = localStorage.getItem(`chiakya-editor-active-draft:${userId}`);
    if (raw) {
      const form = JSON.parse(raw) as Form;
      const fields = [
        form.slug,
        form.title,
        form.body,
        form.date,
        form.cover,
        form.template,
        form.tags,
        form.categories,
      ];
      if (
        fields.every((value) => typeof value === "string") &&
        Number.isFinite(Date.parse(form.date)) &&
        typeof form.draft === "boolean" &&
        (form.revision === null || typeof form.revision === "string")
      ) {
        return { form, dirty: true };
      }
    }
  } catch {
    // An invalid browser recovery copy must not prevent opening the editor.
  }
  return { form: blank(), dirty: false };
}

export default function Editor() {
  const session = getWorkspaceSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [recovered] = useState(() => recoverDraft(session?.userId));
  const [form, setForm] = useState<Form>(recovered.form);
  const [dirty, setDirty] = useState(recovered.dirty);
  const [message, setMessage] = useState(
    recovered.dirty ? "已恢复上次尚未保存的本地草稿。" : "",
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [publication, setPublication] = useState<Publication>({
    state: "idle",
    message: "",
    available: false,
  });
  const imageInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const insertion = useRef({ start: 0, end: 0 });
  const [mediaMode, setMediaMode] = useState<"body" | "cover" | null>(null);
  const allowed = session?.siteRoles?.includes("editor");
  const draftKey = `chiakya-editor-draft:${session?.userId}:${form.slug}`;
  const activeDraftKey = `chiakya-editor-active-draft:${session?.userId}`;
  useEffect(() => {
    if (!allowed) return;
    Promise.all([
      fetchJson<{ posts: Post[] }>("/api/site/posts"),
      fetchJson<Publication>("/api/site/publication"),
    ])
      .then(([data, publication]) => {
        setPosts(data.posts);
        setPublication(publication);
      })
      .catch((error) => setMessage(error.message));
  }, [allowed]);
  useEffect(() => {
    if (dirty)
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
        localStorage.setItem(activeDraftKey, JSON.stringify(form));
      } catch {
        // Writing remains available when the browser cannot store recovery copies.
      }
  }, [form, dirty, draftKey, activeDraftKey]);
  useEffect(() => {
    if (publication.state !== "building") return;
    const timer = window.setInterval(() => {
      fetchJson<Publication>("/api/site/publication")
        .then(setPublication)
        .catch((error) => setMessage(error.message));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [publication.state]);
  function edit(patch: Partial<Form>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setDirty(true);
    setPreview("");
  }
  async function open(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const data = await fetchJson<Document>(
        `/api/site/posts/${encodeURIComponent(id)}`,
      );
      const next: Form = {
        slug: data.slug,
        title: String(data.metadata.title || ""),
        body: data.body,
        date: String(data.metadata.date || new Date().toISOString()),
        draft: data.metadata.draft === true,
        cover: String(data.metadata.cover || ""),
        template: String(data.metadata.template || ""),
        tags: joinList(data.metadata.tags),
        categories: joinList(data.metadata.categories),
        revision: data.revision,
      };
      const cached = localStorage.getItem(
        `chiakya-editor-draft:${session?.userId}:${id}`,
      );
      const local = cached ? (JSON.parse(cached) as Form) : null;
      if (local && local.revision === next.revision) {
        setForm(local);
        setDirty(true);
        setMessage("已恢复这篇文章尚未保存的本地草稿。");
      } else {
        setForm(next);
        setDirty(false);
      }
      setPreview("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打开文章失败。");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const data = await fetchJson<Document>(
        `/api/site/posts/${encodeURIComponent(form.slug)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            tags: splitList(form.tags),
            categories: splitList(form.categories),
          }),
        },
      );
      setForm((previous) => ({ ...previous, revision: data.revision }));
      setDirty(false);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(activeDraftKey);
      setPosts((await fetchJson<{ posts: Post[] }>("/api/site/posts")).posts);
      setMessage(
        form.draft
          ? "草稿已保存，仅编辑者可见。"
          : "文章已保存。更新公开页面后，读者会看到这一版。",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存失败。本地草稿会保留。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showPreview() {
    setBusy(true);
    try {
      const result = await fetchJson<{ html: string }>("/api/site/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: form.body }),
      });
      setPreview(
        result.html.replace(
          /src="\/assets\/uploads\/([^"/]+)"/g,
          'src="/api/site/image/$1"',
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "预览失败。");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("图片读取失败。"));
        reader.readAsDataURL(file);
      });
      const result = await fetchJson<{ url: string }>("/api/site/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64 }),
      });
      edit({ cover: result.url });
      setMessage("封面已上传，保存文章后会与文章一起更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }
  async function importMarkdown(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const data = await fetchJson<Omit<Document, "slug" | "revision">>(
        "/api/site/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: await file.text() }),
        },
      );
      setForm({
        ...blank(),
        title: String(data.metadata.title || ""),
        body: data.body,
        tags: joinList(data.metadata.tags),
        categories: joinList(data.metadata.categories),
        cover: String(data.metadata.cover || ""),
        template: String(data.metadata.template || ""),
      });
      setDirty(true);
      setPreview("");
      setMessage("Markdown 已导入为新草稿，请检查内容并保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setBusy(false);
      if (markdownInput.current) markdownInput.current.value = "";
    }
  }
  async function uploadTemplate(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const data = await fetchJson<{ url: string }>("/api/site/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: JSON.parse(await file.text()) }),
      });
      edit({ template: data.url });
      setMessage("副本模板已关联，文章公开后读者可以下载。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模板导入失败。");
    } finally {
      setBusy(false);
      if (templateInput.current) templateInput.current.value = "";
    }
  }
  function download() {
    const metadata = [
      "---",
      `title: ${JSON.stringify(form.title)}`,
      `date: ${JSON.stringify(form.date)}`,
      `draft: ${form.draft}`,
      `tags: ${JSON.stringify(splitList(form.tags))}`,
      `categories: ${JSON.stringify(splitList(form.categories))}`,
      ...(form.cover ? [`cover: ${JSON.stringify(form.cover)}`] : []),
      ...(form.template ? [`template: ${JSON.stringify(form.template)}`] : []),
      "---",
      "",
      form.body,
    ];
    const url = URL.createObjectURL(
      new Blob([metadata.join("\n")], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${form.slug}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function publish() {
    setBusy(true);
    try {
      const result = await fetchJson<Publication>("/api/site/publication", {
        method: "POST",
      });
      setPublication({ ...result, available: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败。");
    } finally {
      setBusy(false);
    }
  }
  function chooseMedia(items: Media[]) {
    if (mediaMode === "cover") {
      edit({ cover: items[0].url });
      setMessage("图片库封面已选择，保存文章后即可发布。");
    } else {
      const images = `\n\n${items.map((item) => markdownImage(item.url, item.name.replace(/\.[^.]+$/, ""))).join("\n\n")}\n\n`;
      const { start, end } = insertion.current;
      edit({ body: form.body.slice(0, start) + images + form.body.slice(end) });
      setMessage(`已插入 ${items.length} 张照片，保存文章后即可发布。`);
      requestAnimationFrame(() => {
        bodyInput.current?.focus();
        bodyInput.current?.setSelectionRange(
          start + images.length,
          start + images.length,
        );
      });
    }
    setMediaMode(null);
  }
  if (!allowed) return <p className="text-slate-400">你没有博客编辑权限。</p>;
  const inputClass =
    "block w-full mt-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50 text-sm";
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen size={24} className="text-blue-400" />
            内容工作台
          </h1>
          <p className="text-sm text-slate-400 mt-3">
            写文章、管理草稿与封面。只有具备博客编辑权限的账号可以操作。
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm"
          disabled={busy}
          onClick={() => {
            setForm(blank());
            setDirty(false);
            setPreview("");
            setMessage("");
          }}
        >
          <FilePlus size={16} />
          新建文章
        </button>
      </div>
      <Link to="/albums" className="self-start text-sm text-blue-300">
        管理相册与随记 ↗
      </Link>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          disabled={busy}
          onClick={() => markdownInput.current?.click()}
        >
          导入 Markdown 草稿
        </button>
        <input
          type="file"
          ref={markdownInput}
          className="hidden"
          accept=".md,text/markdown"
          onChange={(event) => importMarkdown(event.target.files?.[0])}
        />
      </div>
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-5">
        <aside className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-xs text-slate-400 mb-4">
            文章与草稿 · {posts.length}
          </h2>
          <div className="flex flex-col gap-2">
            {posts.map((post) => (
              <button
                key={post.slug}
                disabled={busy}
                className={`text-left rounded-lg px-3 py-3 text-sm leading-6 ${form.slug === post.slug ? "bg-blue-500/20 text-blue-300" : "bg-slate-900 text-slate-300"}`}
                onClick={() => open(post.slug)}
              >
                {post.title}
                <span className="block mt-1 text-xs text-slate-500">
                  {post.draft ? "草稿" : "公开内容"}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div>
          <fieldset
            disabled={busy}
            className="rounded-xl border border-slate-700 bg-slate-800 p-5 grid sm:grid-cols-2 gap-4"
          >
            <label className="sm:col-span-2 text-sm text-slate-400">
              文章标题
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => edit({ title: event.target.value })}
              />
            </label>
            <label className="text-sm text-slate-400">
              文章标识
              <input
                className={inputClass}
                value={form.slug}
                readOnly={form.revision !== null}
                onChange={(event) => edit({ slug: event.target.value })}
                placeholder="例如 ff14-review"
              />
              <span className="text-xs block mt-1">
                将成为文章链接，保存后保持固定。
              </span>
            </label>
            <label className="text-sm text-slate-400">
              发布时间（上海）
              <input
                type="datetime-local"
                className={inputClass}
                value={dateInput(form.date)}
                onChange={(event) => {
                  if (event.target.value)
                    edit({ date: `${event.target.value}:00+08:00` });
                }}
              />
            </label>
            <label className="text-sm text-slate-400">
              分类
              <input
                className={inputClass}
                value={form.categories}
                onChange={(event) => edit({ categories: event.target.value })}
                placeholder="用逗号分隔"
              />
            </label>
            <label className="text-sm text-slate-400">
              标签
              <input
                className={inputClass}
                value={form.tags}
                onChange={(event) => edit({ tags: event.target.value })}
                placeholder="FF14, 固定队"
              />
            </label>
            <label className="sm:col-span-2 text-sm text-slate-400">
              封面地址
              <input
                className={inputClass}
                value={form.cover}
                onChange={(event) => edit({ cover: event.target.value })}
                placeholder="/assets/… 或 HTTPS 图片地址"
              />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-4 items-center">
              <button
                type="button"
                className="rounded bg-slate-700 px-3 py-2 text-xs"
                onClick={() => templateInput.current?.click()}
              >
                关联副本模板
              </button>
              <input
                type="file"
                ref={templateInput}
                className="hidden"
                accept=".json,application/json"
                onChange={(event) => uploadTemplate(event.target.files?.[0])}
              />
              {form.template && (
                <span className="text-xs text-emerald-300">
                  已关联副本模板{" "}
                  <button
                    type="button"
                    className="underline ml-2"
                    onClick={() => edit({ template: "" })}
                  >
                    移除
                  </button>
                </span>
              )}
              <button
                type="button"
                className="flex items-center gap-2 rounded bg-slate-700 px-3 py-2 text-xs"
                onClick={() => imageInput.current?.click()}
              >
                <ImagePlus size={15} />
                上传封面
              </button>
              <input
                type="file"
                ref={imageInput}
                className="hidden"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => upload(event.target.files?.[0])}
              />
              <button
                type="button"
                className="rounded bg-slate-700 px-3 py-2 text-xs"
                onClick={() => setMediaMode("cover")}
              >
                从图片库选封面
              </button>
              <label className="text-sm text-slate-300 flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={form.draft}
                  onChange={(event) => edit({ draft: event.target.checked })}
                />
                保留为草稿
              </label>
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                className="rounded bg-slate-700 px-3 py-2 text-xs"
                onClick={() => {
                  insertion.current = {
                    start:
                      bodyInput.current?.selectionStart ?? form.body.length,
                    end: bodyInput.current?.selectionEnd ?? form.body.length,
                  };
                  setMediaMode("body");
                }}
              >
                正文插图 / 图片库
              </button>
            </div>
            <label className="sm:col-span-2 text-sm text-slate-400">
              正文（Markdown）
              <textarea
                ref={bodyInput}
                aria-label="正文（Markdown）"
                rows={22}
                className={`${inputClass} font-mono leading-7 resize-y`}
                value={form.body}
                onChange={(event) => edit({ body: event.target.value })}
                placeholder="在这里开始写下你的故事…"
              />
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm"
              disabled={busy || !form.title.trim()}
              onClick={save}
            >
              <Save size={16} />
              {busy ? "处理中…" : "保存文章"}
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm"
              disabled={busy}
              onClick={showPreview}
            >
              <Eye size={16} />
              预览正文
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm"
              onClick={download}
            >
              <Download size={16} />
              下载本地草稿
            </button>
            {dirty && (
              <span className="text-xs text-amber-300 self-center">
                有未保存修改 · 本地草稿会保留
              </span>
            )}
          </div>
          <p
            role="status"
            className="text-sm text-amber-300 mt-4 whitespace-pre-wrap"
          >
            {message}
          </p>
          {preview && (
            <div
              className="editor-preview rounded-xl border border-slate-700 bg-slate-950 p-6 mt-5"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">更新公开页面</h2>
          <p className="text-xs text-slate-400 mt-2">
            内容库中的非草稿文章将出现在公开站点。更新失败时，读者仍会看到原版本。
          </p>
          <p className="text-sm text-emerald-300 mt-2" role="status">
            {publication.message}
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm disabled:opacity-50"
          disabled={
            busy ||
            dirty ||
            !publication.available ||
            publication.state === "building"
          }
          onClick={publish}
        >
          <Globe size={16} />
          {publication.state === "building" ? "正在更新…" : "更新公开页面"}
        </button>
      </div>
      {mediaMode && (
        <MediaPicker
          onSelect={chooseMedia}
          onClose={() => setMediaMode(null)}
          multiple={mediaMode === "body"}
        />
      )}
    </section>
  );
}
