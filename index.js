const BASE_URL = 'https://qr-app-4gxs.onrender.com';

const express = require('express');
const app = express();

const cors = require('cors');
const db = require('./db');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

app.use(cors());
app.use(express.json());

/* =========================================
   GERADOR DE CÓDIGO ÚNICO
========================================= */
function gerarCodigo() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/* =========================================
   HOME
========================================= */
app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');

    res.json({
      status: 'online',
      banco: 'conectado',
      horario: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      erro: err.message
    });
  }
});

/* =========================================
   GERAR LOTE
========================================= */
app.get('/generate-lote', async (req, res) => {

  const quantidade =
    parseInt(req.query.quantidade) || 100;

  const premios =
    parseInt(req.query.premios) || 0;

  const tipo =
    req.query.tipo || 'premio';

  const descricao =
    req.query.descricao || 'PRÊMIO';

  const lote = 'LOTE-' + Date.now();

  let lista = [];

  // =====================================
  // PREMIADOS
  // =====================================

  for (let i = 0; i < premios; i++) {

    lista.push({
      tipo: tipo,
      descricao_premio: descricao
    });

  }

  // =====================================
  // NÃO PREMIADOS
  // =====================================

  const restante = quantidade - premios;

  for (let i = 0; i < restante; i++) {

    lista.push({
      tipo: 'nao_premio',
      descricao_premio: null
    });

  }

  // =====================================
  // EMBARALHAR
  // =====================================

  lista.sort(() => Math.random() - 0.5);

  // =====================================
  // INSERIR
  // =====================================

  for (let item of lista) {

    let inserted = false;

    while (!inserted) {

      const code = gerarCodigo();

      try {

        await db.query(
          `
          INSERT INTO qrcodes
          (code, tipo, descricao_premio, usado, lote)

          VALUES
          ($1, $2, $3, false, $4)
          `,
          [
            code,
            item.tipo,
            item.descricao_premio,
            lote
          ]
        );

        inserted = true;

      } catch (err) {
        // tenta novamente se repetir código
      }

    }

  }

  res.json({
    mensagem: 'Lote criado com sucesso',
    lote,
    quantidade,
    premios,
    tipo,
    descricao
  });

});

/* =========================================
   VISUALIZAR LOTE
========================================= */
app.get('/lote/:lote', async (req, res) => {

  const { lote } = req.params;

  const result = await db.query(
    'SELECT * FROM qrcodes WHERE lote = $1',
    [lote]
  );

  let html = `
  <html>

  <head>

    <style>

      body {
        margin: 0;
        padding: 20px;
        font-family: Arial;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 6cm);
        gap: 0.8cm;
        justify-content: center;
      }

      .item {
        width: 6cm;
        height: 7.5cm;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
      }

      .qr-box {
        width: 6cm;
        height: 6cm;

        background: white;

        display: flex;
        align-items: center;
        justify-content: center;
      }

      img {
        width: 4.5cm;
        height: 4.5cm;
      }

      .texto {
        margin-top: 5px;

        font-size: 12px;
        text-align: center;
        font-weight: bold;
      }

      @media print {

        body {
          margin: 0;
        }

      }

    </style>

  </head>

  <body>

    <div class="grid">
  `;

  for (let item of result.rows) {

    const url = `${BASE_URL}/scan/${item.code.trim()}`;

    console.log('QR URL:', url);

    const qr = await QRCode.toDataURL(url);

    html += `
      <div class="item">

        <div class="qr-box">
          <img src="${qr}" />
        </div>

        <div class="texto">
          Aponte a câmera do seu celular<br>
          e garanta seu prêmio
        </div>

      </div>
    `;
  }

  html += `
    </div>
  </body>

  </html>
  `;

  res.send(html);

});

/* =========================================
   PDF DO LOTE
========================================= */
app.get('/lote-pdf/:lote', async (req, res) => {

  const { lote } = req.params;

  const result = await db.query(
    'SELECT * FROM qrcodes WHERE lote = $1',
    [lote]
  );

  const doc = new PDFDocument({
    size: 'A4',
    margin: 20
  });

  res.setHeader(
    'Content-Type',
    'application/pdf'
  );

  res.setHeader(
    'Content-Disposition',
    `inline; filename=${lote}.pdf`
  );

  doc.pipe(res);

  const startX = 40;
  const startY = 40;

  const qrSize = 120;
  const boxSize = 150;

  let x = startX;
  let y = startY;

  let count = 0;

  for (let item of result.rows) {

    const url = `${BASE_URL}/scan/${item.code.trim()}`;

    const qr = await QRCode.toDataURL(url);

    const base64Data = qr.replace(
      /^data:image\/png;base64,/,
      ''
    );

    const imgBuffer = Buffer.from(
      base64Data,
      'base64'
    );

    // FUNDO
    doc.rect(
      x,
      y,
      boxSize,
      boxSize
    ).fill('#FFFFFF');

    // QR
    doc.image(
      imgBuffer,
      x + 15,
      y + 15,
      {
        width: qrSize,
        height: qrSize
      }
    );

    // TEXTO
    doc
      .fillColor('black')
      .fontSize(8)
      .text(
        'Aponte a câmera do seu celular e ganhe prêmios instantâneos',
        x,
        y + qrSize + 20,
        {
          width: boxSize,
          align: 'center'
        }
      );

    count++;

    // GRID
    if (count % 3 === 0) {

      x = startX;
      y += 200;

    } else {

      x += 170;

    }

    // NOVA PÁGINA
    if (y > 700) {

      doc.addPage();

      x = startX;
      y = startY;

    }
  }

  doc.end();

});

/* =========================================
   SCAN QR
========================================= */
app.get('/scan/:code', async (req, res) => {

  const { code } = req.params;

  try {

    const result = await db.query(
      'SELECT * FROM qrcodes WHERE code = $1',
      [code]
    );

    // NÃO EXISTE
    if (result.rows.length === 0) {

      return res.send(`
        <h1>Código inválido</h1>
      `);

    }

    const qr = result.rows[0];

    // JÁ USADO
    if (qr.usado) {

      return res.send(`
        <h1>Código já utilizado</h1>
      `);

    }

    // MARCAR COMO USADO
    await db.query(
      `
      UPDATE qrcodes
      SET usado = true
      WHERE code = $1
      `,
      [code]
    );

    // PREMIADO
    if (qr.tipo === 'nao_premio') {

      return res.send(`
      <html>

      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >
      </head>

      <body style="
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        background:linear-gradient(135deg,#00c6ff,#0072ff);
        font-family:Arial;
      ">

        <div style="
          background:white;
          border-radius:20px;
          padding:30px;
          width:90%;
          max-width:350px;
          text-align:center;
        ">

          <h1>🎉</h1>

          <h2>Parabéns!</h2>

          <p>Você ganhou:</p>

          <h3>${qr.descricao_premio}</h3>

        </div>

      </body>

      </html>
      `);

    }

    // NÃO PREMIADO
    return res.send(`
    <html>

    <head>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >
    </head>

    <body style="
      margin:0;
      height:100vh;
      display:flex;
      justify-content:center;
      align-items:center;
      background:linear-gradient(135deg,#d50000,#ff1744);
      font-family:Arial;
    ">

      <div style="
        background:white;
        border-radius:20px;
        padding:30px;
        width:90%;
        max-width:350px;
        text-align:center;
      ">

        <h1>😢</h1>

        <h2>Não foi dessa vez</h2>

        <p>Continue participando!</p>

      </div>

    </body>

    </html>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send('Erro no servidor');

  }

});

/* =========================================
   START
========================================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});