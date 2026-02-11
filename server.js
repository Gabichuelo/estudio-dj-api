
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

// --- RUTA DE EMAIL OPTIMIZADA V3 (FINAL) ---
app.post('/api/send-email', async (req, res) => {
    const { to, subject, html, config } = req.body;

    console.log(`📩 Intento de envío a: ${to}`);

    if (!config || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        console.error("❌ Faltan credenciales SMTP");
        return res.status(400).json({ success: false, error: "Faltan credenciales SMTP" });
    }

    try {
        let transporterConfig;

        // ESTRATEGIA 1: GMAIL (Modo Servicio Nativo)
        // Detectamos si es Gmail y usamos el servicio preconfigurado de Nodemailer.
        // Esto gestiona automáticamente los puertos (465/587) y el tipo de seguridad.
        if (config.smtpHost.toLowerCase().includes('gmail') || config.smtpHost.toLowerCase().includes('google')) {
            console.log("ℹ️ Detectado Gmail: Usando preset 'service: gmail'");
            transporterConfig = {
                service: 'gmail',
                auth: {
                    user: config.smtpUser,
                    pass: config.smtpPassword
                }
            };
        } 
        // ESTRATEGIA 2: GENÉRICA (Otros proveedores)
        else {
            // Detección inteligente de puerto para otros proveedores
            let port = 587;
            let secure = false;

            if (config.smtpHost.includes('hostinger') || config.smtpHost.includes('ionos') || config.smtpHost.includes('zoho')) {
                port = 465;
                secure = true;
            }

            console.log(`ℹ️ SMTP Genérico: Host=${config.smtpHost} Port=${port} Secure=${secure}`);
            
            transporterConfig = {
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
                // CRÍTICO: Forzar IPv4 para evitar timeouts en redes con mala configuración IPv6 (común en servidores cloud)
                family: 4
            };
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
            friendlyError = "Timeout de conexión: El servidor no pudo contactar con Gmail. Asegúrate de que no hay firewalls bloqueando y reintenta.";
        } else if (error.code === 'EAUTH' || (error.response && error.response.includes('Authentication required'))) {
            friendlyError = "Error de Autenticación: Contraseña incorrecta. IMPORTANTE: Si usas Gmail, DEBES usar una 'Contraseña de Aplicación'.";
        } else if (error.code === 'EADDRNOTAVAIL') {
             friendlyError = "Error de Red: Dirección no disponible. Problema de DNS o IP del servidor.";
        }

        res.status(500).json({ success: false, error: friendlyError, originalError: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 SERVIDOR CORRIENDO EN PUERTO ' + PORT);
});
