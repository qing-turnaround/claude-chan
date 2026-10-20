<p align="center">
  <img src="app/build/icon.png" width="120" alt="クロードちゃん">
</p>

<h1 align="center">クロードちゃん</h1>

<p align="center">
  <b>Claude Code のためのアニメ風デスクトップマスコット。</b><br>
  デスクトップに住んで、Claude Code と一緒に働きます。<br>
  ツール実行中はノートPCをカタカタ、許可待ちでは手を挙げて、終わったらジャンプして大喜び。
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <b>日本語</b>
</p>

> 非公式のファンメイドプロジェクトです。Anthropic とは関係ありません。

<table align="center">
  <tr>
    <td align="center"><img src="docs/cheer.gif" width="150"><br>バンザイ</td>
    <td align="center"><img src="docs/wave.gif" width="150"><br>あいさつ</td>
    <td align="center"><img src="docs/stretch.gif" width="150"><br>のび</td>
    <td align="center"><img src="docs/eat.gif" width="150"><br>おにぎり</td>
    <td align="center"><img src="docs/walk.gif" width="150"><br>おさんぽ</td>
  </tr>
</table>

## Claude Code との連動

<p align="center"><img src="docs/states.gif" width="180"></p>

| Claude Code が… | 彼女は… |
|---|---|
| 考え中・ツール実行中 | あぐらでノートPCをタイピング |
| 権限の許可待ち | 手を挙げて「!」の吹き出し |
| ひと区切り完了 | ジャンプしてバンザイ |

複数のセッションを同時に開いても大丈夫。どれか一つでも許可待ちなら手を挙げ、すべて終わったときだけバンザイします。

### ペットから直接承認

Claude Code が許可を求めると、彼女の横にカードが出ます。実行するコマンドや、変更するファイルと変更行が表示され、**許可**・**常に許可**（Claude Code が提案するルール）・**拒否** をそのままクリックできます。ターミナルに切り替える必要はありません。Claude Code から質問されたときは、カードに選択肢が並び、その場で答えられます。ターミナルで答えても大丈夫で、カードは自動で消えます。ペットが起動していないときは、いつも通りターミナルで聞かれます。

## そのほか

- ひまなときは歩き回ったり、考えごとをしたり、おにぎりを食べたり、のびをしたり、手を振ったり
- クリックすると喜びます。つまみ上げると振り子のように揺れ、投げるとデスクトップに着地します
- パソコンから 5 分離れると、あくびをして眠ります。戻ると起きます
- 反応するのは彼女自身のピクセルだけ。周りの透明部分はクリックを邪魔しません
- 5 つ目の衣装 **Clawd** にすると、彼女の代わりに Claude Code のマスコットが登場します。赤と、花を付けたピンク（どちらか 1 匹でも 2 匹一緒でも）が画面のふちを歩き回り、壁をのぼり、上辺は逆さまに進みます。Claude Code の作業中は、赤い子が小さなノートパソコンでタイピングし、ピンクの子が手伝います。旗で応援したり、コーヒーを運んだり、Claude Code が 1 ステップ終えるごとにコードブロックを運んで積み上げたり。承認待ちでは「!」と手を挙げ、完了すると積んだブロックがきらめいて消え、2 匹でバンザイ。何もないときは少し歩いてはひと休み（座る、見回す、のび、うたた寝）、席を離れるとその場で眠ります。つまんで投げると落ちてつぶれ、目を回します。壁のそばで放すと壁にしがみつきます。目はカーソルを追い、表情は状態に合わせて変わります。ときどき追いかけっこをしたり、手をつないで歩いたり、片方がもう片方の頭に乗ったりします。右クリックでメニューが開きます。

## 着せ替え

右クリック →「着せ替え」で切り替え。どの衣装にもポーズ・歩行・アクションクリップが一式そろっています。

| パーカー | 学者 |
|:---:|:---:|
| <img src="docs/character-sheets/hoodie.webp" width="420"> | <img src="docs/character-sheets/scholar.webp" width="420"> |
| **メイド** | **星の精** |
| <img src="docs/character-sheets/maid.webp" width="420"> | <img src="docs/character-sheets/spirit.webp" width="420"> |

