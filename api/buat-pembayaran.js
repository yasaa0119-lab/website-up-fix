module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { idPesanan, total } = req.body || {};

    // Slug proyek boleh disimpan di environment variable Vercel (PAKASIR_SLUG)
    const PROJECT_SLUG = process.env.PAKASIR_SLUG || 'unitproduksi2';

    const amountVal = Math.round(Number(total));

    if (!idPesanan || !Number.isFinite(amountVal) || amountVal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Data pesanan tidak valid (idPesanan / total).'
      });
    }

    // Format link pembayaran resmi Pakasir:
    // https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}
    const paymentUrl =
      `https://app.pakasir.com/pay/${encodeURIComponent(PROJECT_SLUG)}/${amountVal}` +
      `?order_id=${encodeURIComponent(idPesanan)}`;

    return res.status(200).json({
      success: true,
      payment_url: paymentUrl
    });
  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ success: false, message: 'Kesalahan server: ' + err.message });
  }
};
