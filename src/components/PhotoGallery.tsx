import { useEffect, useRef, useState } from "react";
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
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const current = photos[selected ?? 0];
  useEffect(() => {
    if (selected === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);
  function close() {
    dialog.current?.close();
    setSelected(null);
  }
  function move(direction: number) {
    setSelected(
      (index) => ((index ?? 0) + direction + photos.length) % photos.length,
    );
  }
  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, index) => (
          <figure className="photo-frame" key={photo.mediaId}>
            <a
              className="photo-image"
              href={photo.url}
              aria-label={`查看照片 ${index + 1}：${photo.alt || photo.caption || "生活留影"}`}
              onClick={(event) => {
                event.preventDefault();
                setSelected(index);
                dialog.current?.showModal();
              }}
            >
              <img
                src={photo.thumbnail}
                alt={photo.alt || photo.caption || `相册照片 ${index + 1}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
              />
              <span className="photo-zoom" aria-hidden="true">
                ↗
              </span>
            </a>
            {(photo.caption || photo.takenAt) && (
              <figcaption>
                {photo.takenAt && (
                  <time dateTime={photo.takenAt}>
                    {photo.takenAt.replaceAll("-", ".")}
                  </time>
                )}
                {photo.caption && <p>{photo.caption}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      {current && (
        <dialog
          ref={dialog}
          className="photo-lightbox"
          aria-labelledby="lightbox-title"
          onCancel={() => setSelected(null)}
          onClose={() => setSelected(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              move(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              move(1);
            }
          }}
        >
          <div className="lightbox-panel">
            <div className="lightbox-toolbar">
              <span>
                {(selected ?? 0) + 1} / {photos.length}
              </span>
              <button type="button" onClick={close} aria-label="关闭照片">
                关闭 ×
              </button>
            </div>
            <img
              src={current.url}
              alt={current.alt || current.caption || "相册照片"}
              width={current.width}
              height={current.height}
            />
            <div className="lightbox-caption">
              <div>
                <h2 id="lightbox-title">
                  {current.alt || `照片 ${(selected ?? 0) + 1}`}
                </h2>
                {current.caption && <p>{current.caption}</p>}
                {current.takenAt && (
                  <time dateTime={current.takenAt}>{current.takenAt}</time>
                )}
              </div>
              <div className="lightbox-controls">
                <button
                  type="button"
                  aria-label="上一张照片"
                  onClick={() => move(-1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="下一张照片"
                  onClick={() => move(1)}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
