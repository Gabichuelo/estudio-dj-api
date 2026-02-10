require('dotenv').config(); // Carga las variables del entorno
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// YA NO HAY CONTRASEÑA AQUÍ. Se lee desde el panel de Render.
const MONGODB_URI = process.env.MONGODB_URI;

console.log('--- 🚀 DGR STUDIO BACKEND STARTING ---');

if (!MONGODB_URI) {
  console.error('❌ ERROR: La variable MONGODB_URI no está definida en el panel de Render.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ CONEXIÓN EXITOSA: MongoDB Atlas está listo.');
})
.catch(err => {
  console.log('❌ ERROR DE CONEXIÓN CRÍTICO ❌');
  console.log('👉 DETALLE:', err.message);
  console.log('👉 REVISA: 1. IP en Network Access (0.0.0.0/0). 2. Contraseña en Render.');
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
