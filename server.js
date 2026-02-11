
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

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

// --- RUTA DE EMAIL OPTIMIZADA ---
app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, config } = req.body;

    console.log(`📩 Intento de envío a: ${to}`);

    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        console.error("❌ Faltan credenciales SMTP");
        return res.status(400).json({ success: false, error: "Faltan credenciales SMTP" });
    }

    // CONFIGURACIÓN DE PUERTOS:
    // Gmail suele funcionar mejor en el puerto 587 (TLS/STARTTLS) en servidores Cloud (Render, AWS, etc.)
    // El puerto 465 (SSL) a veces sufre bloqueos o timeouts (ETIMEDOUT) como el que te ha ocurrido.
    let port = 587;
    let secure = false;

    if (config.smtpHost.includes('gmail') || config.smtpHost.includes('google')) {
        console.log("ℹ️ Detectado Gmail: Forzando puerto 587 (STARTTLS) para evitar Timeouts.");
        port = 587;
        secure = false;
    } else if (config.smtpHost.includes('hostinger') || config.smtpHost.includes('ionos')) {
        port = 465;
        secure = true;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: port,
            secure: secure, 
            auth: {
                user: config.smtpUser,
                pass: config.smtpPassword
            },
            tls: {
                rejectUnauthorized: false
            },
            // Aumentamos los tiempos de espera para evitar cortes prematuros
            connectionTimeout: 10000, 
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        // 1. Verificar conexión
        await transporter.verify();
        console.log("✅ Conexión SMTP verificada.");

        // 2. Enviar correo
        const info = await transporter.sendMail({
            from: `"StreamPulse Studio" <${config.smtpUser}>`,
            to: to,
            subject: subject,
            html: html
        });

        console.log("📨 Email enviado ID:", info.messageId);
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("❌ ERROR ENVIANDO EMAIL:", error);
        
        let friendlyError = error.message;
        if (error.code === 'ETIMEDOUT') {
            friendlyError = "Timeout de conexión: Render no pudo conectar con Gmail por el puerto " + port + ". Revisa si la contraseña de aplicación es correcta.";
        } else if (error.code === 'EAUTH' || error.response?.includes('Authentication required')) {
            friendlyError = "Error de Autenticación: Contraseña incorrecta. Si usas Gmail, RECUERDA usar una 'Contraseña de Aplicación', no tu contraseña normal.";
        }

        res.status(500).json({ success: false, error: friendlyError, originalError: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
