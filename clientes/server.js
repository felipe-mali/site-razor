const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/area-colaborador', (req, res) => {
  res.redirect(process.env.FUNCIONARIOS_URL || '/funcionarios/');
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, () => {
  console.log(`Site de clientes iniciado na porta ${PORT}`);
});
