const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// URL de tu base de datos MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://gabry87_db_user:44EyKOTr30WRe9SP@dgrstudio.ognbwwb.mongodb.net/?appName=DGRStudio";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Conectado a DGRStudio'))
  .catch(err => console.error('❌ Error de conexión DB:', err));

const State = mongoose.model('State', {
  id: { type: String, default: 'main' },
  packs: Array,
  bookings: Array,
  homeContent: Object
});

app.get('/api/sync', async (req, res) => {
  try {
    const state = await State.findOne({ id: 'main' });
    res.json(state || { packs: [], bookings: [], homeContent: {} });
  } catch (err) { res.status(500).json(err); }
});

app.post('/api/sync', async (req, res) => {
  try {
    await State.findOneAndUpdate({ id: 'main' }, req.body, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json(err); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('🚀 Server listo en puerto ' + PORT));
