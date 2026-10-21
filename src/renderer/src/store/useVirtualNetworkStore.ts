import { create } from 'zustand'
import type { BondingStrategy, VirtualNetworkMode, VirtualNetworkState } from '@shared/types'

interface VirtualNetworkStore {
  networkState: VirtualNetworkState | null
  loading: boolean
  activeTab: 'overview' | 'interfaces' | 'flows' | 'settings'
  setActiveTab: (tab: 'overview' | 'interfaces' | 'flows' | 'settings') => void
  fetchState: () => Promise<void>
  start: (mode?: VirtualNetworkMode) => Promise<void>
  stop: () => Promise<void>
  setStrategy: (strategy: BondingStrategy) => Promise<void>
  setMode: (mode: VirtualNetworkMode) => Promise<void>
  toggleInterface: (interfaceId: string, enabled: boolean) => Promise<void>
  setupAdapter: () => Promise<void>
  receiveUpdate: (state: VirtualNetworkState) => void
}

export const useVirtualNetworkStore = create<VirtualNetworkStore>((set, get) => ({
  networkState: null,
  loading: false,
  activeTab: 'overview',

  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchState: async () => {
    try {
      const state = await window.plexo.getVirtualNetworkState()
      set({ networkState: state })
    } catch (err) {
      console.error('[plexo] Failed to fetch virtual network state:', err)
    }
  },

  start: async (mode?: VirtualNetworkMode) => {
    set({ loading: true })
    try {
      const updated = await window.plexo.startVirtualNetwork(mode)
      set({ networkState: updated, loading: false })
    } catch (err) {
      console.error('[plexo] Failed to start virtual network:', err)
      set({ loading: false })
    }
  },

  stop: async () => {
    set({ loading: true })
    try {
      const updated = await window.plexo.stopVirtualNetwork()
      set({ networkState: updated, loading: false })
    } catch (err) {
      console.error('[plexo] Failed to stop virtual network:', err)
      set({ loading: false })
    }
  },

  setStrategy: async (strategy: BondingStrategy) => {
    await window.plexo.setBondingStrategy(strategy)
    const current = get().networkState
    if (current) {
      set({ networkState: { ...current, strategy } })
    }
  },

  setMode: async (mode: VirtualNetworkMode) => {
    await window.plexo.setBondingMode(mode)
    const current = get().networkState
    if (current) {
      set({ networkState: { ...current, mode } })
    }
  },

  toggleInterface: async (interfaceId: string, enabled: boolean) => {
    await window.plexo.toggleBondingInterface(interfaceId, enabled)
    const current = get().networkState
    if (current) {
      const updatedInterfaces = current.interfaces.map((iface) =>
        iface.id === interfaceId ? { ...iface, enabled } : iface
      )
      set({ networkState: { ...current, interfaces: updatedInterfaces } })
    }
  },

  setupAdapter: async () => {
    try {
      const info = await window.plexo.setupVirtualNetworkAdapter()
      const current = get().networkState
      if (current) {
        set({ networkState: { ...current, adapterSetup: info } })
      }
    } catch (err) {
      console.error('[plexo] Failed to setup virtual network adapter:', err)
    }
  },

  receiveUpdate: (networkState: VirtualNetworkState) => {
    set({ networkState, loading: false })
  }
}))
