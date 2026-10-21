import { useState } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Cpu,
  Globe,
  Layers,
  Power,
  RefreshCw,
  Router,
  Settings2,
  Shield,
  Smartphone,
  Wifi,
  Zap
} from 'lucide-react'
import type { BondingStrategy, NetworkInterfaceKind } from '@shared/types'
import { useVirtualNetworkStore } from '../store/useVirtualNetworkStore'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatSpeed(bytesPerSec: number): { value: string; unit: string } {
  if (bytesPerSec <= 0) return { value: '0.0', unit: 'KB/s' }
  if (bytesPerSec < 1024 * 1024) {
    return { value: (bytesPerSec / 1024).toFixed(1), unit: 'KB/s' }
  }
  return { value: (bytesPerSec / (1024 * 1024)).toFixed(2), unit: 'MB/s' }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function getInterfaceIcon(kind: NetworkInterfaceKind): React.JSX.Element {
  switch (kind) {
    case 'wifi':
      return <Wifi className="h-5 w-5 text-emerald-500" />
    case 'usb':
      return <Smartphone className="h-5 w-5 text-amber-500" />
    case 'ethernet':
      return <Router className="h-5 w-5 text-indigo-500" />
    default:
      return <Globe className="h-5 w-5 text-slate-400" />
  }
}

export function VirtualNetworkScreen(): React.JSX.Element {
  const {
    networkState,
    loading,
    start,
    stop,
    setStrategy,
    setMode,
    toggleInterface,
    fetchState,
    setupAdapter
  } = useVirtualNetworkStore()

  const [activeTab, setActiveTab] = useState<'status' | 'interfaces' | 'flows' | 'settings'>(
    'status'
  )

  const status = networkState?.status ?? 'inactive'
  const isActive = status === 'active'
  const isStarting = status === 'starting'
  const isStopping = status === 'stopping'
  const adapterSetup = networkState?.adapterSetup

  const totalDl = formatSpeed(networkState?.totalDownloadSpeed ?? 0)
  const totalUl = formatSpeed(networkState?.totalUploadSpeed ?? 0)

  const activeInterfaces = networkState?.interfaces.filter((i) => i.enabled) ?? []
  const totalSpeedForContribution =
    networkState?.interfaces.reduce((sum, i) => sum + i.downloadSpeed + i.uploadSpeed, 0) || 1

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-(--text) select-none">
      {/* Top Hero Section */}
      <div className="relative border-b border-border bg-linear-to-b from-(--bg-secondary) to-background px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                  : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              <Shield className={`h-8 w-8 ${isActive ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Virtual Network Aggregator</h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : isStarting || isStopping
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-slate-500/15 text-slate-500 border border-slate-500/20'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive
                        ? 'bg-emerald-500 animate-ping'
                        : isStarting || isStopping
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-slate-400'
                    }`}
                  />
                  {status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-(--text-secondary)">
                  Combining {activeInterfaces.length} network connection
                  {activeInterfaces.length === 1 ? '' : 's'} in parallel for your device
                </p>
                {adapterSetup?.installed ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>{adapterSetup.details || 'macOS Virtual Network Ready'}</span>
                  </span>
                ) : (
                  <button
                    onClick={() => void setupAdapter()}
                    className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3 shrink-0" />
                    <span>Setup macOS Network Service</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Master Control Power Button */}
          <div className="flex items-center gap-3">
            <button
              disabled={loading || isStarting || isStopping}
              onClick={() => {
                if (isActive) void stop()
                else void start()
              }}
              className={`flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold shadow-md transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-50 ${
                isActive
                  ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 dark:text-rose-400'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20 border border-emerald-500'
              }`}
            >
              {loading || isStarting || isStopping ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              {isActive ? 'Disconnect Virtual Network' : 'Connect & Combine Networks'}
            </button>
          </div>
        </div>

        {/* Aggregate Output Speed Cards */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-(--text-secondary)">
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowDown className="h-3.5 w-3.5 text-emerald-500" /> Output Download
              </span>
              <Activity className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight">{totalDl.value}</span>
              <span className="text-xs font-semibold text-(--text-secondary)">{totalDl.unit}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Total {formatBytes(networkState?.totalBytesDownloaded ?? 0)}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-(--text-secondary)">
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowUp className="h-3.5 w-3.5 text-blue-500" /> Output Upload
              </span>
              <Activity className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight">{totalUl.value}</span>
              <span className="text-xs font-semibold text-(--text-secondary)">{totalUl.unit}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Total {formatBytes(networkState?.totalBytesUploaded ?? 0)}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-(--text-secondary)">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Parallel Streams
              </span>
              <Layers className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight">
                {networkState?.activeFlowsCount ?? 0}
              </span>
              <span className="text-xs font-semibold text-(--text-secondary)">active flows</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Bonded across {activeInterfaces.length} adapters
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-(--text-secondary)">
              <span className="flex items-center gap-1.5 font-medium">
                <Cpu className="h-3.5 w-3.5 text-purple-500" /> Virtual Gateway
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono tracking-tight truncate">
                127.0.0.1:{networkState?.proxyPort ?? 10800}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {isActive
                ? `Uptime ${formatUptime(networkState?.uptimeSeconds ?? 0)}`
                : 'Ready to route'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-border -mb-6 gap-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-(--text-secondary) hover:text-(--text)'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Bonded Connections
          </button>
          <button
            onClick={() => setActiveTab('flows')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'flows'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-(--text-secondary) hover:text-(--text)'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Live Traffic Flows (
            {networkState?.recentFlows?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-(--text-secondary) hover:text-(--text)'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" /> Bonding Strategy & Options
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {networkState?.errorMessage && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2 font-semibold">
              <Power className="h-4 w-4" />
              <span>Virtual Network Gateway Notice</span>
            </div>
            <p className="mt-1 text-[11px] opacity-90">{networkState.errorMessage}</p>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Physical Network Adapters</h2>
                <p className="text-xs text-(--text-secondary)">
                  Toggle which connections contribute to the bonded device pipeline
                </p>
              </div>
              <button
                onClick={() => void fetchState()}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-(--bg-secondary) px-3 py-1.5 text-xs font-medium hover:bg-secondary cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {networkState?.interfaces && networkState.interfaces.length > 0 ? (
                networkState.interfaces.map((iface) => {
                  const ifaceDl = formatSpeed(iface.downloadSpeed)
                  const ifaceUl = formatSpeed(iface.uploadSpeed)
                  const totalIfaceSpeed = iface.downloadSpeed + iface.uploadSpeed
                  const contributionPct =
                    totalSpeedForContribution > 0
                      ? Math.min(
                          100,
                          Math.round((totalIfaceSpeed / totalSpeedForContribution) * 100)
                        )
                      : 0

                  return (
                    <div
                      key={iface.id}
                      className={`rounded-xl border p-5 transition-all duration-200 ${
                        iface.enabled
                          ? 'border-border bg-(--bg-secondary) shadow-xs'
                          : 'border-(--border)/60 bg-(--bg-secondary)/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-border">
                            {getInterfaceIcon(iface.kind)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold truncate max-w-50">
                                {iface.displayName}
                              </h3>
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono font-semibold text-(--text-secondary)">
                                {iface.device}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-(--text-secondary) font-mono">
                              <span>{iface.latencyMs} ms ping</span>
                              <span>•</span>
                              <span>
                                {iface.activeFlows} active stream
                                {iface.activeFlows === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={iface.enabled}
                            onChange={(e) => void toggleInterface(iface.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                      </div>

                      {/* Speed Metrics */}
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-background p-3 border border-(--border-subtle)">
                        <div>
                          <div className="text-[10px] font-medium text-(--text-secondary) flex items-center gap-1">
                            <ArrowDown className="h-3 w-3 text-emerald-500" /> Download
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-semibold">
                            {ifaceDl.value}{' '}
                            <span className="text-[10px] text-(--text-secondary)">
                              {ifaceDl.unit}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium text-(--text-secondary) flex items-center gap-1">
                            <ArrowUp className="h-3 w-3 text-blue-500" /> Upload
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-semibold">
                            {ifaceUl.value}{' '}
                            <span className="text-[10px] text-(--text-secondary)">
                              {ifaceUl.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contribution Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-(--text-secondary) mb-1">
                          <span>Bandwidth Contribution</span>
                          <span className="font-semibold">{contributionPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${contributionPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-(--text-secondary)">
                  Scanning for network interfaces... Connect Wi-Fi, Ethernet, or USB Tethering.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Traffic Flows */}
        {activeTab === 'flows' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Real-time Traffic Dispatcher</h2>
                <p className="text-xs text-(--text-secondary)">
                  Active TCP & UDP streams being parallelized across physical interfaces
                </p>
              </div>
              <span className="text-xs font-mono text-(--text-secondary)">
                {networkState?.recentFlows?.length ?? 0} recorded flows
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-(--bg-secondary) shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-(--bg-tertiary)/50 font-semibold text-(--text-secondary)">
                  <tr>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Assigned Adapter</th>
                    <th className="px-4 py-3">Protocol</th>
                    <th className="px-4 py-3">Transferred</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-subtle) font-mono">
                  {networkState?.recentFlows && networkState.recentFlows.length > 0 ? (
                    networkState.recentFlows.map((flow) => (
                      <tr key={flow.id} className="hover:bg-background transition-colors">
                        <td className="px-4 py-2.5 font-medium text-(--text)">
                          {flow.targetHost}:{flow.targetPort}
                        </td>
                        <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          {flow.interfaceName}
                        </td>
                        <td className="px-4 py-2.5 text-(--text-secondary)">
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                            {flow.protocol}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-(--text-secondary)">
                          {formatBytes(flow.bytesTransferred)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              flow.state === 'active'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-500/15 text-slate-500'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                flow.state === 'active'
                                  ? 'bg-emerald-500 animate-pulse'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {flow.state}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-(--text-secondary)"
                      >
                        No active flows yet. Start browsing or downloading to see parallel
                        connections routed!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-bold">Bonding Strategy</h2>
              <p className="text-xs text-(--text-secondary)">
                Choose how new network flows are balanced across your available connections
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: 'weighted-speed',
                  title: 'Dynamic Speed-Weighted (Recommended)',
                  desc: 'Streams are distributed proportionally based on real-time link speeds. Faster networks handle more traffic automatically.'
                },
                {
                  id: 'round-robin',
                  title: 'Equal Round-Robin',
                  desc: 'Every new TCP/UDP stream is alternated 1:1 across all active connections evenly.'
                },
                {
                  id: 'lowest-latency',
                  title: 'Lowest Latency First',
                  desc: 'New connections are sent to the connection with the lowest ping. Ideal for gaming or responsive web browsing.'
                }
              ].map((strat) => (
                <div
                  key={strat.id}
                  onClick={() => void setStrategy(strat.id as BondingStrategy)}
                  className={`flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                    networkState?.strategy === strat.id
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                      : 'border-border bg-(--bg-secondary) hover:bg-secondary'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={networkState?.strategy === strat.id}
                    onChange={() => void setStrategy(strat.id as BondingStrategy)}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <h3 className="text-sm font-semibold">{strat.title}</h3>
                    <p className="text-xs text-(--text-secondary) mt-0.5">{strat.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <h2 className="text-base font-bold">Virtual Network Routing Mode</h2>
              <p className="text-xs text-(--text-secondary)">
                Select how the virtual network intercepts device network traffic
              </p>

              <div className="mt-3 space-y-3">
                <div
                  onClick={() => void setMode('system-proxy')}
                  className={`flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                    networkState?.mode === 'system-proxy'
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                      : 'border-border bg-(--bg-secondary) hover:bg-secondary'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    checked={networkState?.mode === 'system-proxy'}
                    onChange={() => void setMode('system-proxy')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <h3 className="text-sm font-semibold">Automatic System-Wide Virtual Network</h3>
                    <p className="text-xs text-(--text-secondary) mt-0.5">
                      Automatically routes all browser, system, and application traffic through the
                      combined multi-network pipeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h2 className="text-base font-bold">Virtual Network Adapter Status</h2>
              <p className="text-xs text-(--text-secondary)">
                Status of the OS virtual network adapter, firewall rules, and multi-interface
                routing
              </p>

              <div className="mt-3 rounded-xl border border-border bg-(--bg-secondary) p-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background border border-border">
                      <Shield className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          Post-Install Virtual Adapter Setup
                        </span>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {adapterSetup?.status === 'ready' ? 'Ready & Configured' : 'Initializing'}
                        </span>
                      </div>
                      <p className="text-xs text-(--text-secondary) mt-0.5 font-mono">
                        {adapterSetup?.details || 'Virtual network adapter initialized'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void setupAdapter()}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" /> Verify Setup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
