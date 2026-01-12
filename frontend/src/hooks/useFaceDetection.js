import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

export const useFaceDetection = () => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const animationRef = useRef(null);

    const loadModels = async () => {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            setModelsLoaded(true);
            console.log('Modelos de detección facial cargados');
        } catch (error) {
            console.error('Error al cargar modelos de detección facial:', error);
        }
    };

    const stopDetection = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    };

    const startDetection = (video, overlayCanvas) => {
        if (!video || !overlayCanvas || !modelsLoaded) return;

        // Asegurarse de detener cualquier detección previa
        stopDetection();

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(overlayCanvas, displaySize);

        const detect = async () => {
            if (video.paused || video.ended) return;

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            const ctx = overlayCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);
            }

            animationRef.current = requestAnimationFrame(detect);
        };

        detect();
    };

    const captureFace = async (video) => {
        if (!video || video.videoWidth === 0) {
            throw new Error('Video no está listo.');
        }

        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

        if (!detection) {
            throw new Error('No se detectó ningún rostro. Asegúrate de que tu rostro esté visible y bien iluminado.');
        }

        const { box } = detection.detection;

        // Configuración para foto tipo pasaporte
        const padding = 0.8;
        const width = box.width * (1 + padding);
        const height = box.height * (1 + padding);
        const x = Math.max(0, box.x - (width - box.width) / 2);
        const y = Math.max(0, box.y - (height - box.height) / 2);

        // Canvas temporal para el frame completo
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Canvas para el recorte
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = width;
        croppedCanvas.height = height;
        croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

        // Canvas final redimensionado (tamaño carnet)
        const targetWidth = 135;
        const targetHeight = 189;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetWidth;
        finalCanvas.height = targetHeight;
        const finalCtx = finalCanvas.getContext('2d');

        // Calcular recorte para llenar (Cover)
        let sourceX = 0;
        let sourceY = 0;
        let sourceW = width;
        let sourceH = height;
        const targetRatio = targetWidth / targetHeight;
        const sourceRatio = width / height;

        if (sourceRatio > targetRatio) {
            sourceW = height * targetRatio;
            sourceX = (width - sourceW) / 2;
        } else {
            sourceH = width / targetRatio;
            sourceY = (height - sourceH) / 2;
        }

        finalCtx.drawImage(croppedCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, targetWidth, targetHeight);

        return finalCanvas.toDataURL('image/jpeg', 0.9);
    };

    useEffect(() => {
        loadModels();
        return () => stopDetection();
    }, []);

    return {
        modelsLoaded,
        startDetection,
        stopDetection,
        captureFace
    };
};
