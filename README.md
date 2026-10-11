<div align="center">
  <h1>Chillato Baileys</h1>
  <p><b>TypeScript & Node.js Library Creator for WhatsApp Bots</b></p>
  <p>by Chillato</p>
</div>
</br>

<div align="center">

<img src="https://media1.tenor.com/m/2Yar1sBkiXUAAAAC/tokyo-ghoul-anime.gif" alt="Header Image" width="30%"/>

<p>
  <br>
  <img src="https://img.shields.io/github/v/release/ChillatoOfficial/Baileys?include_prereleases&sort=semver" alt="Latest Release"/>
  </br>
</p>
</div>

---
## 🔭 Features

- *Template bottoni*
- *Auth redis*
---

---
# auth redis exemple

```javascript
async function start() {
// esempio auth con redis: (Attenzione non è un auth locale)
    const { state, saveCreds } = await useRedisAuthState('main-bot', {
  host: '127.0.0.1', // IP del tuo server redis
  port: 6380, // porta del tuo server redis
  password: 'testbaileys'
})


    const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr){
            qrcode.generate(qr, {small: true})
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) {
                start()
            } else {
                console.log('Disconnesso, devi riscansionare il QR')
            }
        } else if (connection === 'open') {
            console.log('Connesso!')
        }
    })
```
---

---
# button exemple
```javascript
sendCustomButtons(sock, jid, {
  title: "@chillato/baileys\n",
  bodyText: "Fork buttons\n",
  footerText: "by Chillato",
  mentions: [jid],
  buttons: [
    {type: "quick_reply", text: "ciao", id: "ciao"}, 
    {type: "call", text: "chiama", phone: "3751112345"},
    {type: "url", text: "link", url: "https://google.com"},
  ]
})
```
---

---
# Auto version wa

```javascript
const { default: makeWASocket, DisconnectReason, useRedisAuthState, getWAVersion, useMultiFileAuthState} = require('@chillato/baileys')
const {sendCustomButtons} = require("@chillato/baileys/lib/Extensions/buttons")
const qrcode = require("qrcode-terminal")
const P = require('pino')

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("session")

  const version = await getWAVersion()
    
  const sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: 'silent' }),
    })  

  sock.ev.on('creds.update', saveCreds)
}
```
----

