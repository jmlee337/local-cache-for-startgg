import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Settings from './Settings';

function Hello() {
  return <Settings />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
