require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
const PORT = process.env.PORT || 3000;

// Base de datos
const db = require('./db/conexion');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_vehicular',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Flash messages
app.use(flash());

// Middleware para variables globales
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.usuario = req.session.usuario || null;
    next();
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas
app.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS fecha');
        res.render('Home', {
            title: 'Sistema de Gestión Vehicular',
            fecha: rows[0].fecha
        });
    } catch (error) {
        console.error('Error en ruta principal:', error);
        res.render('Home', {
            title: 'Sistema de Gestión Vehicular',
            fecha: new Date().toLocaleString()
        });
    }
});

// Rutas de vehículos
const vehiculosRoutes = require('./routes/vehiculos.routes');
app.use('/vehiculos', vehiculosRoutes);

// Rutas de personas
const personasRoutes = require('./routes/personas.routes');
app.use('/personas', personasRoutes);

// RUTAS DE DOCUMENTOS
const documentosRoutes = require('./routes/documentos.routes');
app.use('/documentos', documentosRoutes);

app.get('/login', (req, res) => {
    res.render('Login', { title: 'Iniciar Sesión' });
});

// Ruta de prueba
app.get('/tst-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1+1 AS result');
        res.json({
            db: 'Conectado correctamente',
            result: rows[0].result
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error en la base de datos',
            message: error.message
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`  Servidor corriendo en http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('   Rutas disponibles:');
    console.log(`   • http://localhost:${PORT}/ (Inicio)`);
    console.log(`   • http://localhost:${PORT}/personas/agregar (Agregar Persona)`);
    console.log(`   • http://localhost:${PORT}/personas (Listar Personas)`);
    console.log(`   • http://localhost:${PORT}/vehiculos/agregar (Agregar Vehículo)`);
    console.log(`   • http://localhost:${PORT}/vehiculos (Listar Vehículos)`);
    console.log(`   • http://localhost:${PORT}/documentos (Gestión Documental)`);
    console.log(`   • http://localhost:${PORT}/documentos/vehiculos (Documentos Vehículos)`);
    console.log(`   • http://localhost:${PORT}/login (Login)`);
    console.log(`   • http://localhost:${PORT}/tst-db (Test DB)`);
    console.log('='.repeat(50));
});