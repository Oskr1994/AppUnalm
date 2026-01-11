import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Persons from './pages/Persons';
import Pedestrian from './pages/Pedestrian';
import Users from './pages/Users';
import Postulant from './pages/Postulant';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/persons"
            element={
              <PrivateRoute roles={['admin', 'gestion_vehicular']}>
                <Persons />
              </PrivateRoute>
            }
          />
          <Route
            path="/pedestrian"
            element={
              <PrivateRoute roles={['admin', 'gestion_peatonal']}>
                <Pedestrian />
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute roles={['admin']}>
                <Users />
              </PrivateRoute>
            }
          />
          <Route
            path="/postulant"
            element={
              <PrivateRoute roles={['admin', 'postulante']}>
                <Postulant />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
