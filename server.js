const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DB_FILE = './db.json';

// Si no existe el archivo db.json, lo crea vacío
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ packs: [], bookings: [], homeContent: {} }));
}

// Obtener datos
app.get('/api/sync', (req, res) => {
    const data = JSON.parse(fs.readFileSync(DB_FILE));
    res.json(data);
});

// Guardar datos
app.post('/api/sync', (req, res) => {
    const current = JSON.parse(fs.readFileSync(DB_FILE));
    const updated = { ...current, ...req.body };
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2));
    res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor DJ activo en puerto ${PORT}`));
