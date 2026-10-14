<p align="center">
  <img src="build/icon.png" width="128" alt="Plexo icon">
</p>

<h1 align="center">Plexo</h1>

<p align="center">
  Download files and torrents faster by combining all your internet connections.<br>
  Plexo combines Wi-Fi, Ethernet, mobile networks, and other available connections to boost your download speeds.
</p>

<p align="center">
  <a href="https://getplexo.app">Download</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#build-from-source">Build</a> ·
  <a href="https://github.com/sponsors/anmolkapil">Sponsor</a>
</p>

<p align="center">
  <a href="https://github.com/anmolkapil/plexo/releases/latest"><img src="https://img.shields.io/github/v/release/anmolkapil/plexo?label=release" alt="Latest release"></a>
  <a href="https://github.com/anmolkapil/plexo/releases"><img src="https://img.shields.io/github/downloads/anmolkapil/plexo/total" alt="Downloads"></a>
  <a href="https://github.com/anmolkapil/plexo/actions/workflows/ci.yml"><img src="https://github.com/anmolkapil/plexo/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <a href="https://getplexo.app/#downloads"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-black" alt="macOS, Windows and Linux"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/anmolkapil/plexo" alt="MIT license"></a>
</p>

https://github.com/user-attachments/assets/e57728f4-fb63-441f-839c-174eef954b17


## Features

### Combine your connections

- **Every network at once.** Download one file over Wi-Fi, Ethernet and a tethered phone together, and their speeds add up. No VPN or driver required.
- **Smart splitting.** The faster network takes on more of the file, so a slow one never holds the download back.
- **Fast to the finish.** Lagging pieces near the end are fetched again on a free connection, so downloads don't crawl at 99%.
- **Adapts as it goes.** Eases off when a server or a hard drive can't keep up, then speeds back up.

### Downloads that don't break

- **Pause and resume.** Stop any download and pick it up later, even after restarting your computer.
- **Picks up after sleep.** Downloads carry on by themselves when your computer wakes, and Plexo keeps it awake while they run.
- **Fix expired links.** Paste a fresh link to the same file and the download continues where it stopped.
- **No corrupt files.** If the file changed on the server, Plexo tells you instead of joining two versions.

### Torrents

- **Magnet links and `.torrent` files.** Paste a link or open a file, and the torrent downloads over all your networks.
- **Choose files.** Pick what to download before it starts, and change your mind while it runs.
- **Your torrent app stays the default.** Plexo never takes over magnet links or `.torrent` files.

### Speed, data and schedule

- **Speed limits.** Cap all downloads or one network, or switch on Slow mode while you're on a call.
- **Data allowances.** Set a daily, weekly or monthly limit per network, so your mobile plan lasts.
- **Schedule.** Run downloads only in a time window, such as a free-data night plan.
- **Queue.** Add as many downloads as you like, and up to four run at once.

### Everyday comforts

