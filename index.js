const BASE_URL = 'https://qr-app-4gxs.onrender.com';
const express = req	uire('express');
const app = express();
const cors = require('cors');
const db = require('./db');
const QRCode = require('qrcode');

app.use(cors());
app.use(express.json());

// 🔹 Gerador de código único
function gerarCodigo() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// 🔹 HOME (teste)
app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      message: 'Banco conectado 🚀',
      time: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 GERAR LOTE COM % DE PRÊMIO
app.get('/generate-lote', async (req, res) => {
  const quantidade = parseInt(req.query.quantidade) || 100;
  const percentual = parseFloat(req.query.percentual) || 10;

  const totalPremios = Math.floor((quantidade * percentual) / 100);
  const lote = 'LOTE-' + Date.now();

  let lista = [];

  // premiados
  for (let i = 0; i < totalPremios; i++) {
    lista.push({
      tipo: 'premio',
      descricao_premio: 'PRÊMIO TESTE'
    });
  }

  // não premiados
  for (let i = totalPremios; i < quantidade; i++) {
    lista.push({
      tipo: 'nao_premio',
      descricao_premio: null
    });
  }

  // embaralhar
  lista.sort(() => Math.random() - 0.5);

  for (let item of lista) {
    let code;
    let inserted = false;

    while (!inserted) {
      code = gerarCodigo();

      try {
        await db.query(
          `INSERT INTO qrcodes (code, tipo, descricao_premio, usado, lote)
           VALUES ($1, $2, $3, false, $4)`,
          [code, item.tipo, item.descricao_premio, lote]
        );
        inserted = true;
      } catch (err) {
        // tenta outro código
      }
    }
  }

  res.json({
    mensagem: 'Lote criado com sucesso',
    lote,
    quantidade,
    premios: totalPremios
  });
});

// 🔹 VISUALIZAR LOTE (IMPRIMIR)
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
    const qr = await QRCode.toDataURL(
  `${BASE_URL}/scan/${item.code}`
);

    html += `
      <div class="item">
        <div class="qr-box">
          <img src="${qr}" />
        </div>
        <div class="texto">
          Aponte a câmera do seu celular<br>
          e ganhe prêmios instantâneos
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

const PDFDocument = require('pdfkit');

// 🔥 GERAR PDF DO LOTE
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

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${lote}.pdf`);

  doc.pipe(res);

  const startX = 40;
  const startY = 40;

  const qrSize = 120; // ~5cm
  const boxSize = 150;

  let x = startX;
  let y = startY;

  let count = 0;

  for (let item of result.rows) {
    const qr = await QRCode.toDataURL(
  `${BASE_URL}/scan/${item.code}`
);

    const base64Data = qr.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    // fundo branco
    doc.rect(x, y, boxSize, boxSize).fill('#FFFFFF');

    // QR
    doc.image(imgBuffer, x + 15, y + 15, {
      width: qrSize,
      height: qrSize
    });

    // texto
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

    // posicionamento grid
    if (count % 3 === 0) {
  x = startX;
  y += 200;
} else {
  x += 170;
}

    // nova página
    if (y > 700) {
      doc.addPage();
      x = startX;
      y = startY;
    }
  }

  doc.end();
});

// 🔹 SCAN (ABRE PELO QR)
app.get('/scan/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM qrcodes WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.send('Código inválido');
    }

    const qr = result.rows[0];

    if (qr.usado) {
      return res.send('Código já utilizado');
    }

    await db.query(
      'UPDATE qrcodes SET usado = true WHERE code = $1',
      [code]
    );

    if (qr.tipo === 'premio') {

      res.send(`
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @keyframes cair {
      0% { transform: translateY(-50px); opacity:0; }
      100% { transform: translateY(100vh); opacity:1; }
    }
  </style>
</head>

<body style="
  margin:0;
  height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
  background:linear-gradient(135deg, #00c6ff, #0072ff);
  font-family:Arial;
">

  <div style="
    position:absolute;
    width:100%;
    top:0;
    text-align:center;
    font-size:30px;
    animation: cair 2s linear infinite;
  ">
    🎉 🎊 🎉 🎊
  </div>

  <div style="
    background:white;
    border-radius:20px;
    padding:30px;
    width:90%;
    max-width:350px;
    text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
  ">

    <img src="https://i.imgur.com/lpQKSAK.png" style="max-width:120px; margin-bottom:20px;">

    <h1>🎉</h1>
    <h2 style="color:#0d47a1;">Parabéns!</h2>
    <p>Você ganhou:</p>
    <h3>${qr.descricao_premio}</h3>

  </div>

</body>
</html>
      `);

    } else {

      res.send(`
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="
  margin:0;
  height:100vh;
  display:flex;
  justify-content:center;
  align-items:center;
  background:linear-gradient(135deg, #d50000, #ff1744);
  font-family:Arial;
">

  <div style="
    background:white;
    border-radius:20px;
    padding:30px;
    width:90%;
    max-width:350px;
    text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
  ">

    <h1>😢</h1>
    <h2 style="color:#d50000;">Não foi dessa vez</h2>
    <p>Continue participando!</p>

  </div>

</body>
</html>
      `);
    }

  } catch (err) {
    console.error(err);
    res.send('Erro no servidor');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor rodando');
});