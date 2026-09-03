import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import ActivityPage from "./pages/ActivityPage";
import ConfigPage from "./pages/ConfigPage";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import PlayersPage from "./pages/PlayersPage";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="main">Opening the ledger…</div>;

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setAuthed(true)} />} />
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
        <NavLink to="/activity">Activity</NavLink>
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
          <Route path="/activity" element={<ActivityPage />} />
        </Routes>
      </div>
    </div>
  );
}
