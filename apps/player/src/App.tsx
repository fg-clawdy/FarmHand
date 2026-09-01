import { Navigate, Route, Routes } from "react-router-dom";
import FarmDashboard from "./screens/FarmDashboard";
import Garden from "./screens/Garden";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FarmDashboard />} />
      <Route path="/garden/:playerId" element={<Garden />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
