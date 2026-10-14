import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto'
import * as curve from 'libsignal/src/curve'
import { KEY_BUNDLE_TYPE } from '../Defaults'
import type { KeyPair } from '../Types'

// ---- WHATSAPP RUST BRIDGE EMBEDDED (Soluzione B) ----
// Se non c'è (es. su build senza wasm), usa fallback JS puro
let _md5: (data: Uint8Array) => Uint8Array
let _hkdf: (ikm: any, length: number, opts?: any) => Uint8Array

try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const bridge = require('../../packages/whatsapp-rust-bridge/dist/index.cjs') as any
	_md5 = bridge.md5
	_hkdf = bridge.hkdf
} catch {
	_md5 = (data: Uint8Array) => createHash('md5').update(data).digest()
	_hkdf = (ikm: any, length: number, opts: any = {}) => {
		const salt = opts.salt || Buffer.alloc(0)
		const info = opts.info || Buffer.alloc(0)
		const prk = createHmac('sha256', salt).update(ikm).digest()
		let t = Buffer.alloc(0)
		let okm = Buffer.alloc(0)
		let c = 1
		while (okm.length < length) {
			t = createHmac('sha256', prk).update(Buffer.concat([t, info, Buffer.from([c])])).digest()
			okm = Buffer.concat([okm, t])
			c++
		}
		return okm.subarray(0, length)
	}
}

export const md5 = _md5
export const hkdf = _hkdf
// ---- FINE BRIDGE ----

// insure browser & node compatibility
const { subtle } = globalThis.crypto

/** prefix version byte to the pub keys, required for some curve crypto functions */
export const generateSignalPubKey = (pubKey: Uint8Array | Buffer) =>
	pubKey.length === 33 ? pubKey : Buffer.concat([KEY_BUNDLE_TYPE, pubKey])

export const Curve = {
	generateKeyPair: (): KeyPair => {
		const { pubKey, privKey } = curve.generateKeyPair()
		return {
			private: Buffer.from(privKey),
			// remove version byte
			public: Buffer.from(pubKey.slice(1))
		}
	},
	sharedKey: (privateKey: Uint8Array, publicKey: Uint8Array) => {
		const shared = curve.calculateAgreement(generateSignalPubKey(publicKey), privateKey)
		return Buffer.from(shared)
	},
	sign: (privateKey: Uint8Array, buf: Uint8Array) => curve.calculateSignature(privateKey, buf),
	verify: (pubKey: Uint8Array, message: Uint8Array, signature: Uint8Array) => {
		try {
			curve.verifySignature(generateSignalPubKey(pubKey), message, signature)
			return true
		} catch (error) {
			return false
		}
	}
}

export const signedKeyPair = (identityKeyPair: KeyPair, keyId: number) => {
	const preKey = Curve.generateKeyPair()
	const pubKey = generateSignalPubKey(preKey.public)
	const signature = Curve.sign(identityKeyPair.private, pubKey)
	return { keyPair: preKey, signature, keyId }
}

const GCM_TAG_LENGTH = 128 >> 3

export function aesEncryptGCM(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array, additionalData: Uint8Array) {
	const cipher = createCipheriv('aes-256-gcm', key, iv)
	cipher.setAAD(additionalData)
	return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
}

export function aesDecryptGCM(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, additionalData: Uint8Array) {
	const decipher = createDecipheriv('aes-256-gcm', key, iv)
	const enc = ciphertext.slice(0, ciphertext.length - GCM_TAG_LENGTH)
	const tag = ciphertext.slice(ciphertext.length - GCM_TAG_LENGTH)
	decipher.setAAD(additionalData)
	decipher.setAuthTag(tag)
	return Buffer.concat([decipher.update(enc), decipher.final()])
}

export function aesEncryptCTR(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array) {
	const cipher = createCipheriv('aes-256-ctr', key, iv)
	return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

export function aesDecryptCTR(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array) {
	const decipher = createDecipheriv('aes-256-ctr', key, iv)
	return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function aesDecrypt(buffer: Uint8Array, key: Uint8Array) {
	return aesDecryptWithIV(buffer.subarray(16), key, buffer.subarray(0, 16))
}

export function aesDecryptWithIV(buffer: Uint8Array, key: Uint8Array, IV: Uint8Array) {
	const aes = createDecipheriv('aes-256-cbc', key, IV)
	return Buffer.concat([aes.update(buffer), aes.final()])
}

export function aesEncrypt(buffer: Uint8Array, key: Uint8Array) {
	const IV = randomBytes(16)
	const aes = createCipheriv('aes-256-cbc', key, IV)
	return Buffer.concat([IV, aes.update(buffer), aes.final()])
}

export function aesEncrypWithIV(buffer: Buffer, key: Buffer, IV: Buffer) {
	const aes = createCipheriv('aes-256-cbc', key, IV)
	return Buffer.concat([aes.update(buffer), aes.final()])
}

export function hmacSign(buffer: Buffer | Uint8Array, key: Buffer | Uint8Array, variant: 'sha256' | 'sha512' = 'sha256') {
	return createHmac(variant, key).update(buffer).digest()
}

export function sha256(buffer: Buffer) {
	return createHash('sha256').update(buffer).digest()
}

export async function derivePairingCodeKey(pairingCode: string, salt: Buffer): Promise<Buffer> {
	const encoder = new TextEncoder()
	const pairingCodeBuffer = encoder.encode(pairingCode)
	const saltBuffer = new Uint8Array(salt instanceof Uint8Array ? salt : new Uint8Array(salt))
	const keyMaterial = await subtle.importKey('raw', pairingCodeBuffer as BufferSource, { name: 'PBKDF2' }, false, ['deriveBits'])
	const derivedBits = await subtle.deriveBits(
		{ name: 'PBKDF2', salt: saltBuffer as BufferSource, iterations: 2 << 16, hash: 'SHA-256' },
		keyMaterial,
		32 * 8
	)
	return Buffer.from(derivedBits)
}