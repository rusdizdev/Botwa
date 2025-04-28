const { Crypto } = require("@peculiar/webcrypto");
globalThis.crypto = new Crypto();

const { useMultiFileAuthState, makeWASocket } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

// Configuración
const usePairingCode = true;
const sessionPath = "./session";

// Función para hacer preguntas
const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => rl.question(text, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const bot = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    if (usePairingCode && !bot.authState.creds.registered) {
        const phoneNumber = await question("Ingrese el número activo (comience con 34xx): ");
        const code = await bot.requestPairingCode(phoneNumber.trim());
        console.log(`Código de emparejamiento: ${code}`);
    }

    bot.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log("✅ ¡Bot de WhatsApp listo para usar!");
            try {
                const main = require('./main.js');
                if (typeof main === 'function') {
                    main(bot, saveCreds);
                } else {
                    console.error("Error: main.js debe exportar una función");
                }
            } catch (err) {
                console.error("Error al cargar main.js:", err.message);
            }
        } else if (connection === "close") {
            console.log("⚠️ Conexión perdida, intentando reconectar...");
            setTimeout(connectToWhatsApp, 5000);
        }
    });

    bot.ev.on("creds.update", saveCreds);
}

connectToWhatsApp().catch(err => {
    console.error("Error de conexión:", err.message);
    setTimeout(connectToWhatsApp, 5000);
});