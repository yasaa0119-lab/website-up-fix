const crypto = require('crypto');

exports.handler = async (event, context) => {
    // Header agar diizinkan diakses oleh domain .my.id kamu
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Tangani preflight request dari browser
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Metode tidak diizinkan' };
    }

    try {
        const data = JSON.parse(event.body);
        const { idPesanan, total, nama } = data;

        const MERCHANT_CODE = 'DS35495'; 
        const API_KEY = '282b322af7228e1f7260160b2a96a715'; 
        const IS_PRODUCTION = false; 

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
            callbackUrl: "https://unitproduksismkyadika13.netlify.app/.netlify/functions/duitku-callback", 
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
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    payment_url: result.paymentUrl 
                })
            };
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: result.statusMessage || "Gagal mendapatkan link dari Duitku", 
                    detail: result 
                })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: error.message })
        };
    }
};