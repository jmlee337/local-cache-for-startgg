import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { Box } from '@mui/material';
import Settings from './Settings';
import Tournament from './Tournament';

function Hello() {
  return (
    <Box>
      <Tournament />
      <Settings />
    </Box>
  );
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
