import { DEFAULT_CONNECTION_CONFIG } from '../Defaults'
import type { UserFacingSocketConfig } from '../Types'
import { makeCommunitiesSocket } from './communities'

// export the last socket layer
const makeWASocket = (config: UserFacingSocketConfig) => {
	printChillatoBanner()
	const newConfig = {
		...DEFAULT_CONNECTION_CONFIG,
		...config
	}

	return makeCommunitiesSocket(newConfig)
}

function printChillatoBanner() {
    console.clear()
    console.log(`
\x1b[38;2;0;255;136m
  ██████╗  █████╗ ██╗██╗     ███████╗██╗   ██╗███████╗
  ██╔══██╗██╔══██╗██║██║     ██╔════╝╚██╗ ██╔╝██╔════╝
  ██████╔╝███████║██║██║     █████╗   ╚████╔╝ ███████╗
  ██╔══██╗██╔══██║██║██║     ██╔══╝    ╚██╔╝  ╚════██║
  ██████╔╝██║  ██║██║███████╗███████╗   ██║   ███████║
  ╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝   ╚═╝   ╚══════╝
\x1b[0m
  \x1b[90mby\x1b[0m \x1b[1mChillato\x1b[0m \x1b[90m| v1.2 | github.com/ChillatoOfficial/Baileys\x1b[0m
`)
}

export default makeWASocket
