module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { idPesanan, total } = req.body || {};
    
    const PAKASIR_API_KEY = 'cfU4UEgD06yFzcqwBBZ6vPAl09v1qp94';
    const PROJECT_SLUG = 'unitproduksi2';
    const amountVal = Math.round(Number(total));

    const PAKASIR_URL = `https://app.pakasir.com/api/v2/create-transaction/${PROJECT_SLUG}/${idPesanan}`;

    const response = await fetch(PAKASIR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': PAKASIR_API_KEY
      },
      body: JSON.stringify({
        method: "payment_link",
        amount: amountVal
      })
    });

    const result = await response.json();
    const paymentUrl = result.payment_url || result.url || (result.payment && result.payment.payment_url);

    if (response.ok && paymentUrl) {
      return res.status(200).json({ success: true, payment_url: paymentUrl });
    }

    return res.status(400).json({ success: false, message: result.message || 'Gagal membuat tagihan di Pakasir' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Kesalahan server: ' + err.message });
  }
};
