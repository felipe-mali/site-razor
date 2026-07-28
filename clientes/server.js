const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';

app.get('/area-colaborador', (req, res) => {
  res.redirect(process.env.FUNCIONARIOS_URL || '/funcionarios/');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'clientes',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, HOST, () => {
  console.log(`Site de clientes iniciado em ${HOST}:${PORT}`);
});
