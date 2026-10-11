import Redis from 'ioredis'
import { BufferJSON, initAuthCreds } from '../Utils'
import type { AuthenticationState, SignalDataSet } from '../Types'

export type RedisOptions = {
  url?: string
  host?: string
  port?: number
  password?: string
  username?: string
  db?: number
  prefix?: string 
  redis?: Redis
}

export const useRedisAuthState = async (sessionId: string, opts: RedisOptions = {}) => {
  const redis = opts.redis || (opts.url? new Redis(opts.url) : new Redis({
    host: opts.host || process.env.REDIS_HOST || '127.0.0.1',
    port: opts.port || Number(process.env.REDIS_PORT) || 6379,
    password: opts.password || process.env.REDIS_PASSWORD || undefined,
    username: opts.username || undefined,
    db: opts.db?? 0,
    maxRetriesPerRequest: null,
  }))

  const basePrefix = opts.prefix || 'baileys:auth'
  const credsKey = `${basePrefix}:${sessionId}:creds`
  const keyPrefix = `${basePrefix}:${sessionId}:keys:`

  const saved = await redis.get(credsKey)
  const creds = saved? JSON.parse(saved, BufferJSON.reviver) : initAuthCreds()

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: any = {}
        const pipe = redis.pipeline()
        for (const id of ids) pipe.get(`${keyPrefix}${type}:${id}`)
        const res = await pipe.exec()
        res?.forEach((r: any, i: number) => {
          const v = r[1] as string | null
          if (v) data[ids[i] as any] = JSON.parse(v, BufferJSON.reviver)
        })
        return data
      },
      set: async (data: SignalDataSet) => {
        const pipe = redis.pipeline()
        for (const _t in data) {
          const t = _t as keyof SignalDataSet
          const td = (data as any)[t]
          if (!td) continue
          for (const id in td) {
            const key = `${keyPrefix}${t}:${id}`
            td[id]? pipe.set(key, JSON.stringify(td[id], BufferJSON.replacer)) : pipe.del(key)
          }
        }
        await pipe.exec()
      }
    }
  }

  return {
    state,
    saveCreds: async () => {
      await redis.set(credsKey, JSON.stringify(state.creds, BufferJSON.replacer))
    },
    redis
  }
}