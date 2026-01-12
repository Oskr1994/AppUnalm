import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useFaceDetection } from '../hooks/useFaceDetection';

const CameraCapture = forwardRef(({ isActive, onError, onCameraReady }, ref) => {
    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const streamRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    const { modelsLoaded, startDetection, stopDetection, captureFace } = useFaceDetection();

    useImperativeHandle(ref, () => ({
        capture: async () => {
            try {
                return await captureFace(videoRef.current);
            } catch (e) {
                throw e;
            }
        },
        restart: () => restartCamera()
    }));

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        stopDetection();
        setIsReady(false);
    };

    const startCamera = async () => {
        try {
            if (onError) onError(''); // Limpiar errores previos

            if (!window.isSecureContext) {
                throw new Error('La cámara requiere una conexión segura (HTTPS). Accede desde localhost o un sitio HTTPS.');
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara.');
            }

            try {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                if (permissionStatus.state === 'denied') {
                    throw new Error('Permiso de cámara denegado. Por favor, permite el acceso en la configuración de tu navegador.');
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

            try {
                const s = await navigator.mediaDevices.getUserMedia(constraints);
                handleStreamSuccess(s);
            } catch (err) {
                // Fallback a configuración básica
                console.warn('Falló configuración ideal, intentando básica...', err);
                const basicConstraints = { video: true };
                const s = await navigator.mediaDevices.getUserMedia(basicConstraints);
                handleStreamSuccess(s);
            }

        } catch (e) {
            console.error('Error al iniciar cámara:', e);
            let msg = e.message;
            if (e.name === 'NotAllowedError') msg = 'Permiso denegado para acceder a la cámara.';
            else if (e.name === 'NotFoundError') msg = 'No se encontró una cámara.';
            else if (e.name === 'NotReadableError') msg = 'La cámara está siendo usada por otra aplicación.';

            if (onError) onError(msg);
        }
    };

    const handleStreamSuccess = (stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().then(() => {
                    setIsReady(true);
                    if (onCameraReady) onCameraReady();
                }).catch(err => {
                    if (onError) onError('Error al reproducir video: ' + err.message);
                });
            };
        }
    };

    const restartCamera = () => {
        stopCamera();
        setTimeout(() => {
            if (isActive) startCamera();
        }, 500);
    };

    useEffect(() => {
        if (isActive) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isActive]);

    // Iniciar detección cuando todo esté listo
    useEffect(() => {
        if (isActive && isReady && modelsLoaded && videoRef.current && overlayRef.current) {
            startDetection(videoRef.current, overlayRef.current);
        }
    }, [isActive, isReady, modelsLoaded]);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <video
                ref={videoRef}
                style={{ width: '100%', borderRadius: '8px', display: isReady ? 'block' : 'none' }}
                playsInline
                muted
            />
            {!isReady && isActive && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '300px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Cargando cámara...</span>
                    </div>
                </div>
            )}
            <canvas
                ref={overlayRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
        </div>
    );
});

export default CameraCapture;
