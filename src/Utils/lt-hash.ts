let LTImpl: any
try {
    // @ts-ignore
    LTImpl = require('../../packages/whatsapp-rust-bridge/dist/index.cjs').LTHashAntiTampering
} catch {
    LTImpl = class { mix() { } subtract() { } snapshot() { return Buffer.alloc(128) } }
}
export const LTHashAntiTampering = LTImpl
export const LT_HASH_ANTI_TAMPERING = new LTImpl()
export const LT = LTImpl