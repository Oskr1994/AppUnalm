
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api, { authService } from '../services/api';

export default function Users() {
  // Force refresh
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

  const [editingUser, setEditingUser] = useState(null);

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

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role: 'viewer',
    });
    setEditingUser(null);
    setShowAddModal(false);
    setError('');
    setSuccess('');
  };

  const handleAddClick = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name || '',
      password: '', // Password not required for edit
      role: user.role,
    });
    setError('');
    setSuccess('');
    setShowAddModal(true);
  };

  const handleDeleteClick = async (userId) => {
    if (window.confirm('¿Está seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      try {
        await authService.deleteUser(userId);
        setSuccess('Usuario eliminado exitosamente');
        loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError(error.response?.data?.detail || 'Error al eliminar usuario');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        // Edit mode
        const dataToSend = { ...formData };
        if (!dataToSend.password) {
          delete dataToSend.password; // Don't send empty password on edit
        }
        delete dataToSend.username; // Username usually shouldn't be changed or needs backend support

        await authService.updateUser(editingUser.id, dataToSend);
        setSuccess('Usuario actualizado exitosamente');
      } else {
        // Create mode
        await api.post('/auth/register', formData);
        setSuccess('Usuario creado exitosamente');
      }

      resetForm();
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      let errorMessage = 'Error al guardar usuario';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation error array
          errorMessage = error.response.data.detail
            .map(err => `${err.loc?.[1] || 'Field'}: ${err.msg} `)
            .join(', ');
        } else {
          errorMessage = JSON.stringify(error.response.data.detail);
        }
      }
      setError(errorMessage);
    }
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

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      gestion_vehicular: 'Gestión Vehicular',
      gestion_peatonal: 'Gestión Peatonal',
      postulante: 'Postulante',
      viewer: 'Visualizador',
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
            className="btn"
            style={{ backgroundColor: '#0D5F2C', color: 'white' }}
            onClick={handleAddClick}
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
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center">
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
                            <span className={`badge ${getRoleBadge(u.role)} `}>
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
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button className="btn btn-outline-primary" onClick={() => handleEditClick(u)} title="Editar">
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button className="btn btn-outline-danger" onClick={() => handleDeleteClick(u.id)} title="Eliminar">
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
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

        {/* Modal para agregar/editar usuario */}
        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editingUser ? 'Editar Usuario' : 'Agregar Usuario'}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowAddModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Usuario {editingUser ? '(No editable)' : '*'}</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                        disabled={!!editingUser}
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
                      <label className="form-label">Contraseña {editingUser ? '(Opcional)' : '*'}</label>
                      <input
                        type="password"
                        className="form-control"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!editingUser}
                        minLength="6"
                        placeholder={editingUser ? 'Dejar en blanco para mantener actual' : ''}
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
                        <option value="gestion_vehicular">Gestión Vehicular</option>
                        <option value="gestion_peatonal">Gestión Peatonal</option>
                        <option value="postulante">Postulante</option>
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
                      {editingUser ? 'Actualizar' : 'Crear Usuario'}
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
