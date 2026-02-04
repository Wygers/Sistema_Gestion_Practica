const express = require('express');
const router = express.Router();
const personasController = require('../db/controllers/personasController');

// Ruta para listar personas
router.get('/', personasController.listarPersonas);

// Ruta para mostrar formulario de agregar persona
router.get('/agregar', personasController.mostrarFormularioAgregar);

// Ruta para procesar formulario de agregar persona
router.post('/agregar', personasController.agregarPersona);

// Ruta para mostrar formulario de editar persona
router.get('/editar/:id', personasController.mostrarFormularioEditar);

// Ruta para actualizar persona
router.post('/editar/:id', personasController.actualizarPersona);

// Ruta para eliminar persona
router.get('/eliminar/:id', personasController.eliminarPersona);

module.exports = router;