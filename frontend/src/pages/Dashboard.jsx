import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <div className="container-fluid py-5">
        <div className="container">
          <div className="row mb-5">
            <div className="col-12">
              <div className="d-flex align-items-center mb-4">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3 me-3">
                  <i className="bi bi-house-door-fill text-primary fs-2"></i>
                </div>
                <div>
                  <h1 className="mb-1">Bienvenido, {user?.full_name || user?.username}!</h1>
                  <p className="text-muted mb-0">Sistema de Gestión de Acceso UNALM</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row g-4 mb-5">
            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-3">
                      <i className="bi bi-car-front-fill text-primary fs-4"></i>
                    </div>
                    <h5 className="card-title mb-0 fw-bold">Gestión Vehicular</h5>
                  </div>
                  <p className="card-text text-muted mb-4">
                    Agrega, edita y administra personas y placas de vehículos.
                  </p>
                  <Link to="/persons" className="btn btn-primary w-100">
                    <i className="bi bi-arrow-right-circle me-2"></i>
                    Ver Personas
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-4">
              <div className="card h-100 border-0">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-success bg-opacity-10 rounded-circle p-2 me-3">
                      <i className="bi bi-person-walking text-success fs-4"></i>
                    </div>
                    <h5 className="card-title mb-0 fw-bold">Gestión Peatonal</h5>
                  </div>
                  <p className="card-text text-muted mb-4">
                    Registra y administra peatones y credenciales de acceso.
                  </p>
                  <Link to="/pedestrian" className="btn btn-success w-100">
                    <i className="bi bi-arrow-right-circle me-2"></i>
                    Ver Personas
                  </Link>
                </div>
              </div>
            </div>

            {(user?.role === 'admin' || user?.role === 'operador') && (
              <div className="col-md-6 col-lg-4">
                <div className="card h-100 border-0">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="bg-warning bg-opacity-10 rounded-circle p-2 me-3">
                        <i className="bi bi-key-fill text-warning fs-4"></i>
                      </div>
                      <h5 className="card-title mb-0 fw-bold">Niveles de Acceso</h5>
                    </div>
                    <p className="card-text text-muted mb-4">
                      Asigna niveles de acceso a las personas registradas.
                    </p>
                    <Link to="/persons" className="btn btn-warning w-100">
                      <i className="bi bi-arrow-right-circle me-2"></i>
                      Gestionar Accesos
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'admin' && (
              <div className="col-md-6 col-lg-4">
                <div className="card h-100 border-0">
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-3">
                      <div className="bg-info bg-opacity-10 rounded-circle p-2 me-3">
                        <i className="bi bi-person-badge-fill text-info fs-4"></i>
                      </div>
                      <h5 className="card-title mb-0 fw-bold">Usuarios del Sistema</h5>
                    </div>
                    <p className="card-text text-muted mb-4">
                      Administra usuarios y permisos del sistema.
                    </p>
                    <Link to="/users" className="btn btn-info w-100">
                      <i className="bi bi-arrow-right-circle me-2"></i>
                      Ver Usuarios
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="row">
            <div className="col-lg-8">
              <div className="card border-0">
                <div className="card-header bg-white border-0 pb-0">
                  <h5 className="mb-0 fw-bold d-flex align-items-center">
                    <i className="bi bi-info-circle text-primary me-2"></i>
                    Tu Información
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded">
                        <small className="text-muted d-block">Nombre Completo</small>
                        <strong>{user?.full_name}</strong>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded">
                        <small className="text-muted d-block">Correo Electrónico</small>
                        <strong>{user?.email}</strong>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded">
                        <small className="text-muted d-block">Rol</small>
                        <span className={`badge fs-6 px-3 py-2 ${
                          user?.role === 'admin' ? 'bg-danger' :
                          user?.role === 'operador' ? 'bg-warning' : 'bg-info'
                        }`}>
                          {user?.role}
                        </span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded">
                        <small className="text-muted d-block">Estado</small>
                        <span className="badge bg-success fs-6 px-3 py-2">Activo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
