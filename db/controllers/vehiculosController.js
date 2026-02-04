const db = require('../conexion');

const vehiculosController = {
    // Listar todos los vehículos
    listarVehiculos: async (req, res) => {
        try {
            console.log('🔄 Cargando listado de vehículos...');

            // Consulta corregida sin apellido_cliente
            const query = `
                SELECT 
                    v.*,
                    c.nombre_cliente,
                    c.rut_cliente,
                    c.correo_contacto,
                    c.telefono,
                    tv.nombre_tipo,
                    c.nombre_cliente AS nombre_completo_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                LEFT JOIN tipos_vehiculo tv ON v.tipo_vehiculo = tv.id_tipo_vehiculo
                ORDER BY v.fecha_registro DESC
            `;

            const [vehiculos] = await db.query(query);
            
            console.log(`✅ ${vehiculos.length} vehículo(s) cargado(s)`);

            res.render('listarVehiculos', {
                title: 'Listado de Vehículos',
                vehiculos: vehiculos,
                success: req.query.success,
                error: req.query.error
            });

        } catch (error) {
            console.error('❌ Error al listar vehículos:', error);
            res.render('listarVehiculos', {
                title: 'Listado de Vehículos',
                vehiculos: [],
                error: 'Error al cargar los vehículos: ' + error.message
            });
        }
    },

    // Mostrar formulario para agregar vehículo
    mostrarFormularioAgregar: async (req, res) => {
        try {
            console.log('🔄 Cargando formulario de vehículo...');

            // Obtener clientes activos con más información
            let clientes = [];
            try {
                const [rowsClientes] = await db.query(
                    'SELECT id_cliente, nombre_cliente, rut_cliente FROM clientes WHERE activo = 1 ORDER BY nombre_cliente'
                );
                clientes = rowsClientes || [];
                console.log(`✅ ${clientes.length} cliente(s) cargado(s)`);
            } catch (err) {
                console.log('⚠️ No se pudieron obtener clientes:', err.message);
            }

            // Obtener tipos de vehículo
            let tiposVehiculo = [];
            try {
                const [rowsTipos] = await db.query('SELECT id_tipo_vehiculo, nombre_tipo FROM tipos_vehiculo ORDER BY nombre_tipo');
                tiposVehiculo = rowsTipos || [];
                console.log(`✅ ${tiposVehiculo.length} tipo(s) de vehículo cargado(s)`);
            } catch (err) {
                console.log('⚠️ No se pudieron obtener tipos de vehículo:', err.message);
            }

            // Datos del formulario si hay error
            let datosForm = {};
            if (req.query.datos) {
                try {
                    datosForm = JSON.parse(decodeURIComponent(req.query.datos));
                } catch (e) { }
            }

            res.render('agregarVehiculo', {
                title: 'Agregar Vehículo',
                clientes: clientes,
                tiposVehiculo: tiposVehiculo,
                success: req.query.success,
                error: req.query.error,
                datosFormulario: datosForm
            });

        } catch (error) {
            console.error('❌ Error al cargar formulario:', error);
            res.render('agregarVehiculo', {
                title: 'Agregar Vehículo',
                clientes: [],
                tiposVehiculo: [],
                error: 'Error al cargar el formulario'
            });
        }
    },

    // Procesar formulario de vehículo
    agregarVehiculo: async (req, res) => {
        try {
            console.log('📝 Procesando nuevo vehículo...');

            const {
                id_cliente,
                patente,
                marca,
                modelo,
                anio,
                numero_chasis,
                numero_motor,
                tipo_vehiculo,
                capacidad,
                color,
                activo
            } = req.body;

            // Validación de campos obligatorios
            const camposObligatorios = [
                { campo: id_cliente, nombre: 'Cliente' },
                { campo: patente, nombre: 'Patente' },
                { campo: marca, nombre: 'Marca' },
                { campo: modelo, nombre: 'Modelo' },
                { campo: anio, nombre: 'Año' },
                { campo: tipo_vehiculo, nombre: 'Tipo de Vehículo' },
                { campo: capacidad, nombre: 'Capacidad' },
                { campo: color, nombre: 'Color' }
            ];

            const camposFaltantes = camposObligatorios
                .filter(item => !item.campo || item.campo.trim() === '')
                .map(item => item.nombre);

            if (camposFaltantes.length > 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/vehiculos/agregar?error=Faltan campos obligatorios: ${camposFaltantes.join(', ')}&datos=${datosJSON}`);
            }

            // Validar que el cliente existe
            const [clienteCheck] = await db.query(
                'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
                [id_cliente]
            );

            if (clienteCheck.length === 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/vehiculos/agregar?error=Cliente no válido&datos=${datosJSON}`);
            }

            // Validar que el tipo de vehículo existe
            const [tipoCheck] = await db.query(
                'SELECT id_tipo_vehiculo FROM tipos_vehiculo WHERE id_tipo_vehiculo = ?',
                [tipo_vehiculo]
            );

            if (tipoCheck.length === 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/vehiculos/agregar?error=Tipo de vehículo no válido&datos=${datosJSON}`);
            }

            // Validar patente única para el cliente
            const [patenteExistente] = await db.query(
                'SELECT id_vehiculo FROM vehiculos WHERE id_cliente = ? AND patente = ?',
                [id_cliente, patente.toUpperCase()]
            );

            if (patenteExistente.length > 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/vehiculos/agregar?error=La patente ya existe para este cliente&datos=${datosJSON}`);
            }

            // Insertar vehículo
            console.log('➕ Insertando vehículo...');

            const [result] = await db.query(
                `INSERT INTO vehiculos (
                    id_cliente,
                    patente,
                    marca,
                    modelo,
                    anio,
                    numero_chasis,
                    numero_motor,
                    tipo_vehiculo,
                    capacidad,
                    color,
                    activo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id_cliente,
                    patente.toUpperCase().replace(/\s+/g, ''),
                    marca.trim(),
                    modelo.trim(),
                    parseInt(anio),
                    numero_chasis ? numero_chasis.trim() : null,
                    numero_motor ? numero_motor.trim() : null,
                    tipo_vehiculo,
                    capacidad.trim(),
                    color.trim(),
                    activo === '1' ? 1 : 0
                ]
            );

            console.log('✅ Vehículo creado ID:', result.insertId);
            return res.redirect(`/vehiculos?success=Vehículo agregado exitosamente (ID: ${result.insertId})`);

        } catch (error) {
            console.error('❌ Error al agregar vehículo:', error);

            // Mantener datos si hay error
            const datosJSON = encodeURIComponent(JSON.stringify(req.body));

            if (error.code === 'ER_DUP_ENTRY') {
                return res.redirect(`/vehiculos/agregar?error=Patente duplicada para este cliente&datos=${datosJSON}`);
            }

            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.redirect(`/vehiculos/agregar?error=Cliente o tipo de vehículo no existe&datos=${datosJSON}`);
            }

            return res.redirect(`/vehiculos/agregar?error=Error del servidor: ${error.message}&datos=${datosJSON}`);
        }
    },

    // Eliminar vehículo
    eliminarVehiculo: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`🗑️  Eliminando vehículo ID: ${id}`);

            const [result] = await db.query('DELETE FROM vehiculos WHERE id_vehiculo = ?', [id]);

            if (result.affectedRows > 0) {
                console.log(`✅ Vehículo ${id} eliminado`);
                return res.redirect('/vehiculos?success=Vehículo eliminado exitosamente');
            } else {
                return res.redirect('/vehiculos?error=Vehículo no encontrado');
            }

        } catch (error) {
            console.error('❌ Error al eliminar vehículo:', error);
            
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.redirect('/vehiculos?error=No se puede eliminar el vehículo porque tiene documentos asociados');
            }
            
            return res.redirect('/vehiculos?error=Error al eliminar vehículo');
        }
    },

    // Mostrar formulario de edición
    mostrarFormularioEditar: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`✏️  Cargando formulario edición vehículo ID: ${id}`);

            // Obtener vehículo
            const [vehiculos] = await db.query(
                'SELECT * FROM vehiculos WHERE id_vehiculo = ?', 
                [id]
            );

            if (vehiculos.length === 0) {
                return res.redirect('/vehiculos?error=Vehículo no encontrado');
            }

            const vehiculo = vehiculos[0];

            // Obtener clientes activos
            const [clientes] = await db.query(
                'SELECT id_cliente, nombre_cliente, rut_cliente FROM clientes WHERE activo = 1 ORDER BY nombre_cliente'
            );

            // Obtener tipos de vehículo
            const [tiposVehiculo] = await db.query(
                'SELECT id_tipo_vehiculo, nombre_tipo FROM tipos_vehiculo ORDER BY nombre_tipo'
            );

            res.render('editarVehiculo', {
                title: 'Editar Vehículo',
                vehiculo: vehiculo,
                clientes: clientes,
                tiposVehiculo: tiposVehiculo,
                error: req.query.error
            });

        } catch (error) {
            console.error('❌ Error al cargar formulario de edición:', error);
            res.redirect('/vehiculos?error=Error al cargar formulario de edición');
        }
    },

    // Actualizar vehículo
    actualizarVehiculo: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`📝 Actualizando vehículo ID: ${id}`);

            const {
                id_cliente,
                patente,
                marca,
                modelo,
                anio,
                numero_chasis,
                numero_motor,
                tipo_vehiculo,
                capacidad,
                color,
                activo
            } = req.body;

            // Validación de campos obligatorios
            const camposObligatorios = [
                { campo: id_cliente, nombre: 'Cliente' },
                { campo: patente, nombre: 'Patente' },
                { campo: marca, nombre: 'Marca' },
                { campo: modelo, nombre: 'Modelo' },
                { campo: anio, nombre: 'Año' },
                { campo: tipo_vehiculo, nombre: 'Tipo de Vehículo' },
                { campo: capacidad, nombre: 'Capacidad' },
                { campo: color, nombre: 'Color' }
            ];

            const camposFaltantes = camposObligatorios
                .filter(item => !item.campo || item.campo.trim() === '')
                .map(item => item.nombre);

            if (camposFaltantes.length > 0) {
                return res.redirect(`/vehiculos/editar/${id}?error=Faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
            }

            // Verificar si el vehículo existe
            const [vehiculoExistente] = await db.query(
                'SELECT id_vehiculo FROM vehiculos WHERE id_vehiculo = ?',
                [id]
            );

            if (vehiculoExistente.length === 0) {
                return res.redirect('/vehiculos?error=Vehículo no encontrado');
            }

            // Verificar patente única (excluyendo el actual)
            const [patenteDuplicada] = await db.query(
                'SELECT id_vehiculo FROM vehiculos WHERE id_cliente = ? AND patente = ? AND id_vehiculo != ?',
                [id_cliente, patente.toUpperCase(), id]
            );

            if (patenteDuplicada.length > 0) {
                return res.redirect(`/vehiculos/editar/${id}?error=La patente ya existe para otro vehículo de este cliente`);
            }

            // Actualizar vehículo
            const [result] = await db.query(
                `UPDATE vehiculos SET
                    id_cliente = ?,
                    patente = ?,
                    marca = ?,
                    modelo = ?,
                    anio = ?,
                    numero_chasis = ?,
                    numero_motor = ?,
                    tipo_vehiculo = ?,
                    capacidad = ?,
                    color = ?,
                    activo = ?
                WHERE id_vehiculo = ?`,
                [
                    id_cliente,
                    patente.toUpperCase().replace(/\s+/g, ''),
                    marca.trim(),
                    modelo.trim(),
                    parseInt(anio),
                    numero_chasis ? numero_chasis.trim() : null,
                    numero_motor ? numero_motor.trim() : null,
                    tipo_vehiculo,
                    capacidad.trim(),
                    color.trim(),
                    activo === '1' ? 1 : 0,
                    id
                ]
            );

            console.log(`✅ Vehículo ${id} actualizado`);
            return res.redirect('/vehiculos?success=Vehículo actualizado exitosamente');

        } catch (error) {
            console.error('❌ Error al actualizar vehículo:', error);
            return res.redirect(`/vehiculos/editar/${req.params.id}?error=Error al actualizar vehículo`);
        }
    },

    // Obtener detalles de un vehículo (para AJAX)
    obtenerDetallesVehiculo: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`🔍 Obteniendo detalles vehículo ID: ${id}`);
            
            const query = `
                SELECT 
                    v.*,
                    c.nombre_cliente,
                    c.rut_cliente,
                    c.correo_contacto,
                    c.telefono,
                    tv.nombre_tipo,
                    c.nombre_cliente AS nombre_completo_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                LEFT JOIN tipos_vehiculo tv ON v.tipo_vehiculo = tv.id_tipo_vehiculo
                WHERE v.id_vehiculo = ?
            `;
            
            const [vehiculos] = await db.query(query, [id]);
            
            if (vehiculos.length === 0) {
                return res.status(404).json({ error: 'Vehículo no encontrado' });
            }
            
            res.json(vehiculos[0]);
            
        } catch (error) {
            console.error('❌ Error al obtener detalles del vehículo:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    }
};

module.exports = vehiculosController;