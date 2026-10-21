import { createServer, type Server, type Socket } from 'node:net'

export interface ProxyServerDelegate {
  createOutboundSocket: (
    targetHost: string,
    targetPort: number,
    protocol: 'TCP' | 'UDP' | 'HTTP' | 'HTTPS'
  ) => Promise<{
    socket: Socket
    interfaceId: string
    interfaceName: string
    recordBytes: (bytesIn: number, bytesOut: number) => void
    onClose: () => void
  }>
}

/**
 * High-performance dual-protocol (SOCKS5 & HTTP/HTTPS CONNECT) proxy server
 * that terminates incoming client connections from the OS/device and routes
 * outbound traffic across parallel bonded physical network interfaces.
 */
export class BondedProxyServer {
  private server: Server | null = null
  private activePort = 0
  private activeFlows = new Map<string, { close: () => void }>()
  private flowCounter = 0

  constructor(private readonly delegate: ProxyServerDelegate) {}

  get port(): number {
    return this.activePort
  }

  async start(preferredPort = 10800): Promise<number> {
    if (this.server) return this.activePort

    return new Promise((resolve, reject) => {
      const server = createServer((clientSocket) => {
        this.handleClientConnection(clientSocket)
      })

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // If preferred port is taken, listen on an ephemeral random port
          server.listen(0, '127.0.0.1')
        } else {
          reject(err)
        }
      })

