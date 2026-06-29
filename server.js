const app = require('./src/app');
const Connection = require('./src/db/stratex');
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await Connection();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

}
startServer().catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
});
