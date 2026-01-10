import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { personService } from '../services/api';
import Navbar from '../components/Navbar';
import * as faceapi from 'face-api.js';

export default function Pedestrian() {
  const { user } = useAuth();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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
  const [cameraLarge, setCameraLarge] = useState(false);
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
  const [editCameraReady, setEditCameraReady] = useState(false);
  const [editCameraError, setEditCameraError] = useState('');
  const [editCameraLarge, setEditCameraLarge] = useState(false);
  const editVideoRef = useRef(null);
  const editCanvasRef = useRef(null);
  const editOverlayCanvasRef = useRef(null);
  const editStreamRef = useRef(null);
  const editAnimationRef = useRef(null);
    // Funciones para cámara en edición
    const startEditCamera = async () => {
      try {
        setEditCameraError('');
        if (!window.isSecureContext) {
          setEditCameraError('La cámara requiere una conexión segura (HTTPS). Accede desde localhost o un sitio HTTPS.');
          return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setEditCameraError('Tu navegador no soporta acceso a la cámara.');
          return;
        }
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' });
          if (permissionStatus.state === 'denied') {
            setEditCameraError('Permiso de cámara denegado. Por favor, permite el acceso en la configuración de tu navegador.');
            return;
          }
        } catch (permError) {
          console.warn('No se pudo verificar permisos de cámara:', permError);
        }
        const constraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        editStreamRef.current = s;
        if (editVideoRef.current) {
          editVideoRef.current.srcObject = s;
          editVideoRef.current.onloadedmetadata = () => {
            editVideoRef.current.play().then(() => {
              setEditCameraReady(true);
              if (modelsLoaded) startEditFaceDetection();
            }).catch(error => {
              setEditCameraError('Error al iniciar la reproducción del video.');
            });
          };
        }
      } catch (e) {
        setEditCameraError('Error al acceder a la cámara: ' + (e.message || 'Error desconocido'));
      }
    };

    const stopEditCamera = () => {
      if (editStreamRef.current) {
        editStreamRef.current.getTracks().forEach((t) => t.stop());
        editStreamRef.current = null;
      }
      if (editAnimationRef.current) {
        cancelAnimationFrame(editAnimationRef.current);
        editAnimationRef.current = null;
      }
      setEditCameraReady(false);
      setEditCameraError('');
    };

    const restartEditCamera = async () => {
      stopEditCamera();
      setTimeout(() => startEditCamera(), 500);
    };

    const startEditFaceDetection = () => {
      const video = editVideoRef.current;
      const overlayCanvas = editOverlayCanvasRef.current;
      if (!video || !overlayCanvas || !modelsLoaded) return;
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(overlayCanvas, displaySize);
      const detectFaces = async () => {
        if (!editStreamRef.current) return;
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);
        editAnimationRef.current = requestAnimationFrame(detectFaces);
      };
      detectFaces();
    };

    const captureEditPhoto = async () => {
      const video = editVideoRef.current;
      const canvas = editCanvasRef.current;
      if (!video || !canvas) {
        setEditCameraError('Error: Elementos de captura no disponibles.');
        return;
      }
      if (!editStreamRef.current) {
        setEditCameraError('Error: Cámara no activa. Intenta recargar la página.');
        return;
      }
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setEditCameraError('Error: Video no está listo. Espera a que la cámara se inicie completamente.');
        return;
      }
      try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
        if (!detection) {
          setEditCameraError('No se detectó ningún rostro. Asegúrate de que tu rostro esté visible y bien iluminado.');
          return;
        }
        const { box } = detection.detection;
        const padding = 0.3;
        const width = box.width * (1 + padding);
        const height = box.height * (1 + padding);
        const x = Math.max(0, box.x - (width - box.width) / 2);
        const y = Math.max(0, box.y - (height - box.height) / 2);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = width;
        croppedCanvas.height = height;
        croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
        const targetWidth = 300;
        const targetHeight = 400;
        const aspectRatio = width / height;
        let finalWidth, finalHeight;
        if (aspectRatio > targetWidth / targetHeight) {
          finalWidth = targetWidth;
          finalHeight = targetWidth / aspectRatio;
        } else {
          finalHeight = targetHeight;
          finalWidth = targetHeight * aspectRatio;
        }
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        finalCtx.drawImage(croppedCanvas, 0, 0, width, height, (targetWidth - finalWidth) / 2, (targetHeight - finalHeight) / 2, finalWidth, finalHeight);
        const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
        setEditPhotoDataUrl(dataUrl);
        setEditCameraError('');
      } catch (error) {
        setEditCameraError('Error al capturar la foto. Inténtalo de nuevo.');
      }
    };
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

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

  const loadFaceDetectionModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      setModelsLoaded(true);
      console.log('Modelos de detección facial cargados');
    } catch (error) {
      console.error('Error al cargar modelos de detección facial:', error);
    }
  };

  useEffect(() => {
    loadPersons();
    loadOrganizations();
    loadFaceDetectionModels();
  }, [currentPage, loadPersons]);

  useEffect(() => {
    if (searchTerm) {
      const timeoutId = setTimeout(() => loadPersons(), 500);
      return () => clearTimeout(timeoutId);
    } else {
      loadPersons();
    }
  }, [searchTerm, loadPersons]);

  useEffect(() => {
    if (showAddModal) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showAddModal]);

  const startCamera = async () => {
    try {
      setCameraError('');

      // Verificar si estamos en un contexto seguro
      if (!window.isSecureContext) {
        setCameraError('La cámara requiere una conexión segura (HTTPS). Accede desde localhost o un sitio HTTPS.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Tu navegador no soporta acceso a la cámara.');
        return;
      }

      // Verificar permisos de cámara
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' });
        if (permissionStatus.state === 'denied') {
          setCameraError('Permiso de cámara denegado. Por favor, permite el acceso en la configuración de tu navegador.');
          return;
        }
      } catch (permError) {
        console.warn('No se pudo verificar permisos de cámara:', permError);
      }

      // Pedir cámara frontal cuando sea posible (user-facing)
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      console.log('Solicitando acceso a cámara...');
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Acceso a cámara concedido');

      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, playing...');
          videoRef.current.play().then(() => {
            console.log('Video playing successfully');
            setCameraReady(true);
            if (modelsLoaded) startFaceDetection();
          }).catch(error => {
            console.error('Error al reproducir video:', error);
            setCameraError('Error al iniciar la reproducción del video.');
          });
        };
      }
    } catch (e) {
      console.error('Error completo al acceder a cámara:', e);
      if (e.name === 'NotAllowedError') {
        setCameraError('Permiso denegado para acceder a la cámara. Haz clic en el icono de la cámara en la barra de direcciones y permite el acceso.');
      } else if (e.name === 'NotFoundError') {
        setCameraError('No se encontró una cámara en tu dispositivo. Verifica que tengas una cámara conectada.');
      } else if (e.name === 'NotReadableError') {
        setCameraError('La cámara está siendo usada por otra aplicación. Cierra otras aplicaciones que puedan estar usando la cámara.');
      } else if (e.name === 'OverconstrainedError') {
        setCameraError('La configuración de cámara solicitada no es soportada. Intentando con configuración básica...');
        // Intentar con configuración más básica
        try {
          const basicConstraints = { video: true };
          const s = await navigator.mediaDevices.getUserMedia(basicConstraints);
          streamRef.current = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch(error => {
                console.error('Error al reproducir video básico:', error);
              });
            };
          }
        } catch (basicError) {
          setCameraError('Error al acceder a la cámara incluso con configuración básica.');
        }
      } else {
        setCameraError(`Error al acceder a la cámara: ${e.message || 'Error desconocido'}`);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setCameraReady(false);
    setCameraError('');
  };

  const restartCamera = async () => {
    stopCamera();
    setTimeout(() => startCamera(), 500); // Pequeño delay para asegurar que se libere
  };

  const startFaceDetection = () => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!video || !overlayCanvas || !modelsLoaded) return;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(overlayCanvas, displaySize);

    const detectFaces = async () => {
      if (!streamRef.current) return;

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = overlayCanvas.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);

      animationRef.current = requestAnimationFrame(detectFaces);
    };

    detectFaces();
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      console.error('Video o canvas no disponibles');
      setCameraError('Error: Elementos de captura no disponibles.');
      return;
    }

    if (!streamRef.current) {
      console.error('No hay stream de cámara activo');
      setCameraError('Error: Cámara no activa. Intenta recargar la página.');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video no tiene dimensiones válidas');
      setCameraError('Error: Video no está listo. Espera a que la cámara se inicie completamente.');
      return;
    }

    try {
      // Detectar rostro
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
      if (!detection) {
        setCameraError('No se detectó ningún rostro. Asegúrate de que tu rostro esté visible y bien iluminado.');
        return;
      }

      const { box } = detection.detection;
      const landmarks = detection.landmarks;

      // Calcular bounding box expandido para incluir más del rostro
      const padding = 0.3; // 30% padding
      const width = box.width * (1 + padding);
      const height = box.height * (1 + padding);
      const x = Math.max(0, box.x - (width - box.width) / 2);
      const y = Math.max(0, box.y - (height - box.height) / 2);

      // Dibujar el frame completo en canvas temporal
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Recortar la imagen al área del rostro
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

      // Redimensionar a tamaño carnet (aprox 300x400 píxeles, manteniendo proporción)
      const targetWidth = 300;
      const targetHeight = 400;
      const aspectRatio = width / height;
      let finalWidth, finalHeight;
      if (aspectRatio > targetWidth / targetHeight) {
        finalWidth = targetWidth;
        finalHeight = targetWidth / aspectRatio;
      } else {
        finalHeight = targetHeight;
        finalWidth = targetHeight * aspectRatio;
      }

      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      finalCtx.drawImage(croppedCanvas, 0, 0, width, height, (targetWidth - finalWidth) / 2, (targetHeight - finalHeight) / 2, finalWidth, finalHeight);

      // Convertir a data URL
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
      setPhotoDataUrl(dataUrl);

      console.log('Foto del rostro capturada y recortada exitosamente');
      setCameraError(''); // Limpiar cualquier error anterior

    } catch (error) {
      console.error('Error al capturar foto:', error);
      setCameraError('Error al capturar la foto. Inténtalo de nuevo.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const dataToSend = { ...formData };
      if (photoDataUrl) dataToSend.photo = photoDataUrl;
      const response = await personService.addPerson(dataToSend);
      console.log('Respuesta completa al crear persona:', response);
      if (response.success) {
        // Mostrar todas las claves y valores de response.data si es objeto
        if (response.data && typeof response.data === 'object') {
          console.log('Claves y valores de response.data:');
          Object.entries(response.data).forEach(([key, value]) => {
            console.log(key, ':', value);
          });
        }
        // Nueva lógica: si response.data es un string, usarlo directamente como personId
        let realPersonId = null;
        // Caso 1: response.data es string/number
        if (typeof response.data === 'string' || typeof response.data === 'number') {
          realPersonId = response.data;
        }
        // Caso 2: response.data.data es string/number
        else if (response.data && typeof response.data === 'object' && (typeof response.data.data === 'string' || typeof response.data.data === 'number')) {
          realPersonId = response.data.data;
        }
        // Otros casos
        else if (response.data?.person?.personId) {
          realPersonId = response.data.person.personId;
        } else if (response.data?.personId) {
          realPersonId = response.data.personId;
        } else if (response.data?.id) {
          realPersonId = response.data.id;
        } else if (response.data?.person) {
          if (typeof response.data.person === 'object') {
            for (const key in response.data.person) {
              if (key.toLowerCase().includes('id')) {
                realPersonId = response.data.person[key];
                break;
              }
            }
          }
        }
        const realDNI = response.data?.person?.certificateNumber || response.data?.certificateNumber;
        console.log('personId extraído:', realPersonId, 'DNI extraído:', realDNI);
        if (!realPersonId) {
          setError('No se pudo extraer el personId de la respuesta. Revisa la consola y comparte aquí el log para ajustar la lógica.');
          return;
        }
        try {
          for (const groupId of selectedAccessGroups) {
            const body = {
              privilegeGroupId: groupId,
              type: 1,
              list: [{ id: realPersonId }]
            };
            try {
              await personService.addPersonToPrivilegeGroups(realPersonId, groupId);
            } catch (err2) {
              let errorMsg = 'Persona creada pero error al asignar acceso: ';
              errorMsg += '\nBody enviado: ' + JSON.stringify(body);
              if (err2.response && err2.response.data) {
                errorMsg += '\nRespuesta: ' + JSON.stringify(err2.response.data);
              } else {
                errorMsg += '\nError: ' + err2.message;
              }
              setError(errorMsg);
            }
          }
        } catch (err2) {
          setError('Error inesperado al asignar acceso: ' + err2.message);
        }
        setSuccess('Peatón agregado exitosamente');
        setShowAddModal(false);
        setFormData({ personGivenName: '', personFamilyName: '', personCode: '', gender: '1', certificateNumber: '', phoneNo: '', orgIndexCode: '1' });
        setPhotoDataUrl(null);
        setSelectedAccessGroups([]);
        loadPersons();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al agregar peatón');
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
  const canEdit = user?.role === 'admin' || user?.role === 'operador' || user?.role === 'personal_seguridad';

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
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
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
                <input type="text" className="form-control" placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
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
          <div className="text-center py-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Cargando...</span></div></div>
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
                              <button className="btn btn-sm btn-primary" onClick={() => handleEditClick(person)} title="Editar persona"><i className="bi bi-pencil me-1"></i>Editar</button>
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
                    <div className="mb-3"><label className="form-label">Nombre</label><input type="text" className="form-control" value={formData.personGivenName} onChange={(e) => setFormData({ ...formData, personGivenName: e.target.value })} required /></div>
                    <div className="mb-3"><label className="form-label">Apellido</label><input type="text" className="form-control" value={formData.personFamilyName} onChange={(e) => setFormData({ ...formData, personFamilyName: e.target.value })} required /></div>
                    <div className="mb-3"><label className="form-label">ID</label><input type="text" className="form-control" value={formData.personCode} onChange={(e) => setFormData({ ...formData, personCode: e.target.value })} /></div>
                    <div className="mb-3"><label className="form-label">DNI/Documento</label><input type="text" className="form-control" value={formData.certificateNumber} onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })} placeholder="Número de documento de identidad" /></div>
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
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{
                              width: cameraLarge ? 480 : 240,
                              height: cameraLarge ? 360 : 180,
                              background: '#000',
                              border: cameraReady ? '2px solid #28a745' : '2px solid #6c757d',
                              borderRadius: '4px',
                              transition: 'width 0.2s, height 0.2s'
                            }}
                          />
                          <canvas
                            ref={overlayCanvasRef}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: cameraLarge ? 480 : 240,
                              height: cameraLarge ? 360 : 180,
                              pointerEvents: 'none',
                              transition: 'width 0.2s, height 0.2s'
                            }}
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
                          {!cameraReady && !cameraError && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: '#fff',
                              fontSize: '14px',
                              textAlign: 'center'
                            }}>
                              <div className="spinner-border spinner-border-sm text-light me-2" role="status"></div>
                              Iniciando cámara...
                            </div>
                          )}
                          {cameraReady && (
                            <div style={{
                              position: 'absolute',
                              top: '5px',
                              right: cameraLarge ? '40px' : '5px',
                              background: '#28a745',
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '12px'
                            }}>
                              ● Activa
                            </div>
                          )}
                        </div>
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
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
                          <button
                            type="button"
                            className="btn btn-outline-info btn-sm"
                            onClick={restartCamera}
                            title="Reiniciar cámara"
                          >
                            🔄
                          </button>
                        </div>
                      </div>
                      {cameraError && <div className="alert alert-warning mt-2">{cameraError}</div>}
                      {!cameraError && !cameraReady && (
                        <div className="alert alert-info mt-2">
                          <small>
                            <strong>Nota:</strong> Si la cámara no se activa, asegúrate de:
                            <br />• Permitir el acceso a la cámara en tu navegador
                            <br />• Acceder desde HTTPS o localhost
                            <br />• Cerrar otras aplicaciones que usen la cámara
                          </small>
                        </div>
                      )}
                    </div>

                    <div className="mb-3"><label className="form-label">Organización</label><select className="form-select" value={formData.orgIndexCode} onChange={(e) => setFormData({ ...formData, orgIndexCode: e.target.value })}>{organizations.map((org) => (<option key={org.orgIndexCode} value={org.orgIndexCode}>{org.orgName}</option>))}</select></div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Agregar</button>
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
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                          <video
                            ref={editVideoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{
                              width: editCameraLarge ? 480 : 240,
                              height: editCameraLarge ? 360 : 180,
                              background: '#000',
                              border: editCameraReady ? '2px solid #28a745' : '2px solid #6c757d',
                              borderRadius: '4px',
                              transition: 'width 0.2s, height 0.2s'
                            }}
                          />
                          <canvas
                            ref={editOverlayCanvasRef}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: editCameraLarge ? 480 : 240,
                              height: editCameraLarge ? 360 : 180,
                              pointerEvents: 'none',
                              transition: 'width 0.2s, height 0.2s'
                            }}
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
                          {!editCameraReady && !editCameraError && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: '#fff',
                              fontSize: '14px',
                              textAlign: 'center'
                            }}>
                              <div className="spinner-border spinner-border-sm text-light me-2" role="status"></div>
                              Iniciando cámara...
                            </div>
                          )}
                          {editCameraReady && (
                            <div style={{
                              position: 'absolute',
                              top: '5px',
                              right: editCameraLarge ? '40px' : '5px',
                              background: '#28a745',
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '12px'
                            }}>
                              ● Activa
                            </div>
                          )}
                        </div>
                        <canvas ref={editCanvasRef} style={{ display: 'none' }} />
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
                          <button
                            type="button"
                            className="btn btn-outline-info btn-sm"
                            onClick={restartEditCamera}
                            title="Reiniciar cámara"
                          >
                            🔄
                          </button>
                        </div>
                        <div className="mb-2 mt-2 w-100 d-flex justify-content-center">
                          <button
                            type="button"
                            className="btn btn-outline-dark btn-sm"
                            onClick={editCameraReady ? stopEditCamera : startEditCamera}
                          >
                            {editCameraReady ? 'Cerrar cámara' : 'Abrir cámara'}
                          </button>
                        </div>
                        {editCameraError && <div className="alert alert-warning mt-2">{editCameraError}</div>}
                        {!editCameraError && !editCameraReady && (
                          <div className="alert alert-info mt-2">
                            <small>
                              <strong>Nota:</strong> Si la cámara no se activa, asegúrate de:
                              <br />• Permitir el acceso a la cámara en tu navegador
                              <br />• Acceder desde HTTPS o localhost
                              <br />• Cerrar otras aplicaciones que usen la cámara
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary"><i className="bi bi-save me-2"></i>Guardar Cambios</button></div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
