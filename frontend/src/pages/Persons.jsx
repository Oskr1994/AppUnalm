import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { personService } from '../services/api';
import Navbar from '../components/Navbar';

export default function Persons() {
  const { user } = useAuth();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [accessLevels, setAccessLevels] = useState([]);
  const [formData, setFormData] = useState({
    personGivenName: '',
    personFamilyName: '',
    personCode: '',
    gender: '1',
    certificateNumber: '',
    phoneNo: '',
    plateNo: '',  // Campo para la placa
    effectiveDate: '',  // Fecha de inicio
    expiredDate: '',  // Fecha de fin
    orgIndexCode: '1',
    photo: '',  // Foto en base64
  });
  const [photoPreview, setPhotoPreview] = useState('');
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
  const [cameraSize, setCameraSize] = useState('normal'); // 'normal' o 'large'
<<<<<<< HEAD
=======
  const [showPhotoModal, setShowPhotoModal] = useState(false);
>>>>>>> 69b9cd5d664057455299bd67b0605b1077f65a54

  useEffect(() => {
    loadPersons();
    loadOrganizations();
    loadAccessLevels();
  }, [currentPage]);

  // Efecto para búsqueda con debounce
  useEffect(() => {
    if (searchTerm) {
      const timeoutId = setTimeout(() => {
        loadPersons();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      loadPersons();
    }
  }, [searchTerm]);

  // Efecto para inicializar la cámara cuando se abre el modal
  useEffect(() => {
    if (showCameraModal) {
      initializeCamera();
    }
  }, [showCameraModal]);

  const initializeCamera = async () => {
    const video = document.getElementById('camera-video');
    const status = document.getElementById('camera-status');
    const captureBtn = document.getElementById('capture-btn');

    if (!video || !status || !captureBtn) return;

    try {
      status.textContent = 'Verificando contexto seguro...';
      if (!window.isSecureContext) {
        status.textContent = 'ERROR: No estás en un contexto seguro (HTTPS). La cámara requiere HTTPS.';
        return;
      }

      status.textContent = 'Verificando soporte de getUserMedia...';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'ERROR: Tu navegador no soporta getUserMedia.';
        return;
      }

      status.textContent = 'Solicitando permisos de cámara...';
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      window.cameraStream = stream;
      status.textContent = 'Permisos concedidos. Iniciando video...';

      video.srcObject = stream;
      video.style.display = 'block';

      video.onloadedmetadata = () => {
        status.textContent = '¡Cámara funcionando correctamente!';
        captureBtn.disabled = false;
        video.play().catch(err => {
          status.textContent = 'ERROR al reproducir video: ' + err.message;
        });
      };

    } catch (error) {
      console.error('Error completo:', error);
      if (error.name === 'NotAllowedError') {
        status.textContent = 'ERROR: Permiso denegado. Haz clic en el icono de la cámara en la barra de direcciones.';
      } else if (error.name === 'NotFoundError') {
        status.textContent = 'ERROR: No se encontró cámara.';
      } else {
        status.textContent = 'ERROR: ' + error.message;
      }
      captureBtn.disabled = true;
    }
  };

  const loadPersons = async () => {
    try {
      setLoading(true);
      const response = await personService.listPersons(
        searchTerm ? 1 : currentPage, 
        itemsPerPage,
        searchTerm || null
      );
      if (response.success) {
        setPersons(response.data.persons);
        setTotalPersons(response.data.total);
        setIsSearching(response.data.isSearch || false);
      }
    } catch (error) {
      console.error('Error al cargar personas:', error);
      setError('Error al cargar la lista de personas');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await personService.listOrganizations();
      if (response.success) {
        setOrganizations(response.data.organizations);
      }
    } catch (error) {
      console.error('Error al cargar organizaciones:', error);
    }
  };

  const loadAccessLevels = async () => {
    try {
      const response = await personService.listAccessLevels();
      if (response.success) {
        setAccessLevels(response.data.groups);
      }
    } catch (error) {
      console.error('Error al cargar access levels:', error);
    }
  };

  // Funciones para la cámara
  const openCamera = () => {
    setShowCameraModal(true);
  };

  const closeCamera = () => {
    setShowCameraModal(false);
    setCameraSize('normal'); // Resetear tamaño al cerrar
    // Detener stream de cámara si existe
    if (window.cameraStream) {
      window.cameraStream.getTracks().forEach(track => track.stop());
      window.cameraStream = null;
    }
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convertir a base64
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setFormData({ ...formData, photo: photoData });
      setPhotoPreview(photoData);
      closeCamera();
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo: '' });
    setPhotoPreview('');
  };

  const toggleCameraSize = () => {
    setCameraSize(cameraSize === 'normal' ? 'large' : 'normal');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Preparar datos para enviar
      const dataToSend = { ...formData };
      
      // Convertir fechas al formato ISO requerido por la API
      if (dataToSend.effectiveDate) {
        dataToSend.effectiveDate = `${dataToSend.effectiveDate}T00:00:00-05:00`;
      }
      if (dataToSend.expiredDate) {
        dataToSend.expiredDate = `${dataToSend.expiredDate}T23:59:59-05:00`;
      }
      
      const response = await personService.addPerson(dataToSend);
      if (response.success) {
        setSuccess('Persona agregada exitosamente');
        setShowAddModal(false);
        setFormData({
          personGivenName: '',
          personFamilyName: '',
          personCode: '',
          gender: '1',
          certificateNumber: '',
          phoneNo: '',
          plateNo: '',
          effectiveDate: '',
          expiredDate: '',
          orgIndexCode: '1',
          photo: '',
        });
        setPhotoPreview('');
        loadPersons();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al agregar persona');
    }
  };

  const handleAssignAccess = async (personCode) => {
    const privilegeGroupId = prompt('Ingrese el ID del grupo de privilegios:');
    if (!privilegeGroupId) return;

    try {
      const response = await personService.assignAccessLevel(personCode, privilegeGroupId);
      if (response.success) {
        alert('Access level asignado exitosamente');
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al asignar access level');
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
      plateNo: person.plateNo || '',
      effectiveDate: '',
      expiredDate: '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Preparar datos para enviar
      const dataToSend = { ...editData };
      
      // Convertir fechas al formato ISO requerido por la API
      if (dataToSend.effectiveDate) {
        dataToSend.effectiveDate = `${dataToSend.effectiveDate}T00:00:00-05:00`;
      }
      if (dataToSend.expiredDate) {
        dataToSend.expiredDate = `${dataToSend.expiredDate}T23:59:59-05:00`;
      }
      
      await personService.updatePerson(selectedPerson.personId, dataToSend);
      setSuccess('Persona actualizada exitosamente');
      setShowEditModal(false);
      loadPersons();
    } catch (error) {
      setError(error.response?.data?.detail || 'Error al actualizar persona');
    }
  };

  // Los resultados ya vienen filtrados del servidor
  const totalPages = Math.ceil(totalPersons / itemsPerPage);
  const currentPersons = persons;

  const canEdit = user?.role === 'admin' || user?.role === 'operador' || user?.role === 'personal_seguridad';

  // Función para obtener el nombre de la organización por su código
  const getOrgName = (orgIndexCode) => {
    if (!orgIndexCode) return 'N/A';
    // Convertir ambos a string para comparación flexible
    const org = organizations.find(o => String(o.orgIndexCode) === String(orgIndexCode));
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
          <h2>Gestión Vehicular</h2>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-plus-lg me-2"></i>
              Agregar Persona
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
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por nombre o código en todas las personas..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="col-md-4 text-end mt-2 mt-md-0">
                <span className="text-muted">
                  {isSearching ? (
                    `${totalPersons} resultado${totalPersons !== 1 ? 's' : ''} encontrado${totalPersons !== 1 ? 's' : ''}`
                  ) : (
                    `Mostrando ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, totalPersons)} de ${totalPersons} personas`
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

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
                      <th className="d-none d-md-table-cell">Código</th>
                      <th>Nombre</th>
                      <th>DNI</th>
                      <th>Placa</th>
                      <th className="d-none d-lg-table-cell">Fecha Inicio</th>
                      <th className="d-none d-lg-table-cell">Fecha Fin</th>
                      <th className="d-none d-lg-table-cell">Organización</th>
                      {canEdit && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPersons.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 9 : 8} className="text-center">
                          No se encontraron personas
                        </td>
                      </tr>
                    ) : (
                      currentPersons.map((person) => (
                        <tr key={person.personCode}>
                          <td className="d-none d-md-table-cell">{person.personCode}</td>
                          <td>{person.personName}</td>
                          <td>{person.certificateNumber || 'N/A'}</td>
                          <td>{person.plateNo || 'N/A'}</td>
                          <td className="d-none d-lg-table-cell">
                            {person.beginTime 
                              ? (() => {
                                  try {
                                    // Puede ser timestamp Unix (número) o ISO string
                                    const date = typeof person.beginTime === 'number' 
                                      ? new Date(person.beginTime * 1000)
                                      : new Date(person.beginTime);
                                    return date.toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    });
                                  } catch (e) {
                                    return person.beginTime;
                                  }
                                })()
                              : 'N/A'}
                          </td>
                          <td className="d-none d-lg-table-cell">
                            {person.endTime 
                              ? (() => {
                                  try {
                                    // Puede ser timestamp Unix (número) o ISO string
                                    const date = typeof person.endTime === 'number' 
                                      ? new Date(person.endTime * 1000)
                                      : new Date(person.endTime);
                                    return date.toLocaleDateString('es-ES', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    });
                                  } catch (e) {
                                    return person.endTime;
                                  }
                                })()
                              : 'N/A'}
                          </td>
                          <td className="d-none d-lg-table-cell">{getOrgName(person.orgIndexCode)}</td>
                          {canEdit && (
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEditClick(person)}
                                title="Editar persona"
                              >
                                <i className="bi bi-pencil me-1"></i>
                                Editar
                              </button>
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

        {/* Controles de paginación */}
        {!isSearching && totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              <span className="text-muted">
                Página {currentPage} de {totalPages}
              </span>
            </div>
            <nav>
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    «
                  </button>
                </li>
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </button>
                </li>
                
                {/* Mostrar páginas */}
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  // Mostrar solo páginas cercanas a la actual
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2)
                  ) {
                    return (
                      <li
                        key={pageNumber}
                        className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      </li>
                    );
                  } else if (
                    pageNumber === currentPage - 3 ||
                    pageNumber === currentPage + 3
                  ) {
                    return (
                      <li key={pageNumber} className="page-item disabled">
                        <span className="page-link">...</span>
                      </li>
                    );
                  }
                  return null;
                })}

                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </button>
                </li>
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    »
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}

        {/* Modal para agregar persona */}
        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Agregar Persona</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowAddModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Nombre</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.personGivenName}
                        onChange={(e) => setFormData({ ...formData, personGivenName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Apellido</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.personFamilyName}
                        onChange={(e) => setFormData({ ...formData, personFamilyName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">ID</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.personCode}
                        onChange={(e) => setFormData({ ...formData, personCode: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">DNI/Documento</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.certificateNumber}
                        onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                        placeholder="Número de documento de identidad"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Género</label>
                      <select
                        className="form-select"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="1">Masculino</option>
                        <option value="2">Femenino</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Teléfono</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.phoneNo}
                        onChange={(e) => setFormData({ ...formData, phoneNo: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Foto</label>
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={openCamera}
                        >
                          <i className="bi bi-camera me-2"></i>
                          Tomar Foto
                        </button>
                        {photoPreview && (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={removePhoto}
                          >
                            <i className="bi bi-trash me-1"></i>
                            Quitar
                          </button>
                        )}
                      </div>
                      {photoPreview && (
                        <div className="mt-2">
                          <img
                            src={photoPreview}
                            alt="Vista previa"
                            className="img-thumbnail"
                            style={{ maxWidth: '200px', maxHeight: '200px' }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Placa del Vehículo</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.plateNo}
                        onChange={(e) => setFormData({ ...formData, plateNo: e.target.value })}
                        placeholder="Ej: ABC123 (opcional)"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Fecha Inicio de Vigencia</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.effectiveDate}
                        onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      />
                      <small className="text-muted">Opcional - Solo si agregó placa. Por defecto: hoy</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Fecha Fin de Vigencia</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.expiredDate}
                        onChange={(e) => setFormData({ ...formData, expiredDate: e.target.value })}
                      />
                      <small className="text-muted">Opcional - Solo si agregó placa. Por defecto: +2 años</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Organización</label>
                      <select
                        className="form-select"
                        value={formData.orgIndexCode}
                        onChange={(e) => setFormData({ ...formData, orgIndexCode: e.target.value })}
                      >
                        {organizations.map((org) => (
                          <option key={org.orgIndexCode} value={org.orgIndexCode}>
                            {org.orgName}
                          </option>
                        ))}
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
                      Agregar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cámara para tomar foto */}
        {showCameraModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
            <div className="modal-dialog modal-xl modal-fullscreen">
              <div className="modal-content" style={{ backgroundColor: '#000' }}>
                <div className="modal-header border-0">
                  <h5 className="modal-title text-white">Tomar Foto</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={closeCamera}
                  ></button>
                </div>
                <div className="modal-body d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '70vh' }}>
                  <div className="text-center mb-4">
                    <video
                      id="camera-video"
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: cameraSize === 'large' ? '90vw' : '100%',
                        maxWidth: cameraSize === 'large' ? 'none' : '100%',
                        height: cameraSize === 'large' ? '70vh' : '60vh',
                        maxHeight: cameraSize === 'large' ? 'none' : '60vh',
                        border: '2px solid #fff',
                        borderRadius: '8px',
                        boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                        objectFit: 'cover'
                      }}
                    ></video>
                    <canvas id="camera-canvas" style={{ display: 'none' }}></canvas>
                  </div>
                  <div className="d-flex gap-3 justify-content-center">
                    <button
                      type="button"
                      className="btn btn-info btn-lg"
                      onClick={toggleCameraSize}
                      title={cameraSize === 'normal' ? 'Agrandar vista' : 'Reducir vista'}
                    >
                      <i className={`bi ${cameraSize === 'normal' ? 'bi-arrows-fullscreen' : 'bi-arrows-angle-contract'} me-2`}></i>
                      {cameraSize === 'normal' ? 'Agrandar' : 'Reducir'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      onClick={capturePhoto}
                      id="capture-btn"
                      disabled
                    >
                      <i className="bi bi-camera me-2"></i>
                      Capturar Foto
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg"
                      onClick={closeCamera}
                    >
                      Cancelar
                    </button>
                  </div>
                  <div id="camera-status" className="mt-3 text-white"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar persona */}
        {showEditModal && selectedPerson && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Editar Persona: {selectedPerson.personName}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowEditModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-body">
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      Seleccione los campos que desea modificar
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Código de Persona</label>
                      <input
                        type="text"
                        className="form-control"
                        value={selectedPerson.personCode}
                        disabled
                      />
                      <small className="text-muted">Este campo no se puede modificar</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Nombre</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.personGivenName}
                        onChange={(e) => setEditData({ ...editData, personGivenName: e.target.value })}
                        placeholder="Nombre(s)"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Apellido</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.personFamilyName}
                        onChange={(e) => setEditData({ ...editData, personFamilyName: e.target.value })}
                        placeholder="Apellido(s)"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">DNI/Documento</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.certificateNumber}
                        onChange={(e) => setEditData({ ...editData, certificateNumber: e.target.value })}
                        placeholder="Número de documento"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Género</label>
                      <select
                        className="form-select"
                        value={editData.gender}
                        onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                      >
                        <option value="0">No especificado</option>
                        <option value="1">Masculino</option>
                        <option value="2">Femenino</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Teléfono</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.phoneNo}
                        onChange={(e) => setEditData({ ...editData, phoneNo: e.target.value })}
                        placeholder="Número de teléfono"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        placeholder="Correo electrónico"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Placa del Vehículo</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editData.plateNo}
                        onChange={(e) => setEditData({ ...editData, plateNo: e.target.value })}
                        placeholder="Ej: ABC123"
                      />
                      <small className="text-muted">Placa actual: {selectedPerson.plateNo || 'Sin vehículo'}</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Fecha Inicio de Vigencia</label>
                      <input
                        type="date"
                        className="form-control"
                        value={editData.effectiveDate}
                        onChange={(e) => setEditData({ ...editData, effectiveDate: e.target.value })}
                      />
                      <small className="text-muted">Opcional - Solo si actualizó la placa. Por defecto: hoy</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Fecha Fin de Vigencia</label>
                      <input
                        type="date"
                        className="form-control"
                        value={editData.expiredDate}
                        onChange={(e) => setEditData({ ...editData, expiredDate: e.target.value })}
                      />
                      <small className="text-muted">Opcional - Solo si actualizó la placa. Por defecto: +2 años</small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Organización</label>
                      <select
                        className="form-select"
                        value={editData.orgIndexCode}
                        onChange={(e) => setEditData({ ...editData, orgIndexCode: e.target.value })}
                      >
                        {organizations.map((org) => (
                          <option key={org.orgIndexCode} value={org.orgIndexCode}>
                            {org.orgName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-save me-2"></i>
                      Guardar Cambios
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
