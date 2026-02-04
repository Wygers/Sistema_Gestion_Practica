const db = require('../db/conexion');
const path = require('path');
const fs = require('fs');

const documentosController = {
    // Mostrar vista principal de documentos
    mostrarVistaDocumentos: async (req, res) => {
        try {
            // Obtener fecha actual
            const [fechaResult] = await db.query('SELECT NOW() AS fecha');
            const fecha = fechaResult[0].fecha;

            // Inicializar contadores
            let totalDocumentos = 0;
            let documentosVigentes = 0;
            let documentosPorVencer = 0;
            let documentosVencidos = 0;
            let documentosProximos = [];
            let documentosRecientes = [];
            let vehiculos = [];
            let tiposDocumentos = [];

            try {
                // Verificar si la tabla documentos_vehiculo existe
                const [checkTable] = await db.query(`
                    SELECT COUNT(*) as existe 
                    FROM information_schema.tables 
                    WHERE table_schema = DATABASE() 
                    AND table_name = 'documentos_vehiculo'
                `);

                if (checkTable[0].existe > 0) {
                    // 1. Obtener total de documentos
                    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM documentos_vehiculo');
                    totalDocumentos = totalResult[0]?.total || 0;

                    // 2. Obtener documentos vigentes
                    const [vigentesResult] = await db.query("SELECT COUNT(*) as vigentes FROM documentos_vehiculo WHERE estado = 'vigente'");
                    documentosVigentes = vigentesResult[0]?.vigentes || 0;

                    // 3. Obtener documentos por vencer
                    const [porVencerResult] = await db.query(`
                        SELECT COUNT(*) as por_vencer 
                        FROM documentos_vehiculo 
                        WHERE estado = 'por_vencer' 
                        OR (estado = 'vigente' AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY))
                    `);
                    documentosPorVencer = porVencerResult[0]?.por_vencer || 0;

                    // 4. Obtener documentos vencidos
                    const [vencidosResult] = await db.query("SELECT COUNT(*) as vencidos FROM documentos_vehiculo WHERE estado = 'vencido'");
                    documentosVencidos = vencidosResult[0]?.vencidos || 0;

                    // 5. Obtener documentos próximos a vencer (próximos 30 días) - CON JOIN CORRECTO
                    const [proximosResult] = await db.query(`
                        SELECT 
                            dv.id_documento_veh,
                            dv.numero_documento,
                            dv.fecha_vencimiento,
                            dv.estado,
                            v.placa,
                            v.marca,
                            v.modelo,
                            tdv.nombre as tipo_documento
                        FROM documentos_vehiculo dv
                        LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                        LEFT JOIN tipo_documentos_vehiculo tdv ON dv.id_tipo_documento_veh = tdv.id_tipo_documento_veh
                        WHERE dv.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                        AND dv.estado != 'vencido'
                        ORDER BY dv.fecha_vencimiento ASC
                        LIMIT 10
                    `);
                    documentosProximos = proximosResult || [];

                    // 6. Obtener documentos recientes (últimos 10) - CON JOIN CORRECTO
                    const [recientesResult] = await db.query(`
                        SELECT 
                            dv.id_documento_veh,
                            dv.numero_documento,
                            dv.fecha_emision,
                            dv.fecha_vencimiento,
                            dv.estado,
                            dv.observaciones,
                            v.placa,
                            v.marca,
                            v.modelo,
                            tdv.nombre as tipo_documento
                        FROM documentos_vehiculo dv
                        LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                        LEFT JOIN tipo_documentos_vehiculo tdv ON dv.id_tipo_documento_veh = tdv.id_tipo_documento_veh
                        ORDER BY dv.fecha_subida DESC
                        LIMIT 10
                    `);
                    documentosRecientes = recientesResult || [];

                    // 7. Obtener vehículos activos
                    const [vehiculosResult] = await db.query(`
                        SELECT id_vehiculo, placa, marca, modelo 
                        FROM vehiculos 
                        WHERE estado = 'activo'
                        ORDER BY placa
                    `);
                    vehiculos = vehiculosResult || [];

                    // 8. Verificar si la tabla tipo_documentos_vehiculo existe
                    const [checkTiposTable] = await db.query(`
                        SELECT COUNT(*) as existe 
                        FROM information_schema.tables 
                        WHERE table_schema = DATABASE() 
                        AND table_name = 'tipo_documentos_vehiculo'
                    `);

                    if (checkTiposTable[0].existe > 0) {
                        const [tiposResult] = await db.query('SELECT * FROM tipo_documentos_vehiculo ORDER BY nombre');
                        tiposDocumentos = tiposResult || [];
                    } else {
                        // Tipos predeterminados si la tabla no existe
                        tiposDocumentos = [
                            { id_tipo_documento_veh: 1, nombre: 'SOAT', descripcion: 'Seguro Obligatorio de Accidentes de Tránsito' },
                            { id_tipo_documento_veh: 2, nombre: 'Revisión Técnica', descripcion: 'Certificado de revisión técnica vehicular' },
                            { id_tipo_documento_veh: 3, nombre: 'Seguro', descripcion: 'Seguro del vehículo' },
                            { id_tipo_documento_veh: 4, nombre: 'Otros', descripcion: 'Otros documentos' }
                        ];
                    }
                }
            } catch (error) {
                console.log('Error al consultar tablas de documentos:', error.message);
                // Continuar con datos por defecto
            }

            res.render('Documentos', {
                title: 'Gestión Documental',
                fecha: fecha,
                totalDocumentos: totalDocumentos,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos,
                documentosProximos: documentosProximos,
                documentos: documentosRecientes, // Cambié el nombre para ser más claro
                vehiculos: vehiculos,
                tiposDocumentos: tiposDocumentos
            });

        } catch (error) {
            console.error('Error crítico al cargar vista de documentos:', error);
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
        }
    },

    // Listar todos los documentos de vehículos
    listarDocumentosVehiculos: async (req, res) => {
        try {
            let documentos = [];

            try {
                const [result] = await db.query(`
                    SELECT 
                        dv.*,
                        v.placa,
                        v.marca,
                        v.modelo,
                        v.anio,
                        v.color,
                        tdv.nombre as tipo_documento,
                        tdv.descripcion as descripcion_tipo,
                        CONCAT(p.nombre, ' ', p.apellido) as propietario
                    FROM documentos_vehiculo dv
                    LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                    LEFT JOIN tipo_documentos_vehiculo tdv ON dv.id_tipo_documento_veh = tdv.id_tipo_documento_veh
                    LEFT JOIN personas p ON v.id_propietario = p.id_persona
                    ORDER BY dv.fecha_vencimiento ASC
                `);
                documentos = result || [];
            } catch (error) {
                console.log('Error al cargar documentos de vehículos:', error.message);
            }

            const [fechaResult] = await db.query('SELECT NOW() AS fecha');

            res.render('DocumentosVehiculos', {
                title: 'Documentos de Vehículos',
                documentos: documentos,
                fecha: fechaResult[0].fecha
            });

        } catch (error) {
            console.error('Error al listar documentos:', error);
            req.flash('error', 'Error al cargar documentos');
            res.redirect('/documentos');
        }
    },

    // Registrar documento de vehículo
    registrarDocumentoVehiculo: async (req, res) => {
        try {
            const {
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            console.log('Datos recibidos:', req.body); // Para debug

            // Validar campos requeridos
            if (!id_vehiculo || !id_tipo_documento_veh || !numero_documento || !fecha_vencimiento) {
                req.flash('error', 'Todos los campos marcados como requeridos son obligatorios');
                return res.redirect('/documentos');
            }

            // Determinar estado del documento
            const fechaVencimiento = new Date(fecha_vencimiento);
            const hoy = new Date();
            const diasDiferencia = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

            let estado = 'vigente';
            if (diasDiferencia <= 30 && diasDiferencia > 0) {
                estado = 'por_vencer';
            } else if (diasDiferencia <= 0) {
                estado = 'vencido';
            }

            // Manejo del archivo si existe
            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.originalname;
                ruta_archivo = `/uploads/documentos/vehiculos/${req.file.filename}`;

                // Crear directorio si no existe
                const uploadDir = path.join(__dirname, '../public/uploads/documentos/vehiculos');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
            }

            // Insertar documento - usando el ID de usuario de la sesión o 1 por defecto
            const usuarioId = req.session.usuario ? req.session.usuario.id_usuario : 1;

            await db.query(`
                INSERT INTO documentos_vehiculo 
                (id_vehiculo, id_tipo_documento_veh, numero_documento, fecha_emision, 
                 fecha_vencimiento, nombre_archivo, ruta_archivo, 
                 observaciones, estado, usuario_subida)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento,
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                estado,
                usuarioId
            ]);

            req.flash('success', 'Documento de vehículo registrado exitosamente');
            res.redirect('/documentos/vehiculos');

        } catch (error) {
            console.error('Error al registrar documento de vehículo:', error);
            req.flash('error', `Error al registrar el documento: ${error.message}`);
            res.redirect('/documentos');
        }
    },

    // Ver detalle de documento
    verDetalleDocumento: async (req, res) => {
        try {
            const { id } = req.params;

            const [documentos] = await db.query(`
                SELECT 
                    dv.*,
                    v.placa,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    tdv.nombre as tipo_documento,
                    tdv.descripcion as descripcion_tipo,
                    CONCAT(p.nombre, ' ', p.apellido) as propietario,
                    p.telefono,
                    p.email,
                    p.direccion,
                    u.nombre as usuario_registro
                FROM documentos_vehiculo dv
                LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                LEFT JOIN tipo_documentos_vehiculo tdv ON dv.id_tipo_documento_veh = tdv.id_tipo_documento_veh
                LEFT JOIN personas p ON v.id_propietario = p.id_persona
                LEFT JOIN usuarios u ON dv.usuario_subida = u.id_usuario
                WHERE dv.id_documento_veh = ?
            `, [id]);

            if (documentos.length === 0) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/documentos/vehiculos');
            }

            const documento = documentos[0];

            // Calcular días restantes
            const hoy = new Date();
            const fechaVencimiento = new Date(documento.fecha_vencimiento);
            const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

            res.render('DocumentoDetalle', {
                title: `Documento: ${documento.tipo_documento || 'Sin tipo'}`,
                documento: documento,
                diasRestantes: diasRestantes,
                fecha: new Date()
            });

        } catch (error) {
            console.error('Error al obtener detalle de documento:', error);
            req.flash('error', 'Error al cargar el detalle del documento');
            res.redirect('/documentos/vehiculos');
        }
    },

    // Agregar nuevo tipo de documento
    agregarNuevoTipoDocumento: async (req, res) => {
        try {
            const { nombre, descripcion, dias_alerta } = req.body;

            if (!nombre) {
                req.flash('error', 'El nombre del tipo de documento es obligatorio');
                return res.redirect('/documentos');
            }

            await db.query(`
                INSERT INTO tipo_documentos_vehiculo (nombre, descripcion, dias_alerta_predeterminado)
                VALUES (?, ?, ?)
            `, [nombre, descripcion || null, dias_alerta || 30]);

            req.flash('success', 'Tipo de documento agregado correctamente');
            res.redirect('/documentos');

        } catch (error) {
            console.error('Error al agregar tipo de documento:', error);
            req.flash('error', `Error al agregar el tipo de documento: ${error.message}`);
            res.redirect('/documentos');
        }
    },

    // Eliminar documento
    eliminarDocumento: async (req, res) => {
        try {
            const { id } = req.params;

            await db.query('DELETE FROM documentos_vehiculo WHERE id_documento_veh = ?', [id]);

            req.flash('success', 'Documento eliminado correctamente');
            res.redirect('/documentos/vehiculos');

        } catch (error) {
            console.error('Error al eliminar documento:', error);
            req.flash('error', 'Error al eliminar el documento');
            res.redirect('/documentos/vehiculos');
        }
    },

    // Función auxiliar para actualizar estados automáticamente
    actualizarEstadosDocumentos: async () => {
        try {
            await db.query(`
                UPDATE documentos_vehiculo 
                SET estado = 'por_vencer'
                WHERE estado = 'vigente' 
                AND fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                AND fecha_vencimiento > CURDATE()
            `);

            await db.query(`
                UPDATE documentos_vehiculo 
                SET estado = 'vencido'
                WHERE fecha_vencimiento < CURDATE() 
                AND estado != 'vencido'
            `);
        } catch (error) {
            console.error('Error al actualizar estados:', error);
        }
    }
};

module.exports = documentosController;