import type { proto } from '../../WAProto/index.js'
import type { WAMessage, WAMessageContent } from '../Types/Message'
import { generateWAMessageFromContent } from '../Utils/messages'

// ── La tua API (invariata per compatibilità) ──

export type ButtonItem =
  | { type: 'url'; text: string; url: string }
  | { type: 'copy'; text: string; code: string }
  | { type: 'call'; text: string; phone: string }
  | { type: 'quick_reply'; text: string; id: string }
  | {
      type: 'list'
      text: string
      sections: Array<{
        title: string
        rows: Array<{ title: string; id: string; description?: string }>
      }>
    }

export interface CustomInteractiveOptions {
  title?: string
  bodyText: string
  footerText?: string
  buttons: ButtonItem[]
  mentions?: string[]
  quoted?: WAMessage
}

type BinaryNode = { tag: string; attrs: Record<string, string>; content?: BinaryNode[] }
type NativeFlowBtn = proto.Message.InteractiveMessage.NativeFlowMessage.INativeFlowButton
type MinimalSocket = {
  relayMessage: (jid: string, msg: proto.IMessage, opts: { messageId: string; additionalNodes: BinaryNode[] }) => Promise<any>
  ev: { emit: (e: string, data: any) => void }
  user?: { id: string }
}

const NATIVE_FLOW = { v: '9', name: 'mixed' } as const
const INTERACTIVE = { type: 'native_flow', v: '1' } as const
const isGroup = (jid: string) => jid.endsWith('@g.us')

// ── Builders puri (niente any) ──

export const buildUrlButton = (text: string, url: string): NativeFlowBtn => ({
  name: 'cta_url',
  buttonParamsJson: JSON.stringify({ display_text: text, url, merchant_url: url }),
})

export const buildCopyButton = (text: string, codeToCopy: string): NativeFlowBtn => ({
  name: 'cta_copy',
  buttonParamsJson: JSON.stringify({ display_text: text, copy_code: codeToCopy }),
})

export const buildCallButton = (text: string, phoneNumber: string): NativeFlowBtn => ({
  name: 'cta_call',
  buttonParamsJson: JSON.stringify({ display_text: text, phone_number: phoneNumber }),
})

export const buildQuickReplyButton = (text: string, id: string): NativeFlowBtn => ({
  name: 'quick_reply',
  buttonParamsJson: JSON.stringify({ display_text: text, id }),
})

export const buildListButton = (
  text: string,
  sections: ButtonItem & { type: 'list' } extends { sections: infer S }? S : never
): NativeFlowBtn => ({
  name: 'single_select',
  buttonParamsJson: JSON.stringify({ title: text, sections }),
})

const toNativeFlowButton = (btn: ButtonItem): NativeFlowBtn => {
  switch (btn.type) {
    case 'url': return buildUrlButton(btn.text, btn.url)
    case 'copy': return buildCopyButton(btn.text, btn.code)
    case 'call': return buildCallButton(btn.text, btn.phone)
    case 'quick_reply': return buildQuickReplyButton(btn.text, btn.id)
    case 'list': return buildListButton(btn.text, btn.sections as any)
    default: {
      const _never: never = btn as never
      throw new Error(`Tipo bottone non valido: ${JSON.stringify(_never)}`)
    }
  }
}

// ── Core Baileys fix ──

export const buildInteractiveAdditionalNodes = (jid: string): BinaryNode[] => {
  const nodes: BinaryNode[] = [
    {
      tag: 'biz',
      attrs: {},
      content: [{ tag: 'interactive', attrs: {...INTERACTIVE }, content: [{ tag: 'native_flow', attrs: {...NATIVE_FLOW } }] }],
    },
  ]
  if (!isGroup(jid)) nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
  return nodes
}

export function createButtons(options: CustomInteractiveOptions): WAMessageContent {
  const { title, bodyText, footerText, buttons, mentions } = options

  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
        interactiveMessage: {
          header: title? { title, hasMediaAttachment: false } : undefined,
          body: { text: bodyText },
          footer: footerText? { text: footerText } : undefined,
          contextInfo: mentions?.length? { mentionedJid: mentions } : undefined,
          nativeFlowMessage: {
            buttons: buttons.map(toNativeFlowButton),
            messageVersion: 1,
          },
        },
      },
    },
  }
}

// ── Sender + Attach ──

export const sendCustomButtons = async (sock: MinimalSocket, jid: string, options: CustomInteractiveOptions) => {
  const content = createButtons(options)
  const fullMsg = generateWAMessageFromContent(jid, content, {
    userJid: sock.user?.id as string,
    quoted: options.quoted,
  })

  await sock.relayMessage(jid, fullMsg.message!, {
    messageId: fullMsg.key.id!,
    additionalNodes: buildInteractiveAdditionalNodes(jid),
  })
  sock.ev.emit('messages.upsert', { messages: [fullMsg], type: 'append' })
  return fullMsg
}

export const attachButtonSupport = <T extends MinimalSocket>(sock: T) => {
  const s = sock as T & { sendCustomButtons: typeof sendCustomButtons }
  s.sendCustomButtons = (jid, opts) => sendCustomButtons(s, jid as any, opts as any)
  return s
}