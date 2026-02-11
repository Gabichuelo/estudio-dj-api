
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

// --- RUTA DE EMAIL FINAL (FIXED TIMEOUTS) ---
app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, config } = req.body;

    console.log(`📩 Intento de envío a: ${to}`);

    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        console.error("❌ Faltan credenciales SMTP");
        return res.status(400).json({ success: false, error: "Faltan credenciales SMTP" });
    }

    try {
        let transporterConfig = {
            auth: {
                user: config.smtpUser,
                pass: config.smtpPassword
            },
            // CRÍTICO PARA RENDER/CLOUD:
            // Muchos servidores cloud tienen problemas resolviendo direcciones IPv6 de Google.
            // Forzar IPv4 (family: 4) soluciona el error 'ETIMEDOUT' casi siempre.
            family: 4, 
            connectionTimeout: 10000, // 10s timeout para conectar
            greetingTimeout: 10000,   // 10s para recibir el saludo del servidor
            socketTimeout: 20000      // 20s para operaciones de socket
        };

        const hostLower = config.smtpHost.toLowerCase();

        // ESTRATEGIA GMAIL: Manual sobre puerto 587 (STARTTLS)
        // Evitamos 'service: gmail' y el puerto 465 que suele bloquearse en cloud.
        if (hostLower.includes('gmail') || hostLower.includes('google')) {
            console.log("ℹ️ Configurando Gmail: Manual Port 587 + IPv4 Force");
            transporterConfig.host = 'smtp.gmail.com';
            transporterConfig.port = 587;
            transporterConfig.secure = false; // false para 587 (STARTTLS)
            transporterConfig.requireTLS = true; // Gmail requiere STARTTLS
            transporterConfig.tls = {
                rejectUnauthorized: true
            };
        } 
        // ESTRATEGIA OTROS (Hostinger, Ionos, Zoho, etc)
        else {
             // Detección básica de puerto seguro
             if (hostLower.includes('hostinger') || hostLower.includes('ionos') || hostLower.includes('zoho')) {
                 transporterConfig.host = config.smtpHost;
                 transporterConfig.port = 465;
                 transporterConfig.secure = true;
             } else {
                 // Default fallback
                 transporterConfig.host = config.smtpHost;
                 transporterConfig.port = 587;
                 transporterConfig.secure = false;
             }
             console.log(`ℹ️ Configurando SMTP Genérico: ${transporterConfig.host}:${transporterConfig.port}`);
        }

        const transporter = nodemailer.createTransport(transporterConfig);

        // 1. Verificación
        await transporter.verify();
        console.log("✅ Conexión SMTP verificada.");

        // 2. Envío
        const info = await transporter.sendMail({
            from: `"StreamPulse Studio" <${config.smtpUser}>`,
            to: to,
            subject: subject,
            html: html
        });

        console.log("📨 Email enviado ID:", info.messageId);
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error("❌ ERROR CRÍTICO ENVIANDO EMAIL:", error);
        
        let friendlyError = error.message;
        
        if (error.code === 'ETIMEDOUT') {
            friendlyError = "Timeout de Conexión: El servidor no pudo conectar con Gmail. (Posible bloqueo de firewall o problema IPv6).";
        } else if (error.code === 'EAUTH' || (error.response && error.response.includes('Authentication required'))) {
            friendlyError = "Error de Autenticación: Contraseña incorrecta. Si usas Gmail, asegúrate de usar una 'Contraseña de Aplicación'.";
        } else if (error.code === 'EADDRNOTAVAIL') {
             friendlyError = "Error de Red: Dirección no disponible.";
        }

        res.status(500).json({ success: false, error: friendlyError, originalError: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
