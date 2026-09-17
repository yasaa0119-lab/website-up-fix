const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors()); // Mengizinkan akses dari domain .my.id kamu

const MERCHANT_CODE = 'DS35495'; 
const API_KEY = '282b322af7228e1f7260160b2a96a715'; 
const IS_PRODUCTION = false; 

app.post('/api/buat-pembayaran', async (req, res) => {
    try {
        const { idPesanan, total, nama } = req.body;

        const url = IS_PRODUCTION 
            ? 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry' 
            : 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'; 

        const amountStr = String(total);
        const signatureString = MERCHANT_CODE + idPesanan + amountStr + API_KEY;
        const signature = crypto.createHash('md5').update(signatureString).digest('hex');

        const requestBody = {
            merchantCode: MERCHANT_CODE,
            paymentAmount: Number(total),
            merchantOrderId: idPesanan,
            productDetails: `Pesanan Unit Produksi SMK Yadika 13 (${idPesanan})`,
            email: "pembeli@smkyadika13.com",
            customerVaName: nama || "Pelanggan",
            returnUrl: "https://unitproduksismkyadika13.my.id", 
            callbackUrl: "https://unitproduksismkyadika13.my.id", 
            signature: signature,
            expiryPeriod: 60
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.statusCode === "00" && result.paymentUrl) {
            return res.json({ success: true, payment_url: result.paymentUrl });
        } else {
            return res.status(400).json({ success: false, message: result.statusMessage || "Gagal dari Duitku", detail: result });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server backend jalan di port ${PORT}`));