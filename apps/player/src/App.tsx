import { Navigate, Route, Routes } from "react-router-dom";
import { FarmArtDefs } from "./art";
import FarmDashboard from "./screens/FarmDashboard";
import FarmQa from "./screens/FarmQa";
import Garden from "./screens/Garden";
import GardenQa from "./screens/GardenQa";
import UiPolishQa from "./screens/UiPolishQa";

export default function App() {
  return (
    <>
      <FarmArtDefs />
      <Routes>
        <Route path="/" element={<FarmDashboard />} />
        <Route path="/garden/:playerId" element={<Garden />} />
        <Route path="/qa/garden" element={<GardenQa />} />
        <Route path="/qa/farm" element={<FarmQa />} />
        <Route path="/qa/ui" element={<UiPolishQa />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
