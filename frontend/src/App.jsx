import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import TVPage from './pages/TVPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TVPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;