      server.listen(preferredPort, '127.0.0.1', () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          this.activePort = address.port
          this.server = server
          resolve(this.activePort)
        } else {
          reject(new Error('Failed to retrieve proxy server address'))
        }
      })
    })
  }

  async stop(): Promise<void> {
    for (const flow of this.activeFlows.values()) {
      flow.close()
    }
    this.activeFlows.clear()

    if (!this.server) return
    return new Promise((resolve) => {
      this.server?.close(() => {
        this.server = null
        this.activePort = 0
        resolve()
      })
    })
  }

  private handleClientConnection(clientSocket: Socket): void {
    clientSocket.once('data', (initialChunk) => {
      if (initialChunk.length === 0) {
        clientSocket.end()
        return
      }

      const firstByte = initialChunk[0]

      if (firstByte === 0x05) {
        // SOCKS5 Protocol
        this.handleSocks5(clientSocket)
      } else {
        const textHeader = initialChunk.toString('latin1', 0, Math.min(initialChunk.length, 512))
        if (textHeader.startsWith('CONNECT ')) {
          // HTTP CONNECT Tunneling (HTTPS)
          this.handleHttpConnect(clientSocket, textHeader)
        } else {
          // Plain HTTP Request
          this.handlePlainHttp(clientSocket, textHeader, initialChunk)
        }
      }
    })

    clientSocket.on('error', () => {
      clientSocket.destroy()
    })
  }

  // --- SOCKS5 Handler ---
  private handleSocks5(clientSocket: Socket): void {
    // Respond: SOCKS5 (0x05), NO AUTH (0x00)
    clientSocket.write(Buffer.from([0x05, 0x00]))

    clientSocket.once('data', async (req) => {
      if (req.length < 7 || req[0] !== 0x05) {
        clientSocket.destroy()
        return
      }

      const cmd = req[1] // 0x01 = CONNECT
      if (cmd !== 0x01) {
        // Command not supported (0x07)
        clientSocket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
        clientSocket.destroy()
        return
      }

      const atyp = req[3]
      let targetHost = ''
      let portOffset = 4

      if (atyp === 0x01) {
        // IPv4
        targetHost = `${req[4]}.${req[5]}.${req[6]}.${req[7]}`
        portOffset = 8
      } else if (atyp === 0x03) {
        // Domain
        const domainLen = req[4]
        targetHost = req.toString('utf8', 5, 5 + domainLen)
        portOffset = 5 + domainLen
      } else if (atyp === 0x04) {
        // IPv6
        const parts: string[] = []
        for (let i = 4; i < 20; i += 2) {
          parts.push(req.readUInt16BE(i).toString(16))
        }
        targetHost = parts.join(':')
        portOffset = 20
      } else {
        clientSocket.destroy()
        return
      }

      const targetPort = req.readUInt16BE(portOffset)

      try {
        const outbound = await this.delegate.createOutboundSocket(targetHost, targetPort, 'TCP')
        // Reply SUCCESS (0x00)
        clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]))
        this.bridgeSockets(clientSocket, outbound.socket, outbound.recordBytes, outbound.onClose)
      } catch {
        // General failure (0x01)
        clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
        clientSocket.destroy()
      }
    })
  }

  // --- HTTP CONNECT Tunnel Handler ---
  private async handleHttpConnect(clientSocket: Socket, headerText: string): Promise<void> {
    const firstLine = headerText.split('\r\n')[0]
    const match = firstLine.match(/^CONNECT\s+([^:\s]+):?(\d+)?\s+HTTP/i)
    if (!match) {
      clientSocket.destroy()
      return
    }

    const targetHost = match[1]
    const targetPort = match[2] ? parseInt(match[2], 10) : 443

    try {
      const outbound = await this.delegate.createOutboundSocket(targetHost, targetPort, 'HTTPS')
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      this.bridgeSockets(clientSocket, outbound.socket, outbound.recordBytes, outbound.onClose)
    } catch (err) {
      console.warn(
        `[plexo:proxy] HTTPS CONNECT tunnel failed for ${targetHost}:${targetPort}:`,
        err
      )
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
      clientSocket.destroy()
    }
  }

  // --- Plain HTTP Forwarder ---
  private async handlePlainHttp(
    clientSocket: Socket,
    headerText: string,
    initialChunk: Buffer
  ): Promise<void> {
    const hostMatch = headerText.match(/Host:\s*([^:\r\n]+):?(\d+)?/i)
    if (!hostMatch) {
      clientSocket.destroy()
      return
    }

    const targetHost = hostMatch[1]
    const targetPort = hostMatch[2] ? parseInt(hostMatch[2], 10) : 80

    try {
      const outbound = await this.delegate.createOutboundSocket(targetHost, targetPort, 'HTTP')

      // Transform absolute URI to origin-form path so remote origin servers accept standard HTTP
      let modifiedText = headerText.replace(
        /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+https?:\/\/[^/\s]+(\/[^\s]*)?/i,
        (_m, verb, path) => `${verb} ${path || '/'}`
      )
      // Replace Proxy-Connection with Connection
      modifiedText = modifiedText.replace(/Proxy-Connection:/gi, 'Connection:')

      // Replace header part of initialChunk while keeping any attached body
      const headerEndIndex = initialChunk.indexOf('\r\n\r\n')
      let payloadToSend: Buffer
      if (headerEndIndex !== -1) {
        const headerBuf = Buffer.from(
          modifiedText.slice(0, modifiedText.indexOf('\r\n\r\n') + 4),
          'latin1'
        )
        const bodyBuf = initialChunk.subarray(headerEndIndex + 4)
        payloadToSend = Buffer.concat([headerBuf, bodyBuf])
      } else {
        payloadToSend = Buffer.from(modifiedText, 'latin1')
      }

      outbound.socket.write(payloadToSend)
      this.bridgeSockets(clientSocket, outbound.socket, outbound.recordBytes, outbound.onClose)
    } catch (err) {
      console.warn(`[plexo:proxy] Plain HTTP forward failed for ${targetHost}:${targetPort}:`, err)
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
      clientSocket.destroy()
    }
  }

  private bridgeSockets(
    client: Socket,
    remote: Socket,
    recordBytes: (bytesIn: number, bytesOut: number) => void,
    onClose: () => void
  ): void {
    const flowId = `flow-${++this.flowCounter}`

    const cleanup = (): void => {
      this.activeFlows.delete(flowId)
      onClose()
      client.destroy()
      remote.destroy()
    }

    this.activeFlows.set(flowId, { close: cleanup })

    client.on('data', (chunk) => {
      recordBytes(0, chunk.length)
      if (!remote.destroyed) remote.write(chunk)
    })

    remote.on('data', (chunk) => {
      recordBytes(chunk.length, 0)
      if (!client.destroyed) client.write(chunk)
    })

    client.on('close', cleanup)
    remote.on('close', cleanup)
    client.on('error', cleanup)
    remote.on('error', cleanup)
  }
}