## インストール

[Releases](../../releases) からダウンロード：

| | ファイル |
|---|---|
| **Windows** 10 / 11 | `Claude-chan-Setup-x.y.z-x64.exe`（ARM PC は `-arm64.exe`） |
| **macOS**（Apple シリコン） | `Claude-chan-x.y.z-arm64.dmg` |
| **macOS**（Intel） | `Claude-chan-x.y.z-x64.dmg` |
| **Linux** | `Claude-chan-x.y.z-x86_64.AppImage` または `Claude-chan-x.y.z-amd64.deb` |

まだ Microsoft / Apple の署名がありません：

- **Windows**：「Windows によって PC が保護されました」と出たら **詳細情報 → 実行**。
- **macOS**：初回はブロックされます。**システム設定 → プライバシーとセキュリティ** で **このまま開く** を押すか、`xattr -dr com.apple.quarantine /Applications/Claude-chan.app` を実行してください。
- **Linux**：AppImage は `chmod +x` してから実行、または `sudo apt install ./Claude-chan-*.deb`。透過にはコンポジタが必要です。Wayland では XWayland 経由で動きます。Linux の Electron はピクセル単位のクリック透過ができないため、キャラクターまわりの小さな枠がマウスを受け取ります。スタートアップ起動は使えません。

承認カードには Claude Code **2.1.113 以降** が必要です（それより古いバージョンでは、ペットを閉じているときに権限 hook の失敗が拒否扱いになります）。

インストール後、彼女を右クリックして **Claude Code と連動**にチェックを入れると、`~/.claude/settings.json` に 7 つの hook が追加されます。

- OS 標準の `curl` でイベントを転送するので Node は不要です。マスコットが起動していないときは何もせず、エラーにもなりません
- 初回の変更前に `settings.json.claude-chan.bak` としてバックアップします
- チェックを外すとアンインストール。追加した hook だけを削除し、ほかの設定には触れません

右クリックメニューには、アクション、自由に歩く、「設定…」があります。設定ウィンドウでは、着せ替え、サイズのスライダー（50〜200%、ドラッグ中もリアルタイムに反映）、自由に歩く（オフにするとその場にとどまり、Claude Code への反応だけ続けます）、スタートアップ起動（初期値オフ）、言語を変更できます。表示はシステムの言語（日本語 / English / 简体中文 / 繁體中文）に合わせます。

## 開発

```bash
cd app
npm install
npx electron .        # 起動
npm run dist          # Windows インストーラーを app/dist/ に作成
```

ローカルエンドポイント `127.0.0.1:47823`：`POST /hook`（Claude Code hook の stdin そのまま）、`POST /permission`（承認カード用の hook）、`POST /state`（`{"state":"work"|"wait"|"done"|"idle"}`、ほかのツール向け）。ブラウザからのリクエストは拒否します。テスト用のエンドポイントは `PET_DEBUG` を設定したときだけ有効です。

## 素材の作り方

- **立ち絵とポーズ**：キャラクター設定画を参照に gpt-image-2 でグリーンバック画像を生成し、`art/process.py` で切り抜いて髪の幅でサイズをそろえます
- **歩行**：横向きの歩行 4 コマを 1 枚に生成し、`art/process_walk.py` で切り分けて頭の位置でそろえます
- **アクションクリップ**：MiniMax H3 の最初/最後のフレーム指定による画像→動画生成。**最初と最後のフレームはどちらも待機ポーズ**なので、どのアクションも待機から始まって待機に戻り、つなぎ目なく切り替わります。`art/process_video.py` で全フレームを切り抜いて WebP に変換します
- プロンプトは `h3/*.txt` にあります（リポジトリ内は英訳です。このクリップは中国語の原文で生成しました。H3 のテキストエンコーダーは Qwen ベースで、検証では中国語のほうが指示に忠実でした）

## ライセンス

- コード：MIT
- キャラクターデザインと素材：CC BY-NC 4.0（クレジット表記のうえ二次創作歓迎、商用利用不可）

「Claude」は Anthropic の商標です。Clawd は Anthropic の Claude Code マスコットで、ここの 2 匹はコードで描いたファンアートです。
