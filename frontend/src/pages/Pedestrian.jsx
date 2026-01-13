import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { personService, externalService } from '../services/api';
import Navbar from '../components/Navbar';
import CameraCapture from '../components/CameraCapture';

export default function Pedestrian() {
  const { user } = useAuth();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Estados para alertas dentro del modal
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [formData, setFormData] = useState({
    personGivenName: '',
    personFamilyName: '',
    personCode: '',
    gender: '1',
    certificateNumber: '',
    phoneNo: '',
    orgIndexCode: '1',
  });
  const [selectedAccessGroups, setSelectedAccessGroups] = useState([]);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);

  // UI states for camera
  const [cameraLarge, setCameraLarge] = useState(false);
  const [editCameraLarge, setEditCameraLarge] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const [totalPersons, setTotalPersons] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editData, setEditData] = useState({});
  const [editPhotoDataUrl, setEditPhotoDataUrl] = useState(null);

  const [cameraError, setCameraError] = useState('');
  const [editCameraError, setEditCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [editCameraReady, setEditCameraReady] = useState(false);

  const addCameraRef = useRef(null);
  const editCameraRef = useRef(null);

  const loadPersons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await personService.listPersons(searchTerm ? 1 : currentPage, itemsPerPage, searchTerm || null);
      if (response.success) {
        setPersons(response.data.persons);
        setTotalPersons(response.data.total);
        setIsSearching(response.data.isSearch || false);
      }
    } catch (e) {
      console.error(e);
      setError('Error al cargar la lista de personas');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  const loadOrganizations = async () => {
    try {
      const response = await personService.listOrganizations();
      if (response.success) setOrganizations(response.data.organizations);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPersons();
    loadOrganizations();
  }, [currentPage, loadPersons]);

  // Estado para el input de búsqueda temporal
  const [tempSearch, setTempSearch] = useState('');

  // Manejador de búsqueda manual
  const handleSearch = () => {
    setSearchTerm(tempSearch);
    setCurrentPage(1);
  };

  // Manejador para detectar tecla Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleConsultDni = async () => {
    if (!formData.certificateNumber) {
      setModalError('Por favor ingrese un número de DNI');
      return;
    }

    try {
      setLoading(true);
      setModalError('');
      setModalSuccess('');
      const data = await externalService.consultDni(formData.certificateNumber);
      if (data && data.success) {
        setFormData(prev => ({
          ...prev,
          personGivenName: data.nombres || '',
          personFamilyName: `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim(),
        }));
        setModalSuccess('Datos del DNI obtenidos correctamente');
      } else {
        setModalError('No se encontraron datos para este DNI');
      }
    } catch (error) {
      console.error('Error consultando DNI:', error);
      setModalError('Error al consultar DNI');
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (addCameraRef.current) {
      try {
        const dataUrl = await addCameraRef.current.capture();
        setPhotoDataUrl(dataUrl);
        setCameraError('');
      } catch (e) {
        setCameraError(e.message);
      }
    }
  };

  const captureEditPhoto = async () => {
    if (editCameraRef.current) {
      try {
        const dataUrl = await editCameraRef.current.capture();
        setEditPhotoDataUrl(dataUrl);
        setEditCameraError('');
      } catch (e) {
        setEditCameraError(e.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setError('');
    setSuccess('');
    try {
      const dataToSend = { ...formData };
      if (photoDataUrl) dataToSend.photo = photoDataUrl;
      const response = await personService.addPerson(dataToSend);
      console.log('Respuesta completa al crear persona:', response);
      if (response.success) {
        // Extraer el personCode real para asignar access level
        let realPersonCode = null;
        if (response.data?.person?.personCode) {
          realPersonCode = response.data.person.personCode;
        } else if (response.data?.personCode) {
          realPersonCode = response.data.personCode;
        } else if (response.data?.data?.personCode) {
          realPersonCode = response.data.data.personCode;
        } else if (response.data?.person) {
          for (const key in response.data.person) {
            if (key.toLowerCase().includes('code')) {
              realPersonCode = response.data.person[key];
              break;
            }
          }
        }

        if (!realPersonCode) {
          setModalError('No se pudo extraer el personCode de la respuesta. Revisa la consola.');
          return;
        }
        try {
          for (const groupId of selectedAccessGroups) {
            try {
              await personService.addPersonToPrivilegeGroups(realPersonCode, groupId);
            } catch (err2) {
              setModalError('Persona creada pero error al asignar acceso: ' + err2.message);
            }
          }
        } catch (err2) {
          setModalError('Error inesperado al asignar acceso: ' + err2.message);
        }
        setSuccess('Peatón agregado exitosamente');
        setShowAddModal(false);
        setFormData({ personGivenName: '', personFamilyName: '', personCode: '', gender: '1', certificateNumber: '', phoneNo: '', orgIndexCode: '1' });
        setPhotoDataUrl(null);
        setSelectedAccessGroups([]);
        loadPersons();
      }
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Error al agregar peatón');
    }
  };

  const handleEditClick = (person) => {
    setSelectedPerson(person);
    setEditData({
      personGivenName: person.personGivenName || '',
      personFamilyName: person.personFamilyName || '',
      personCode: person.personCode || '',
      gender: person.gender?.toString() || '0',
      phoneNo: person.phoneNo || '',
      email: person.email || '',
      orgIndexCode: person.orgIndexCode || '1',
      certificateNumber: person.certificateNumber || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const dataToSend = { ...editData };
      if (editPhotoDataUrl) dataToSend.photo = editPhotoDataUrl; // Asegurarse que el backend maneje 'photo' en update
      await personService.updatePerson(selectedPerson.personId, dataToSend);
      setSuccess('Persona actualizada exitosamente');
      setShowEditModal(false);
      loadPersons();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar persona');
    }
  };

  const totalPages = Math.ceil(totalPersons / itemsPerPage);
  const currentPersons = persons;
  const canEdit = user?.role === 'admin' || user?.role === 'gestion_peatonal';

  const getOrgName = (orgIndexCode) => {
    if (!orgIndexCode) return 'N/A';
    const org = organizations.find((o) => String(o.orgIndexCode) === String(orgIndexCode));
    return org ? org.orgName : `N/A (${orgIndexCode})`;
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Gestión Peatonal</h2>
          {canEdit && (
            <button className="btn" style={{ backgroundColor: '#0D5F2C', color: 'white' }} onClick={() => setShowAddModal(true)}>
              <i className="bi bi-plus-lg me-2"></i>
              Agregar Peatón
            </button>
          )}
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

        <div className="card mb-3">
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-8">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por nombre o código..."
                    value={tempSearch}
                    onChange={(e) => setTempSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    className="btn"
                    style={{ backgroundColor: '#0D5F2C', color: 'white' }}
                    type="button"
                    onClick={handleSearch}
                  >
                    <i className="bi bi-search me-2"></i>
                    Buscar
                  </button>
                </div>
              </div>
              <div className="col-md-4 text-end mt-2 mt-md-0">
                <span className="text-muted">
                  {isSearching ? `${totalPersons} resultado${totalPersons !== 1 ? 's' : ''}` : `Mostrando ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalPersons)} de ${totalPersons} personas`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border" style={{ color: '#0D5F2C' }} role="status"><span className="visually-hidden">Cargando...</span></div></div>
        ) : (
          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th className="d-none d-md-table-cell">Código</th>
                      <th>Nombre</th>
                      <th>DNI</th>
                      <th className="d-none d-lg-table-cell">Fecha Inicio</th>
                      <th className="d-none d-lg-table-cell">Fecha Fin</th>
                      <th className="d-none d-lg-table-cell">Organización</th>
                      {canEdit && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPersons.length === 0 ? (
                      <tr><td colSpan={canEdit ? 7 : 6} className="text-center">No se encontraron personas</td></tr>
                    ) : (
                      currentPersons.map((person) => (
                        <tr key={person.personCode}>
                          <td className="d-none d-md-table-cell">{person.personCode}</td>
                          <td>{person.personName}</td>
                          <td>{person.certificateNumber || 'N/A'}</td>
                          <td className="d-none d-lg-table-cell">{person.beginTime ? (typeof person.beginTime === 'number' ? new Date(person.beginTime * 1000).toLocaleDateString('es-ES') : new Date(person.beginTime).toLocaleDateString('es-ES')) : 'N/A'}</td>
                          <td className="d-none d-lg-table-cell">{person.endTime ? (typeof person.endTime === 'number' ? new Date(person.endTime * 1000).toLocaleDateString('es-ES') : new Date(person.endTime).toLocaleDateString('es-ES')) : 'N/A'}</td>
                          <td className="d-none d-lg-table-cell">{getOrgName(person.orgIndexCode)}</td>
                          {canEdit && (
                            <td>
                              <button className="btn btn-sm" style={{ backgroundColor: '#0D5F2C', color: 'white' }} onClick={() => handleEditClick(person)} title="Editar persona"><i className="bi bi-pencil me-1"></i>Editar</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!isSearching && totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div><span className="text-muted">Página {currentPage} de {totalPages}</span></div>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>«</button></li>
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>‹</button></li>
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  if (pageNumber === 1 || pageNumber === totalPages || (pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2)) {
                    return (<li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}><button className="page-link" onClick={() => handlePageChange(pageNumber)}>{pageNumber}</button></li>);
                  } else if (pageNumber === currentPage - 3 || pageNumber === currentPage + 3) {
                    return (<li key={pageNumber} className="page-item disabled"><span className="page-link">...</span></li>);
                  }
                  return null;
                })}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}><button className="page-link" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</button></li>
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}><button className="page-link" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>»</button></li>
              </ul>
            </nav>
          </div>
        )}

        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Agregar Peatón</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    {modalError && (
                      <div className="alert alert-danger" role="alert">
                        {modalError}
                      </div>
                    )}
                    {modalSuccess && (
                      <div className="alert alert-success" role="alert">
                        {modalSuccess}
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label">DNI/Documento</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={formData.certificateNumber}
                          onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                          placeholder="Número de documento de identidad"
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={handleConsultDni}
                        >
                          Consultar DNI
                        </button>
                      </div>
                    </div>
                    <div className="mb-3"><label className="form-label">Nombre</label><input type="text" className="form-control" value={formData.personGivenName} onChange={(e) => setFormData({ ...formData, personGivenName: e.target.value })} required /></div>
                    <div className="mb-3"><label className="form-label">Apellido</label><input type="text" className="form-control" value={formData.personFamilyName} onChange={(e) => setFormData({ ...formData, personFamilyName: e.target.value })} required /></div>
                    <div className="mb-3"><label className="form-label">ID</label><input type="text" className="form-control" value={formData.personCode} onChange={(e) => setFormData({ ...formData, personCode: e.target.value })} /></div>

                    <div className="mb-3"><label className="form-label">Género</label><select className="form-select" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}><option value="1">Masculino</option><option value="2">Femenino</option></select></div>
                    <div className="mb-3"><label className="form-label">Teléfono</label><input type="text" className="form-control" value={formData.phoneNo} onChange={(e) => setFormData({ ...formData, phoneNo: e.target.value })} /></div>

                    <div className="mb-3">
                      <label className="form-label">Asignar Acceso</label>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="acceso-visitas"
                          checked={selectedAccessGroups.includes("3")}
                          onChange={e => {
                            if (e.target.checked) setSelectedAccessGroups(prev => [...prev, "3"]);
                            else setSelectedAccessGroups(prev => prev.filter(id => id !== "3"));
                          }}
                        />
                        <label className="form-check-label" htmlFor="acceso-visitas">Acceso Visitas</label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="acceso-total"
                          checked={selectedAccessGroups.includes("2")}
                          onChange={e => {
                            if (e.target.checked) setSelectedAccessGroups(prev => [...prev, "2"]);
                            else setSelectedAccessGroups(prev => prev.filter(id => id !== "2"));
                          }}
                        />
                        <label className="form-check-label" htmlFor="acceso-total">ACCESO-TOTAL</label>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Foto</label>
                      <div className="d-flex flex-column align-items-center gap-2">
                        <div style={{
                          width: cameraLarge ? 480 : 240,
                          height: cameraLarge ? 360 : 180,
                          position: 'relative',
                          transition: 'width 0.2s, height 0.2s'
                        }}>
                          <CameraCapture
                            ref={addCameraRef}
                            isActive={showAddModal}
                            onError={setCameraError}
                            onCameraReady={() => setCameraReady(true)}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{ position: 'absolute', bottom: 5, right: 5, zIndex: 2 }}
                            onClick={() => setCameraLarge((prev) => !prev)}
                            title={cameraLarge ? 'Reducir cámara' : 'Agrandar cámara'}
                          >
                            {cameraLarge ? <span>🔍-</span> : <span>🔍+</span>}
                          </button>
                        </div>

                        {photoDataUrl && (
                          <img
                            src={photoDataUrl}
                            alt="captura"
                            style={{
                              width: 160,
                              borderRadius: 4,
                              border: '1px solid #ddd',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              marginBottom: '8px'
                            }}
                          />
                        )}
                        <div className="mb-2 mt-2 w-100 d-flex justify-content-center">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm me-2"
                            onClick={capturePhoto}
                            disabled={!cameraReady}
                          >
                            {cameraReady ? 'Capturar' : 'Esperando...'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm me-1"
                            onClick={() => setPhotoDataUrl(null)}
                            disabled={!photoDataUrl}
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                      {cameraError && <div className="alert alert-warning mt-2">{cameraError}</div>}
                    </div>

                    <div className="mb-3"><label className="form-label">Organización</label><select className="form-select" value={formData.orgIndexCode} onChange={(e) => setFormData({ ...formData, orgIndexCode: e.target.value })}>{organizations.map((org) => (<option key={org.orgIndexCode} value={org.orgIndexCode}>{org.orgName}</option>))}</select></div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                    <button type="submit" className="btn" style={{ backgroundColor: '#0D5F2C', color: 'white' }}>Agregar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedPerson && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Editar Persona: {selectedPerson.personName}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
                </div>
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-body">
                    <div className="alert alert-info"><i className="bi bi-info-circle me-2"></i>Seleccione los campos que desea modificar</div>
                    <div className="mb-3"><label className="form-label">Código de Persona</label><input type="text" className="form-control" value={selectedPerson.personCode} disabled /><small className="text-muted">Este campo no se puede modificar</small></div>
                    <div className="mb-3"><label className="form-label">Nombre</label><input type="text" className="form-control" value={editData.personGivenName} onChange={(e) => setEditData({ ...editData, personGivenName: e.target.value })} placeholder="Nombre(s)" /></div>
                    <div className="mb-3"><label className="form-label">Apellido</label><input type="text" className="form-control" value={editData.personFamilyName} onChange={(e) => setEditData({ ...editData, personFamilyName: e.target.value })} placeholder="Apellido(s)" /></div>
                    <div className="mb-3"><label className="form-label">DNI/Documento</label><input type="text" className="form-control" value={editData.certificateNumber} onChange={(e) => setEditData({ ...editData, certificateNumber: e.target.value })} placeholder="Número de documento" /></div>
                    <div className="mb-3"><label className="form-label">Género</label><select className="form-select" value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}><option value="0">No especificado</option><option value="1">Masculino</option><option value="2">Femenino</option></select></div>
                    <div className="mb-3"><label className="form-label">Teléfono</label><input type="text" className="form-control" value={editData.phoneNo} onChange={(e) => setEditData({ ...editData, phoneNo: e.target.value })} placeholder="Número de teléfono" /></div>
                    <div className="mb-3"><label className="form-label">Email</label><input type="email" className="form-control" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="Correo electrónico" /></div>
                    <div className="mb-3"><label className="form-label">Organización</label><select className="form-select" value={editData.orgIndexCode} onChange={(e) => setEditData({ ...editData, orgIndexCode: e.target.value })}>{organizations.map((org) => (<option key={org.orgIndexCode} value={org.orgIndexCode}>{org.orgName}</option>))}</select></div>
                    <div className="mb-3">
                      <label className="form-label">Foto</label>
                      <div className="d-flex flex-column align-items-center gap-2">
                        <div style={{
                          width: editCameraLarge ? 480 : 240,
                          height: editCameraLarge ? 360 : 180,
                          position: 'relative',
                          transition: 'width 0.2s, height 0.2s'
                        }}>
                          <CameraCapture
                            ref={editCameraRef}
                            isActive={showEditModal}
                            onError={setEditCameraError}
                            onCameraReady={() => setEditCameraReady(true)}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            style={{ position: 'absolute', bottom: 5, right: 5, zIndex: 2 }}
                            onClick={() => setEditCameraLarge((prev) => !prev)}
                            title={editCameraLarge ? 'Reducir cámara' : 'Agrandar cámara'}
                          >
                            {editCameraLarge ? <span>🔍-</span> : <span>🔍+</span>}
                          </button>
                        </div>
                        {editPhotoDataUrl && (
                          <img
                            src={editPhotoDataUrl}
                            alt="captura"
                            style={{
                              width: 160,
                              borderRadius: 4,
                              border: '1px solid #ddd',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              marginBottom: '8px'
                            }}
                          />
                        )}
                        <div className="mb-2 mt-2 w-100 d-flex justify-content-center">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm me-2"
                            onClick={captureEditPhoto}
                            disabled={!editCameraReady}
                          >
                            {editCameraReady ? 'Capturar' : 'Esperando...'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm me-1"
                            onClick={() => setEditPhotoDataUrl(null)}
                            disabled={!editPhotoDataUrl}
                          >
                            Borrar
                          </button>
                        </div>

                        {editCameraError && <div className="alert alert-warning mt-2">{editCameraError}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button><button type="submit" className="btn" style={{ backgroundColor: '#0D5F2C', color: 'white' }}><i className="bi bi-save me-2"></i>Guardar Cambios</button></div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
