const express = require('express');
const router = require('./router');
const http = require('http');

const app = express().use(express.json());

app.use('/payment', router);

const port = 3500;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});