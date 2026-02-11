// controllers/documentoPersona.controller.js
const db = require('../conexion');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// Configuración de Multer
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/documentos_personas');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `persona-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF, JPG y PNG'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('archivo_documento');

const documentoPersonaController = {
    // ============================================
    // VISTA PRINCIPAL - CON TIPOS DE DOCUMENTO
    // ============================================
    index: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            // 1. Actualizar estados
            await db.query(`
                UPDATE documentos_persona dp
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                SET dp.estado = CASE
                    WHEN dp.fecha_vencimiento < CURDATE() THEN 'vencido'
                    WHEN dp.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL tdp.dias_alerta DAY) THEN 'por_vencer'
                    ELSE 'vigente'
                END
                WHERE p.id_cliente = ?
            `, [idCliente]);

            // 2. Obtener documentos
            const [documentos] = await db.query(`
                SELECT 
                    dp.*,
                    p.run,
                    p.dv,
                    p.nombres,
                    p.apellido_paterno,
                    p.apellido_materno,
                    p.email,
                    CONCAT(p.run, '-', p.dv) as identificacion,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as nombre_completo,
                    tdp.nombre_documento as tipo_documento_nombre,
                    tdp.dias_alerta,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.id_cliente = ? AND p.activo = true
                ORDER BY dp.fecha_subida DESC
            `, [idCliente]);

            // 3. Documentos próximos a vencer
            const [proximos] = await db.query(`
                SELECT 
                    dp.*,
                    p.run,
                    p.dv,
                    p.nombres,
                    p.apellido_paterno,
                    p.apellido_materno,
                    CONCAT(p.run, '-', p.dv) as identificacion,
                    tdp.nombre_documento as tipo_documento_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    AND dp.estado != 'vencido'
                    AND p.activo = true
                ORDER BY dp.fecha_vencimiento ASC
            `, [idCliente]);

            // 4. Estadísticas
            const [estadisticas] = await db.query(`
                SELECT 
                    COUNT(*) as total_documentos,
                    SUM(CASE WHEN dp.estado = 'vigente' THEN 1 ELSE 0 END) as documentos_vigentes,
                    SUM(CASE WHEN dp.estado = 'por_vencer' THEN 1 ELSE 0 END) as documentos_por_vencer,
                    SUM(CASE WHEN dp.estado = 'vencido' THEN 1 ELSE 0 END) as documentos_vencidos
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE p.id_cliente = ? AND p.activo = true
            `, [idCliente]);

            // 5. Personas activas
            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    run,
                    dv,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    CONCAT(run, '-', dv) as identificacion,
                    email,
                    telefono,
                    cargo
                FROM personas 
                WHERE id_cliente = ? AND activo = true
                ORDER BY apellido_paterno, nombres
            `, [idCliente]);

            // ===== 🔥 CRÍTICO: OBTENER TIPOS DE DOCUMENTO 🔥 =====
            let [tiposDocumentos] = await db.query(`
                SELECT 
                    id_tipo_documento,
                    nombre_documento,
                    descripcion,
                    dias_alerta,
                    obligatorio
                FROM tipo_documentos_persona
                WHERE id_cliente = ? AND activo = true
                ORDER BY nombre_documento
            `, [idCliente]);

            // ===== 🔥 RESPALDO: Si no hay tipos, usar array por defecto 🔥 =====
            if (!tiposDocumentos || tiposDocumentos.length === 0) {
                console.log('⚠️ No hay tipos de documento en BD, usando array por defecto');
                tiposDocumentos = [
                    { id_tipo_documento: 1, nombre_documento: 'Cédula de Identidad', descripcion: 'Documento nacional de identidad', dias_alerta: 60, obligatorio: true },
                    { id_tipo_documento: 2, nombre_documento: 'Pasaporte', descripcion: 'Documento de viaje internacional', dias_alerta: 90, obligatorio: false },
                    { id_tipo_documento: 3, nombre_documento: 'Licencia de Conducir', descripcion: 'Permiso para conducir vehículos', dias_alerta: 30, obligatorio: false },
                    { id_tipo_documento: 4, nombre_documento: 'Certificado de Antecedentes', descripcion: 'Certificado de antecedentes penales', dias_alerta: 30, obligatorio: true },
                    { id_tipo_documento: 5, nombre_documento: 'Título Profesional', descripcion: 'Título universitario o técnico', dias_alerta: 365, obligatorio: false },
                    { id_tipo_documento: 6, nombre_documento: 'Certificado de Matrimonio', descripcion: 'Certificado de estado civil', dias_alerta: 365, obligatorio: false },
                    { id_tipo_documento: 7, nombre_documento: 'Otros', descripcion: 'Otros tipos de documentos', dias_alerta: 30, obligatorio: false }
                ];
            }

            // Log para verificar
            console.log(`✅ Tipos de documento cargados: ${tiposDocumentos.length}`);

            // ===== RENDERIZAR CON TODAS LAS VARIABLES =====
            res.render('DocumentosPersonas', {
                title: 'Gestión Documental - Personas',
                currentRoute: '/documentos-personas',
                documentos: documentos,
                documentosProximos: proximos,
                totalDocumentos: estadisticas[0]?.total_documentos || 0,
                documentosVigentes: estadisticas[0]?.documentos_vigentes || 0,
                documentosPorVencer: estadisticas[0]?.documentos_por_vencer || 0,
                documentosVencidos: estadisticas[0]?.documentos_vencidos || 0,
                personas: personas,
                tiposDocumentos: tiposDocumentos, // ✅ VARIABLE CRÍTICA
                success_msg: req.flash('success'),
                error_msg: req.flash('error'),
                success: req.flash('success'),
                error: req.flash('error'),
                formData: req.flash('formData')[0] || {},
                usuario: req.session.usuario || null
            });
        } catch (error) {
            console.error('❌ Error en index:', error);
            req.flash('error', 'Error al cargar documentos');
            res.redirect('/');
        }
    },

    // ============================================
    // REGISTRAR DOCUMENTO
    // ============================================
    registrar: async (req, res) => {
        try {
            upload(req, res, async function (err) {
                if (err) {
                    req.flash('error', err.message || 'Error al subir el archivo');
                    req.flash('formData', req.body);
                    return res.redirect('/documentos-personas');
                }

                const idCliente = req.session?.usuario?.id_cliente || 1;
                const usuarioId = req.session?.usuario?.id_usuario || null;

                const {
                    id_persona,
                    id_tipo_documento,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    observaciones
                } = req.body;

                // Validaciones
                if (!id_persona || !id_tipo_documento || !fecha_vencimiento) {
                    req.flash('error', 'Los campos obligatorios deben ser completados');
                    req.flash('formData', req.body);
                    return res.redirect('/documentos-personas');
                }

                // Verificar persona
                const [persona] = await db.query(
                    'SELECT * FROM personas WHERE id_persona = ? AND id_cliente = ? AND activo = true',
                    [id_persona, idCliente]
                );

                if (persona.length === 0) {
                    req.flash('error', 'La persona seleccionada no existe');
                    req.flash('formData', req.body);
                    return res.redirect('/documentos-personas');
                }

                // Obtener tipo de documento
                const [tipoDoc] = await db.query(
                    'SELECT nombre_documento, dias_alerta FROM tipo_documentos_persona WHERE id_tipo_documento = ? AND id_cliente = ?',
                    [id_tipo_documento, idCliente]
                );

                // Calcular estado
                const hoy = new Date();
                const vencimiento = new Date(fecha_vencimiento);
                const diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
                const diasAlerta = tipoDoc[0]?.dias_alerta || 30;

                let estado = 'vigente';
                if (diasRestantes <= 0) {
                    estado = 'vencido';
                } else if (diasRestantes <= diasAlerta) {
                    estado = 'por_vencer';
                }

                // Insertar documento
                await db.query(`
                    INSERT INTO documentos_persona (
                        id_persona, id_tipo_documento, nombre_archivo, ruta_archivo,
                        numero_documento, fecha_emision, fecha_vencimiento, estado,
                        observaciones, usuario_subida
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_persona,
                    id_tipo_documento,
                    req.file?.originalname || null,
                    req.file?.path || null,
                    numero_documento || null,
                    fecha_emision || null,
                    fecha_vencimiento,
                    estado,
                    observaciones || null,
                    usuarioId
                ]);

                req.flash('success', 'Documento registrado exitosamente');
                res.redirect('/documentos-personas');
            });
        } catch (error) {
            console.error('❌ Error en registrar:', error);
            req.flash('error', 'Error al registrar el documento');
            req.flash('formData', req.body);
            res.redirect('/documentos-personas');
        }
    },

    // ============================================
    // BUSCAR PERSONA POR RUN
    // ============================================
    buscarPersonaPorRun: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;
            const { run } = req.params;

            const [persona] = await db.query(`
                SELECT 
                    id_persona, run, dv, nombres, apellido_paterno, apellido_materno,
                    CONCAT(run, '-', dv) as identificacion_completa,
                    email, telefono, cargo, activo
                FROM personas 
                WHERE id_cliente = ? AND activo = true
                    AND (run = ? OR CONCAT(run, '-', dv) = ?)
                LIMIT 1
            `, [idCliente, run, run]);

            if (persona.length > 0) {
                res.json({ success: true, persona: persona[0] });
            } else {
                res.json({ success: false, message: 'Persona no encontrada' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error al buscar persona' });
        }
    },

    // ============================================
    // DESCARGAR DOCUMENTO
    // ============================================
    descargar: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documento] = await db.query(`
                SELECT dp.*, p.id_cliente 
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0 || !documento[0].ruta_archivo) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/documentos-personas');
            }

            try {
                await fs.access(documento[0].ruta_archivo);
                res.download(documento[0].ruta_archivo, documento[0].nombre_archivo);
            } catch {
                req.flash('error', 'El archivo no existe en el servidor');
                res.redirect('/documentos-personas');
            }
        } catch (error) {
            req.flash('error', 'Error al descargar el documento');
            res.redirect('/documentos-personas');
        }
    },

    // ============================================
    // ELIMINAR DOCUMENTO
    // ============================================
    eliminar: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documento] = await db.query(`
                SELECT dp.*, p.id_cliente 
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/documentos-personas');
            }

            if (documento[0].ruta_archivo) {
                try { await fs.unlink(documento[0].ruta_archivo); } catch (e) { }
            }

            await db.query('DELETE FROM documentos_persona WHERE id_documento = ?', [id]);
            req.flash('success', 'Documento eliminado exitosamente');
            res.redirect('/documentos-personas');
        } catch (error) {
            req.flash('error', 'Error al eliminar el documento');
            res.redirect('/documentos-personas');
        }
    },

    // ============================================
    // CREAR TIPO DE DOCUMENTO
    // ============================================
    crearTipoDocumento: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;
            const { nombre, descripcion, dias_alerta, obligatorio } = req.body;

            if (!nombre) {
                req.flash('error', 'El nombre del tipo de documento es obligatorio');
                return res.redirect('/documentos-personas');
            }

            await db.query(`
                INSERT INTO tipo_documentos_persona 
                (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio) 
                VALUES (?, ?, ?, ?, ?)
            `, [idCliente, nombre, descripcion || null, dias_alerta || 30, obligatorio === 'on']);

            req.flash('success', 'Tipo de documento creado exitosamente');
            res.redirect('/documentos-personas');
        } catch (error) {
            req.flash('error', error.code === 'ER_DUP_ENTRY' ?
                'Ya existe un tipo de documento con ese nombre' :
                'Error al crear el tipo de documento');
            res.redirect('/documentos-personas');
        }
    }
};

module.exports = documentoPersonaController;