export default function SiteNavigation() {
  if (import.meta.env.BASE_URL === '/') return null;
  return <header className="portal-navigation"><a className="portal-wordmark" href="/"><span/>Chiakya<small>.home</small></a><nav aria-label="主站导航"><a href="/">首页</a><a href="/blog/">文章</a><a href="/photos/">相册</a><a href="/games/">游戏</a><a href="/ff14/" aria-current="page">FF14</a><a href="/anime-calendar/">追番</a></nav><a className="portal-back" href="/ff14/">回到 FF14 专区 ↗</a></header>;
}
