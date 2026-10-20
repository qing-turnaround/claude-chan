<p align="center">
  <img src="app/build/icon.png" width="120" alt="Claude-chan">
</p>

<h1 align="center">Claude-chan</h1>

<p align="center">
  <b>An anime desktop pet for Claude Code.</b><br>
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

When Claude Code asks for permission, a card pops up next to her: the command, or the file and the lines being changed. Click **Allow**, **Always allow** (with the rule Claude Code suggests) or **Deny**, without switching to the terminal. When Claude Code asks you a question, the card shows the options and you answer there. Answering in the terminal still works; the card goes away by itself, and if the pet isn't running Claude Code just asks in the terminal as usual.

## Also

- Wanders around, thinks, snacks, stretches and waves when idle
- Click her and she's happy; pick her up and she swings like a pendulum; throw her and she lands back on your desktop
- Leave your computer for 5 minutes and she yawns and falls asleep; she wakes up when you're back
- Only her own pixels catch the mouse — the transparent area around her never blocks your clicks
- A fifth outfit, **Clawd**, swaps her for Claude Code's mascot: a red one and a pink one with a flower (show either or both) crawling around the edges of your screen, up the walls and upside down across the top. While Claude Code works, the red one sits down at a little laptop and types, and the pink one helps: it cheers with a flag, fetches coffee, and hauls a code block onto a pile for every step Claude Code finishes. When it needs your approval they raise a hand with a "!"; when it's done the pile sparkles away and they cheer. When nothing is going on they wander a bit and rest a lot: sitting, looking around, stretching, dozing, and they fall asleep when you step away. Pick one up and throw it, and it falls, squashes and gets dizzy; let go next to a wall and it grabs on. Their eyes follow your cursor, and their faces change with what they're doing. Now and then they chase each other or one rides on the other's head. Right-click one for the menu.

## Outfits

Right-click → **Outfit** to switch. Every outfit has the full set of poses, walk cycle and action clips.

| Hoodie | Scholar |
|:---:|:---:|
| <img src="docs/character-sheets/hoodie.webp" width="420"> | <img src="docs/character-sheets/scholar.webp" width="420"> |
| **Maid** | **Spark Spirit** |
| <img src="docs/character-sheets/maid.webp" width="420"> | <img src="docs/character-sheets/spirit.webp" width="420"> |

## Install

**Windows** (10 / 11): download `Claude-chan-Setup-x.y.z.exe` from [Releases](../../releases) and run it. The installer isn't code-signed yet, so Windows SmartScreen may say "Windows protected your PC": click **More info → Run anyway**.

**macOS / Linux**: not yet. The code is mostly portable, but there are no builds and it hasn't been tested there (on Linux, click-through on the transparent window isn't supported by Electron).

Needs Claude Code **2.1.113 or newer** for the approval card (older versions turn a failed permission hook into a denial while the pet is closed).

Then right-click her and check **Link Claude Code**. This adds 7 hooks to `~/.claude/settings.json`:

- They use the system's built-in `curl` to forward events, so Node is not required. If the pet isn't running, they do nothing and never error.
- Your settings file is backed up to `settings.json.claude-chan.bak` before the first change.
- Uncheck to uninstall. Only her own hooks are removed; everything else is left untouched.

The right-click menu also has actions, free roaming and **Settings…**. The Settings window has the outfit picker, a size slider (50–200%, the pet follows it live), free roaming (when off, the pet stays put and still reacts to Claude Code), launch at startup (off by default) and language. Text follows your system language (English / 简体中文 / 繁體中文 / 日本語) unless you pick one.

## Development

```bash
cd app
npm install
npx electron .        # run
npm run dist          # build the Windows installer into app/dist/
```

Local endpoint `127.0.0.1:47823`: `POST /hook` (raw Claude Code hook stdin), `POST /permission` (the approval-card hook), `POST /state` (`{"state":"work"|"wait"|"done"|"idle"}`, for other tools). Requests from web browsers are refused. Test helpers exist only when `PET_DEBUG` is set.

## How the art was made

- **Poses**: gpt-image-2 renders each pose on a green screen using the character sheet as reference; `art/process.py` keys them out and normalizes size by hair width.
- **Walk cycle**: four side-view frames in one image; `art/process_walk.py` slices them and aligns by head position.
- **Action clips**: MiniMax H3 first/last-frame image-to-video. **Both the first and last frame are the idle pose**, so every action starts and ends at idle and blends in seamlessly. `art/process_video.py` keys every frame and exports WebP.
- Prompts live in `h3/*.txt` (English translations; the clips in this repo were generated from the Chinese originals, which H3's Qwen-based text encoder followed more closely in our tests).

## License

- Code: MIT
- Character design and art assets: CC BY-NC 4.0 (fan art welcome with credit; no commercial use)

"Claude" is a trademark of Anthropic. Clawd is Anthropic's Claude Code mascot; the buddies here are fan art drawn in code.
