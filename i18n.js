// i18n.js — ゼロ依存の軽量i18n。app.js より前に読み込むこと。
const LOCALE_STORAGE_KEY = "soccer-board-locale-v1";
const DEFAULT_LOCALE = "ja";
const SUPPORTED_LOCALES = ["ja", "en"];

const MESSAGES = {
  ja: {
    // --- 静的（index.html） ---
    "brand.tagline": "チーム戦術ホワイトボード",
    "toolbar.formationLabel": "配置",
    "toolbar.apply": "反映",
    "toolbar.lanes": "5レーン",
    "toolbar.bielsa": "ビエルサライン",
    "toolbar.thirds": "3ゾーン",
    "toolbar.reset": "ボードリセット",
    "header.hideToolbar": "ツールバーを隠す",
    "header.showToolbar": "ツールバーを表示",
    "score.home": "味方",
    "score.away": "相手",
    "draw.move": "移動",
    "draw.pen": "ペン",
    "draw.arrow": "矢印",
    "draw.colorYellow": "黄",
    "draw.colorRed": "赤",
    "draw.colorBlue": "青",
    "draw.colorWhite": "白",
    "draw.undo": "1つ戻す",
    "draw.clear": "全消去",
    "panel.selectedTitle": "選択中",
    "panel.clearSelection": "解除",
    "panel.subTitle": "交代",
    "panel.sentOffTitle": "退場",
    "panel.homeRosterTitle": "味方登録",
    "panel.sortByNumber": "番号順",
    "form.numberPlaceholder": "No.",
    "form.namePlaceholder": "名前",
    "form.add": "追加",
    "panel.resetHome": "味方登録を初期化",
    "panel.opponentTitle": "相手登録",
    "panel.resetOpponents": "リセット",
    "panel.notesTitle": "メモ",
    "notes.placeholder": "今日の狙い、交代案、セットプレーなど",
    "panel.open": "管理パネルを開く",
    "panel.close": "管理パネルを閉じる",
    "panel.toggleLabel": "パネル",
    // --- 動的ラベル（app.js が textContent を設定） ---
    "toolbar.orientationToVertical": "縦表示",
    "toolbar.orientationToHorizontal": "横表示",
    // --- 動的（app.js） ---
    "confirm.resetHome": "味方の登録と配置を初期状態に戻しますか？",
    "confirm.clearDrawings": "描いた線をすべて消しますか？",
    "confirm.deletePlayer": "{label}を削除しますか？",
    "team.home": "味方",
    "team.away": "相手",
    "token.ball": "ボール",
    "panel.noSelection": "選択なし",
    "status.onPitch": "ピッチ",
    "status.bench": "控え",
    "label.number": "背番号",
    "label.name": "名前",
    "sub.selectHome": "味方選手を選択",
    "sub.noBench": "控えなし",
    "sub.noField": "ピッチの選手なし",
    "action.sub": "交代",
    "action.sendOff": "退場させる",
    "sentOff.none": "退場者なし",
    "action.restore": "復帰",
    "roster.onFieldGroup": "ピッチ {count}",
    "roster.benchGroup": "控え {count}",
    "roster.none": "該当なし",
    "action.select": "選択",
    "action.delete": "削除",
    "player.noName": "名前未登録",
    "aria.opponentNumber": "相手 背番号",
    "aria.opponentName": "相手 名前",
  },
  en: {
    "brand.tagline": "Team tactics whiteboard",
    "toolbar.formationLabel": "Formation",
    "toolbar.apply": "Apply",
    "toolbar.lanes": "5 lanes",
    "toolbar.bielsa": "Bielsa line",
    "toolbar.thirds": "Thirds",
    "toolbar.reset": "Reset board",
    "header.hideToolbar": "Hide toolbar",
    "header.showToolbar": "Show toolbar",
    "score.home": "Home",
    "score.away": "Away",
    "draw.move": "Move",
    "draw.pen": "Pen",
    "draw.arrow": "Arrow",
    "draw.colorYellow": "Yellow",
    "draw.colorRed": "Red",
    "draw.colorBlue": "Blue",
    "draw.colorWhite": "White",
    "draw.undo": "Undo",
    "draw.clear": "Clear all",
    "panel.selectedTitle": "Selected",
    "panel.clearSelection": "Clear",
    "panel.subTitle": "Substitution",
    "panel.sentOffTitle": "Sent off",
    "panel.homeRosterTitle": "Home roster",
    "panel.sortByNumber": "By number",
    "form.numberPlaceholder": "No.",
    "form.namePlaceholder": "Name",
    "form.add": "Add",
    "panel.resetHome": "Reset home roster",
    "panel.opponentTitle": "Opponent roster",
    "panel.resetOpponents": "Reset",
    "panel.notesTitle": "Notes",
    "notes.placeholder": "Game plan, subs, set pieces…",
    "panel.open": "Open panel",
    "panel.close": "Close panel",
    "panel.toggleLabel": "Panel",
    "toolbar.orientationToVertical": "Vertical",
    "toolbar.orientationToHorizontal": "Horizontal",
    "confirm.resetHome": "Reset the home roster and positions to defaults?",
    "confirm.clearDrawings": "Erase all drawings?",
    "confirm.deletePlayer": "Delete {label}?",
    "team.home": "Home",
    "team.away": "Away",
    "token.ball": "Ball",
    "panel.noSelection": "No selection",
    "status.onPitch": "On pitch",
    "status.bench": "Bench",
    "label.number": "Number",
    "label.name": "Name",
    "sub.selectHome": "Select a home player",
    "sub.noBench": "No bench players",
    "sub.noField": "No players on pitch",
    "action.sub": "Sub",
    "action.sendOff": "Send off",
    "sentOff.none": "No sent-off players",
    "action.restore": "Restore",
    "roster.onFieldGroup": "On pitch {count}",
    "roster.benchGroup": "Bench {count}",
    "roster.none": "None",
    "action.select": "Select",
    "action.delete": "Delete",
    "player.noName": "Unnamed",
    "aria.opponentNumber": "Opponent number",
    "aria.opponentName": "Opponent name",
  },
};

let currentLocale = DEFAULT_LOCALE;
let localeChangeHandler = null;

function t(key, vars) {
  const table = MESSAGES[currentLocale] || MESSAGES[DEFAULT_LOCALE];
  let text = table[key];
  if (text === undefined) {
    text = MESSAGES[DEFAULT_LOCALE][key];
    if (text === undefined) {
      console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
  }
  if (vars) {
    for (const name of Object.keys(vars)) {
      text = text.split(`{${name}}`).join(String(vars[name]));
    }
  }
  return text;
}

function getLocale() {
  return currentLocale;
}

function initLocale() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    saved = null;
  }
  currentLocale = SUPPORTED_LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;
  document.documentElement.lang = currentLocale;
}

function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  currentLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ロケール保存に失敗してもアプリは動く
  }
  document.documentElement.lang = locale;
  applyStaticTranslations();
  if (localeChangeHandler) localeChangeHandler();
}

function registerLocaleChange(handler) {
  localeChangeHandler = handler;
}

function applyStaticTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    const value = t(key);
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });
}

function assertLocaleParity() {
  const missingInEn = Object.keys(MESSAGES.ja).filter((k) => !(k in MESSAGES.en));
  const missingInJa = Object.keys(MESSAGES.en).filter((k) => !(k in MESSAGES.ja));
  if (missingInEn.length || missingInJa.length) {
    console.warn("[i18n] key parity mismatch", { missingInEn, missingInJa });
  }
}

assertLocaleParity();
