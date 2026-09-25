import { Link } from "react-router-dom";

/** Art polish QA used preview props product Profile/Selfie don't have. Stubbed for beta. */
export default function UiPolishQa() {
  return (
    <div className="screen" style={{ padding: 24 }}>
      <h1>UI polish QA deferred</h1>
      <p>Product Profile/Selfie sheets don't take art preview props. Job Board merge is otherwise in.</p>
      <p><Link to="/">Back to farm</Link></p>
    </div>
  );
}
