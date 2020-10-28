const express = require('express');
require('dotenv').config();
const http = require('http');
const https = require('https');
const qs = require('querystring')

const PaytmChecksum = require('./PaytmChecksum');

const router = express.Router().use(express.json());

router.get('/', (req,res) => {
    var paytmParams = {};

    paytmParams.body = {
        "requestType"   : "Payment",
        "mid"           : process.env.MID,
        "websiteName"   : "WEBSTAGING",
        "orderId"       : "ORD"+new Date().getTime(),
        "callbackUrl"   : "http://localhost:3500/payment/response",
        "txnAmount"     : {
            "value"     : "50.00",
            "currency"  : "INR",
        },
        "userInfo"      : {
            "custId"    : "CUST_001",
        },
    };

    PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), process.env.MKEY).then(function (checksum) {

        paytmParams.head = {
            "signature": checksum
        };

        var post_data = JSON.stringify(paytmParams);

        var options = {

            /* for Staging */
            hostname: 'securegw-stage.paytm.in',

            /* for Production */
            // hostname: 'securegw.paytm.in',

            port: 443,
            path: `/theia/api/v1/initiateTransaction?mid=${process.env.MID}&orderId=${paytmParams.body.orderId}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };

        var response = "";
        var post_req = https.request(options, function (post_res) {
            post_res.on('data', function (chunk) {
                response += chunk;
            });

            post_res.on('end', function () {
                response = JSON.parse(response)
                console.log('txnToken:', response);

                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.write(`<html>
                    <head>
                        <title>Show Payment Page</title>
                    </head>
                    <body>
                        <center>
                            <h1>Please do not refresh this page...</h1>
                        </center>
                        <form method="post" action="https://securegw-stage.paytm.in/theia/api/v1/showPaymentPage?mid=${process.env.MID}&orderId=${paytmParams.body.orderId}" name="paytm">
                            <table border="1">
                                <tbody>
                                    <input type="hidden" name="mid" value="${process.env.MID}">
                                        <input type="hidden" name="orderId" value="${paytmParams.body.orderId}">
                                        <input type="hidden" name="txnToken" value="${response.body.txnToken}">
                             </tbody>
                          </table>
                                        <script type="text/javascript"> document.paytm.submit(); </script>
                       </form>
                    </body>
                 </html>`)
                res.end()
            });
        });

        post_req.write(post_data);
        post_req.end();
    });

});

router.post('/response', (req,res) => {
    let callbackResponse = ''

    req.on('error', (err) => {
        console.error(err.stack)
    }).on('data', (chunk) => {
        callbackResponse += chunk
    }).on('end', () => {
        let data = qs.parse(callbackResponse)
        console.log(data)

        data = JSON.parse(JSON.stringify(data))

        const paytmChecksum = data.CHECKSUMHASH

        var isVerifySignature = PaytmChecksum.verifySignature(data, process.env.MKEY, paytmChecksum)
        if (isVerifySignature) {
            console.log("Checksum Matched");

            var paytmParams = {};

            paytmParams.body = {
                "mid": process.env.MID,
                "orderId": data.ORDERID,
            };

            PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), process.env.MKEY).then(function (checksum) {
                paytmParams.head = {
                    "signature": checksum
                };

                var post_data = JSON.stringify(paytmParams);

                var options = {

                    /* for Staging */
                    hostname: 'securegw-stage.paytm.in',

                    /* for Production */
                    // hostname: 'securegw.paytm.in',

                    port: 443,
                    path: '/v3/order/status',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': post_data.length
                    }
                };

                // Set up the request
                var response = "";
                var post_req = https.request(options, function (post_res) {
                    post_res.on('data', function (chunk) {
                        response += chunk;
                    });

                    post_res.on('end', function () {
                        console.log('Response: ', response);
                        res.write(response)
                        res.end()
                    });
                });

                // post the data
                post_req.write(post_data);
                post_req.end();
            });
        } else {
            console.log("Checksum Mismatched");
        }
    })
});


module.exports = router;