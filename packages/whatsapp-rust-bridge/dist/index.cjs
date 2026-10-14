const fs = require('fs');
const path = require('path');

// prova a trovare il wasm in tutti i posti possibili
const possibleWasmPaths = [
    path.join(__dirname, '../pkg/whatsapp_rust_bridge_bg.wasm'),
    path.join(__dirname, './whatsapp_rust_bridge_bg.wasm'),
    path.join(__dirname, '../dist/wasm/whatsapp_rust_bridge_bg.wasm'),
];

const possibleJsPaths = [
    '../pkg/whatsapp_rust_bridge.js',
    './whatsapp_rust_bridge.js',
    '../dist/wasm/whatsapp_rust_bridge.js',
];

let bindgen = null;
let wasmPath = null;

for (const p of possibleJsPaths) {
    try {
        bindgen = require(p);
        // se lo trova, trova anche il wasm vicino
        const dir = path.dirname(require.resolve(p));
        const wp = path.join(dir, 'whatsapp_rust_bridge_bg.wasm');
        if (fs.existsSync(wp)) wasmPath = wp;
        break;
    } catch { }
}

if (!bindgen) throw new Error('whatsapp-rust-bridge: pkg non trovato');

if (!wasmPath) {
    for (const p of possibleWasmPaths) {
        if (fs.existsSync(p)) { wasmPath = p; break; }
    }
}

if (!wasmPath) throw new Error('whatsapp-rust-bridge: wasm non trovato');

const wasmBuffer = fs.readFileSync(wasmPath);

// init sync - supporta entrambe le firme
if (bindgen.initSync) {
    try {
        bindgen.initSync(wasmBuffer);
    } catch {
        bindgen.initSync({ module: wasmBuffer });
    }
}

module.exports = bindgen;
module.exports.default = bindgen;