<p align="center">
  <img src="app/build/icon.png" width="120" alt="Claude-chan">
</p>

<h1 align="center">Claude-chan</h1>

<p align="center">
  <b>A desktop pet that shows what Claude Code is doing.</b><br>
  She lives on your desktop and works alongside Claude Code: typing while it runs tools,<br>
  raising her hand when it needs your approval, and cheering when it's done.
</p>

<p align="center">
  <b>English</b> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.ja.md">日本語</a>
</p>

> Unofficial fan project. Not affiliated with Anthropic.

<table align="center">
  <tr>
    <td align="center"><img src="docs/cheer.gif" width="150"><br>Cheer</td>
    <td align="center"><img src="docs/wave.gif" width="150"><br>Wave</td>
    <td align="center"><img src="docs/stretch.gif" width="150"><br>Stretch</td>
    <td align="center"><img src="docs/eat.gif" width="150"><br>Snack</td>
    <td align="center"><img src="docs/walk.gif" width="150"><br>Walk</td>
  </tr>
</table>

## Works with Claude Code

<p align="center"><img src="docs/states.gif" width="180"></p>

| When Claude Code is… | She… |
|---|---|
| thinking or running tools | sits cross-legged, typing on her laptop |
| waiting for your permission | raises her hand with a "!" bubble |
| done with a turn | jumps up and cheers |

Running several sessions at once is fine: if any session is waiting for you, she raises her hand; she only cheers once all of them are done.

### Approve right from the pet

When Claude Code asks for permission, a card pops up next to her: the command, or the file and the lines being changed.

- Click **Allow**, **Always allow** (with the rule Claude Code suggests) or **Deny**, without switching to the terminal
- Even quicker: while she raises her hand, **double-click her head** to allow it once (you can turn this off in Settings)
- When Claude Code asks you a question, the card shows the options and you answer there

Answering in the terminal still works; the card goes away by itself, and if the pet isn't running Claude Code just asks in the terminal as usual.

## Outfits

Five outfits. Right-click → **Outfit** to switch, or pick one in **Settings…**. The four Claude-chan outfits each have the full set of poses, walk cycle and action clips.

| Hoodie | Scholar |
|:---:|:---:|
| <img src="docs/character-sheets/hoodie.webp" width="420"> | <img src="docs/character-sheets/scholar.webp" width="420"> |
| **Maid** | **Spark Spirit** |
| <img src="docs/character-sheets/maid.webp" width="420"> | <img src="docs/character-sheets/spirit.webp" width="420"> |

**Clawd**: the fifth outfit swaps her for Claude Code's mascot, a red one and a pink one with a flower (show either or both).

<p align="center"><img src="docs/clawd.gif" width="480"></p>

- They crawl around the edges of your screen, up the walls and upside down across the top
- While Claude Code works, the red one types at a little laptop; the pink one cheers with a flag, fetches coffee, and hauls a code block onto a pile for every step. When it's done the pile sparkles away and they cheer
- When it needs your approval they raise a hand with a "!"; double-click the one raising its hand to approve
- Pick one up and throw it, and it falls, squashes and gets dizzy; let go next to a wall and it grabs on
- Now and then they chase each other, walk off hand in hand, or one rides on the other's head
- When nothing is going on they wander a bit and rest a lot, and fall asleep when you step away

## Also

- Wanders around, thinks, snacks, stretches and waves when idle
- Click her and she's happy; pick her up and she swings like a pendulum; throw her and she lands back on your desktop
- Leave your computer for 5 minutes and she yawns and falls asleep; she wakes up when you're back
- Only her own pixels catch the mouse — the transparent area around her never blocks your clicks

## Install

Download from [Releases](../../releases):

| | File |
|---|---|
| **Windows** 10 / 11 | `Claude-chan-Setup-x.y.z-x64.exe` (`-arm64.exe` for ARM PCs) |
| **macOS** (Apple silicon) | `Claude-chan-x.y.z-arm64.dmg` |
| **macOS** (Intel) | `Claude-chan-x.y.z-x64.dmg` |
| **Linux** | `Claude-chan-x.y.z-x86_64.AppImage` or `Claude-chan-x.y.z-amd64.deb` |

The builds aren't signed by Microsoft / Apple yet:

- **Windows**: SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.
- **macOS**: the first open is blocked. Open **System Settings → Privacy & Security** and click **Open Anyway**, or run `xattr -dr com.apple.quarantine /Applications/Claude-chan.app`.
- **Linux**: `chmod +x` the AppImage and run it, or `sudo apt install ./Claude-chan-*.deb`. A compositing desktop is needed for transparency. On Wayland it runs through XWayland. Electron can't pass clicks through per pixel on Linux, so a small box around the character catches the mouse; launch at startup isn't available there.

Needs Claude Code **2.1.113 or newer** for the approval card (older versions turn a failed permission hook into a denial while the pet is closed).

## Getting started

1. Open it and she shows up at the bottom of your desktop.
2. **Right-click her → check Link Claude Code**. From then on she reacts when Claude Code works, asks for permission, or finishes.
3. To change outfits, resize her or stop her wandering: **right-click her → Settings…**.

**Link Claude Code** adds 7 hooks to `~/.claude/settings.json`:

- They use the system's built-in `curl` to forward events, so Node is not required. If the pet isn't running, they do nothing and never error.
- Your settings file is backed up to `settings.json.claude-chan.bak` before the first change.
- Uncheck to uninstall. Only her own hooks are removed; everything else is left untouched.

## Right-click menu and Settings

Everything starts with **right-clicking her** (with Clawd, right-click either one).

| Menu | What it does |
|---|---|
| Actions | Play an action: think, snack, stretch, sleep… (not in the Clawd outfit) |
| Work status | Switch to Working / Waiting for you / Done by hand to see how it looks |
| Outfit | The five outfits; with Clawd, also which ones to show |
| Link Claude Code | Install / remove the hooks |
| Free roaming | When off, stays put and still reacts to Claude Code |
| **Settings…** | Open the Settings window |
| Quit | |

<img src="docs/settings-en.png" width="300" align="right" alt="Settings window">

In Settings:

- **Outfit**, and which Clawds to show
- **Size**: a 50–200% slider, the pet follows it live; ↺ resets it
- **Free roaming**, **Link Claude Code**
- **Double-click to approve**: on by default
- **Launch at startup**: off by default
- **Language**: follows your system (English / 简体中文 / 繁體中文 / 日本語) unless you pick one

<br clear="right">

## Development

```bash
cd app
npm install
npx electron .        # run
npm run dist          # build the Windows installer into app/dist/
```

Local endpoint `127.0.0.1:47823`: `POST /hook` (raw Claude Code hook stdin), `POST /permission` (the approval-card hook), `POST /state` (`{"state":"work"|"wait"|"done"|"idle"}`, for other tools). Requests from web browsers are refused. Test helpers exist only when `PET_DEBUG` is set.


## License

- Code: MIT
- Character design and art assets: CC BY-NC 4.0 (fan art welcome with credit; no commercial use)

"Claude" is a trademark of Anthropic. Clawd is Anthropic's Claude Code mascot; the buddies here are fan art drawn in code.
