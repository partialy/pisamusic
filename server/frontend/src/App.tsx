import { useEffect } from "react";
import HomePage from "./Home/HomePage";

interface StaticRouteRedirectProps {
  /** 需要补齐尾斜杠的静态目录路径。 */
  path: "/scan" | "/download";
}

function StaticRouteRedirect({ path }: StaticRouteRedirectProps) {
  useEffect(() => {
    window.location.replace(`${path}/${window.location.search}${window.location.hash}`);
  }, [path]);

  return null;
}

export default function App() {
  if (window.location.pathname === "/scan") {
    return <StaticRouteRedirect path="/scan" />;
  }
  if (window.location.pathname === "/download") {
    return <StaticRouteRedirect path="/download" />;
  }
  return <HomePage />;
}
