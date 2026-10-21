import { lookup } from 'node:dns/promises'
import { isIP, type Socket } from 'node:net'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import type {
  BondingStrategy,
  IpFamily,
  NetworkFlowEntry,
  NetworkInterfaceInfo,
  VirtualNetworkInterfaceStats,
  VirtualNetworkMode,
  VirtualNetworkState,
  VirtualNetworkStatus
} from '../../shared/types'
import { connectRoute } from '../network/deviceBinding'
import type { NetworkMonitor } from '../network/interfaces'
import { BondedProxyServer, type ProxyServerDelegate } from './proxyServer'
import { SystemProxyManager } from './systemProxy'
import { AdapterSetupManager } from './adapterSetup'
import type { AdapterSetupInfo } from '../../shared/types'

interface InterfaceRuntimeData {
  enabled: boolean
  weight: number
  activeFlows: number
  bytesInThisSecond: number
  bytesOutThisSecond: number
  totalBytesIn: number
  totalBytesOut: number
  downloadSpeed: number
  uploadSpeed: number
  latencyMs: number
}

export class VirtualNetworkManager implements ProxyServerDelegate {
  private status: VirtualNetworkStatus = 'inactive'
  private mode: VirtualNetworkMode = 'system-proxy'
  private strategy: BondingStrategy = 'weighted-speed'
  private proxyPort = 10800
  private startTime = 0
  private timer: NodeJS.Timeout | null = null
  private pingTimer: NodeJS.Timeout | null = null
  private errorMessage?: string

