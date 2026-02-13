require('dotenv').config();
const db = require('../conexion'); // Ya es una instancia, no necesita "new"

const daysBetween = d => Math.ceil((new Date(d) - new Date()) / 86400000);
const logError = (tag, err) => console.error(` ${tag}`, err.message || err);

const documentosController = {
    apiVehiculos: async (req, res) => {
        try {
            const [vehiculos] = await db.execute(`
                SELECT 
                    v.id_vehiculo, 
                    v.patente, 
                    v.marca, 
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    c.nombre_cliente,
                    c.rut_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.activo = 1
                ORDER BY v.patente
            `);

            // Formatear para el select
            const formatted = vehiculos.map(v => ({
                id: v.id_vehiculo,
                text: `${v.patente} - ${v.marca} ${v.modelo}`,
                datos: v
            }));

            res.json({
                success: true,
                vehiculos: formatted,
                total: vehiculos.length
            });

        } catch (err) {
            logError('API VEHICULOS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar vehículos'
            });
        }
    },

    buscarVehiculoPorID: async (req, res) => {
        try {
            const { id } = req.params;

            const [[vehiculo]] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    v.numero_chasis,
                    v.numero_motor,
                    v.activo,
                    c.nombre_cliente,
                    c.rut_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.id_vehiculo = ?
            `, [id]);

            if (!vehiculo) {
                return res.json({
                    success: false,
                    message: 'Vehículo no encontrado'
                });
            }

            res.json({
                success: true,
                vehiculo
            });

        } catch (err) {
            logError('BUSCAR VEHICULO POR ID', err);
            res.status(500).json({
                success: false,
                error: 'Error al buscar vehículo'
            });
        }
    },

    buscarVehiculoPorPatente: async (req, res) => {
        try {
            const { patente } = req.params;

            const [[vehiculo]] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    v.numero_chasis,
                    v.numero_motor,
                    v.activo,
                    c.nombre_cliente,
                    c.rut_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.patente = ?
            `, [patente]);

            if (!vehiculo) {
                return res.json({
                    success: false,
                    message: 'Vehículo no encontrado'
                });
            }

            res.json({
                success: true,
                vehiculo
            });

        } catch (err) {
            logError('BUSCAR VEHICULO POR PATENTE', err);
            res.status(500).json({
                success: false,
                error: 'Error al buscar vehículo por patente'
            });
        }
    },

    verificarVehiculo: async (req, res) => {
        try {
            const { id } = req.params;

            const [[vehiculo]] = await db.execute(`
                SELECT id_vehiculo, patente, activo 
                FROM vehiculos 
                WHERE id_vehiculo = ?
            `, [id]);

            if (!vehiculo) {
                return res.json({
                    success: false,
                    exists: false,
                    message: 'Vehículo no encontrado'
                });
            }

            res.json({
                success: true,
                exists: true,
                vehiculo: {
                    id: vehiculo.id_vehiculo,
                    patente: vehiculo.patente,
                    activo: vehiculo.activo
                }
            });

        } catch (err) {
            logError('VERIFICAR VEHICULO', err);
            res.status(500).json({
                success: false,
                error: 'Error al verificar vehículo'
            });
        }
    },

    apiTipos: async (req, res) => {
        try {
            const [tipos] = await db.execute(`
                SELECT * FROM tipos_documento_veh 
                WHERE activo = 1
                ORDER BY nombre_documento
            `);

            res.json({
                success: true,
                tipos
            });

        } catch (err) {
            logError('API TIPOS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar tipos'
            });
        }
    },

    mostrarDocumentos: async (req, res) => {
        try {
            // 1. Obtener vehículos para el modal
            const [vehiculos] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    c.nombre_cliente,
                    v.anio,
                    v.color
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.activo = 1
                ORDER BY v.patente
            `);

            // 2. Obtener tipos de documento
            const [tiposDocumentos] = await db.execute(`
                SELECT * FROM tipos_documento_veh 
                WHERE activo = 1
                ORDER BY nombre_documento
            `);

            // 3. Obtener documentos con JOIN
            const [documentos] = await db.execute(`
                SELECT 
                    dv.*,
                    v.patente,
                    v.marca,
                    v.modelo,
                    td.nombre_documento as tipo_documento
                FROM documentos_vehiculo dv
                LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh = td.id_tipo_documento_veh
                ORDER BY dv.fecha_vencimiento DESC
                LIMIT 100
            `);

            const hoy = new Date();
            const documentosConEstado = documentos.map(doc => {
                const vencimiento = new Date(doc.fecha_vencimiento);
                const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

                let estado = 'vigente';
                if (diff <= 0) estado = 'vencido';
                else if (diff <= 7) estado = 'urgente';
                else if (diff <= 30) estado = 'por_vencer';

                return { ...doc, dias_restantes: diff, estado };
            });

            const documentosProximos = documentosConEstado.filter(d =>
                d.dias_restantes > 0 && d.dias_restantes <= 30
            );

            res.render('documentos', {
                title: 'Gestión Documental',
                vehiculos,
                tiposDocumentos,
                documentos: documentosConEstado,
                documentosProximos,
                totalDocumentos: documentos.length,
                documentosVigentes: documentosConEstado.filter(d => d.estado === 'vigente').length,
                documentosPorVencer: documentosConEstado.filter(d => d.estado === 'por_vencer').length,
                documentosVencidos: documentosConEstado.filter(d => d.estado === 'vencido').length,
                fecha: hoy,
                success_msg: req.query.success,
                error_msg: req.query.error
            });

        } catch (err) {
            logError('MOSTRAR DOCUMENTOS', err);
            console.error('Error detallado:', err);

            res.render('documentos', {
                title: 'Gestión Documental',
                vehiculos: [],
                tiposDocumentos: [],
                documentos: [],
                documentosProximos: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                fecha: new Date(),
                error_msg: 'Error al cargar datos. Intente nuevamente.'
            });
        }
    },

    agregarDocumento: async (req, res) => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const id_vehiculo = req.body.id_vehiculo || req.body.id_vehiculo_final;
            const {
                id_tipo_documento_veh,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            // Validaciones básicas
            if (!id_vehiculo || !id_tipo_documento_veh || !numero_documento || !fecha_vencimiento) {
                return res.redirect('/documentos?error=Faltan campos obligatorios');
            }

            const [[vehiculoExiste]] = await conn.execute(
                'SELECT id_vehiculo FROM vehiculos WHERE id_vehiculo = ? AND activo = 1',
                [id_vehiculo]
            );

            if (!vehiculoExiste) {
                return res.redirect('/documentos?error=El vehículo seleccionado no existe o está inactivo');
            }

            // Procesar archivo si existe
            const nombre_archivo = req.file ? req.file.filename : null;
            const ruta_archivo = req.file ? `/uploads/documentos/${req.file.filename}` : null;

            await conn.execute(`
                INSERT INTO documentos_vehiculo (
                    id_vehiculo,
                    id_tipo_documento_veh,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    nombre_archivo,
                    ruta_archivo,
                    observaciones,
                    fecha_subida,
                    estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'vigente')
            `, [
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null
            ]);

            await conn.commit();
            res.redirect('/documentos?success=Documento registrado exitosamente');

        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR DOCUMENTO', err);

            let errorMsg = 'Error al guardar el documento';
            if (err.code === 'ER_DUP_ENTRY') {
                errorMsg = 'El número de documento ya existe';
            } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                errorMsg = 'El vehículo o tipo de documento no existe';
            }

            res.redirect(`/documentos?error=${encodeURIComponent(errorMsg)}`);
        } finally {
            if (conn) conn.release();
        }
    },

    obtenerDetalle: async (req, res) => {
        try {
            const { id } = req.params;

            const [[documento]] = await db.execute(`
                SELECT 
                    dv.*,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.color,
                    td.nombre_documento as tipo_documento,
                    td.descripcion
                FROM documentos_vehiculo dv
                LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh = td.id_tipo_documento_veh
                WHERE dv.id_documento_veh = ?
            `, [id]);

            if (!documento) {
                return res.status(404).json({
                    success: false,
                    error: 'Documento no encontrado'
                });
            }

            res.json({ success: true, documento });

        } catch (err) {
            logError('DETALLE DOCUMENTO', err);
            res.status(500).json({
                success: false,
                error: 'Error al obtener detalle'
            });
        }
    },

    crearTipoDocumento: async (req, res) => {
        try {
            const { nombre_documento, descripcion } = req.body;

            if (!nombre_documento) {
                return res.redirect('/documentos?error=El nombre del tipo es obligatorio');
            }

            await db.execute(`
                INSERT INTO tipos_documento_veh (nombre_documento, descripcion, activo)
                VALUES (?, ?, 1)
            `, [nombre_documento, descripcion || null]);

            res.redirect('/documentos?success=Tipo de documento creado exitosamente');

        } catch (err) {
            logError('CREAR TIPO DOCUMENTO', err);
            res.redirect('/documentos?error=Error al crear tipo de documento');
        }
    },

    editarDocumento: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
            const {
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            // Procesar archivo si existe
            if (req.file) {
                const nombre_archivo = req.file.filename;
                const ruta_archivo = `/uploads/documentos/${req.file.filename}`;

                await conn.execute(
                    'UPDATE documentos_vehiculo SET nombre_archivo = ?, ruta_archivo = ? WHERE id_documento_veh = ?',
                    [nombre_archivo, ruta_archivo, id]
                );
            }

            await conn.execute(`
                UPDATE documentos_vehiculo 
                SET id_vehiculo = ?,
                    id_tipo_documento_veh = ?,
                    numero_documento = ?,
                    fecha_emision = ?,
                    fecha_vencimiento = ?,
                    observaciones = ?,
                    fecha_actualizacion = NOW()
                WHERE id_documento_veh = ?
            `, [
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                observaciones || null,
                id
            ]);

            await conn.commit();
            res.redirect('/documentos?success=Documento actualizado exitosamente');

        } catch (err) {
            if (conn) await conn.rollback();
            logError('EDITAR DOCUMENTO', err);
            res.redirect('/documentos?error=Error al actualizar documento');
        } finally {
            if (conn) conn.release();
        }
    },

    eliminarDocumento: async (req, res) => {
        try {
            const { id } = req.params;

            await db.execute(
                'DELETE FROM documentos_vehiculo WHERE id_documento_veh = ?',
                [id]
            );

            res.redirect('/documentos?success=Documento eliminado exitosamente');

        } catch (err) {
            logError('ELIMINAR DOCUMENTO', err);
            res.redirect('/documentos?error=Error al eliminar documento');
        }
    },

    listarDocumentosPorVehiculo: async (req, res) => {
        try {
            const [vehiculosConDocumentos] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    COUNT(dv.id_documento_veh) as total_documentos,
                    SUM(CASE WHEN dv.fecha_vencimiento > NOW() THEN 1 ELSE 0 END) as vigentes,
                    SUM(CASE WHEN dv.fecha_vencimiento < NOW() THEN 1 ELSE 0 END) as vencidos
                FROM vehiculos v
                LEFT JOIN documentos_vehiculo dv ON v.id_vehiculo = dv.id_vehiculo
                WHERE v.activo = 1
                GROUP BY v.id_vehiculo, v.patente, v.marca, v.modelo
                ORDER BY v.patente
            `);

            res.render('documentos_vehiculos', {
                title: 'Documentos por Vehículo',
                vehiculos: vehiculosConDocumentos,
                fecha: new Date()
            });

        } catch (err) {
            logError('LISTAR DOCUMENTOS POR VEHICULO', err);
            res.redirect('/documentos?error=Error al cargar documentos por vehículo');
        }
    },

    documentosPorVehiculo: async (req, res) => {
        try {
            const { id } = req.params;

            const [[vehiculo]] = await db.execute(`
                SELECT * FROM vehiculos WHERE id_vehiculo = ?
            `, [id]);

            if (!vehiculo) {
                return res.redirect('/documentos?error=Vehículo no encontrado');
            }

            const [documentos] = await db.execute(`
                SELECT 
                    dv.*,
                    td.nombre_documento as tipo_documento
                FROM documentos_vehiculo dv
                LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh = td.id_tipo_documento_veh
                WHERE dv.id_vehiculo = ?
                ORDER BY dv.fecha_vencimiento
            `, [id]);

            const hoy = new Date();
            const documentosConEstado = documentos.map(doc => {
                const vencimiento = new Date(doc.fecha_vencimiento);
                const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

                let estado = 'vigente';
                if (diff <= 0) estado = 'vencido';
                else if (diff <= 7) estado = 'urgente';
                else if (diff <= 30) estado = 'por_vencer';

                return { ...doc, dias_restantes: diff, estado };
            });

            res.render('documentos_vehiculo', {
                title: `Documentos - ${vehiculo.patente}`,
                vehiculo,
                documentos: documentosConEstado,
                fecha: hoy
            });

        } catch (err) {
            logError('DOCUMENTOS POR VEHICULO', err);
            res.redirect('/documentos?error=Error al cargar documentos del vehículo');
        }
    },

    enviarRecordatorio: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`Enviando recordatorio para documento ID: ${id}`);
            res.redirect('/documentos?success=Recordatorio enviado exitosamente');

        } catch (err) {
            logError('ENVIAR RECORDATORIO', err);
            res.redirect('/documentos?error=Error al enviar recordatorio');
        }
    },

    generarReporte: async (req, res) => {
        try {
            const { tipo } = req.params;
            console.log(`Generando reporte tipo: ${tipo}`);
            res.redirect('/documentos?success=Reporte generado exitosamente');

        } catch (err) {
            logError('GENERAR REPORTE', err);
            res.redirect('/documentos?error=Error al generar reporte');
        }
    }
};

module.exports = documentosController;