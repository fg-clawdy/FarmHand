import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api, onAuthExpired } from "./api";
import AccoladesPage from "./pages/AccoladesPage";
import ActivityPage from "./pages/ActivityPage";
import BalancePage from "./pages/BalancePage";
import ConfigPage from "./pages/ConfigPage";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import PlayersPage from "./pages/PlayersPage";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [expired, setExpired] = useState(false);
  const authedRef = useRef(authed);
  authedRef.current = authed;

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
    return onAuthExpired(() => {
      // Only flag "session expired" if we believed we were already signed in.
      if (authedRef.current === true) setExpired(true);
      setAuthed(false);
    });
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const probe = () => {
      if (cancelled) return;
      // A 401 here is handled globally by onAuthExpired.
      void api.me().catch(() => {});
    };
    const onVisible = () => {
      if (!document.hidden) probe();
    };
    window.addEventListener("focus", probe);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", probe);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authed]);

  if (authed === null) return <div className="main">Opening the ledger…</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage
              expired={expired}
              onLogin={() => {
                setExpired(false);
                setAuthed(true);
              }}
            />
          )
        }
      />
      <Route
        path="/*"
        element={
          authed ? (
            <Shell onLogout={() => setAuthed(false)} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="shell">
      <nav className="nav">
        <h1>FarmHand</h1>
        <p>Parent ledger</p>
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/players">Players</NavLink>
        <NavLink to="/config">Tunables</NavLink>
        <NavLink to="/balance">Balance</NavLink>
        <NavLink to="/activity">Activity</NavLink>
        <NavLink to="/accolades">Accolades</NavLink>
        <a href="/parent/">Parent inbox</a>
        <button
          className="link"
          type="button"
          onClick={() => {
            void api.logout().finally(() => {
              onLogout();
              navigate("/login");
            });
          }}
        >
          Sign out
        </button>
        <p className="muted" style={{ marginTop: 24 }}>
          <Link to="/" style={{ color: "#f7ead0" }}>
            Kids play on /
          </Link>
        </p>
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<PlayerDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/balance" element={<BalancePage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/accolades" element={<AccoladesPage />} />
        </Routes>
      </div>
    </div>
  );
}
