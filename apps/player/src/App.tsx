import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FarmArtDefs } from "./art";
import FarmDashboard from "./screens/FarmDashboard";
import FarmQa from "./screens/FarmQa";
import Garden from "./screens/Garden";
import GardenQa from "./screens/GardenQa";
import UiPolishQa from "./screens/UiPolishQa";

/** Player PWA must never route into admin/parent apps (defense in depth). */
function BlockForeignApps({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin") || pathname.startsWith("/parent")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <FarmArtDefs />
      <BlockForeignApps>
        <Routes>
          <Route path="/" element={<FarmDashboard />} />
          <Route path="/garden/:playerId" element={<Garden />} />
          <Route path="/qa/garden" element={<GardenQa />} />
          <Route path="/qa/farm" element={<FarmQa />} />
          <Route path="/qa/ui" element={<UiPolishQa />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BlockForeignApps>
    </>
  );
}
