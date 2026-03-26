import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/employee" element={<EmployeeDashboard />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
