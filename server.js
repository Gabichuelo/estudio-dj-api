
require('dotenv').config(); // Carga las variables del entorno
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); // Necesario para los emails

const app = express();
app.use(cors());
// Aumentamos el límite a 50mb por si subes imágenes grandes al panel
app.use(express.json({ limit: '50mb' })); 

// YA NO HAY CONTRASEÑA AQUÍ. Se lee desde el panel de Render.
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

console.log('--- 🚀 DGR STUDIO BACKEND STARTING ---');

if (!MONGODB_URI) {
  // Nota: En local puede que no tengas el .env configurado, por eso no hacemos exit(1) estricto,
  // pero te avisamos por consola. En Render SÍ debe estar definida.
  console.error('❌ ERROR CRÍTICO: La variable MONGODB_URI no está definida.');
  console.error('👉 En Render: Ve a Environment Variables y añade MONGODB_URI con tu cadena de conexión.');
} else {
    // Conexión a MongoDB con opciones de timeout para evitar cuelgues
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
      console.log('👉 REVISA: 1. IP en Network Access de MongoDB Atlas (0.0.0.0/0). 2. Contraseña correcta en Render.');
    });
}

// Esquema de la Base de Datos
const State = mongoose.model('State', {
  id: { type: String, default: 'main' },
  packs: Array,
  bookings: Array,
  homeContent: Object
});

// --- RUTA BASE (HEALTH CHECK) ---
app.get('/', (req, res) => res.status(200).send('API ONLINE 🚀 - StreamPulse Backend'));

// --- RUTAS DE SINCRONIZACIÓN (SYNC) ---
app.get('/api/sync', async (req, res) => {
  try {
    const state = await State.findOne({ id: 'main' });
    // Si no hay datos, devolvemos objeto vacío estructurado
    res.json(state || { packs: [], bookings: [], homeContent: {} });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sync', async (req, res) => {
  try {
    // Guardamos o actualizamos los datos
    await State.findOneAndUpdate({ id: 'main' }, req.body, { upsert: true, new: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- RUTA DE EMAIL (NUEVA) ---
app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, config } = req.body;

    // Validación básica
    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        return res.status(400).json({ success: false, message: "Faltan credenciales SMTP en la configuración" });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: 465, // Puerto seguro SSL estándar para Gmail/otros
            secure: true, 
            auth: {
                user: config.smtpUser,
                pass: config.smtpPassword
            }
        });

        const info = await transporter.sendMail({
            from: `"StreamPulse Studio" <${config.smtpUser}>`,
            to: to,
            subject: subject,
            html: html
        });

        console.log("📩 Email enviado correctamente: %s", info.messageId);
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("❌ Error enviando email:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
