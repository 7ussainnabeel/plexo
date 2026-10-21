import { useEffect } from 'react'
import { useVirtualNetworkStore } from '../store/useVirtualNetworkStore'

export function useVirtualNetworkEvents(): void {
  const fetchState = useVirtualNetworkStore((s) => s.fetchState)
  const receiveUpdate = useVirtualNetworkStore((s) => s.receiveUpdate)

  useEffect(() => {
    void fetchState()
    const unsubscribe = window.plexo.onVirtualNetworkUpdated((state) => {
      receiveUpdate(state)
    })
    return () => {
      unsubscribe()
    }
  }, [fetchState, receiveUpdate])
}
