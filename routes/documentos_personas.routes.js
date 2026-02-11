
const express = require('express');
const router = express.Router();
const documentoPersonaController = require('../db/controllers/documentosPersonaController');

// Middleware de autenticación (opcional)
const isAuthenticated = (req, res, next) => {
 
    return next();
};

router.use(isAuthenticated);


router.get('/', documentoPersonaController.index);

router.post('/registrar', documentoPersonaController.registrar);


router.post('/actualizar/:id', documentoPersonaController.actualizar);


router.post('/eliminar/:id', documentoPersonaController.eliminar);


router.get('/descargar/:id', documentoPersonaController.descargar);


router.post('/tipos/nuevo', documentoPersonaController.crearTipoDocumento);


router.get('/api/persona/buscar/:run', documentoPersonaController.buscarPersonaPorRun);


router.get('/api/detalle/:id', documentoPersonaController.detalle);


router.get('/api/persona/:idPersona/documentos', documentoPersonaController.documentosPorPersona);

router.get('/api/estadisticas', documentoPersonaController.obtenerEstadisticas);


router.get('/api/proximos-vencer', documentoPersonaController.obtenerProximosVencer);


router.get('/nuevo', (req, res) => {
    res.redirect('/documentos-personas?nuevo=1');
});


router.get('/vencidos', async (req, res) => {
    req.query.filtro = 'vencidos';
    documentoPersonaController.index(req, res);
});


router.get('/proximos', async (req, res) => {
    req.query.filtro = 'proximos';
    documentoPersonaController.index(req, res);
});


router.use('*', (req, res) => {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({
            success: false,
            message: 'Ruta no encontrada'
        });
    }
    res.status(404).render('404', {
        title: 'Página no encontrada',
        message: 'La ruta solicitada no existe'
    });
});

module.exports = router;