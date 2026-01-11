import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-danger',
      gestion_vehicular: 'bg-primary',
      gestion_peatonal: 'bg-warning text-dark',
      postulante: 'bg-success',
      viewer: 'bg-info',
    };
    return badges[role] || 'bg-secondary';
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-lg">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold d-flex align-items-center" to="/dashboard">
          <i className="bi bi-shield-check-fill me-2"></i>
          UNALM
        </Link>

        <button
          className="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link d-flex align-items-center" to="/dashboard">
                <i className="bi bi-house-door me-1"></i>
                INICIO
              </Link>
            </li>
            {(user?.role === 'admin' || user?.role === 'gestion_vehicular') && (
              <li className="nav-item">
                <Link className="nav-link d-flex align-items-center" to="/persons">
                  <i className="bi bi-people me-1"></i>
                  Personas
                </Link>
              </li>
            )}
            {(user?.role === 'admin' || user?.role === 'gestion_peatonal') && (
              <li className="nav-item">
                <Link className="nav-link d-flex align-items-center" to="/pedestrian">
                  <i className="bi bi-person-walking me-1"></i>
                  Peatonal
                </Link>
              </li>
            )}
            {(user?.role === 'admin' || user?.role === 'postulante') && (
              <li className="nav-item">
                <Link className="nav-link d-flex align-items-center" to="/postulant">
                  <i className="bi bi-person-plus me-1"></i>
                  Postulante
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li className="nav-item">
                <Link className="nav-link d-flex align-items-center" to="/users">
                  <i className="bi bi-person-badge me-1"></i>
                  Usuarios
                </Link>
              </li>
            )}
          </ul>

          <div className="d-flex align-items-center">
            <div className="d-flex align-items-center me-3">
              <div className="bg-white bg-opacity-20 rounded-circle p-2 me-2">
                <i className="bi bi-person-circle text-white"></i>
              </div>
              <div>
                <div className="text-white fw-medium small">
                  {user?.full_name || user?.username}
                </div>
                <span className={`badge ${getRoleBadge(user?.role)} fs-6`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button className="btn btn-outline-light btn-sm d-flex align-items-center" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-1"></i>
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
