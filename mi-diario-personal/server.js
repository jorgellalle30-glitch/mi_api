const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const sql = require('mssql');
require('dotenv').config();

// Configuración de SQL Server
const poolPromise = sql.connect({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // Para conexiones seguras (útil si usas Azure)
    trustServerCertificate: true // Si el servidor es local o tienes problemas con certificados
  }
});

// Configuración de Express
const app = express();
app.use(bodyParser.json());

// Función para verificar el JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Acceso denegado');
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Token inválido');
    req.user = user;
    next();
  });
};

// Endpoints para manejar las notas

// Obtener todas las notas
app.get('/notes', verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.id)
      .query('SELECT * FROM notes WHERE user_id = @user_id');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Crear una nueva nota
app.post('/notes', verifyToken, async (req, res) => {
  const { title, content } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('content', sql.NText, content)
      .input('user_id', sql.Int, req.user.id)
      .query('INSERT INTO notes (title, content, user_id) OUTPUT Inserted.* VALUES (@title, @content, @user_id)');
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Actualizar una nota existente
app.put('/notes/:id', verifyToken, async (req, res) => {
  const { title, content } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('title', sql.NVarChar, title)
      .input('content', sql.NText, content)
      .input('id', sql.Int, req.params.id)
      .input('user_id', sql.Int, req.user.id)
      .query('UPDATE notes SET title = @title, content = @content WHERE id = @id AND user_id = @user_id OUTPUT Inserted.*');
    if (result.recordset.length === 0) {
      return res.status(404).send('Nota no encontrada');
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Eliminar una nota
app.delete('/notes/:id', verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('user_id', sql.Int, req.user.id)
      .query('DELETE FROM notes WHERE id = @id AND user_id = @user_id');
    if (result.rowsAffected[0] === 0) {
      return res.status(404).send('Nota no encontrada');
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Endpoint para login y generar JWT
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM users WHERE username = @username');
    
    if (result.recordset.length === 0 || result.recordset[0].password !== password) {
      return res.status(401).send('Usuario o contraseña incorrectos');
    }
    
    const user = result.recordset[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error en la base de datos');
  }
});

// Iniciar el servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en el puerto ${process.env.PORT}`);
});
