const db = require('../conexion');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/documentos_personas/';
        // Crear el directorio si no existe
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('archivo_documento');

// Obtener todos los tipos de documentos de un cliente
exports.getTiposDocumentos = async (req, res) => {
    try {
        const id_cliente = req.session.id_cliente || 1; // Ajusta según tu sesión
        const [tipos] = await db.query(
            `SELECT id_tipo_documento, nombre_documento, descripcion, dias_alerta, obligatorio 
             FROM tipo_documentos_persona 
             WHERE id_cliente = ? AND activo = TRUE 
             ORDER BY nombre_documento`,
            [id_cliente]
        );
        res.json(tipos);
    } catch (error) {
        console.error('Error al obtener tipos de documentos:', error);
        res.status(500).json({ error: 'Error al cargar tipos de documentos' });
    }
};

// Buscar persona por identificación
exports.buscarPersonaPorIdentificacion = async (req, res) => {
    try {
        const { identificacion } = req.params;
        const id_cliente = req.session.id_cliente || 1;

        const [personas] = await db.query(
            `SELECT p.id_persona, p.nombres, p.apellidos, p.identificacion, p.correo, p.telefono,
                    p.direccion, p.activo
             FROM personas p
             WHERE p.identificacion = ? AND p.id_cliente = ? AND p.activo = TRUE
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
        console.error('Error al buscar persona por identificación:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar persona'
        });
    }
};

// Obtener dashboard de documentos de personas
exports.getDashboard = async (req, res) => {
    try {
        const id_cliente = req.session.id_cliente || 1;
        const usuario_id = req.session.usuario_id || 1;

        // Obtener tipos de documentos
        const [tiposDocumentos] = await db.query(
            `SELECT id_tipo_documento, nombre_documento, descripcion, dias_alerta 
             FROM tipo_documentos_persona 
             WHERE id_cliente = ? AND activo = TRUE`,
            [id_cliente]
        );

        // Obtener personas con documentos
        const [personas] = await db.query(
            `SELECT DISTINCT p.id_persona, p.nombres, p.apellidos, p.identificacion
             FROM personas p
             INNER JOIN documentos_persona dp ON p.id_persona = dp.id_persona
             WHERE p.id_cliente = ? AND p.activo = TRUE
             ORDER BY p.nombres
             LIMIT 20`,
            [id_cliente]
        );

        // Obtener documentos recientes
        const [documentos] = await db.query(
            `SELECT dp.*, 
                    p.nombres, p.apellidos, p.identificacion,
                    td.nombre_documento as tipo_documento_nombre,
                    td.dias_alerta as tipo_dias_alerta
             FROM documentos_persona dp
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             INNER JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
             WHERE p.id_cliente = ? AND dp.estado IN ('vigente', 'por_vencer')
             ORDER BY dp.fecha_subida DESC
             LIMIT 15`,
            [id_cliente]
        );

        // Obtener documentos próximos a vencer (próximos 30 días)
        const [documentosProximos] = await db.query(
            `SELECT dp.*, 
                    p.nombres, p.apellidos, p.identificacion,
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

        res.render('documentos_personas/index', {
            title: 'Gestión de Documentos - Personas',
            tiposDocumentos,
            personas,
            documentos,
            documentosProximos,
            totalDocumentos: total[0].total,
            documentosVigentes: vigentes[0].total,
            documentosPorVencer: porVencer[0].total,
            documentosVencidos: vencidos[0].total,
            fecha: new Date(),
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('Error en dashboard:', error);
        req.flash('error_msg', 'Error al cargar el dashboard');
        res.redirect('/');
    }
};

// Registrar nuevo documento de persona
exports.registrarDocumento = async (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            console.error('Error en upload:', err);
            req.flash('error_msg', err.message || 'Error al subir el archivo');
            return res.redirect('/documentos-personas');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

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

            // Validaciones básicas
            if (!id_persona || !id_tipo_documento || !numero_documento || !fecha_vencimiento) {
                throw new Error('Todos los campos obligatorios deben estar completos');
            }

            // Verificar que la persona existe
            const [persona] = await connection.query(
                'SELECT id_persona FROM personas WHERE id_persona = ? AND activo = TRUE',
                [id_persona]
            );

            if (persona.length === 0) {
                throw new Error('La persona seleccionada no existe');
            }

            // Verificar que el tipo de documento existe
            const [tipoDoc] = await connection.query(
                'SELECT id_tipo_documento FROM tipo_documentos_persona WHERE id_tipo_documento = ? AND activo = TRUE',
                [id_tipo_documento]
            );

            if (tipoDoc.length === 0) {
                throw new Error('El tipo de documento seleccionado no existe');
            }

            // Calcular estado automático
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
            const [result] = await connection.query(
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

            await connection.commit();

            req.flash('success_msg', 'Documento registrado exitosamente');
            res.redirect('/documentos-personas');

        } catch (error) {
            await connection.rollback();
            console.error('Error al registrar documento:', error);

            // Eliminar archivo si se subió y hubo error
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo:', err);
                });
            }

            req.flash('error_msg', error.message || 'Error al registrar el documento');
            res.redirect('/documentos-personas');
        } finally {
            connection.release();
        }
    });
};

// Obtener documentos de una persona específica
exports.getDocumentosByPersona = async (req, res) => {
    try {
        const { id_persona } = req.params;
        const id_cliente = req.session.id_cliente || 1;

        const [documentos] = await db.query(
            `SELECT dp.*, td.nombre_documento as tipo_documento_nombre
             FROM documentos_persona dp
             INNER JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
             INNER JOIN personas p ON dp.id_persona = p.id_persona
             WHERE dp.id_persona = ? AND p.id_cliente = ?
             ORDER BY dp.fecha_vencimiento DESC`,
            [id_persona, id_cliente]
        );

        const [persona] = await db.query(
            'SELECT nombres, apellidos, identificacion FROM personas WHERE id_persona = ?',
            [id_persona]
        );

        res.json({
            success: true,
            documentos,
            persona: persona[0] || null
        });

    } catch (error) {
        console.error('Error al obtener documentos por persona:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cargar documentos'
        });
    }
};

// Actualizar estado de documentos (cron job o manual)
exports.actualizarEstados = async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        // Actualizar documentos vencidos
        await db.query(
            `UPDATE documentos_persona 
             SET estado = 'vencido' 
             WHERE fecha_vencimiento < ? AND estado != 'vencido'`,
            [hoy]
        );

        // Actualizar documentos por vencer (próximos 30 días)
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
};

// Registrar nuevo tipo de documento para personas
exports.registrarTipoDocumento = async (req, res) => {
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
        console.error('Error al registrar tipo de documento:', error);
        req.flash('error_msg', 'Error al registrar el tipo de documento');
        res.redirect('/documentos-personas');
    }
};

// Descargar archivo de documento
exports.descargarDocumento = async (req, res) => {
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
        console.error('Error al descargar documento:', error);
        req.flash('error_msg', 'Error al descargar el archivo');
        res.redirect('/documentos-personas');
    }
};