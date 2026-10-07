import { useEffect } from "react";
export default function LegacyRedirect({
  destination,
}: {
  destination: string;
}) {
  useEffect(() => {
    window.location.replace(`/admin/#${destination}`);
  }, [destination]);
  return <p className="admin-loading">正在打开站点后台…</p>;
}
