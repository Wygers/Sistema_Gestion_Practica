const db = require('../conexion');


exports.listar = async (req, res) => {
  try {
    const [grupos] = await db.query(`
            SELECT * 
            FROM grupos 
            ORDER BY id_grupo DESC
        `);

    res.render('grupos/listar', {
      title: 'Grupos',
      grupos
    });
  } catch (error) {
    console.error('Error al listar grupos:', error);
    res.status(500).send('Error al listar grupos');
  }
};


exports.formCrear = (req, res) => {
  res.render('grupos/crear', {
    title: 'Crear Grupo'
  });
};


exports.crear = async (req, res) => {
  try {
    const {
      nombre_grupo,
      nombre_empresa,
      nombre_contacto,
      email_contacto,
      direccion,
      ciudad
    } = req.body;

    await db.query(`
            INSERT INTO grupos 
            (nombre_grupo, nombre_empresa, nombre_contacto, email_contacto, direccion, ciudad)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
      nombre_grupo,
      nombre_empresa,
      nombre_contacto,
      email_contacto,
      direccion,
      ciudad
    ]);

    req.flash('success', 'Grupo creado correctamente');
    res.redirect('/grupos');
  } catch (error) {
    console.error('Error al crear grupo:', error);
    req.flash('error', 'Error al crear grupo');
    res.redirect('/grupos/crear');
  }
};
