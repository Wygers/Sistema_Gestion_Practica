const express = require('express');
const router = express.Router();
const db = require('../db/conexion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/documentos_personas/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('archivo_documento');

// ============================================
// RUTAS PRINCIPALES - CORREGIDO
// ============================================

// Dashboard principal de documentos de personas
router.get('/', async (req, res) => {
    try {
        const id_cliente = req.session.id_cliente || 1;

        // Obtener tipos de documentos
        const [tiposDocumentos] = await db.query(
            `SELECT id_tipo_documento, nombre_documento, descripcion, dias_alerta, obligatorio 
             FROM tipo_documentos_persona 
             WHERE id_cliente = ? AND activo = TRUE 
             ORDER BY nombre_documento`,
            [id_cliente]
        );

        // Obtener personas para el select
        const [personas] = await db.query(
            `SELECT id_persona, nombres, apellidos, run as identificacion
             FROM personas 
             WHERE id_cliente = ? AND activo = TRUE 
             ORDER BY nombres LIMIT 100`,
            [id_cliente]
        );

        // Obtener documentos recientes
        const [documentos] = await db.query(
            `SELECT dp.*, 
                    p.nombres, p.apellidos, p.run as identificacion,
                    td.nombre_documento as tipo_documento_nombre
             FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             INNER JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
             WHERE p.id_cliente = ?
             ORDER BY dp.fecha_subida DESC
             LIMIT 15`,
            [id_cliente]
        );

        // Obtener documentos próximos a vencer
        const [documentosProximos] = await db.query(
            `SELECT dp.*, 
                    p.nombres, p.apellidos, p.run as identificacion,
                    td.nombre_documento as tipo_documento_nombre
             FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             INNER JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
             WHERE p.id_cliente = ? 
               AND dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
               AND dp.estado IN ('vigente', 'por_vencer')
             ORDER BY dp.fecha_vencimiento ASC`,
            [id_cliente]
        );

        // Contadores
        const [total] = await db.query(
            `SELECT COUNT(*) as total FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             WHERE p.id_cliente = ?`,
            [id_cliente]
        );

        const [vigentes] = await db.query(
            `SELECT COUNT(*) as total FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             WHERE p.id_cliente = ? AND dp.estado = 'vigente'`,
            [id_cliente]
        );

        const [porVencer] = await db.query(
            `SELECT COUNT(*) as total FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             WHERE p.id_cliente = ? AND dp.estado = 'por_vencer'`,
            [id_cliente]
        );

        const [vencidos] = await db.query(
            `SELECT COUNT(*) as total FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             WHERE p.id_cliente = ? AND dp.estado = 'vencido'`,
            [id_cliente]
        );

        // ⭐ CORREGIDO: Apunta directamente a DocumentosPersonas.ejs en la raíz
        res.render('DocumentosPersonas', {
            title: 'Gestión de Documentos - Personas',
            tiposDocumentos,
            personas,
            documentos,
            documentosProximos,
            totalDocumentos: total[0]?.total || 0,
            documentosVigentes: vigentes[0]?.total || 0,
            documentosPorVencer: porVencer[0]?.total || 0,
            documentosVencidos: vencidos[0]?.total || 0,
            fecha: new Date(),
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('Error en dashboard documentos personas:', error);
        req.flash('error_msg', 'Error al cargar el dashboard');
        res.redirect('/');
    }
});

// ============================================
// API - Búsqueda de personas por identificación
// ============================================
router.get('/api/persona/identificacion/:identificacion', async (req, res) => {
    try {
        const { identificacion } = req.params;
        const id_cliente = req.session.id_cliente || 1;

        const [personas] = await db.query(
            `SELECT p.id_persona, p.nombres, p.apellidos, p.run as identificacion, 
                    p.correo, p.telefono, p.direccion, p.activo
             FROM personas p
             WHERE p.run = ? AND p.id_cliente = ? AND p.activo = TRUE
             LIMIT 1`,
            [identificacion, id_cliente]
        );

        if (personas.length > 0) {
            res.json({
                success: true,
                persona: personas[0]
            });
        } else {
            res.json({
                success: false,
                message: 'No se encontró una persona con esa identificación'
            });
        }
    } catch (error) {
        console.error('Error al buscar persona:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar persona'
        });
    }
});

// ============================================
// API - Obtener tipos de documentos
// ============================================
router.get('/api/tipos-documentos', async (req, res) => {
    try {
        const id_cliente = req.session.id_cliente || 1;
        const [tipos] = await db.query(
            `SELECT id_tipo_documento, nombre_documento, descripcion, dias_alerta, obligatorio 
             FROM tipo_documentos_persona 
             WHERE id_cliente = ? AND activo = TRUE 
             ORDER BY nombre_documento`,
            [id_cliente]
        );
        res.json(tipos);
    } catch (error) {
        console.error('Error al obtener tipos:', error);
        res.status(500).json({ error: 'Error al cargar tipos de documentos' });
    }
});

// ============================================
// REGISTRAR NUEVO DOCUMENTO
// ============================================
router.post('/registrar', (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            console.error('Error en upload:', err);
            req.flash('error_msg', err.message || 'Error al subir el archivo');
            return res.redirect('/documentos-personas');
        }

        try {
            const {
                id_persona,
                id_tipo_documento,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones,
                dias_alerta
            } = req.body;

            const usuario_subida = req.session.usuario_id || 1;

            // Validaciones
            if (!id_persona || !id_tipo_documento || !numero_documento || !fecha_vencimiento) {
                req.flash('error_msg', 'Todos los campos obligatorios deben estar completos');
                return res.redirect('/documentos-personas');
            }

            // Calcular estado
            let estado = 'vigente';
            const hoy = new Date();
            const vencimiento = new Date(fecha_vencimiento);
            const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                estado = 'vencido';
            } else if (diffDays <= (dias_alerta || 30)) {
                estado = 'por_vencer';
            }

            // Preparar datos del archivo
            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.originalname;
                ruta_archivo = req.file.path;
            }

            // Insertar documento
            await db.query(
                `INSERT INTO documentos_persona 
                 (id_persona, id_tipo_documento, nombre_archivo, ruta_archivo, 
                  numero_documento, fecha_emision, fecha_vencimiento, estado, 
                  observaciones, usuario_subida)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_persona,
                    id_tipo_documento,
                    nombre_archivo,
                    ruta_archivo,
                    numero_documento,
                    fecha_emision || null,
                    fecha_vencimiento,
                    estado,
                    observaciones || null,
                    usuario_subida
                ]
            );

            req.flash('success_msg', 'Documento registrado exitosamente');
            res.redirect('/documentos-personas');

        } catch (error) {
            console.error('Error al registrar documento:', error);

            // Eliminar archivo si se subió
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo:', err);
                });
            }

            req.flash('error_msg', 'Error al registrar el documento: ' + error.message);
            res.redirect('/documentos-personas');
        }
    });
});

// ============================================
// REGISTRAR NUEVO TIPO DE DOCUMENTO
// ============================================
router.post('/tipos/nuevo', async (req, res) => {
    try {
        const { nombre, descripcion, dias_alerta, obligatorio } = req.body;
        const id_cliente = req.session.id_cliente || 1;

        if (!nombre) {
            req.flash('error_msg', 'El nombre del tipo de documento es obligatorio');
            return res.redirect('/documentos-personas');
        }

        await db.query(
            `INSERT INTO tipo_documentos_persona 
             (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio) 
             VALUES (?, ?, ?, ?, ?)`,
            [id_cliente, nombre, descripcion || null, dias_alerta || 30, obligatorio ? 1 : 0]
        );

        req.flash('success_msg', 'Tipo de documento registrado exitosamente');
        res.redirect('/documentos-personas');

    } catch (error) {
        console.error('Error al registrar tipo:', error);
        req.flash('error_msg', 'Error al registrar el tipo de documento');
        res.redirect('/documentos-personas');
    }
});

// ============================================
// DESCARGAR DOCUMENTO
// ============================================
router.get('/descargar/:id_documento', async (req, res) => {
    try {
        const { id_documento } = req.params;

        const [documento] = await db.query(
            'SELECT ruta_archivo, nombre_archivo FROM documentos_persona WHERE id_documento = ?',
            [id_documento]
        );

        if (documento.length === 0 || !documento[0].ruta_archivo) {
            req.flash('error_msg', 'Documento no encontrado o sin archivo');
            return res.redirect('/documentos-personas');
        }

        const filePath = documento[0].ruta_archivo;
        if (fs.existsSync(filePath)) {
            res.download(filePath, documento[0].nombre_archivo || 'documento.pdf');
        } else {
            req.flash('error_msg', 'Archivo no encontrado en el servidor');
            res.redirect('/documentos-personas');
        }

    } catch (error) {
        console.error('Error al descargar:', error);
        req.flash('error_msg', 'Error al descargar el archivo');
        res.redirect('/documentos-personas');
    }
});

// ============================================
// ACTUALIZAR ESTADOS
// ============================================
router.post('/actualizar-estados', async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        // Actualizar documentos vencidos
        await db.query(
            `UPDATE documentos_persona 
             SET estado = 'vencido' 
             WHERE fecha_vencimiento < ? AND estado != 'vencido'`,
            [hoy]
        );

        // Actualizar documentos por vencer
        await db.query(
            `UPDATE documentos_persona 
             SET estado = 'por_vencer' 
             WHERE fecha_vencimiento BETWEEN ? AND DATE_ADD(?, INTERVAL 30 DAY)
               AND estado != 'vencido'`,
            [hoy, hoy]
        );

        // Actualizar documentos vigentes
        await db.query(
            `UPDATE documentos_persona 
             SET estado = 'vigente' 
             WHERE fecha_vencimiento > DATE_ADD(?, INTERVAL 30 DAY)
               AND estado != 'vigente'`,
            [hoy]
        );

        req.flash('success_msg', 'Estados de documentos actualizados correctamente');
        res.redirect('/documentos-personas');

    } catch (error) {
        console.error('Error al actualizar estados:', error);
        req.flash('error_msg', 'Error al actualizar estados');
        res.redirect('/documentos-personas');
    }
});

module.exports = router;