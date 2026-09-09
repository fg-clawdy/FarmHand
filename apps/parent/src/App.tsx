import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="main">Opening parent home…</div>;

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setAuthed(true)} />} />
      <Route
        path="/*"
        element={authed ? <Shell onLogout={() => setAuthed(false)} /> : <Navigate to="/login" replace />}
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
        <p>Parent home</p>
        <NavLink to="/" end>
          Chore inbox
        </NavLink>
        <a href="/admin/">Admin ledger</a>
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
            Same login as /admin
          </Link>
        </p>
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<InboxPage />} />
        </Routes>
      </div>
    </div>
  );
}
