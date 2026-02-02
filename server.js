const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Base de datos temporal (se guarda en memoria)
let db = {
  packs: [],
  bookings: [],
  homeContent: {}
};

// Configuración de Gmail (Usa variables de entorno de Render)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Tu correo
    pass: process.env.EMAIL_PASS  // Tu contraseña de aplicación (16 letras)
  }
});

// Ruta para obtener y guardar datos
app.get('/api/sync', (req, res) => res.json(db));

app.post('/api/sync', async (req, res) => {
  const prevBookingsCount = db.bookings.length;
  db = { ...db, ...req.body };

  // Detectar si hay una reserva nueva para enviar el correo
  if (db.bookings && db.bookings.length > prevBookingsCount) {
    const newBooking = db.bookings[db.bookings.length - 1];
    
    const mailOptions = {
      from: `"Estudio DJ" <${process.env.EMAIL_USER}>`,
      to: `${newBooking.customerEmail}, ${db.homeContent.adminEmail || process.env.EMAIL_USER}`,
      subject: `Confirmación de Reserva - ${newBooking.id}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #8b5cf6;">¡Reserva Recibida!</h2>
          <p>Hola <b>${newBooking.customerName}</b>,</p>
          <p>Hemos recibido tu reserva para el estudio:</p>
          <ul>
            <li><b>Fecha:</b> ${newBooking.date}</li>
            <li><b>Hora:</b> ${newBooking.startTime}:00</li>
            <li><b>Duración:</b> ${newBooking.duration}h</li>
            <li><b>Total:</b> ${newBooking.totalPrice}€</li>
          </ul>
          <p>Estado: <b>${newBooking.status === 'confirmed' ? 'Confirmado' : 'Pendiente de verificación'}</b></p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email enviado con éxito");
    } catch (error) {
      console.error("Error enviando email:", error);
    }
  }

  res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor API corriendo en puerto ${PORT}`));
