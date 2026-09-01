import { Navigate, Route, Routes } from "react-router-dom";
import { FarmArtDefs } from "./art";
import FarmDashboard from "./screens/FarmDashboard";
import Garden from "./screens/Garden";

export default function App() {
  return (
    <>
      <FarmArtDefs />
      <Routes>
        <Route path="/" element={<FarmDashboard />} />
        <Route path="/garden/:playerId" element={<Garden />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
