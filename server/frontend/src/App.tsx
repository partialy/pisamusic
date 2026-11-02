import { useEffect, useState } from "react";
import HomePage from "./Home/HomePage";
import ListenPage from "./Listen/ListenPage";

interface StaticRouteRedirectProps {
  /** 需要补齐尾斜杠的静态目录路径。 */
  path: "/scan" | "/download" | "/app-share";
}

function StaticRouteRedirect({ path }: StaticRouteRedirectProps) {
  useEffect(() => {
    window.location.replace(`${path}/${window.location.search}${window.location.hash}`);
  }, [path]);

  return null;
}

function checkIsListenRoute(): boolean {
  const path = window.location.pathname;
  const hash = window.location.hash;
  return (
    path === "/listen" ||
    path.startsWith("/listen/") ||
    hash === "#/listen" ||
    hash.startsWith("#/listen")
  );
}

export default function App() {
  const [isListen, setIsListen] = useState(checkIsListenRoute);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsListen(checkIsListenRoute());
    };

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  if (window.location.pathname === "/scan") {
    return <StaticRouteRedirect path="/scan" />;
  }
  if (window.location.pathname === "/download") {
    return <StaticRouteRedirect path="/download" />;
  }

  if (window.location.pathname === "/app-share") {
    return <StaticRouteRedirect path="/app-share" />;
  }

  if (isListen) {
    return (
      <ListenPage
        onBackToHome={() => {
          if (window.location.hash.includes("listen")) {
            window.location.hash = "";
          } else {
            window.history.pushState(null, "", "/");
          }
          setIsListen(false);
        }}
      />
    );
  }

  return <HomePage />;
}
