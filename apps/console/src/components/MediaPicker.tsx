import { useEffect, useRef, useState } from "react";
import { ImagePlus, Check, X } from "lucide-react";
import { fetchJson } from "../utils/http";
import { privateImage, uploadMedia, type Media } from "../utils/media";
type Page = { items: Media[]; total: number; nextOffset: number | null };
export default function MediaPicker({
  onSelect,
  onClose,
  multiple = true,
  inline = false,
}: {
  onSelect: (items: Media[]) => void;
  onClose: () => void;
  multiple?: boolean;
  inline?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media[]>([]);
  const [query, setQuery] = useState("");
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (inline) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [inline]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchJson<Page>(`/api/site/media?q=${encodeURIComponent(query)}`)
        .then((page) => {
          if (active) {
            setItems(page.items);
            setNext(page.nextOffset);
            setLoading(false);
          }
        })
        .catch((error) => {
          if (active) {
            setMessage(error.message);
            setLoading(false);
          }
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  async function more() {
    if (next === null) return;
    setLoading(true);
    try {
      const page = await fetchJson<Page>(
        `/api/site/media?q=${encodeURIComponent(query)}&offset=${next}`,
      );
      setItems((previous) => [...previous, ...page.items]);
      setNext(page.nextOffset);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片读取失败。");
    } finally {
      setLoading(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const uploaded: Media[] = [];
    const failures: string[] = [];
    for (const [index, file] of Array.from(files).entries()) {
      setMessage(`正在上传 ${index + 1} / ${files.length}：${file.name}`);
      try {
        const media = await uploadMedia(file);
        uploaded.push(media);
        setItems((previous) => [media, ...previous]);
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : `${file.name} 上传失败`,
        );
      }
    }
    setSelected((previous) =>
      multiple
        ? [
            ...previous.filter(
              (item) => !uploaded.some((photo) => photo.id === item.id),
            ),
            ...uploaded,
          ]
        : uploaded.slice(0, 1),
    );
    setMessage(
      failures.length
        ? `已上传 ${uploaded.length} 张。${failures.join("；")}`
        : `已上传 ${uploaded.length} 张照片，请确认选择。`,
    );
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  function toggle(media: Media) {
    setSelected((previous) =>
      previous.some((item) => item.id === media.id)
        ? previous.filter((item) => item.id !== media.id)
        : multiple
          ? [...previous, media]
          : [media],
    );
  }
  const content = (
    <div className="media-picker-content">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="media-picker-title" className="text-xl font-bold">
            图片库
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            照片可用于相册、文章正文和封面。上传后，保存并发布内容才会公开。
          </p>
        </div>
        {!inline && (
          <button
            type="button"
            aria-label="关闭图片库"
            onClick={onClose}
            disabled={busy}
            className="rounded p-2 hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 my-5">
        <input
          type="search"
          aria-label="搜索图片"
          placeholder="按文件名找照片"
          value={query}
          disabled={busy}
          onChange={(event) => {
            setQuery(event.target.value);
            setLoading(true);
          }}
          className="min-w-0 flex-1 rounded-lg bg-slate-950 border border-slate-600 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded bg-blue-600 px-4 py-2 text-sm flex items-center gap-2"
        >
          <ImagePlus size={16} />
          批量上传照片
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="上传图片库照片"
          className="hidden"
          onChange={(event) => void upload(event.target.files)}
        />
      </div>
      <p className="text-xs text-slate-400 mb-4">
        JPEG / PNG / WebP，每张最多 20 MB，自动生成浏览图与缩略图。
      </p>
      {loading && items.length === 0 ? (
        <p className="text-slate-400 py-10">正在读取图片…</p>
      ) : (
        <div className="media-library-grid">
          {items.map((media) => (
            <button
              type="button"
              className="media-library-item"
              key={media.id}
              aria-label={`选择照片 ${media.name}`}
              aria-pressed={selected.some((item) => item.id === media.id)}
              onClick={() => toggle(media)}
            >
              <img
                src={privateImage(media.thumbnail)}
                alt={media.name}
                loading="lazy"
              />
              <span>{media.name}</span>
              {selected.some((item) => item.id === media.id) && (
                <Check size={18} className="media-selected" />
              )}
            </button>
          ))}
        </div>
      )}
      {!loading && !items.length && (
        <p className="text-slate-400 py-10 text-center">
          {query ? "没有匹配的照片。" : "图片库还空着，先上传几张喜欢的照片。"}
        </p>
      )}
      {next !== null && (
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void more()}
          className="rounded bg-slate-700 px-4 py-2 text-sm mt-4"
        >
          加载更多照片
        </button>
      )}
      <p
        role="status"
        className="text-sm text-amber-300 whitespace-pre-wrap mt-5"
      >
        {message}
      </p>
      <div className="media-picker-footer">
        <span className="text-sm text-slate-400">
          已选 {selected.length} 张
        </span>
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => onSelect(selected)}
          className="rounded-lg bg-blue-600 disabled:bg-slate-700 px-5 py-2 text-sm"
        >
          {inline ? "查看引用地址" : "使用所选照片"}
        </button>
      </div>
    </div>
  );
  return inline ? (
    <div className="media-library-inline">{content}</div>
  ) : (
    <dialog
      ref={dialog}
      className="media-picker"
      aria-labelledby="media-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {content}
    </dialog>
  );
}
