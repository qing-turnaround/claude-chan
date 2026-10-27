// Menu and Settings text. Follows the system language by default (Simplified / Traditional Chinese, Japanese, English for everything else); can also be set manually in the menu
const STR = {
  zh: { actions: '动作', idle: '待机', think: '思考', eat: '吃饭团', stretch: '伸懒腰', yawn: '打哈欠', wave: '打招呼',
        sleep: '睡觉', done: '欢呼', walk: '走走', status: '工作状态', work: '工作中', wait: '等你确认', finish: '完成',
        link: '联动 Claude Code', size: '大小', roam: '自由走动', login: '开机自启', quit: '退出', cantEdit: '改不了',
        outfit: '换装', skins: { hoodie: '卫衣', scholar: '学者', maid: '女仆', spirit: '星芒精灵', clawd: 'Clawd' },
        language: '语言', auto: '跟随系统', clawd: { red: '红色', pink: '粉色' }, flight: '飞行', flights: { off: '不飞', wings: '像素翅膀', jets: '喷气', rotor: '竹蜻蜓' },
        settings: '设置…', title: '设置', secLook: '外观', secMove: '行为', secGeneral: '通用', who: '显示哪只', reset: '默认',
        roamHint: '关掉后原地待着，照样跟着 Claude Code 动', linkHint: '干活、等你批准、做完时都会跟着反应；关掉只是暂停',
        unhook: '从 Claude Code 移除', unhookHint: '删掉写进 ~/.claude/settings.json 的钩子', holiday: '节日装扮', holidayHint: '万圣节、圣诞节、春节期间自动换上', pat: '双击头批准', patHint: '她举手等批准时，双击她的头就允许一次',
        allow: '允许', deny: '拒绝', always: '始终允许', upCheck: '检查更新', upChecking: '正在检查…', upLatest: '已是最新版本', upError: '没连上，稍后会自动再试', upDev: '开发版不检查更新',
        upDownloading: '正在下载 {v}（{p}%）', upInstalling: '正在安装 {v}，马上重启…', upAvailable: '有新版本 {v}', upNow: '更新', upDownload: '去下载',
        upAvailableTitle: 'Claude-chan {v} 出新版了', upAvailableBody: '点这里查看',
        submit: '提交', prev: '上一题', next: '下一题', other: '其他：自己写…', toTerminal: '去终端回答', question: '有问题问你', },
  tw: { actions: '動作', idle: '待機', think: '思考', eat: '吃飯糰', stretch: '伸懶腰', yawn: '打哈欠', wave: '打招呼',
        sleep: '睡覺', done: '歡呼', walk: '走走', status: '工作狀態', work: '工作中', wait: '等你確認', finish: '完成',
        link: '連動 Claude Code', size: '大小', roam: '自由走動', login: '開機自動啟動', quit: '結束', cantEdit: '無法寫入',
        outfit: '換裝', skins: { hoodie: '帽T', scholar: '學者', maid: '女僕', spirit: '星芒精靈', clawd: 'Clawd' },
        language: '語言', auto: '跟隨系統', clawd: { red: '紅色', pink: '粉色' }, flight: '飛行', flights: { off: '不飛', wings: '像素翅膀', jets: '噴氣', rotor: '竹蜻蜓' },
        settings: '設定…', title: '設定', secLook: '外觀', secMove: '行為', secGeneral: '一般', who: '顯示哪隻', reset: '預設',
        roamHint: '關掉後原地待著，照樣跟著 Claude Code 動', linkHint: '工作、等你批准、完成時都會跟著反應；關掉只是暫停',
        unhook: '從 Claude Code 移除', unhookHint: '刪掉寫進 ~/.claude/settings.json 的鉤子', holiday: '節日裝扮', holidayHint: '萬聖節、聖誕節、春節期間自動換上', pat: '雙擊頭批准', patHint: '她舉手等批准時，雙擊她的頭就允許一次',
        allow: '允許', deny: '拒絕', always: '一律允許', upCheck: '檢查更新', upChecking: '正在檢查…', upLatest: '已是最新版本', upError: '沒連上，稍後會自動再試', upDev: '開發版不檢查更新',
        upDownloading: '正在下載 {v}（{p}%）', upInstalling: '正在安裝 {v}，馬上重新啟動…', upAvailable: '有新版本 {v}', upNow: '更新', upDownload: '去下載',
        upAvailableTitle: 'Claude-chan {v} 出新版了', upAvailableBody: '點這裡查看',
        submit: '送出', prev: '上一題', next: '下一題', other: '其他：自己寫…', toTerminal: '到終端機回答', question: '有問題問你', },
  ja: { actions: 'アクション', idle: '待機', think: '考えごと', eat: 'おにぎり', stretch: 'のび', yawn: 'あくび', wave: 'あいさつ',
        sleep: 'ねる', done: 'バンザイ', walk: 'おさんぽ', status: '作業状態', work: '作業中', wait: '許可待ち', finish: '完了',
        link: 'Claude Code と連動', size: 'サイズ', roam: '自由に歩く', login: 'スタートアップ起動', quit: '終了', cantEdit: '書き込めません',
        outfit: '着せ替え', skins: { hoodie: 'パーカー', scholar: '学者', maid: 'メイド', spirit: '星の精', clawd: 'Clawd' },
        language: '言語', auto: 'システムに合わせる', clawd: { red: 'レッド', pink: 'ピンク' }, flight: '飛行', flights: { off: '飛ばない', wings: 'ドット絵の羽', jets: 'ジェット', rotor: 'タケコプター' },
        settings: '設定…', title: '設定', secLook: '見た目', secMove: 'ふるまい', secGeneral: '一般', who: '表示する子', reset: '標準',
        roamHint: 'オフにするとその場にとどまり、Claude Code への反応だけ続けます', linkHint: '作業中・許可待ち・完了に合わせて反応します。オフは一時停止です',
        unhook: 'Claude Code から外す', unhookHint: '~/.claude/settings.json に入れた hook を削除します', holiday: '季節の衣装', holidayHint: 'ハロウィン・クリスマス・旧正月に自動で着替えます', pat: 'ダブルクリックで許可', patHint: '手を挙げて許可を待っているとき、頭をダブルクリックすると 1 回だけ許可します',
        allow: '許可', deny: '拒否', always: '常に許可', upCheck: 'アップデートを確認', upChecking: '確認中…', upLatest: '最新バージョンです', upError: '接続できませんでした。あとで自動で再試行します', upDev: '開発版は確認しません',
        upDownloading: '{v} をダウンロード中（{p}%）', upInstalling: '{v} をインストール中、まもなく再起動します…', upAvailable: '新しいバージョン {v}', upNow: '更新', upDownload: 'ダウンロード',
        upAvailableTitle: 'Claude-chan {v} が出ました', upAvailableBody: 'クリックで確認',
        submit: '送信', prev: '前へ', next: '次へ', other: 'その他：自由に入力…', toTerminal: 'ターミナルで答える', question: '質問があります', },
  en: { actions: 'Actions', idle: 'Idle', think: 'Think', eat: 'Snack', stretch: 'Stretch', yawn: 'Yawn', wave: 'Wave',
        sleep: 'Sleep', done: 'Cheer', walk: 'Walk', status: 'Work status', work: 'Working', wait: 'Waiting for you', finish: 'Done',
        link: 'Link Claude Code', size: 'Size', roam: 'Free roaming', login: 'Launch at startup', quit: 'Quit', cantEdit: 'Cannot write',
        outfit: 'Outfit', skins: { hoodie: 'Hoodie', scholar: 'Scholar', maid: 'Maid', spirit: 'Spark Spirit', clawd: 'Clawd' },
        language: 'Language', auto: 'System default', clawd: { red: 'Red', pink: 'Pink' }, flight: 'Flight', flights: { off: 'Off', wings: 'Pixel wings', jets: 'Jets', rotor: 'Propeller hat' },
        settings: 'Settings…', title: 'Settings', secLook: 'Look', secMove: 'Behavior', secGeneral: 'General', who: 'Which ones', reset: 'Default',
        roamHint: 'When off, stays put and still reacts to Claude Code', linkHint: 'Reacts while it works, when it needs your approval, and when it is done; off just pauses',
        unhook: 'Remove from Claude Code', unhookHint: 'Takes its hooks out of ~/.claude/settings.json', holiday: 'Holiday outfits', holidayHint: 'Put on for Halloween, Christmas and Lunar New Year', pat: 'Double-click to approve', patHint: 'While she raises her hand for approval, double-click her head to allow it once',
        allow: 'Allow', deny: 'Deny', always: 'Always allow', upCheck: 'Check for updates', upChecking: 'Checking…', upLatest: 'You have the latest version', upError: "Couldn't connect; will try again later", upDev: 'Not checked in a dev build',
        upDownloading: 'Downloading {v} ({p}%)', upInstalling: 'Installing {v}, restarting in a moment…', upAvailable: 'Version {v} is out', upNow: 'Update', upDownload: 'Download',
        upAvailableTitle: 'Claude-chan {v} is out', upAvailableBody: 'Click to take a look',
        submit: 'Submit', prev: 'Back', next: 'Next', other: 'Other: type your own…', toTerminal: 'Answer in terminal', question: 'A question for you', },
};

// Each language is shown in its own script in the language menu
const NATIVE = { zh: '简体中文', tw: '繁體中文', ja: '日本語', en: 'English' };

function fromLocale(locale) {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('zh')) return /tw|hk|mo|hant/.test(l) ? 'tw' : 'zh';
  return l.startsWith('ja') ? 'ja' : 'en';
}

// choice: 'auto' or a language code; locale: system language
module.exports = (choice, locale) => STR[STR[choice] ? choice : fromLocale(locale)];
module.exports.LANGS = Object.keys(STR);
module.exports.NATIVE = NATIVE;
module.exports.fromLocale = fromLocale;
