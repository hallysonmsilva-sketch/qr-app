const BASE_URL = 'https://qr-app-4gxs.onrender.com';
const SENHA_ADMIN = 'LOJA2026';

const express = require('express');
const app = express();
app.use(express.static('public'));

const cors = require('cors');
const db = require('./db');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================
   GERADOR DE CÓDIGO ÚNICO
========================================= */
function gerarCodigo() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/* =========================================
   HOME
========================================= */
app.get('/qr/:code', async (req, res) => {

  try {

    const code = req.params.code;

    const qrCode = new QRCodeStyling({

      width: 300,
      height: 300,

      data: `${BASE_URL}/scan/${code}`,

      image: path.join(__dirname, 'public/logo.png'),

      dotsOptions: {
        color: '#000000',
        type: 'rounded'
      },

      backgroundOptions: {
        color: '#ffffff'
      },

      imageOptions: {
        margin: 5
      }

    });

    const buffer = await qrCode.getRawData('png');

    res.setHeader('Content-Type', 'image/png');

    res.send(buffer);

  } catch (err) {

    console.error(err);

    res.status(500).send('Erro ao gerar QR');

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

  let descricao = '';

if (tipo === 'premio_1') {
  descricao =
    'Voucher no valor de R$ 25,00 em nossos parceiros';
}

else if (tipo === 'premio_2') {
  descricao =
    'Voucher no valor de R$ 50,00 em nossos parceiros';
}

else if (tipo === 'premio_3') {
  descricao =
    'Voucher no valor de R$ 75,00 em nossos parceiros';
}

else if (tipo === 'premio_4') {
  descricao =
    'Voucher no valor de R$ 100,00 em nossos parceiros';
}

  const lote = 'LOTE-' + Date.now();

  let lista = [];

  // PREMIADOS
  for (let i = 0; i < premios; i++) {

    lista.push({
      tipo: tipo,
      descricao_premio: descricao
    });

  }

  // NÃO PREMIADOS
  const restante = quantidade - premios;

  for (let i = 0; i < restante; i++) {

    lista.push({
      tipo: 'nao_premio',
      descricao_premio: null
    });

  }

  // EMBARALHAR
  for (let i = lista.length - 1; i > 0; i--) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [lista[i], lista[j]] =
      [lista[j], lista[i]];

  }

  // INSERIR
  for (let item of lista) {

    let inserted = false;

    while (!inserted) {

      const code = gerarCodigo();

      try {

        console.log(
          'SALVANDO:',
          item.tipo
        );

        await db.query(
          `
          INSERT INTO qrcodes
          (
            code,
            tipo,
            descricao_premio,
            usado,
            lote
          )

          VALUES
          (
            $1,
            $2,
            $3,
            false,
            $4
          )
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

        console.log(err);

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

    const url =
      `${BASE_URL}/scan/${item.code.trim()}`;

    const qr =
      await QRCode.toDataURL(url);

    html += `
  <div class="item">

    <div class="qr-box">

      <div style="
        position:relative;
        width:4.5cm;
        height:4.5cm;
      ">

        <!-- QR -->

        <img
          src="${qr}"
          style="
            width:100%;
            height:100%;
          "
        />

        <!-- LOGO CENTRAL -->

        <img
          src="/logo-qr.png"
          style="
            position:absolute;

            top:50%;
            left:50%;

            transform:
              translate(-50%, -50%);

            width:1cm;
            height:1cm;

            background:white;

            padding:4px;

            border-radius:12px;
          "
        />

      </div>

    </div>

    <!-- TEXTO + SETA -->

    <div style="
      position:relative;

      width:100%;

      margin-top:10px;

      height:100px;
    ">

      <!-- TEXTO -->

      <div style="
        position:absolute;

        left:0;
        top:1px;

        font-size:14px;
        font-weight:bold;

        color:black;

        line-height:1.4;

        text-align:center;
      ">

        Aponte a câmera do seu celular<br>
        e garanta seu prêmio

      </div>

      <!-- SETA -->

      <div style="
        position:relative;

        right:0;
        top:-5px;

        font-size:72px;

        color:black;

        transform:
          rotate(-15deg);
	  
        line-height:1;
      ">

      <img
  src="/seta.png"
  style="
    position:absolute;

    right:165px;
    top:-145px;

    width:95px;

    transform:
      rotate(20deg);
  "
>

      </div>

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

    const url =
      `${BASE_URL}/scan/${item.code.trim()}`;

    const qr =
      await QRCode.toDataURL(url);

    const base64Data = qr.replace(
      /^data:image\/png;base64,/,
      ''
    );

    const imgBuffer = Buffer.from(
      base64Data,
      'base64'
    );

    doc.rect(
      x,
      y,
      boxSize,
      boxSize
    ).fill('#FFFFFF');

    doc.image(
      imgBuffer,
      x + 15,
      y + 15,
      {
        width: qrSize,
        height: qrSize
      }
    );

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

    if (count % 3 === 0) {

      x = startX;
      y += 200;

    } else {

      x += 170;

    }

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

    if (result.rows.length === 0) {

      return res.send(`
        <html>
        <body style="
          margin:0;
          height:100vh;
          display:flex;
          justify-content:center;
          align-items:center;
          background:#111;
          color:white;
          font-family:Arial;
        ">
          <div style="
            text-align:center;
          ">
            <h1>❌</h1>
            <h2>Código inválido</h2>
          </div>
        </body>
        </html>
      `);

    }

    const qr = result.rows[0];

    if (qr.usado) {

      return res.send(`
        <html>
        <body style="
          margin:0;
          height:100vh;
          display:flex;
          justify-content:center;
          align-items:center;
          background:#111;
          color:white;
          font-family:Arial;
        ">
          <div style="
            text-align:center;
          ">
            <h1>⚠️</h1>
            <h2>Código já utilizado</h2>
          </div>
        </body>
        </html>
      `);

    }

  // =====================================
// PREMIADO
// =====================================

if (qr.tipo !== 'nao_premio') {

  return res.send(`

<html>

<head>

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<style>

*{
  box-sizing:border-box;
}

body{

  margin:0;

  min-height:100vh;

  display:flex;
  justify-content:center;
  align-items:center;

  overflow:hidden;

  background:
    linear-gradient(
      135deg,
      #00b0ff,
      #0066ff
    );

  font-family:Arial,sans-serif;

  position:relative;
}

/* CONFETES */

.confete{

  position:absolute;

  width:10px;
  height:10px;

  top:-20px;

  border-radius:2px;

  animation:cair linear infinite;

  z-index:1;
}

@keyframes cair{

  to{

    transform:
      translateY(110vh)
      rotate(720deg);

  }

}

/* CARD */

.card{

  position:relative;
  z-index:2;

  width:90%;
  max-width:360px;

  background:white;

  border-radius:32px;

  padding:22px;

  text-align:center;

  box-shadow:
    0 15px 40px rgba(0,0,0,.25);

  animation:entrada .7s ease;
}

@keyframes entrada{

  from{

    opacity:0;

    transform:
      translateY(40px)
      scale(.95);

  }

  to{

    opacity:1;

    transform:
      translateY(0)
      scale(1);

  }

}

/* LOGO */

.logo{

  width:130px;

  margin-bottom:8px;
}

/* EMOJI */

.emoji{

  font-size:52px;

  animation:pulse 1.5s infinite;
}

@keyframes pulse{

  0%{
    transform:scale(1);
  }

  50%{
    transform:scale(1.12);
  }

  100%{
    transform:scale(1);
  }

}

/* TITULOS */

h1{

  margin:8px 0 5px 0;

  color:#0050d8;

  font-size:38px;
}

.sub{

  color:#666;

  font-size:16px;

  margin-bottom:18px;
}

/* PREMIO */

.premio{

  display:flex;
  align-items:center;
  gap:12px;

  background:#f3f5f8;

  padding:16px;

  border-radius:18px;

  margin-bottom:18px;

  text-align:left;
}

.icone-premio{

  min-width:52px;
  height:52px;

  border-radius:50%;

  background:#0d6efd;

  color:white;

  display:flex;
  justify-content:center;
  align-items:center;

  font-size:24px;
}

.texto-premio{

  font-size:16px;
  font-weight:bold;

  color:#111;

  line-height:1.4;
}

/* INPUTS */

.input-box{

  position:relative;

  margin-top:12px;
}

.input{

  width:100%;

  padding:14px 14px 14px 44px;

  border-radius:15px;

  border:2px solid #e2e2e2;

  background:#f3f3f3;

  font-size:15px;

  outline:none;

  transition:.2s;
}

.input:focus{

  border-color:#0d6efd;

  background:white;
}

.icon{

  position:absolute;

  left:14px;
  top:50%;

  transform:translateY(-50%);

  font-size:16px;

  color:#666;
}

/* BOTAO */

.botao{

  width:100%;

  margin-top:18px;

  padding:15px;

  border:none;

  border-radius:16px;

  background:
    linear-gradient(
      135deg,
      #0066ff,
      #0047cc
    );

  color:white;

  font-size:18px;
  font-weight:bold;

  cursor:pointer;

  transition:.2s;

  box-shadow:
    0 8px 20px rgba(0,102,255,.35);
}

.botao:hover{

  transform:scale(1.02);
}

/* RODAPE */

.rodape{

  margin-top:18px;

  color:#555;

  font-size:13px;
}

</style>

</head>

<body>

<!-- CONFETES -->

${Array.from({length:50}).map(() => `

<div
  class="confete"
  style="
    left:${Math.random()*100}%;

    background:
      hsl(${Math.random()*360},100%,50%);

    animation-duration:
      ${3+Math.random()*4}s;

    animation-delay:
      ${Math.random()*3}s;
  "
></div>

`).join('')}

<!-- CARD -->

<div class="card">

  <img
  src="/logo.png"
  style="
    width:140px;
    display:block;
    margin:0 auto 20px auto;
  "
>

  <div class="emoji">
    🎉
  </div>

  <h1>
    Parabéns!
  </h1>

  <div class="sub">
    Você ganhou:
  </div>

  <div class="premio">

    <div class="icone-premio">
      🎁
    </div>

    <div class="texto-premio">
      ${qr.descricao_premio}
    </div>

  </div>

  <form
    method="POST"
    action="/gerar-voucher/${qr.code}"
  >

    <div class="input-box">

      <span class="icon">
        👤
      </span>

      <input
        type="text"
        name="nome"
        placeholder="Nome completo"
        required
        class="input"
      >

    </div>

    <div class="input-box">

      <span class="icon">
        🪪
      </span>

      <input
        type="text"
        name="cpf"
        placeholder="CPF"
        required
        class="input"
      >

    </div>

    <div class="input-box">

      <span class="icon">
        📞
      </span>

      <input
        type="tel"
        name="telefone"
        placeholder="Telefone"
        required
        class="input"
      >

    </div>

    <div class="input-box">

      <span class="icon">
        🏪
      </span>

      <input
        type="text"
        name="loja"
        placeholder="Loja onde comprou"
        required
        class="input"
      >

    </div>

    <button
      type="submit"
      class="botao"
    >
      GERAR VOUCHER
    </button>

  </form>

  <div class="rodape">
    🔒 Seus dados estão seguros conosco.
  </div>

</div>

</body>

</html>

  `);

}

    // =====================================
    // NÃO PREMIADO
    // =====================================

    return res.send(`

      <html>

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
          box-shadow:0 10px 30px rgba(0,0,0,0.2);
        ">

          <h1>😢</h1>

          <h2 style="color:#d50000;">
            Não foi dessa vez
          </h2>

          <p>
            Continue participando!
          </p>

        </div>

      </body>

      </html>

    `);

  } catch (err) {

    console.error(err);

    res.send('Erro no servidor');

  }

});

/* =========================================
   GERAR VOUCHER
========================================= */
app.post('/gerar-voucher/:code', async (req, res) => {

  const { code } = req.params;

  const {
    nome,
    cpf,
    loja
  } = req.body;

  try {

    const result = await db.query(
      'SELECT * FROM qrcodes WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {

      return res.send('Código inválido');

    }

    const qr = result.rows[0];

    if (qr.voucher) {

      return res.send(`
        <h1>
          Voucher já gerado:
          ${qr.voucher}
        </h1>
      `);

    }

    const voucher =
      'VCHR-' +
      Math.random()
        .toString(36)
        .substring(2,8)
        .toUpperCase();

    await db.query(
      `
      UPDATE qrcodes
      SET
        nome = $1,
        cpf = $2,
        loja_compra = $3,
        voucher = $4
      WHERE code = $5
      `,
      [
        nome,
        cpf,
        loja,
        voucher,
        code
      ]
    );

    const qrValidacao =
      await QRCode.toDataURL(
        `${BASE_URL}/admin-validar/${voucher}`
      );

    res.send(`
      <html>

      <body style="
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        background:#f2f2f2;
        font-family:Arial;
      ">

        <div style="
          background:white;
          padding:30px;
          border-radius:20px;
          text-align:center;
          max-width:400px;
          box-shadow:0 10px 30px rgba(0,0,0,0.2);
        ">

	<img
  			src="/logo.png"
  			style="
    			width:140px;
    			display:block;
    			margin:0 auto 20px auto;
  "
>
          <h1>🎉 Voucher Gerado</h1>

          <h2>${qr.descricao_premio}</h2>

          <p>
            Seu código de resgate:
          </p>

          <h1 style="
            color:#0d47a1;
          ">
            ${voucher}
          </h1>

          <p>
            Apresente este voucher
            no ponto de troca.
          </p>

          <img
            src="${qrValidacao}"
            style="
              width:220px;
              margin-top:20px;
            "
          >

          <p style="
            margin-top:15px ;
            font-size:14px;
            color:#666;
          ">
            QR exclusivo para validação do parceiro
          </p>

        </div>

      </body>

      </html>
    `);

  } catch (err) {

    console.log(err);

    res.send('Erro no servidor');

  }

});

/* =========================================
   ADMIN VALIDAR - TELA SENHA
========================================= */
app.get('/admin-validar/:voucher', async (req, res) => {

  const { voucher } = req.params;

  try {

    const result = await db.query(
      `
      SELECT *
      FROM qrcodes
      WHERE voucher = $1
      `,
      [voucher]
    );

    if (result.rows.length === 0) {

      return res.send(`
        <h1>Voucher inválido</h1>
      `);

    }

    res.send(`
      <html>

      <body style="
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        background:#f2f2f2;
        font-family:Arial;
      ">

        <div style="
          background:white;
          padding:30px;
          border-radius:20px;
          width:90%;
          max-width:400px;
          text-align:center;
        ">

	<img
  			src="/logo.png"
  			style="
  		  	width:140px;
    			display:block;
    			margin:0 auto 20px auto;
  "
>

          <h2>Área do Parceiro</h2>

          <p>
            Digite a senha para validar
            este voucher
          </p>

          <form
            method="POST"
            action="/admin-validar/${voucher}"
          >

            <input
              type="password"
              name="senha"
              placeholder="Senha"
              required
              style="
                width:100%;
                padding:12px;
                margin-top:10px;
                border-radius:10px;
                border:1px solid #ccc;
              "
            >

            <button
              type="submit"
              style="
                margin-top:15px;
                width:100%;
                padding:15px;
                background:#0d47a1;
                color:white;
                border:none;
                border-radius:10px;
                font-size:16px;
                cursor:pointer;
              "
            >
              VALIDAR VOUCHER
            </button>

          </form>

        </div>

      </body>

      </html>
    `);

  } catch (err) {

    console.log(err);

    res.send('Erro');

  }

});

/* =========================================
   ADMIN VALIDAR - ÁREA RESTRITA
========================================= */
app.post('/admin-validar/:voucher', async (req, res) => {

  const { voucher } = req.params;
  const { senha } = req.body;

  if (senha !== SENHA_ADMIN) {

    return res.send(`
      <h1>Senha inválida</h1>
    `);

  }

  try {

    const result = await db.query(
      `
      SELECT *
      FROM qrcodes
      WHERE voucher = $1
      `,
      [voucher]
    );

    if (result.rows.length === 0) {

      return res.send(`
        <h1>Voucher inválido</h1>
      `);

    }

    const qr = result.rows[0];

    res.send(`
      <html>

      <body style="
        font-family:Arial;
        background:#f2f2f2;
        padding:30px;
      ">

        <div style="
          background:white;
          max-width:500px;
          margin:auto;
          padding:30px;
          border-radius:20px;
        ">

	<img
  		src="/logo.png"
  		style="
    		width:150px;
    		display:block;
    		margin:0 auto 20px auto;
  "
>

          <h1>VALIDAÇÃO</h1>

          <p>
            <b>Nome:</b>
            ${qr.nome}
          </p>

          <p>
            <b>CPF:</b>
            ${qr.cpf}
          </p>

          <p>
            <b>Prêmio:</b>
            ${qr.descricao_premio}
          </p>

          <p>
            <b>Status:</b>
            ${
              qr.resgatado
                ? 'JÁ RESGATADO'
                : 'DISPONÍVEL'
            }
          </p>

          ${
            !qr.resgatado
              ? `
              <form
                method="POST"
                action="/resgatar/${voucher}"
              >

                <input
                  type="hidden"
                  name="senha"
                  value="${senha}"
                >

                <button
                  type="submit"
                  style="
                    margin-top:20px;
                    width:100%;
                    padding:15px;
                    background:green;
                    color:white;
                    border:none;
                    border-radius:10px;
                    font-size:18px;
                    cursor:pointer;
                  "
                >
                  CONFIRMAR ENTREGA
                </button>

              </form>
              `
              : ''
          }

        </div>

      </body>

      </html>
    `);

  } catch (err) {

    console.log(err);

    res.send('Erro');

  }

});

/* =========================================
   RESGATAR
========================================= */
app.post('/resgatar/:voucher', async (req, res) => {

  const { voucher } = req.params;
  const { senha } = req.body;

  if (senha !== SENHA_ADMIN) {

    return res.send(`
      <h1>Acesso negado</h1>
    `);

  }

  try {

    const result = await db.query(
      `
      SELECT *
      FROM qrcodes
      WHERE voucher = $1
      `,
      [voucher]
    );

    if (result.rows.length === 0) {

      return res.send(`
        <h1>Voucher inválido</h1>
      `);

    }

    const qr = result.rows[0];

    if (qr.resgatado) {

      return res.send(`
        <h1>
          Voucher já resgatado
        </h1>
      `);

    }

    await db.query(
      `
      UPDATE qrcodes
      SET resgatado = true
      WHERE voucher = $1
      `,
      [voucher]
    );

    res.send(`
      <html>

      <body style="
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        background:#f2f2f2;
        font-family:Arial;
      ">

        <div style="
          background:white;
          padding:30px;
          border-radius:20px;
          text-align:center;
          max-width:400px;
        ">

	<img
  		 src="/logo.png"
  		 style="
    		  width:130px;
    		  display:block;
    		 margin:0 auto 20px auto;
  "
>

          <h1>✅</h1>

          <h2>
            Prêmio entregue com sucesso
          </h2>

        </div>

      </body>

      </html>
    `);

  } catch (err) {

    console.log(err);

    res.send('Erro');

  }

});

/* =========================================
   PÁGINA SIMPLES GERAR LOTES
========================================= */
app.get('/gerar', (req, res) => {

  res.send(`
  <html>

  <head>

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    >

  </head>

  <body style="
    margin:0;
    padding:30px;
    background:#f2f2f2;
    font-family:Arial;
  ">

    <div style="
      max-width:500px;
      margin:auto;
    ">

    <!-- GERAR LOTE -->

<div style="
  background:white;
  padding:25px;
  border-radius:20px;
  margin-bottom:25px;
">

  <h2>
    Gerar Lote
  </h2>

  <form
    <form
  action="/generate-lote"
  method="GET"
  target="_blank"
>
  >

    <input
      type="number"
      name="quantidade"
      placeholder="Quantidade QR Codes"
      required
      style="
        width:100%;
        padding:12px;
        margin-top:10px;
      "
    >

    <input
      type="number"
      name="premios"
      placeholder="Quantidade premiados"
      required
      style="
        width:100%;
        padding:12px;
        margin-top:10px;
      "
    >

    <select
      name="tipo"
      required
      style="
        width:100%;
        padding:12px;
        margin-top:10px;
      "
    >

      <option value="">
        Selecione o prêmio
      </option>

      <option value="premio_1">
        1,5MM
      </option>

      <option value="premio_2">
        2,5MM
      </option>

      <option value="premio_3">
        4,0MM
      </option>

      <option value="premio_4">
        6,0MM
      </option>

    </select>

    <button
      type="submit"
      style="
        width:100%;
        margin-top:20px;
        padding:15px;
        background:#0d47a1;
        color:white;
        border:none;
        border-radius:10px;
        font-size:16px;
        cursor:pointer;
      "
    >
      GERAR LOTE
    </button>

  </form>

</div>

      <!-- ABRIR LOTE -->

      <div style="
        background:white;
        padding:25px;
        border-radius:20px;
      ">

        <h2>
          Abrir Lote
        </h2>

        <form
          onsubmit="
            event.preventDefault();

            const lote =
              document
                .getElementById('lote')
                .value;

            window.location =
              '/lote/' + lote;
          "
        >

          <input
            id="lote"
            type="text"
            placeholder="Digite o lote"
            required
            style="
              width:100%;
              padding:12px;
              margin-top:10px;
            "
          >

          <button
            type="submit"
            style="
              width:100%;
              margin-top:20px;
              padding:15px;
              background:green;
              color:white;
              border:none;
              border-radius:10px;
              font-size:16px;
              cursor:pointer;
            "
          >
            ABRIR LOTE
          </button>

        </form>

      </div>

    </div>

  </body>

  </html>
  `);

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    'Servidor rodando na porta',
    PORT
  );

});