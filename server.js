// app.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 3000;

// Base de datos
const db = require('./db/conexion');

// --- Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_vehicular',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(flash());

// Middleware para variables globales (Flash y Usuario)
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.usuario = req.session.usuario || null;
    next();
});

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Carga Dinámica de Rutas (Estructura protegida) ---
const cargarRutas = (nombre, ruta, pathArchivo) => {
    try {
        const router = require(pathArchivo);
        app.use(ruta, router);
        console.log(`Rutas de ${nombre} cargadas`);
    } catch (error) {
        console.error(` Error al cargar rutas de ${nombre}:`, error.message);
    }
};

cargarRutas('Vehículos', '/vehiculos', './routes/vehiculos.routes');
cargarRutas('Personas', '/personas', './routes/personas.routes');
cargarRutas('Documentos', '/documentos', './routes/documentos.routes');

// --- Endpoints de API (Consolidados) ---
app.get('/api/vehiculos', async (req, res) => {
    try {
        const [vehiculos] = await db.query(`
            SELECT v.id_vehiculo, v.patente, v.marca, v.modelo, c.nombre_cliente 
            FROM vehiculos v 
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente 
            WHERE v.activo = 1 ORDER BY v.patente ASC
        `);
        res.json({ success: true, vehiculos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- Rutas de Vistas Principales ---

// Home
app.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS fecha');
        res.render('Home', {
            title: 'Sistema de Gestión Vehicular',
            fecha: rows[0].fecha
        });
    } catch (error) {
        res.render('Home', { title: 'Home', fecha: new Date() });
    }
});

// Listado de Grupos
app.get('/grupos', async (req, res) => {
    try {
        // Obtenemos los grupos para la tabla principal
        const [grupos] = await db.query(`
            SELECT g.*, c.nombre_cliente 
            FROM grupos g 
            LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
        `);
        res.render('Grupos', {
            title: 'Gestión de Grupos',
            fecha: new Date(),
            grupos: grupos // Definimos grupos para la vista
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar grupos');
    }
});

// Crear Grupo (SOLUCIÓN AL ERROR DE REFERENCIA)
app.get('/grupos/crear', async (req, res) => {
    try {
        // Necesitamos 'clientes' para el formulario y 'grupos' para los contadores si hereda el layout
        const [clientes] = await db.query('SELECT id_cliente, nombre_cliente FROM clientes WHERE activo = 1');
        const [grupos] = await db.query('SELECT * FROM grupos');

        res.render('AgregarGrupo', {
            title: 'Crear Nuevo Grupo',
            fecha: new Date(),
            clientes: clientes,
            grupos: grupos // Se envía para evitar el ReferenceError: grupos is not defined
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al preparar el formulario de grupos');
        res.redirect('/grupos');
    }
});

app.get('/login', (req, res) => {
    res.render('Login', { title: 'Iniciar Sesión' });
});

// --- Utilidades ---
app.get('/tst-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1+1 AS result');
        res.json({ db: 'Conectado', result: rows[0].result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/grupos/crear', async (req, res) => {
    try {
        const [clientes] = await db.query('SELECT id_cliente, nombre FROM clientes WHERE activo = 1');
        const [personas] = await db.query('SELECT id_persona, run, dv, nombres, apellido_paterno, apellido_materno, email FROM personas WHERE activo = 1');

        res.render('AgregarGrupo', {
            title: 'Crear Nuevo Grupo',
            fecha: new Date(),
            clientes: clientes,
            personas: personas 
        });
    } catch (error) {
        res.status(500).send('Error');
    }
});

// --- Manejo de errores 404 ---
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Servidor: http://localhost:${PORT}`);
    console.log('='.repeat(50));
});