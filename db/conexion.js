const mysql = require('mysql2');
require('dotenv').config();

class Conexion {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sistema_gpv',
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // 🔎 Verificar conexión al iniciar la app
        this.pool.getConnection((err, connection) => {
            if (err) {
                console.error('❌ Error al conectar a MySQL:', err.message);
            } else {
                console.log('✅ Conectado a MySQL correctamente');
                connection.release();
            }
        });
    }

    execute(sql, valores = []) {
        return new Promise((resolve, reject) => {
            this.pool.execute(sql, valores, (error, resultados, fields) => {
                if (error) {
                    console.error('❌ Error en execute():', error.message);
                    return reject(error);
                }
                resolve([resultados, fields]);
            });
        });
    }

    query(sql, valores = []) {
        return new Promise((resolve, reject) => {
            this.pool.query(sql, valores, (error, resultados, fields) => {
                if (error) {
                    console.error('❌ Error en query():', error.message);
                    return reject(error);
                }
                resolve([resultados, fields]);
            });
        });
    }

    cerrarConexion() {
        return new Promise((resolve, reject) => {
            this.pool.end(err => {
                if (err) {
                    console.error('❌ Error al cerrar MySQL:', err.message);
                    return reject(err);
                }
                console.log('🔌 Conexión MySQL cerrada');
                resolve();
            });
        });
    }
}

module.exports = new Conexion();
