const express = require('express');
const router = express.Router();
const documentosController = require('../db/controllers/documentoController');
const multer = require('multer');
const path = require('path');

/* ===============================
   MULTER
================================ */

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {

        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext)
            .replace(/\s+/g, '_')
            .toLowerCase();

        cb(null, `${base}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {

        const allowed = ['application/pdf','image/jpeg','image/png'];

        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Formato no permitido'));
        }

        cb(null,true);
    }
});

/* ===============================
   API (PRIMERO)
================================ */

router.get('/api/vehiculos', documentosController.apiVehiculos);
router.get('/api/tipos', documentosController.apiTipos);
router.get('/api/documentos', documentosController.apiDocumentos);

/* ===============================
   VISTAS
================================ */

router.get('/', documentosController.mostrarDocumentos);

router.post(
    '/vehiculo/registrar',
    upload.single('archivo_documento'),
    documentosController.agregarDocumento
);

/* ===============================
   ERRORES MULTER
================================ */

router.use((err, req, res, next)=>{
    if(err){
        return res.status(400).json({success:false,message:err.message});
    }
    next();
});

module.exports = router;