  private readonly proxyServer: BondedProxyServer
  private readonly systemProxy: SystemProxyManager
  private readonly adapterSetup: AdapterSetupManager
  private adapterSetupInfo: AdapterSetupInfo
  private readonly interfaceData = new Map<string, InterfaceRuntimeData>()
  private readonly recentFlows: NetworkFlowEntry[] = []
  private roundRobinCounter = 0
  private flowIdCounter = 0

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly networkMonitor: NetworkMonitor
  ) {
    this.proxyServer = new BondedProxyServer(this)
    this.systemProxy = new SystemProxyManager()
    this.adapterSetup = new AdapterSetupManager()
    this.adapterSetupInfo = {
      status: 'setting-up',
      platform: process.platform,
      details: 'Initializing virtual network adapter...',
      installed: false,
      lastChecked: Date.now()
    }

    // Automatically ensure the virtual network adapter is configured after installation
    void this.adapterSetup.setup().then((info) => {
      this.adapterSetupInfo = info
      this.broadcastState()
    })
  }

  async start(mode: VirtualNetworkMode = 'system-proxy'): Promise<VirtualNetworkState> {
    if (this.status === 'active') return this.getState()

    this.status = 'starting'
    this.mode = mode
    this.errorMessage = undefined
    this.broadcastState()

    try {
      // 1. Start Bonded Proxy Server
      this.proxyPort = await this.proxyServer.start(10800)

      // 2. Configure OS System Proxy
      if (this.mode === 'system-proxy') {
        const proxySuccess = await this.systemProxy.enable(this.proxyPort)
        if (!proxySuccess) {
          console.warn(
            '[plexo:virtualNetwork] System proxy could not be automatically set; manual proxy enabled on port',
            this.proxyPort
          )
        }
      }

      this.status = 'active'
      this.startTime = Date.now()

      // Start metrics tick every 1000ms
      this.startMetricsTimer()
      this.startPingTimer()
    } catch (err) {
      this.status = 'error'
      this.errorMessage = err instanceof Error ? err.message : String(err)
      await this.stop()
    }

    this.broadcastState()
    return this.getState()
  }

  async stop(): Promise<VirtualNetworkState> {
    if (this.status === 'inactive') return this.getState()

    this.status = 'stopping'
    this.broadcastState()

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }

    try {
      await this.systemProxy.disable()
      await this.proxyServer.stop()
    } catch (err) {
      console.error('[plexo:virtualNetwork] Error during stop:', err)
    }

    this.status = 'inactive'
    this.startTime = 0
    this.broadcastState()
    return this.getState()
  }

  getState(): VirtualNetworkState {
    const interfaces = this.networkMonitor.current ?? []
    let totalDownloadSpeed = 0
    let totalUploadSpeed = 0
    let totalBytesDownloaded = 0
    let totalBytesUploaded = 0
    let activeFlowsCount = 0

    const interfaceStats: VirtualNetworkInterfaceStats[] = interfaces.map((iface) => {
      const data = this.getOrCreateInterfaceData(iface.id)
      totalDownloadSpeed += data.downloadSpeed
      totalUploadSpeed += data.uploadSpeed
      totalBytesDownloaded += data.totalBytesIn
      totalBytesUploaded += data.totalBytesOut
      activeFlowsCount += data.activeFlows

      return {
        id: iface.id,
        device: iface.device,
        displayName: iface.displayName,
        kind: iface.kind,
        enabled: data.enabled,
        weight: data.weight,
        downloadSpeed: data.downloadSpeed,
        uploadSpeed: data.uploadSpeed,
        activeFlows: data.activeFlows,
        latencyMs: data.latencyMs,
        totalBytesDownloaded: data.totalBytesIn,
        totalBytesUploaded: data.totalBytesOut
      }
    })

    const uptimeSeconds = this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0

    return {
      status: this.status,
      mode: this.mode,
      strategy: this.strategy,
      proxyPort: this.proxyPort,
      totalDownloadSpeed,
      totalUploadSpeed,
      totalBytesDownloaded,
      totalBytesUploaded,
      activeFlowsCount,
      uptimeSeconds,
      interfaces: interfaceStats,
      recentFlows: this.recentFlows.slice(0, 40),
      adapterSetup: this.adapterSetupInfo,
      errorMessage: this.errorMessage
    }
  }

  async setupAdapter(): Promise<AdapterSetupInfo> {
    this.adapterSetupInfo = await this.adapterSetup.setup()
    this.broadcastState()
    return this.adapterSetupInfo
  }

  setStrategy(strategy: BondingStrategy): void {
    this.strategy = strategy
    this.broadcastState()
  }

  setMode(mode: VirtualNetworkMode): void {
    this.mode = mode
    this.broadcastState()
  }

  toggleInterface(interfaceId: string, enabled: boolean): void {
    const data = this.getOrCreateInterfaceData(interfaceId)
    data.enabled = enabled
    this.broadcastState()
  }

  // --- Outbound Socket Dispatcher & Flow Bonding ---
  async createOutboundSocket(
    targetHost: string,
    targetPort: number,
    protocol: 'TCP' | 'UDP' | 'HTTP' | 'HTTPS'
  ): Promise<{
    socket: Socket
    interfaceId: string
    interfaceName: string
    recordBytes: (bytesIn: number, bytesOut: number) => void
    onClose: () => void
  }> {
    const availableInterfaces = this.networkMonitor.current ?? []
    if (availableInterfaces.length === 0) {
      throw new Error('No active network connections available')
    }

    const enabledInterfaces = availableInterfaces.filter((iface) => {
      const data = this.getOrCreateInterfaceData(iface.id)
      return data.enabled && iface.addresses.length > 0
    })

    const pool = enabledInterfaces.length > 0 ? enabledInterfaces : availableInterfaces

    // Build prioritized candidate list starting with preferred interface based on bonding strategy
    const candidates = this.getCandidateInterfaces(pool)
    let lastError: Error | null = null

    for (const selectedIface of candidates) {
      const ifaceData = this.getOrCreateInterfaceData(selectedIface.id)

      try {
        // Determine supported IP families on this physical interface
        const hasIpv4 = selectedIface.addresses.some((a) => a.family === 4)
        const hasIpv6 = selectedIface.addresses.some((a) => a.family === 6)

        // Resolve remote destination matching interface address family
        let remoteIp: string
        let targetFamily: IpFamily

        if (isIP(targetHost)) {
          remoteIp = targetHost
          targetFamily = remoteIp.includes(':') ? 6 : 4
          // Ensure this interface actually has a matching local address family
          if (targetFamily === 6 && !hasIpv6) {
            continue // Try next interface if this one has no IPv6
          }
          if (targetFamily === 4 && !hasIpv4) {
            continue // Try next interface if this one has no IPv4
          }
        } else {
          // Domain name: resolve family matching available local interface addresses
          // Prefer IPv4 for maximum cross-network routing reliability unless IPv6-only
          const preferredFamily = hasIpv4 ? 4 : 6
          const resolved = await lookup(targetHost, { family: preferredFamily })
          remoteIp = resolved.address
          targetFamily = preferredFamily
        }

        // Pick compatible local IP on the chosen interface
        const matchingLocal = selectedIface.addresses.find((addr) => addr.family === targetFamily)
        if (!matchingLocal) {
          continue
        }
        const localAddress = matchingLocal.address

        // Initiate connection via device binding route
        const socket = connectRoute(
          {
            device: selectedIface.device,
            localAddress,
            remoteAddress: remoteIp,
            family: targetFamily
          },
          targetPort
        )

        // Await TCP connection establishment before yielding socket to proxy
        await new Promise<void>((resolve, reject) => {
          let timer: NodeJS.Timeout | null = setTimeout(() => {
            timer = null
            socket.destroy(
              new Error(
                `Connection to ${targetHost}:${targetPort} timed out on ${selectedIface.displayName}`
              )
            )
          }, 6000)

          socket.once('connect', () => {
            if (timer) clearTimeout(timer)
            resolve()
          })

          socket.once('error', (err) => {
            if (timer) clearTimeout(timer)
            reject(err)
          })
        })

        // Outbound connection is established successfully on this interface
        ifaceData.activeFlows++

        const flowEntry: NetworkFlowEntry = {
          id: `f-${++this.flowIdCounter}`,
          targetHost,
          targetPort,
          protocol,
          interfaceId: selectedIface.id,
          interfaceName: selectedIface.displayName,
          startTime: Date.now(),
          bytesTransferred: 0,
          state: 'active'
        }

        this.recentFlows.unshift(flowEntry)
        if (this.recentFlows.length > 50) this.recentFlows.pop()

        return {
          socket,
          interfaceId: selectedIface.id,
          interfaceName: selectedIface.displayName,
          recordBytes: (bytesIn: number, bytesOut: number) => {
            ifaceData.bytesInThisSecond += bytesIn
            ifaceData.bytesOutThisSecond += bytesOut
            ifaceData.totalBytesIn += bytesIn
            ifaceData.totalBytesOut += bytesOut
            flowEntry.bytesTransferred += bytesIn + bytesOut
          },
          onClose: () => {
            ifaceData.activeFlows = Math.max(0, ifaceData.activeFlows - 1)
            flowEntry.state = 'closed'
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(
          `[plexo:virtualNetwork] Interface ${selectedIface.displayName} failed for ${targetHost}:${targetPort}: ${lastError.message}. Trying next candidate.`
        )
      }
    }

    throw (
      lastError ??
      new Error(`All bonded network interfaces failed to connect to ${targetHost}:${targetPort}`)
    )
  }

  private getCandidateInterfaces(interfaces: NetworkInterfaceInfo[]): NetworkInterfaceInfo[] {
    if (interfaces.length <= 1) return interfaces

    const pool = [...interfaces]
    let primary: NetworkInterfaceInfo

    switch (this.strategy) {
      case 'round-robin': {
        const index = this.roundRobinCounter++ % pool.length
        primary = pool[index]
        break
      }
      case 'lowest-latency': {
        primary = pool.reduce((best, curr) => {
          const bData = this.getOrCreateInterfaceData(best.id)
          const cData = this.getOrCreateInterfaceData(curr.id)
          return cData.latencyMs > 0 && (bData.latencyMs <= 0 || cData.latencyMs < bData.latencyMs)
            ? curr
            : best
        }, pool[0])
        break
      }
      case 'weighted-speed':
      default: {
        let lowestRatio = Infinity
        primary = pool[0]
        for (const iface of pool) {
          const data = this.getOrCreateInterfaceData(iface.id)
          const capacity = Math.max(data.downloadSpeed, 1024 * 1024)
          const ratio = (data.activeFlows + 1) / capacity
          if (ratio < lowestRatio) {
            lowestRatio = ratio
            primary = iface
          }
        }
        break
      }
    }

    // Place primary first, followed by remaining candidates for failover
    return [primary, ...pool.filter((i) => i.id !== primary.id)]
  }

  private getOrCreateInterfaceData(id: string): InterfaceRuntimeData {
    let data = this.interfaceData.get(id)
    if (!data) {
      data = {
        enabled: true,
        weight: 1,
        activeFlows: 0,
        bytesInThisSecond: 0,
        bytesOutThisSecond: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        latencyMs: 15
      }
      this.interfaceData.set(id, data)
    }
    return data
  }

  private startMetricsTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      for (const data of this.interfaceData.values()) {
        data.downloadSpeed = data.bytesInThisSecond
        data.uploadSpeed = data.bytesOutThisSecond
        data.bytesInThisSecond = 0
        data.bytesOutThisSecond = 0
      }
      this.broadcastState()
    }, 1000)
  }

  private startPingTimer(): void {
    if (this.pingTimer) clearInterval(this.pingTimer)
    // Measure latency every 5 seconds per interface
    const measurePings = async (): Promise<void> => {
      const ifaces = this.networkMonitor.current ?? []
      for (const iface of ifaces) {
        const start = Date.now()
        try {
          // Quick non-blocking connect to 1.1.1.1:53 or 8.8.8.8:53
          const remoteIp = '1.1.1.1'
          const localAddr = iface.addresses.find((a) => a.family === 4)?.address
          if (!localAddr) continue

          const socket = connectRoute(
            {
              device: iface.device,
              localAddress: localAddr,
              remoteAddress: remoteIp,
              family: 4
            },
            53
          )

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              socket.destroy()
              reject(new Error('timeout'))
            }, 1500)
            socket.on('connect', () => {
              clearTimeout(timeout)
              const lat = Date.now() - start
              const data = this.getOrCreateInterfaceData(iface.id)
              data.latencyMs = lat
              socket.destroy()
              resolve()
            })
            socket.on('error', () => {
              clearTimeout(timeout)
              socket.destroy()
              reject(new Error('err'))
            })
          })
        } catch {
          // Keep previous latency or default
        }
      }
    }

    void measurePings()
    this.pingTimer = setInterval(() => {
      void measurePings()
    }, 5000)
  }

  private broadcastState(): void {
    const window = this.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.virtualNetworkUpdated, this.getState())
    }
  }
}
