// server.js EXPRESS
const express = require("express");
const path = require("path");
const app = express();

// served port
const PORT = 1111;
const data = require("./data/matches.json");

app.get("/data", (req, res) => {
    res.json(data);
});

app.get("/", (req, res) => {
    res.sendFile(path.json(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Express API listening at http://localhost:${PORT}`);
})