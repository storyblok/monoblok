import { BrowserRouter, Link, Route, Routes } from "react-router";
import CatchAllPage from "./pages/CatchAllPage";

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav className="py-8 container mx-auto mb-8">
          <ul className="flex gap-4">
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/react/richtext">Richtext</Link>
            </li>
          </ul>
        </nav>
        <div className="prose mx-auto">
          <Routes>
            <Route path="*" element={<CatchAllPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