- **Browser extension.** Send downloads from Chrome straight to Plexo, including files behind a login. Get it on the [Chrome Web Store](https://chromewebstore.google.com/detail/giejimhiglmjfhbjkikgobbcinpgacmg).
- **Live view.** Watch each network's speed, with names you recognize, like Wi-Fi or iPhone, that you can rename and recolor.
- **Notifications.** Know when a download finishes or fails.
- **Automatic updates.** New versions download in the background and install when you restart.

## Troubleshooting

If your problem isn't covered here, [open an issue](https://github.com/anmolkapil/plexo/issues).

<details>
<summary><strong>Windows says "Windows protected your PC"</strong></summary>
<br>

The installer isn't code-signed yet. Click **More info**, then **Run anyway**.

</details>

<details>
<summary><strong>A second network doesn't make downloads faster</strong></summary>
<br>

Plexo adds speed only when each network reaches the internet through its own connection. Wi-Fi from your home router plus a phone tethered over USB works. Wi-Fi and Ethernet plugged into the same router doesn't: both share one connection, so the total stays the same.

VPN, virtual, and isolated adapters show up in Plexo too, so check each network's latency and speed there.

</details>

<details>
<summary><strong>A network doesn't appear in Plexo</strong></summary>
<br>

Plexo can use any connection your operating system shows as a network adapter.

- **iPhone on macOS**: in **System Settings › Network**, open **iPhone USB** and turn off **Disable unless needed**
- **Android on macOS**: install TetherKit, as described below
- **Phone on Windows**: install your phone maker's driver if the phone doesn't appear in Network Settings

</details>

<details>
<summary><strong>Windows uses only one network</strong></summary>
<br>

If Windows turns Wi-Fi off when Ethernet is plugged in, open the Group Policy Editor (`gpedit.msc`), go to _Computer Configuration_ › _Administrative Templates_ › _Network_ › _Windows Connection Manager_, and set **Minimize the number of simultaneous connections to the Internet or a Windows domain** to **Disabled**.

If both stay connected but one sits idle in Plexo, Windows may be sending its traffic out the other network. Add your setup to [#65](https://github.com/anmolkapil/plexo/issues/65).

</details>

<details>
<summary><strong>A network stays idle after reconnecting a phone</strong></summary>
<br>

Pause the download, then resume it.

</details>

<details>
<summary><strong>Downloads to a hard drive are slow</strong></summary>
<br>

Leave **Streams** on **Auto** in **New download**. Auto lowers the streams when the disk can't keep up; a fixed number doesn't.

</details>

### Use an Android phone over USB on macOS

macOS has no driver for RNDIS, the protocol Android's USB tethering uses, so the phone charges but no network adapter appears. [TetherKit](https://github.com/XiaoMiku01/TetherKit) is an open-source app that adds one without a kernel extension.

1. Install TetherKit: `brew install XiaoMiku01/tap/tetherkit`
2. Connect your phone over USB.
3. On the phone, open **Settings › Network & internet › Hotspot & tethering** and turn on **USB tethering**.
4. Open TetherKit. On first run, approve its helper with your password.
5. Pick your phone, click **Connect**, then apply the IP settings.
6. Open Plexo. The phone appears in the networks list.

Thanks to [@XiaoMiku01](https://github.com/XiaoMiku01) for building and open-sourcing TetherKit.

## How it works

Your computer sends everything through one network, even when several are connected. Plexo opens its own connections on each network you pick and splits the download between them.

```text
              ┌── Wi-Fi ─────── blocks 1, 3, 4, 6 ──┐
file.iso ─────┤                                     ├──→ file.iso
              └── USB tether ── blocks 2, 5 ────────┘
```

- **Direct downloads**: the file is cut into blocks, and each network fetches several at once using HTTP range requests. A connection that finishes takes the next block, so a faster network ends up doing more.
- **Torrents**: each peer connects through one of your networks, and new peers go to the one with the fewest.

Plexo combines networks for its own downloads only, not for other apps. It installs no VPN, driver, or kernel extension, and needs no administrator rights.

## Build from source

You need Node.js 22.12 or later and npm 9 or later.

```bash
git clone https://github.com/anmolkapil/plexo.git
cd plexo
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run test:e2e:smoke` | Playwright smoke tests |
| `npm run test:e2e` | The full end-to-end suite |
| `npm run build:mac` | Writes `dist/mac/Plexo.app` |
| `npm run build:win` | Writes the Windows installer to `dist/` (run from PowerShell) |
| `npm run build:unpack` | Writes a portable `dist/win-unpacked/plexo.exe` |
| `npm run build:linux` | Writes the AppImage and `.deb` packages to `dist/` |

Local builds are unsigned. [CONTRIBUTING.md](CONTRIBUTING.md#end-to-end-tests) covers test options and debugging flags.

Plexo is built with Electron, React 19, TypeScript, Tailwind CSS v4, Base UI, Zustand, WebTorrent, and Lucide icons.

## Contributing

Contributions are welcome. Areas that need help:

- Download and torrent throughput
- Network adapter names on Linux
- Testing with 5G tethering, Wi-Fi 6, and 10 GbE
- The interface and documentation

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, code style, and how to open a pull request. Have an idea? [Suggest a feature](https://github.com/anmolkapil/plexo/issues).

## Acknowledgements

Special thanks to [Dhananjay Bhosale](https://github.com/DhananjayBhosale) for code signing and notarizing the macOS app.

## License

[MIT](LICENSE), copyright 2026 Anmol Kapil.
