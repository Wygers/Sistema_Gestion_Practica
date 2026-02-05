require('dotenv').config();
const Conexion = require('../conexion');
const db = new Conexion();

/* ===============================
   HELPERS
================================ */

const daysBetween = d =>
    Math.ceil((new Date(d) - new Date()) / 86400000);

const logError = (tag, err) => console.error(`❌ ${tag}`, err);

/* ===============================
   CONTROLLER
================================ */

const documentosController = {

    /* ---------- API VEHICULOS ---------- */

    apiVehiculos: async (req, res) => {

        try {

            const [vehiculos] = await db.pool.execute(`
                SELECT id_vehiculo, patente, marca, modelo
                FROM vehiculos
                WHERE activo = 1
                ORDER BY patente
            `);

            res.json({ success: true, vehiculos });

        } catch (err) {

            logError('API VEHICULOS', err);
            res.status(500).json({ success: false });
        }
    },

    /* ---------- DASHBOARD ---------- */

    mostrarDocumentos: async (req, res) => {

        try {

            const [[vehiculos], [tiposDocumentos], [documentos]] =
                await Promise.all([

                    db.pool.execute(`
                    SELECT v.id_vehiculo,v.patente,v.marca,v.modelo,c.nombre_cliente
                    FROM vehiculos v
                    LEFT JOIN clientes c ON v.id_cliente=c.id_cliente
                    WHERE v.activo=1
                    ORDER BY v.patente
                `),

                    db.pool.execute(`
                    SELECT * FROM tipos_documento_veh ORDER BY nombre
                `),

                    db.pool.execute(`
                    SELECT dv.*,v.patente,v.marca,v.modelo,
                    td.nombre tipo_documento
                    FROM documentos_vehiculares dv
                    LEFT JOIN vehiculos v ON dv.id_vehiculo=v.id_vehiculo
                    LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh=td.id_tipo_documento_veh
                    ORDER BY dv.fecha_vencimiento
                `)

                ]);

            const hoy = new Date();

            const proximos = documentos.filter(d => {
                const diff = daysBetween(d.fecha_vencimiento);
                return diff > 0 && diff <= 30;
            });

            res.render('documentos', {
                title: 'Gestión Documental',
                vehiculos,
                tiposDocumentos,
                documentos,
                documentosProximos: proximos,
                totalDocumentos: documentos.length,
                documentosVigentes: documentos.filter(d => new Date(d.fecha_vencimiento) > hoy).length,
                documentosPorVencer: proximos.length,
                documentosVencidos: documentos.filter(d => new Date(d.fecha_vencimiento) < hoy).length,
                fecha: hoy,
                success_msg: req.query.success,
                error_msg: req.query.error
            });

        } catch (err) {

            logError('MOSTRAR', err);

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
                error_msg: 'Error interno'
            });
        }
    },

    /* ---------- CREAR DOCUMENTO ---------- */

    agregarDocumento: async (req, res) => {

        const conn = await db.pool.getConnection();

        try {

            const {
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                dias_alerta,
                observaciones
            } = req.body;

            if (!id_vehiculo || !id_tipo_documento_veh || !numero_documento || !fecha_vencimiento) {
                return res.redirect('/documentos?error=Campos faltantes');
            }

            const ruta = req.file ? `/uploads/${req.file.filename}` : null;

            await conn.beginTransaction();

            await conn.execute(`
                INSERT INTO documentos_vehiculares(
                id_vehiculo,id_tipo_documento_veh,numero_documento,
                fecha_emision,fecha_vencimiento,dias_alerta,
                ruta_archivo,observaciones,enviar_alerta,fecha_registro)
                VALUES(?,?,?,?,?,?,?,?,?,NOW())
            `, [
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                dias_alerta || 30,
                ruta,
                observaciones || null,
                req.body.enviar_alerta ? 1 : 0
            ]);

            await conn.commit();

            res.redirect('/documentos?success=Documento registrado');

        } catch (err) {

            await conn.rollback();
            logError('AGREGAR', err);

            res.redirect('/documentos?error=No se pudo guardar');

        } finally {

            conn.release();
        }
    }

};

module.exports = documentosController;
