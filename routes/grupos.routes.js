const express = require('express');
const router = express.Router();
const gruposController = require('../db/controllers/gruposController');

// Rutas principales
router.get('/', gruposController.listar);                    // Listar grupos
router.get('/crear', gruposController.formCrear);           // Formulario crear
router.post('/crear', gruposController.crear);              // Guardar nuevo grupo
router.get('/editar/:id', gruposController.formEditar);     // Formulario editar
router.post('/editar/:id', gruposController.actualizar);    // Actualizar grupo
router.post('/eliminar/:id', gruposController.eliminar);    // Eliminar grupo

// Rutas API para búsqueda de personas (AJAX)
router.get('/api/personas/buscar/id/:id', gruposController.buscarPersonaPorId);
router.get('/api/personas/buscar/run/:run', gruposController.buscarPersonaPorRun);

module.exports = router;