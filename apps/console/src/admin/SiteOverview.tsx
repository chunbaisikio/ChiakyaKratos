import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../utils/http";
type Publication = {
  state: string;
  message: string;
  available: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
};
type Summary = {
  posts: { draft: boolean }[];
  albums: { draft: boolean }[];
  images: number;
  games: number;
  publication: Publication;
};
const names: Record<string, string> = {
  idle: "可更新",
  building: "正在构建",
  complete: "已完成",
  failed: "更新失败",
};
export default function SiteOverview({
  publicationPage = false,
}: {
  publicationPage?: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ posts: Summary["posts"] }>("/api/site/posts"),
      fetchJson<{ albums: Summary["albums"] }>("/api/site/albums"),
      fetchJson<{ total: number }>("/api/site/media"),
      fetchJson<{ profiles: { visible: boolean }[] }>(
        "/api/site/game-profiles",
      ),
      fetchJson<Publication>("/api/site/publication"),
    ])
      .then(([posts, albums, media, games, publication]) => {
        if (active)
          setSummary({
            posts: posts.posts,
            albums: albums.albums,
            images: media.total,
            games: games.profiles.filter((game) => game.visible).length,
            publication,
          });
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (summary?.publication.state !== "building") return;
    const timer = setInterval(() => {
      fetchJson<Publication>("/api/site/publication")
        .then((publication) =>
          setSummary((previous) => previous && { ...previous, publication }),
        )
        .catch((error) => setMessage(error.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [summary?.publication.state]);
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const state = await fetchJson<Publication>("/api/site/publication", {
        method: "POST",
      });
      setSummary(
        (previous) =>
          previous && {
            ...previous,
            publication: { ...state, available: true },
          },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公开页面更新失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-overview">
      <p className="admin-eyebrow">CHIAKYA HOME</p>
      <h1>{publicationPage ? "发布管理" : "站点管理总览"}</h1>
      <p className="admin-description">
        {publicationPage
          ? "统一更新文章、相册和游戏名片的公开页面。"
          : "文章、相册、图片和游戏名片的管理与发布。"}
      </p>
      {message && (
        <p role="alert" className="text-amber-300 text-sm">
          {message}
        </p>
      )}
      {!summary && !message && <p>正在读取站点内容…</p>}
      {summary && (
        <>
          <div className="admin-stats">
            {[
              {
                label: "文章",
                value: summary.posts.length,
                sub: `${summary.posts.filter((post) => post.draft).length} 篇草稿`,
                path: "/posts",
              },
              {
                label: "相册与随记",
                value: summary.albums.length,
                sub: `${summary.albums.filter((album) => album.draft).length} 篇草稿`,
                path: "/albums",
              },
              {
                label: "图片库",
                value: summary.images,
                sub: "可复用于文章、相册与名片",
                path: "/media",
              },
              {
                label: "公开游戏名片",
                value: summary.games,
                sub: "首页展示前三张公开名片",
                path: "/games",
              },
            ].map((item) => (
              <Link key={item.path} className="admin-stat" to={item.path}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.sub}</small>
              </Link>
            ))}
          </div>
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>更新公开页面</h2>
                <p>
                  先保存编辑内容，再发布。草稿、隐藏名片与未来日期的内容继续保持私有。
                </p>
              </div>
              <span className="admin-status">
                {names[summary.publication.state] || summary.publication.state}
              </span>
            </div>
            <div role="status">
              <p>
                {summary.publication.message ||
                  "公开站点展示最近成功发布的内容。"}
              </p>
            </div>
            <div className="admin-actions">
              <button
                type="button"
                disabled={
                  busy ||
                  summary.publication.state === "building" ||
                  !summary.publication.available
                }
                onClick={() => void publish()}
              >
                更新公开页面
              </button>
              <a href="/" target="_blank" rel="noreferrer">
                查看个人站点 ↗
              </a>
            </div>
          </section>
          {!publicationPage && (
            <section className="admin-panel">
              <h2>常用入口</h2>
              <div className="admin-shortcuts">
                <Link to="/posts">写文章 →</Link>
                <Link to="/albums">整理相册与随记 →</Link>
                <Link to="/games">编辑游戏身份 →</Link>
                <Link to="/publication">管理内容发布 →</Link>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
