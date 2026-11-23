import { BrowserRouter, Route, Routes } from "react-router";
import CatchAllPage from "./pages/CatchAllPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<CatchAllPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
