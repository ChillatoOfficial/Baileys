import { Boom } from '@hapi/boom'
import { DisconnectReason } from '../Types'

export interface SmartReconnectOptions {
	baseDelayMs?: number
	maxDelayMs?: number
	maxRetries?: number
	onRetry?: (attempt: number, delayMs: number) => void
	onGiveUp?: () => void
}

export const attachSmartReconnect = <T extends { ev: { on: (e: any, cb: any) => void } }>(
	sock: T,
	restart: () => void | Promise<void>,
	opts: SmartReconnectOptions = {}
) => {
	const baseDelayMs = opts.baseDelayMs ?? 1500
	const maxDelayMs = opts.maxDelayMs ?? 30_000
	const maxRetries = opts.maxRetries ?? 10

	let attempt = 0
	let timer: ReturnType<typeof setTimeout> | undefined

	sock.ev.on('connection.update', (update: { connection?: string; lastDisconnect?: { error?: Error } }) => {
		const { connection, lastDisconnect } = update

		if (connection === 'open') {
			attempt = 0
			if (timer) clearTimeout(timer)
			return
		}

		if (connection !== 'close') return

		const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
		const shouldStop = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession

		if (shouldStop) {
			return
		}

		if (maxRetries > 0 && attempt >= maxRetries) {
			opts.onGiveUp?.()
			return
		}

		attempt += 1
		const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
		const jitter = Math.random() * exponential * 0.3
		const delayMs = Math.round(exponential + jitter)

		opts.onRetry?.(attempt, delayMs)

		timer = setTimeout(() => {
			void restart()
		}, delayMs)
	})
}
