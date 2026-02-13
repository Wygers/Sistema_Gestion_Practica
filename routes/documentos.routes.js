const express = require('express');
const router = express.Router();
const documentosController = require('../db/controllers/documentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
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
            .substring(0, 50);

        cb(null, name + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
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
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG, WEBP'));
        }
    }
});



router.get('/api/vehiculos', documentosController.apiVehiculos);
router.get('/api/vehiculo/patente/:patente', documentosController.buscarVehiculoPorPatente);
router.get('/api/vehiculo/:id', documentosController.buscarVehiculoPorID);
router.get('/api/tipos', documentosController.apiTipos);
router.get('/api/documento/:id', documentosController.obtenerDetalle);
router.get('/api/verificar-vehiculo/:id', documentosController.verificarVehiculo);
router.get('/reporte/:id', documentosController.generarReporte);
router.get('/', documentosController.mostrarDocumentos);
router.get('/vehiculos', documentosController.listarDocumentosPorVehiculo);
router.get('/vehiculo/:id', documentosController.documentosPorVehiculo);
router.post(
    '/vehiculo/registrar',
    upload.single('archivo_documento'),
    documentosController.agregarDocumento
);
router.post('/tipos/nuevo', documentosController.crearTipoDocumento);
router.post(
    '/editar/:id',
    upload.single('archivo_documento'),
    documentosController.editarDocumento
);
router.post('/eliminar/:id', documentosController.eliminarDocumento);
router.post('/recordatorio/:id', documentosController.enviarRecordatorio);
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.redirect('/documentos?error=Archivo demasiado grande (máx. 10MB)');
        }
        return res.redirect('/documentos?error=Error al subir archivo');
    }

    if (err) {
        console.error('Error:', err.message);
        return res.redirect(`/documentos?error=${encodeURIComponent(err.message)}`);
    }

    next();
});

router.use((req, res) => {
    res.status(404).redirect('/documentos?error=Ruta no encontrada');
});
module.exports = router;
