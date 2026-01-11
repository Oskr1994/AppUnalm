import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import escudo from '../images/ESCUDO1.jpg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5 col-xl-4">
            <div className="card shadow-xl border-0 fade-in">
              <div className="card-body p-5">
                <div className="text-center mb-4">
                  <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <img src={escudo} alt="UNALM" width="50" />
                  </div>
                  <h2 className="fw-bold text-primary mb-2">UNALM</h2>
                  <p className="text-muted mb-0">Sistema de Gestión de Acceso</p>
                  <small className="text-muted">Valtar Security</small>
                </div>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="username" className="form-label fw-medium">
                      <i className="bi bi-person me-1"></i>
                      Usuario
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-person-fill"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus
                        placeholder="Ingresa tu usuario"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="password" className="form-label fw-medium">
                      <i className="bi bi-lock me-1"></i>
                      Contraseña
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      <input
                        type="password"
                        className="form-control form-control-lg"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Ingresa tu contraseña"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 btn-lg py-3 mb-3"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Iniciar Sesión
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Usuario demo: <strong>admin</strong> / Contraseña: <strong>admin123</strong>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
