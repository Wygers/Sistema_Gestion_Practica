const express = require('express');
const router = express.Router();
const authController = require('../db/controllers/authController');

// Mostrar formulario de login (GET)
router.get('/login', authController.mostrarLogin);

// Procesar login (POST)
router.post('/login', authController.login);

// Procesar registro (POST)
router.post('/register', authController.registrar);

// Logout
router.get('/logout', authController.logout);

module.exports = router;