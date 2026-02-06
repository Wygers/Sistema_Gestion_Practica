const express = require('express');
const router = express.Router();
const documentosController = require('../db/controllers/documentoController');
const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Crear directorio si no existe
        const fs = require('fs');
        const dir = 'public/uploads/documentos/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext)
            .replace(/\s+/g, '_')
            .toLowerCase()
            .substring(0, 50); // Limitar longitud del nombre
        cb(null, name + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG, WEBP'), false);
        }
    }
});

// API para obtener lista de vehículos (para el select)
router.get('/api/vehiculos', documentosController.apiVehiculos);

// API para buscar vehículo por ID específico (para búsqueda manual)
router.get('/api/vehiculo/:id', documentosController.buscarVehiculoPorID);

// API para buscar vehículo por patente (NUEVA RUTA)
router.get('/api/vehiculo/patente/:patente', documentosController.buscarVehiculoPorPatente);

// API para obtener tipos de documentos
router.get('/api/tipos', documentosController.apiTipos);

// API para obtener detalle de documento
router.get('/api/documento/:id', documentosController.obtenerDetalle);

// API para verificar existencia de vehículo
router.get('/api/verificar-vehiculo/:id', documentosController.verificarVehiculo);

/* ===============================
   VISTAS PRINCIPALES
================================ */

// Dashboard de documentos (página principal)
router.get('/', documentosController.mostrarDocumentos);

// Página para listar todos los documentos por vehículo
router.get('/vehiculos', documentosController.listarDocumentosPorVehiculo);

// Página para ver documentos de un vehículo específico
router.get('/vehiculo/:id', documentosController.documentosPorVehiculo);

// Registrar nuevo documento
router.post(
    '/vehiculo/registrar',
    upload.single('archivo_documento'),
    documentosController.agregarDocumento
);

// Crear nuevo tipo de documento
router.post('/tipos/nuevo', documentosController.crearTipoDocumento);

// Editar documento existente
router.post('/editar/:id',
    upload.single('archivo_documento'),
    documentosController.editarDocumento
);

// Eliminar documento
router.post('/eliminar/:id', documentosController.eliminarDocumento);

// Enviar recordatorio por correo
router.post('/recordatorio/:id', documentosController.enviarRecordatorio);

// Generar reporte PDF
router.get('/reporte/:tipo', documentosController.generarReporte);

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.redirect('/documentos?error=El archivo es demasiado grande (máx. 10MB)');
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.redirect('/documentos?error=Demasiados archivos');
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.redirect('/documentos?error=Tipo de archivo no esperado');
        }
    } else if (err) {
        // Log del error para debugging
        console.error('Error en multer:', err.message);
        return res.redirect(`/documentos?error=${encodeURIComponent(err.message)}`);
    }
    next();
});

router.use((err, req, res, next) => {
    console.error('Error general:', err.stack);
    res.status(500).redirect('/documentos?error=Error interno del servidor');
});

router.use((req, res) => {
    res.status(404).redirect('/documentos?error=Página no encontrada');
});

module.exports = router;