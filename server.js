/**
 * Entry point for rewaq server
 */
require('dotenv').config();
const app = require('./src/app');
const config = require('./src/config/database');

const PORT = config.PORT;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 rewaq Server is running on http://0.0.0.0:${PORT}`);
});
