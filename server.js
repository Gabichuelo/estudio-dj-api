const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGODB_URI = "mongodb+srv://gabry87_db_user:TfHg.fd9CYGgJwB@dgrstudio.ognbwwb.mongodb.net/?appName=DGRStudio";

console.log('--- 🚀 DGR STUDIO BACKEND STARTING ---');

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ CONEXIÓN EXITOSA: MongoDB Atlas está listo.');
})
.catch(err => {
  console.log('❌ ERROR DE CONEXIÓN CRÍTICO ❌');
  if (err.message.includes('Server selection timed out')) {
    console.log('👉 MOTIVO: MongoDB está bloqueando la IP de Render.');
    console.log('👉 SOLUCIÓN: Ve a MongoDB Atlas -> Network Access -> Add IP -> Allow Access From Anywhere (0.0.0.0/0)');
  } else if (err.message.includes('Authentication failed')) {
    console.log('👉 MOTIVO: La contraseña de la base de datos es incorrecta.');
  } else {
    console.log('👉 ERROR DETALLADO:', err.message);
  }
});

const State = mongoose.model('State', {
  id: { type: String, default: 'main' },
  packs: Array,
  bookings: Array,
  homeContent: Object
});

app.get('/', (req, res) => res.status(200).send('API ONLINE 🚀'));

app.get('/api/sync', async (req, res) => {
  try {
    const state = await State.findOne({ id: 'main' });
    res.json(state || { packs: [], bookings: [], homeContent: {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sync', async (req, res) => {
  try {
    await State.findOneAndUpdate({ id: 'main' }, req.body, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
