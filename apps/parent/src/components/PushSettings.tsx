import { useEffect, useState } from "react";
import { api } from "../api";
import {
  currentPushEndpoint,
  disableParentPush,
  enableParentPush,
  isSecurePushContext,
  pushSupported,
  type PushConfig,
} from "../push";

export default function PushSettings() {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();
  const secure = isSecurePushContext();

  async function refresh() {
    const next = await api.pushConfig();
    setConfig(next);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function enable() {
    if (!config?.publicKey) return;
    setBusy(true);
    setError("");
    try {
      const sub = await enableParentPush(config.publicKey);
      await api.pushSubscribe(sub);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const endpoint = (await disableParentPush()) ?? (await currentPushEndpoint());
      if (endpoint) await api.pushUnsubscribe(endpoint);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 8px" }}>Notifications</h3>
      <p className="muted">
        Get Approve | Deny on your phone when a kid plants a waiting seed. The inbox still works if push is off.
      </p>
      {!supported && <p>This browser cannot take Web Push. Use the inbox.</p>}
      {supported && !secure && (
        <p>
          Web Push needs HTTPS (or localhost). On a home LAN, put TLS in front of nginx — see
          the parent push notes.
        </p>
      )}
      {config && !config.enabled && (
        <p>Push is off on the server (no VAPID keys). Inbox is still the daily driver.</p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row">
        {config?.enabled && supported && secure && !config.subscribed && (
          <button className="btn sage" type="button" disabled={busy} onClick={() => void enable()}>
            Enable notifications
          </button>
        )}
        {config?.subscribed && (
          <>
            <span className="badge">On</span>
            <button className="btn" type="button" disabled={busy} onClick={() => void disable()}>
              Turn off
            </button>
          </>
        )}
      </div>
    </div>
  );
}
