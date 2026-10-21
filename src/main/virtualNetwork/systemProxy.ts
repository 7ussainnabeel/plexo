import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Manages OS-level system proxy settings across macOS, Windows, and Linux
 * so all system applications automatically route through Plexo's Virtual Network.
 */
export class SystemProxyManager {
  private isConfigured = false
  private configuredServices: string[] = []

  /**
   * Enables system proxy on the host OS.
   */
  async enable(port: number): Promise<boolean> {
    try {
      if (process.platform === 'darwin') {
        return await this.enableMac(port)
      } else if (process.platform === 'win32') {
        return await this.enableWindows(port)
      } else if (process.platform === 'linux') {
        return await this.enableLinux(port)
      }
      return false
    } catch (error) {
      console.error('[plexo:virtualNetwork] Failed to enable system proxy:', error)
      return false
    }
  }

  /**
   * Disables system proxy and restores normal OS routing.
   */
  async disable(): Promise<boolean> {
    if (!this.isConfigured) return true
    try {
      if (process.platform === 'darwin') {
        await this.disableMac()
      } else if (process.platform === 'win32') {
        await this.disableWindows()
      } else if (process.platform === 'linux') {
        await this.disableLinux()
      }
      this.isConfigured = false
      return true
    } catch (error) {
      console.error('[plexo:virtualNetwork] Failed to disable system proxy:', error)
      return false
    }
  }

  // --- macOS Implementation ---
  private async getMacNetworkServices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('networksetup -listallnetworkservices')
      return stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 0 &&
            !s.includes('An asterisk (*) denotes that a network service is disabled.')
        )
    } catch {
      return ['Wi-Fi', 'Ethernet']
    }
  }

  private async enableMac(port: number): Promise<boolean> {
    const services = await this.getMacNetworkServices()
    this.configuredServices = []

    for (const service of services) {
      try {
        // Set bypass domains so local loopback traffic never gets intercepted or looped
        await execAsync(
          `networksetup -setproxybypassdomains "${service}" 127.0.0.1 localhost *.local 169.254/16`
        ).catch(() => {})
        // Configure Web Proxy (HTTP), Secure Web Proxy (HTTPS), and SOCKS Firewall Proxy
        await execAsync(`networksetup -setwebproxy "${service}" 127.0.0.1 ${port}`)
        await execAsync(`networksetup -setsecurewebproxy "${service}" 127.0.0.1 ${port}`)
        await execAsync(`networksetup -setsocksfirewallproxy "${service}" 127.0.0.1 ${port}`)
        await execAsync(`networksetup -setwebproxystate "${service}" on`)
        await execAsync(`networksetup -setsecurewebproxystate "${service}" on`)
        await execAsync(`networksetup -setsocksfirewallproxystate "${service}" on`)
        this.configuredServices.push(service)
      } catch {
        // Some virtual or unplumbed network services might fail; continue with active physical services
      }
    }

    this.isConfigured = this.configuredServices.length > 0
    return this.isConfigured
  }

  private async disableMac(): Promise<void> {
    const services = await this.getMacNetworkServices()
    for (const service of services) {
      try {
        await execAsync(`networksetup -setwebproxystate "${service}" off`).catch(() => {})
        await execAsync(`networksetup -setsecurewebproxystate "${service}" off`).catch(() => {})
        await execAsync(`networksetup -setsocksfirewallproxystate "${service}" off`).catch(() => {})
      } catch {
        // Ignore cleanup errors
      }
    }
    this.configuredServices = []
  }

  // --- Windows Implementation ---
  private async enableWindows(port: number): Promise<boolean> {
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:${port}" /f && reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`
    await execAsync(regCmd)
    this.isConfigured = true
    return true
  }

  private async disableWindows(): Promise<void> {
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`
    await execAsync(regCmd)
  }

  // --- Linux Implementation ---
  private async enableLinux(port: number): Promise<boolean> {
    try {
      await execAsync(`gsettings set org.gnome.system.proxy mode 'manual'`)
      await execAsync(`gsettings set org.gnome.system.proxy.http host '127.0.0.1'`)
      await execAsync(`gsettings set org.gnome.system.proxy.http port ${port}`)
      await execAsync(`gsettings set org.gnome.system.proxy.https host '127.0.0.1'`)
      await execAsync(`gsettings set org.gnome.system.proxy.https port ${port}`)
      await execAsync(`gsettings set org.gnome.system.proxy.socks host '127.0.0.1'`)
      await execAsync(`gsettings set org.gnome.system.proxy.socks port ${port}`)
      this.isConfigured = true
      return true
    } catch {
      return false
    }
  }

  private async disableLinux(): Promise<void> {
    try {
      await execAsync(`gsettings set org.gnome.system.proxy mode 'none'`)
    } catch {
      // Ignore
    }
  }
}
