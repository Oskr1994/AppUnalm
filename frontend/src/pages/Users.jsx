import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'viewer',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setError('Error al cargar la lista de usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/register', formData);
      setSuccess('Usuario creado exitosamente');
      setShowAddModal(false);
      setFormData({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'viewer',
      });
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al crear usuario');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-danger',
      operador: 'bg-warning text-dark',
      viewer: 'bg-info',
      personal_seguridad: 'bg-success',
    };
    return badges[role] || 'bg-secondary';
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      operador: 'Operador',
      viewer: 'Visualizador',
      personal_seguridad: 'Personal de Seguridad',
    };
    return labels[role] || role;
  };

  return (
    <>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Gestión de Usuarios</h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <i className="bi bi-plus-lg me-2"></i>
            Agregar Usuario
          </button>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {success && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            {success}
            <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre Completo</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center">
                          No hay usuarios registrados
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.username}</strong>
                          </td>
                          <td>{u.full_name || '-'}</td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`badge ${getRoleBadge(u.role)}`}>
                              {getRoleLabel(u.role)}
                            </span>
                          </td>
                          <td>
                            {u.is_active ? (
                              <span className="badge bg-success">Activo</span>
                            ) : (
                              <span className="badge bg-secondary">Inactivo</span>
                            )}
                          </td>
                          <td>
                            {new Date(u.created_at).toLocaleDateString('es-ES')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal para agregar usuario */}
        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Agregar Usuario</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowAddModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Usuario *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Nombre Completo</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Contraseña *</label>
                      <input
                        type="password"
                        className="form-control"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength="6"
                      />
                      <small className="text-muted">Mínimo 6 caracteres</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Rol *</label>
                      <select
                        className="form-select"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      >
                        <option value="viewer">Visualizador (solo lectura)</option>
                        <option value="operador">Operador (agregar/editar)</option>
                        <option value="personal_seguridad">Personal de Seguridad</option>
                        <option value="admin">Administrador (control total)</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowAddModal(false)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Crear Usuario
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
