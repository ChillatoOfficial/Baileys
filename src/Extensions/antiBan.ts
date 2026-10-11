
import PQueue from 'p-queue'

export interface AntiBanOptions {
	maxPerSecond?: number
	minDelayMs?: number
	jitterMs?: number
	perJidCooldownMs?: number
	onThrottle?: (jid: string, waitedMs: number) => void
}

export const attachAntiBan = <T extends { sendMessage: (...args: any[]) => Promise<any> }>(
	sock: T,
	opts: AntiBanOptions = {}
) => {
	const maxPerSecond = opts.maxPerSecond ?? 1
	const minDelayMs = opts.minDelayMs ?? 700
	const jitterMs = opts.jitterMs ?? 400
	const perJidCooldownMs = opts.perJidCooldownMs ?? 1200

	const queue = new PQueue({
		concurrency: 1,
		interval: 1000,
		intervalCap: Math.max(1, maxPerSecond)
	})

	const lastSentPerJid = new Map<string, number>()
	let lastSentGlobal = 0

	const originalSendMessage = sock.sendMessage.bind(sock)

	const throttledSendMessage = (jid: string, ...rest: any[]) =>
		queue.add(async () => {
			const now = Date.now()

			const sinceGlobal = now - lastSentGlobal
			const sinceJid = now - (lastSentPerJid.get(jid) ?? 0)

			const neededGlobalWait = Math.max(0, minDelayMs + Math.random() * jitterMs - sinceGlobal)
			const neededJidWait = Math.max(0, perJidCooldownMs - sinceJid)
			const waitMs = Math.max(neededGlobalWait, neededJidWait)

			if (waitMs > 0) {
				opts.onThrottle?.(jid, waitMs)
				await new Promise(resolve => setTimeout(resolve, waitMs))
			}

			lastSentGlobal = Date.now()
			lastSentPerJid.set(jid, lastSentGlobal)
			return originalSendMessage(jid, ...rest)
		})

	const extended = sock as T & {
		sendMessage: typeof originalSendMessage
		antiBanQueue: PQueue
	}

	extended.sendMessage = throttledSendMessage
	extended.antiBanQueue = queue

	return extended
}
