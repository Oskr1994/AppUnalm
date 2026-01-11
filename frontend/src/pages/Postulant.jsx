import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { personService, externalService } from '../services/api';
import Navbar from '../components/Navbar';
import * as faceapi from 'face-api.js';

export default function Postulant() {
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
    const [selectedAccessGroups, setSelectedAccessGroups] = useState(['2']);
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

    // Estados para Liveness
    const [livenessStep, setLivenessStep] = useState(0); // 0: Inicio, 1: Centro, 2: Izq, 3: Der, 4: Listo
    const [livenessInstruction, setLivenessInstruction] = useState('');
    const [isLivenessComplete, setIsLivenessComplete] = useState(false);

    // Funciones para cámara en edición (Sin liveness por ahora, copia simple)
    const startEditCamera = async () => {
        try {
            setEditCameraError('');
            if (!window.isSecureContext) {
                setEditCameraError('La cámara requiere una conexión segura (HTTPS).');
                return;
            }
            const constraints = { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } };
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
        if (!video || !canvas) return;
        try {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
            if (!detection) {
                setEditCameraError('No se detectó ningún rostro.');
                return;
            }
            const { box } = detection.detection;
            const padding = 0.8;
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
            const targetWidth = 135;
            const targetHeight = 189;
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = targetWidth;
            finalCanvas.height = targetHeight;
            const finalCtx = finalCanvas.getContext('2d');

            // Calcular recorte para llenar todo el espacio (Cover) sin bordes negros
            let sourceX = 0;
            let sourceY = 0;
            let sourceW = width;
            let sourceH = height;
            const targetRatio = targetWidth / targetHeight;
            const sourceRatio = width / height;

            if (sourceRatio > targetRatio) {
                // La imagen es más ancha que el objetivo: recortar ancho
                sourceW = height * targetRatio;
                sourceX = (width - sourceW) / 2;
            } else {
                // La imagen es más alta que el objetivo: recortar alto
                sourceH = width / targetRatio;
                sourceY = (height - sourceH) / 2;
            }

            finalCtx.drawImage(croppedCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, targetWidth, targetHeight);
            const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
            setEditPhotoDataUrl(dataUrl);
            setEditCameraError('');
        } catch (error) {
            setEditCameraError('Error al capturar la foto.');
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
            setError('Error al cargar la lista de postulantes');
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm]);

    const [postulantOrgId, setPostulantOrgId] = useState(null);

    const loadOrganizations = async () => {
        try {
            const response = await personService.listOrganizations();
            if (response.success) {
                setOrganizations(response.data.organizations);
                // Buscar y setear ID de organización "Postulante"
                const postulantOrg = response.data.organizations.find(o => o.orgName.toLowerCase().includes('postulante'));
                if (postulantOrg) {
                    setPostulantOrgId(postulantOrg.orgIndexCode);
                    setFormData(prev => ({ ...prev, orgIndexCode: postulantOrg.orgIndexCode }));
                }
            }
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

    const [cameraActive, setCameraActive] = useState(false);

    useEffect(() => {
        if (!showAddModal) {
            stopCamera();
            setCameraActive(false);
        }
        return () => stopCamera();
    }, [showAddModal]);

    const startCamera = async () => {
        try {
            setCameraError('');
            // Reset Liveness State
            setLivenessStep(0);
            setLivenessInstruction('Iniciando cámara...');
            setIsLivenessComplete(false);
            setPhotoDataUrl(null);

            if (!window.isSecureContext) {
                setCameraError('La cámara requiere una conexión segura (HTTPS).');
                return;
            }
            const constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            const s = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = s;
            if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().then(() => {
                        setCameraReady(true);
                        setLivenessInstruction('Mire al frente'); // Paso 0 -> 1
                        if (modelsLoaded) startFaceDetection();
                    }).catch(error => {
                        setCameraError('Error al iniciar la reproducción del video.');
                    });
                };
            }
        } catch (e) {
            setCameraError(`Error al acceder a la cámara: ${e.message || 'Error desconocido'}`);
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
        setCameraActive(false);
    };

    const restartCamera = async () => {
        stopCamera();
        setTimeout(() => startCamera(), 500);
    };

    // Función para estimar la pose horizontal de la cabeza (Yaw)
    const estimateHeadPose = (landmarks) => {
        const nose = landmarks.getNose()[0]; // Punta de la nariz
        const jaw = landmarks.getJawOutline();
        const leftJaw = jaw[0];
        const rightJaw = jaw[16];

        // Distancias horizontales
        const distToLeft = Math.abs(nose.x - leftJaw.x);
        const distToRight = Math.abs(nose.x - rightJaw.x);
        const totalDist = distToLeft + distToRight;

        const ratio = distToLeft / totalDist;
        return ratio;
    };

    const startFaceDetection = () => {
        const video = videoRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!video || !overlayCanvas || !modelsLoaded) return;

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(overlayCanvas, displaySize);

        // Variables de control para Liveness
        let stateStep = 0; // Copia local para el loop
        let validFrames = 0;
        const REQUIRED_FRAMES = 5; // Reduced from 10 to be faster
        let lastFaceTimestamp = Date.now(); // For error delay

        const detectFaces = async () => {
            if (!streamRef.current) return;

            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

            const ctx = overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

            if (detections) {
                lastFaceTimestamp = Date.now(); // Update timestamp
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);

                // LÓGICA DE LIVENESS
                const ratio = estimateHeadPose(detections.landmarks);

                // Máquina de Estados
                // Paso 0: Inicio -> Ir a Centro
                if (stateStep === 0) {
                    setLivenessStep(1);
                    setLivenessInstruction("Mire al frente");
                    stateStep = 1;
                    validFrames = 0;
                }
                // Paso 1: Centro (Calibración)
                else if (stateStep === 1) {
                    if (ratio > 0.4 && ratio < 0.6) {
                        validFrames++;
                        if (validFrames > 10) { // Reduced from 20
                            setLivenessStep(2);
                            setLivenessInstruction("Gire suavemente a la IZQUIERDA ⬅️");
                            stateStep = 2;
                            validFrames = 0;
                        }
                    } else {
                        validFrames = 0;
                        setLivenessInstruction("Mire al frente");
                    }
                }
                // Paso 2: Izquierda (Ratio debe subir, nariz se aleja del borde izquierdo)
                else if (stateStep === 2) {
                    if (ratio > 0.60) { // Relaxed from 0.65
                        validFrames++;
                        if (validFrames > REQUIRED_FRAMES) {
                            setLivenessStep(3);
                            setLivenessInstruction("Gire suavemente a la DERECHA ➡️");
                            stateStep = 3;
                            validFrames = 0;
                        }
                    }
                }
                // Paso 3: Derecha (Ratio debe bajar, nariz se acerca al borde izquierdo)
                else if (stateStep === 3) {
                    if (ratio < 0.40) { // Relaxed from 0.35
                        validFrames++;
                        if (validFrames > REQUIRED_FRAMES) {
                            setLivenessStep(4);
                            setLivenessInstruction("¡Perfecto! Mire al frente para la foto 📸");
                            stateStep = 4;
                            validFrames = 0;
                        }
                    }
                }
                // Paso 4: Centro Final y Captura
                else if (stateStep === 4) {
                    if (ratio > 0.40 && ratio < 0.60) { // Relaxed range
                        validFrames++;
                        if (validFrames > 10) { // Reduced from 15
                            // CAPTURA AUTOMÁTICA
                            capturePhoto();
                            setLivenessInstruction("¡Foto Capturada!");
                            setIsLivenessComplete(true);
                            stateStep = 5; // Fin loop liveness
                        }
                    }
                }

            } else {
                // Si no hay rostro
                validFrames = 0;
                // Only show error if face is lost for more than 2 seconds
                if (Date.now() - lastFaceTimestamp > 2000) {
                    if (stateStep < 5) setLivenessInstruction("No se detecta rostro");
                }
            }

            // Si ya terminó, detenemos loop de detección o seguimos solo para pintar
            if (stateStep < 5 || !photoDataUrl) {
                animationRef.current = requestAnimationFrame(detectFaces);
            }
        };

        detectFaces();
    };


    const capturePhoto = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        try {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
            if (!detection) return;

            const { box } = detection.detection;
            const padding = 0.8;
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

            const targetWidth = 135;
            const targetHeight = 189;
            const aspectRatio = width / height;
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = targetWidth;
            finalCanvas.height = targetHeight;
            const finalCtx = finalCanvas.getContext('2d');

            // Calcular recorte para llenar todo el espacio (Cover) sin bordes negros
            let sourceX = 0;
            let sourceY = 0;
            let sourceW = width;
            let sourceH = height;
            const targetRatio = targetWidth / targetHeight;
            const sourceRatio = width / height;

            if (sourceRatio > targetRatio) {
                // La imagen es más ancha que el objetivo: recortar ancho
                sourceW = height * targetRatio;
                sourceX = (width - sourceW) / 2;
            } else {
                // La imagen es más alta que el objetivo: recortar alto
                sourceH = width / targetRatio;
                sourceY = (height - sourceH) / 2;
            }

            finalCtx.drawImage(croppedCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, targetWidth, targetHeight);

            const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);
            setPhotoDataUrl(dataUrl);
            setCameraError('');

        } catch (error) {
            console.error('Error al capturar foto:', error);
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
            setModalError('Error al consultar DNI');
        } finally {
            setLoading(false);
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
            if (response.success) {
                let realPersonCode = null;
                if (response.data?.person?.personCode) realPersonCode = response.data.person.personCode;
                else if (response.data?.personCode) realPersonCode = response.data.personCode;
                else if (response.data?.data?.personCode) realPersonCode = response.data.data.personCode;

                if (realPersonCode) {
                    for (const groupId of selectedAccessGroups) {
                        try { await personService.addPersonToPrivilegeGroups(realPersonCode, groupId); } catch (e) { }
                    }
                }

                setSuccess('¡Postulación exitosa! Sus datos han sido registrados.');
                setShowAddModal(false);
                setFormData({ personGivenName: '', personFamilyName: '', personCode: '', gender: '1', certificateNumber: '', phoneNo: '', orgIndexCode: postulantOrgId || '1' });
                setPhotoDataUrl(null);
                setSelectedAccessGroups(['2']);
                // No recargamos la lista porque es vista de postulante
            }
        } catch (err) {
            setModalError(err.response?.data?.detail || 'Error al agregar postulante');
        }
    };

    const canEdit = user?.role === 'admin' || user?.role === 'postulante';

    return (
        <>
            <Navbar />
            <div className="container mt-4" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>

                {error && <div className="alert alert-danger w-100 mb-4">{error}</div>}
                {success && <div className="alert alert-success w-100 mb-4">{success}</div>}

                {!showAddModal ? (
                    <>
                        <div className="text-center mb-5">
                            <h1 className="display-4 fw-bold text-primary mb-3">Area de Postulantes</h1>
                            <p className="lead text-muted">Bienvenido al sistema de registro.</p>

                            <div className="card text-start mx-auto mb-4" style={{ maxWidth: '600px', backgroundColor: '#f8f9fa' }}>
                                <div className="card-body">
                                    <h5 className="card-title fw-bold mb-3"><i className="bi bi-info-circle-fill text-primary me-2"></i>Pasos para registrarse:</h5>
                                    <ol className="mb-0 ps-3">
                                        <li className="mb-2">Haga clic en el botón <strong>"Registrate Ahora"</strong>.</li>
                                        <li className="mb-2">Ingrese su número de DNI y presione <strong>"Consultar"</strong>. Sus nombres se completarán automáticamente.</li>
                                        <li className="mb-2">Complete su número de teléfono.</li>
                                        <li className="mb-2">Haga clic en <strong>"Iniciar Cámara"</strong> y siga las instrucciones (mirar al frente, giros suaves).</li>
                                        <li>Una vez capturada la foto, presione <strong>"Enviar Registro"</strong>.</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-lg rounded-pill shadow-lg px-5 py-3 d-flex align-items-center gap-3 transition-all hover-scale"
                            style={{ fontSize: '1.5rem', transition: 'transform 0.2s', transform: 'scale(1)' }}
                            onClick={() => { setShowAddModal(true); setError(''); setSuccess(''); }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div className="bg-white text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                                <i className="bi bi-person-plus-fill fs-4"></i>
                            </div>
                            <span>Registrate Ahora</span>
                        </button>
                    </>
                ) : (
                    <div className="card shadow-lg w-100" style={{ maxWidth: '800px' }}>
                        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                            <h4 className="mb-0">Formulario de Postulación</h4>
                            <button className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                        </div>
                        <div className="card-body p-4">
                            <form onSubmit={handleSubmit}>
                                {modalError && <div className="alert alert-danger">{modalError}</div>}

                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label fw-bold">DNI / Documento</label>
                                            <div className="input-group">
                                                <input type="text" className="form-control" value={formData.certificateNumber} onChange={e => setFormData({ ...formData, certificateNumber: e.target.value })} required />
                                                <button type="button" className="btn btn-outline-secondary" onClick={handleConsultDni}>Consultar</button>
                                            </div>
                                        </div>
                                        <div className="mb-3"><label className="form-label fw-bold">Nombres</label><input type="text" className="form-control bg-light" value={formData.personGivenName} readOnly /></div>
                                        <div className="mb-3"><label className="form-label fw-bold">Apellidos</label><input type="text" className="form-control bg-light" value={formData.personFamilyName} readOnly /></div>
                                        <div className="mb-3"><label className="form-label fw-bold">Teléfono</label><input type="text" className="form-control" value={formData.phoneNo} onChange={e => setFormData({ ...formData, phoneNo: e.target.value })} /></div>
                                        <div className="mb-3">
                                            <label className="form-label fw-bold">Organización</label>
                                            <input type="text" className="form-control bg-light" value="Postulante" readOnly />
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label fw-bold text-center w-100">Foto</label>
                                            <div className="d-flex flex-column align-items-center gap-2 border p-3 rounded bg-light">
                                                {!cameraActive && (
                                                    <div className="text-center py-5">
                                                        <i className="bi bi-camera-video fs-1 text-muted mb-3 d-block"></i>
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            onClick={() => { setCameraActive(true); startCamera(); }}
                                                        >
                                                            <i className="bi bi-play-circle me-2"></i> Iniciar Cámara
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ position: 'relative', width: '100%', maxWidth: '300px', display: cameraActive ? 'block' : 'none' }}>
                                                    <video
                                                        ref={videoRef}
                                                        autoPlay muted playsInline
                                                        style={{ width: '100%', borderRadius: '4px', background: '#000' }}
                                                    />
                                                    <canvas
                                                        ref={overlayCanvasRef}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                                    />

                                                    {cameraReady && !photoDataUrl && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: '10px',
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            background: 'rgba(0,0,0,0.7)',
                                                            color: '#fff',
                                                            padding: '5px 10px',
                                                            borderRadius: '20px',
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            width: '90%',
                                                            fontSize: '14px'
                                                        }}>
                                                            {livenessInstruction}
                                                        </div>
                                                    )}
                                                </div>

                                                <canvas ref={canvasRef} style={{ display: 'none' }} />

                                                {photoDataUrl && (
                                                    <div className="mt-2 text-center">
                                                        <img src={photoDataUrl} alt="captura" className="img-thumbnail mb-2" style={{ maxWidth: '150px' }} />
                                                        <div className="text-success fw-bold"><i className="bi bi-check-circle-fill me-1"></i>Foto Capturada</div>
                                                    </div>
                                                )}

                                                <button type="button" className="btn btn-outline-secondary btn-sm mt-2" onClick={restartCamera}>
                                                    <i className="bi bi-arrow-clockwise me-1"></i> Reiniciar Prueba
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-end gap-2 mt-4 border-top pt-3">
                                    <button type="button" className="btn btn-secondary px-4" onClick={() => setShowAddModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-success px-5" disabled={!photoDataUrl}>
                                        <i className="bi bi-check-lg me-2"></i> Enviar Registro
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
