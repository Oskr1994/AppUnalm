import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { auditService } from '../services/api';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filters state
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
        userId: '',
        startDate: '',
        endDate: ''
    });

    // Cargar usuarios al montar
    useEffect(() => {
        loadUsers();
    }, []);

    // Recargar logs cuando cambian los filtros o la página
    useEffect(() => {
        loadLogs();
    }, [page, filters]); // Reload when page OR filters change

    const loadUsers = async () => {
        try {
            const usersData = await auditService.listUsers();
            setUsers(usersData);
        } catch (err) {
            console.error("Error loading users for filter", err);
        }
    };

    const loadLogs = async () => {
        try {
            setLoading(true);
            const limit = 20;

            // Si es página 0, reseteamos logs antes (opcional, para evitar flash de datos viejos)
            if (page === 0) {
                // No limpiamos setLogs([]) aquí para evitar parpadeo blanco, 
                // pero si cambian filtros deberíamos
            }

            const newLogs = await auditService.listLogs(page, limit, filters);

            if (newLogs.length < limit) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (page === 0) {
                setLogs(newLogs);
            } else {
                setLogs(prev => [...prev, ...newLogs]);
            }
        } catch (error) {
            console.error('Error al cargar registros:', error);
            setError('Error al cargar el historial de registros');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
        setPage(0); // Reset to first page on filter change
    };

    const loadMore = () => {
        setPage(prev => prev + 1);
    };

    const getActionBadge = (action) => {
        switch (action) {
            case 'CREATE': return 'bg-success';
            case 'UPDATE': return 'bg-primary';
            case 'DELETE': return 'bg-danger';
            default: return 'bg-secondary';
        }
    };

    return (
        <>
            <Navbar />
            <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2>Registro de Auditoría</h2>
                </div>

                {/* Filters Card */}
                <div className="card shadow-sm mb-4">
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label">Filtrar por Usuario</label>
                                <select
                                    className="form-select"
                                    name="userId"
                                    value={filters.userId}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">Todos los usuarios</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Fecha Inicio</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    name="startDate"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Fecha Fin</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    name="endDate"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                            <div className="col-md-3 d-flex align-items-end">
                                <button
                                    className="btn btn-outline-secondary w-100"
                                    onClick={() => {
                                        setFilters({ userId: '', startDate: '', endDate: '' });
                                        setPage(0);
                                    }}
                                >
                                    Limpiar Filtros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger" role="alert">
                        {error}
                    </div>
                )}

                <div className="card shadow-sm">
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover table-striped mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Fecha/Hora</th>
                                        <th>Usuario</th>
                                        <th>Módulo</th>
                                        <th>Acción</th>
                                        <th>Detalles</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 && !loading ? (
                                        <tr>
                                            <td colSpan="5" className="text-center py-4">
                                                No hay registros disponibles con estos filtros
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id}>
                                                <td style={{ minWidth: '160px' }}>
                                                    {new Date(log.timestamp).toLocaleString('es-PE')}
                                                </td>
                                                <td>
                                                    <strong>{log.username || `ID: ${log.user_id}`}</strong>
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark border">
                                                        {log.module}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getActionBadge(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="text-break">
                                                    {log.details}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Loading / Load More */}
                        <div className="p-3 text-center border-top">
                            {loading && (
                                <div className="spinner-border text-primary spinner-border-sm" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                            )}

                            {!loading && hasMore && (
                                <button className="btn btn-outline-primary btn-sm" onClick={loadMore}>
                                    Cargar más antiguos
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
