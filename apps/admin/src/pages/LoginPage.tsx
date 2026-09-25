import { useState } from "react";
import { api } from "../api";

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="login">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          void api
            .login(username, password)
            .then(onLogin)
            .catch((err: Error) => setError(err.message))
            .finally(() => setBusy(false));
        }}
      >
        <h1>FarmHand ledger</h1>
        <p className="muted">Parents only. The kids’ gardens stay on the farm screen.</p>
        <label className="field">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn sage" type="submit" disabled={busy}>
          Sign in
        </button>
      </form>
    </div>
  );
}
