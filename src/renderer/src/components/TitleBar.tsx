import { Download, Shield } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../theme'
import { useAppStore } from '../store/useAppStore'
import { useVirtualNetworkStore } from '../store/useVirtualNetworkStore'

const isMac = window.plexo.platform === 'darwin'

/** The window's title bar with drag region and central Virtual Network mode switcher. */
export function TitleBar(): React.JSX.Element {
  const appMode = useAppStore((s) => s.appMode)
  const setAppMode = useAppStore((s) => s.setAppMode)
  const isNetworkActive = useVirtualNetworkStore((s) => s.networkState?.status === 'active')

  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`flex shrink-0 items-center justify-between border-b-[0.5px] border-border bg-card [-webkit-app-region:drag] ${
        isMac ? 'px-4 pl-20' : 'px-4 pr-35'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="font-sans text-[13px] leading-none font-bold tracking-tight text-(--text)">
          Plexo
        </div>
      </div>

      {/* Mode Switcher Segmented Control */}
      <div className="flex items-center rounded-lg bg-(--bg-tertiary)/70 p-0.5 [-webkit-app-region:no-drag]">
        <button
          onClick={() => setAppMode('virtual-network')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
            appMode === 'virtual-network'
              ? 'bg-background text-(--text) shadow-xs'
              : 'text-(--text-secondary) hover:text-(--text)'
          }`}
        >
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span>Virtual Network</span>
          {isNetworkActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setAppMode('downloads')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
            appMode === 'downloads'
              ? 'bg-background text-(--text) shadow-xs'
              : 'text-(--text-secondary) hover:text-(--text)'
          }`}
        >
          <Download className="h-3.5 w-3.5 text-blue-500" />
          <span>Downloads</span>
        </button>
      </div>

      <div className="w-12" />
    </div>
  )
}
