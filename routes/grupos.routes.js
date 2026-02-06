const express = require('express');
const router = express.Router();
const gruposController = require('../controllers/gruposController');



// Listar grupos en la tabla
router.get('/', gruposController.listar);

// Form crear grupo
router.get('/crear', gruposController.formCrear);

// Guardar grupo
router.post('/crear', gruposController.crear);

module.exports = router;
