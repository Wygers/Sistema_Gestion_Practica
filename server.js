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

// Configuración de sesión (para flash messages)
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

// IMPORTANTE: Primero verifica que los archivos de rutas existan
try {
    // Rutas de vehículos
    const vehiculosRoutes = require('./routes/vehiculos.routes');
    app.use('/vehiculos', vehiculosRoutes);
    console.log('✓ Rutas de vehículos cargadas');
} catch (error) {
    console.error('✗ Error al cargar rutas de vehículos:', error.message);
    // Crear ruta básica si el archivo no existe
    app.use('/vehiculos', (req, res) => {
        res.status(404).send('Módulo de vehículos no disponible');
    });
}

try {
    // Rutas de personas
    const personasRoutes = require('./routes/personas.routes');
    app.use('/personas', personasRoutes);
    console.log('✓ Rutas de personas cargadas');
} catch (error) {
    console.error('✗ Error al cargar rutas de personas:', error.message);
    app.use('/personas', (req, res) => {
        res.status(404).send('Módulo de personas no disponible');
    });
}

try {
    // RUTAS DE DOCUMENTOS
    const documentosRoutes = require('./routes/documentos.routes');
    app.use('/documentos', documentosRoutes);
    console.log('✓ Rutas de documentos cargadas');
} catch (error) {
    console.error('✗ Error al cargar rutas de documentos:', error.message);
    // Ruta temporal de documentos
    app.use('/documentos', (req, res) => {
        res.render('Documentos', {
            title: 'Gestión Documental',
            fecha: new Date(),
            totalDocumentos: 0,
            documentosVigentes: 0,
            documentosPorVencer: 0,
            documentosVencidos: 0,
            documentosProximos: [],
            documentos: [],
            vehiculos: [],
            tiposDocumentos: []
        });
    });
}

// Ruta principal
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

app.get('/login', (req, res) => {
    res.render('Login', { title: 'Iniciar Sesión' });
});

// Ruta de prueba de base de datos
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

// Ruta para documentos simple (por si fallan las rutas)
app.get('/documentos/simple', async (req, res) => {
    try {
        res.render('Documentos', {
            title: 'Gestión Documental',
            fecha: new Date(),
            totalDocumentos: 0,
            documentosVigentes: 0,
            documentosPorVencer: 0,
            documentosVencidos: 0,
            documentosProximos: [],
            documentos: [],
            vehiculos: [],
            tiposDocumentos: []
        });
    } catch (error) {
        res.status(500).send('Error al cargar documentos');
    }
});

// Ruta 404 para manejar errores
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Página no encontrada',
        message: 'La página que buscas no existe'
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err.stack);
    res.status(500).render('error', {
        title: 'Error del servidor',
        message: 'Algo salió mal en el servidor'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`  Servidor corriendo en http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('   Rutas disponibles:');
    console.log(`   • http://localhost:${PORT}/ (Inicio)`);
    console.log(`   • http://localhost:${PORT}/personas (Personas)`);
    console.log(`   • http://localhost:${PORT}/vehiculos (Vehículos)`);
    console.log(`   • http://localhost:${PORT}/documentos (Documentos)`);
    console.log(`   • http://localhost:${PORT}/documentos/simple (Documentos Simple)`);
    console.log(`   • http://localhost:${PORT}/login (Login)`);
    console.log(`   • http://localhost:${PORT}/tst-db (Test DB)`);
    console.log('='.repeat(50));
});