import { useState } from "react";
import MediaPicker from "../components/MediaPicker";
import { markdownImage, type Media } from "../utils/media";
export default function MediaLibrary() {
  const [selected, setSelected] = useState<Media | null>(null);
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">站点图片库</h1>
        <p className="mt-3 text-sm text-slate-400">
          统一上传和查找照片，复用于文章、相册及游戏名片。
        </p>
      </div>
      <MediaPicker
        inline
        multiple={false}
        onClose={() => {}}
        onSelect={(items) => setSelected(items[0] || null)}
      />
      {selected && (
        <section className="admin-panel">
          <h2>{selected.name}</h2>
          <p className="text-slate-400 text-sm">
            在后台的文章、相册或名片中选用这张照片，保存并发布后，公开引用地址才会生效。
          </p>
          <label className="block text-sm text-slate-300 mt-4">
            图片引用地址
            <input
              readOnly
              value={selected.url}
              onFocus={(event) => event.target.select()}
              className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-600 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-slate-300 mt-4">
            Markdown 引用
            <input
              readOnly
              value={markdownImage(selected.url, selected.name)}
              onFocus={(event) => event.target.select()}
              className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-600 px-3 py-2"
            />
          </label>
        </section>
      )}
    </section>
  );
}
