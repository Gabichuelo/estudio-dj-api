
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createMollieClient } = require('@mollie/api-client');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

console.log('--- 🚀 DGR STUDIO BACKEND STARTING ---');

if (!MONGODB_URI) {
  console.error('❌ ERROR CRÍTICO: La variable MONGODB_URI no está definida.');
} else {
    mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })
    .then(() => console.log('✅ CONEXIÓN EXITOSA: MongoDB Atlas está listo.'))
    .catch(err => console.log('❌ ERROR DE CONEXIÓN A MONGO:', err.message));
}

const State = mongoose.model('State', {
  id: { type: String, default: 'main' },
  packs: Array,
  bookings: Array,
  homeContent: Object
});

app.get('/', (req, res) => res.status(200).send('API ONLINE 🚀 - StreamPulse Backend'));

app.get('/api/sync', async (req, res) => {
  try {
    const state = await State.findOne({ id: 'main' });
    res.json(state || { packs: [], bookings: [], homeContent: {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sync', async (req, res) => {
  try {
    await State.findOneAndUpdate({ id: 'main' }, req.body, { upsert: true, new: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 1. CREAR PAGO (Devuelve URL y ID)
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, description, redirectUrl } = req.body;
    
    const state = await State.findOne({ id: 'main' });
    if (!state || !state.homeContent?.payments?.mollieApiKey) {
      return res.status(400).json({ error: 'Mollie API Key no configurada.' });
    }

    const apiKey = state.homeContent.payments.mollieApiKey;
    const mollieClient = createMollieClient({ apiKey });
    const formattedAmount = Number(amount).toFixed(2);

    const payment = await mollieClient.payments.create({
      amount: { currency: 'EUR', value: formattedAmount },
      description: description,
      redirectUrl: redirectUrl, 
    });

    // Devolvemos la URL y el ID del pago para verificarlo luego
    res.json({ 
      checkoutUrl: payment.getCheckoutUrl(),
      paymentId: payment.id 
    });

  } catch (error) {
    console.error('Error creando pago en Mollie:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. VERIFICAR PAGO (Seguridad Servidor-a-Servidor)
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) return res.status(400).json({ error: 'Falta paymentId' });

    const state = await State.findOne({ id: 'main' });
    if (!state || !state.homeContent?.payments?.mollieApiKey) {
      return res.status(400).json({ error: 'Mollie API Key no configurada.' });
    }

    const apiKey = state.homeContent.payments.mollieApiKey;
    const mollieClient = createMollieClient({ apiKey });

    // Consultamos a Mollie el estado REAL de este ID
    const payment = await mollieClient.payments.get(paymentId);

    if (payment.status === 'paid') {
      res.json({ status: 'paid', paidAt: payment.paidAt });
    } else {
      res.json({ status: payment.status }); // open, canceled, expired, failed
    }

  } catch (error) {
    console.error('Error verificando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
