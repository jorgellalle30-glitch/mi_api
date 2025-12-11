const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Conexión a la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Manejo de errores global
const handleError = (error, res) => {
  console.error(error);
  res.status(500).send('Error en la operación de la base de datos');
};

// Middleware para verificar el token JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(403).send('Acceso denegado');
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).send('Token no válido');
  }
};

// Ruta de login para obtener el token JWT
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send('El nombre de usuario y la contraseña son obligatorios');
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(400).send('Usuario no encontrado');
    }

    const user = result.rows[0];

    // Verificar la contraseña (debería estar encriptada en producción)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).send('Contraseña incorrecta');
    }

    // Crear el token JWT
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al realizar login');
  }
});

// Rutas para las notas

// Obtener todas las notas (requiere autenticación)
app.get('/notes', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notes WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// Crear una nueva nota (requiere autenticación)
app.post('/notes', verifyToken, async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).send('El título y el contenido son obligatorios');
  }

  try {
    const result = await pool.query('INSERT INTO notes (title, content, user_id) VALUES ($1, $2, $3) RETURNING *', [title, content, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Actualizar una nota (requiere autenticación)
app.put('/notes/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).send('El título y el contenido son obligatorios');
  }

  try {
    const result = await pool.query('UPDATE notes SET title = $1, content = $2 WHERE id = $3 AND user_id = $4 RETURNING *', [title, content, id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Nota no encontrada');
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Eliminar una nota (requiere autenticación)
app.delete('/notes/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Nota no encontrada');
    }
    res.status(204).send();
  } catch (error) {
    handleError(error, res);
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Cerrar la conexión a la base de datos cuando el servidor se detiene
process.on('SIGINT', () => {
  pool.end().then(() => {
    console.log('Conexión a la base de datos cerrada');
    process.exit(0);
  });
});
