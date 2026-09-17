const crypto = require('crypto');

export default async function handler(req, res) {
    // Mengizinkan CORS untuk akses dari frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { idPesanan, total, nama, kelas, catatan, items } = req.body;

        const MERCHANT_CODE = 'DS35495';
        const API_KEY = '282b322af7228e1f7260160b2a96a715';
        const paymentAmount = Number(total);
        const merchantOrderId = idPesanan;

        // Hitung signature MD5 untuk Duitku Sandbox
        const rawSignature = MERCHANT_CODE + merchantOrderId + paymentAmount + API_KEY;
        const signature = crypto.createHash('md5').update(rawSignature).digest('hex');

        const requestBody = {
            merchantCode: MERCHANT_CODE,
            paymentAmount: paymentAmount,
            merchantOrderId: merchantOrderId,
            productDetails: `Pesanan Unit Produksi SMK Yadika 13 (${merchantOrderId}) - ${kelas}`,
            email: "pembeli@smkyadika13.com",
            customerVaName: nama || "Pelanggan",
            returnUrl: "https://unitproduksismkyadika13.my.id",
            callbackUrl: "https://unitproduksismkyadika13.my.id",
            signature: signature,
            expiryPeriod: 60
        };

        const response = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.statusCode === "00") {
            return res.status(200).json({ success: true, payment_url: result.paymentUrl });
        } else {
            return res.status(400).json({ success: false, message: result.statusMessage || "Gagal dari Duitku" });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
}