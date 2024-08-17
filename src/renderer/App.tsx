import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { Box } from '@mui/material';
import Tournament from './Tournament';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';

function Hello() {
  return (
    <Box>
      <Tournament />
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
