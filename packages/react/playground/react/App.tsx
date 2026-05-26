import { BrowserRouter, Link, Route, Routes } from 'react-router';
import Home from './pages/Home';
import RichtextPage from './pages/RichtextPage';
import CatchAllPage from './pages/CatchAllPage';

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav className=" py-8 container mx-auto mb-8">
          <ul className="flex gap-4">
            <li>
              <Link to="/react">Home</Link>
            </li>
            <li>
              <Link to="/react/test-richtext">Richtext</Link>
            </li>
          </ul>
        </nav>
        <div className="prose mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="react" element={<Home />} />
            <Route path="react/test-richtext" element={<RichtextPage />} />
            <Route path="*" element={<CatchAllPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
