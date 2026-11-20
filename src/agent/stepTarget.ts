import { getLanguage } from '../i18n';
import type { Language } from '../i18n/languages';
import type { Browser } from '../browser/Browser';

/**
 * The words a step line uses for the element a page step acts on ("Tapping the “Add to cart” button", Turkish
 * "“Sepete ekle” düğmesine dokunuluyor"), instead of the model's ref number. Display only: the model's tool input and
 * result are untouched. The page script reports what it knows (targetInfo in src/browser/pageScript.ts); this file
 * turns it into a kind and a phrase in the grammatical case the line's template needs, per language (the phrases
 * carry their own articles, case endings and particles, so nothing is glued together across languages). Pure: tested
 * in scripts/i18n-tests/stepTarget.test.ts.
 */

/** What the page script says about the element (all optional: an old page script or a failed lookup gives less). */
export type TargetFacts = { name?: string; role?: string; tag?: string; type?: string; editable?: boolean };

export type TargetKind =
  | 'button'
  | 'link'
  | 'field'
  | 'checkbox'
  | 'option'
  | 'switch'
  | 'list'
  | 'image'
  | 'file'
  | 'element';

/** The kind of element, in words a person uses (a role wins over the tag, as for screen readers). */
export function targetKind(facts: TargetFacts | null | undefined): TargetKind {
  if (!facts) return 'element';
  const role = (facts.role ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';
  switch (role) {
    case 'button':
    case 'menuitem':
    case 'tab':
      return 'button';
    case 'link':
      return 'link';
    case 'checkbox':
    case 'menuitemcheckbox':
      return 'checkbox';
    case 'radio':
    case 'menuitemradio':
    case 'option':
      return 'option';
    case 'switch':
      return 'switch';
    case 'textbox':
    case 'searchbox':
    case 'spinbutton':
      return 'field';
    case 'combobox':
    case 'listbox':
      // An input with suggestions is still a field to type into; a picker is a list.
      return facts.tag === 'input' || facts.tag === 'textarea' ? 'field' : 'list';
    case 'img':
    case 'image':
      return 'image';
  }
  const tag = (facts.tag ?? '').toLowerCase();
  switch (tag) {
    case 'a':
    case 'area':
      return 'link';
    case 'button':
    case 'summary':
      return 'button';
    case 'textarea':
      return 'field';
    case 'select':
      return 'list';
    case 'img':
    case 'svg':
    case 'picture':
      return 'image';
    case 'input':
      switch ((facts.type ?? 'text').toLowerCase()) {
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'option';
        case 'file':
          return 'file';
        case 'submit':
        case 'button':
        case 'reset':
        case 'image':
          return 'button';
        case 'range':
        case 'color':
        case 'hidden':
          return 'element';
        default:
          return 'field';
      }
  }
  return facts.editable ? 'field' : 'element';
}

/** Names longer than this are shortened at a word boundary. */
export const MAX_NAME = 40;

/**
 * The element's name as shown: spaces folded, quote marks that would clash with the line's own dropped, shortened at a
 * word boundary with "…". Empty when the name is only punctuation or looks like an internal id.
 */
export function shownName(raw: string | null | undefined, max = MAX_NAME): string {
  let name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/["“”„«»「」‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[\p{L}\p{N}]/u.test(name)) return '';
  // "ref 12", "ref=12", "#submit-btn", ".nav > a": machine words, never shown.
  if (/^ref\s*=?\s*\d+$/i.test(name) || /^[#.][\w-]/.test(name) || /[>{}]/.test(name)) return '';
  const chars = Array.from(name);
  if (chars.length <= max) return name;
  let cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  if (space >= max / 2) cut = cut.slice(0, space);
  return cut.replace(/[\s,.;:–—-]+$/u, '') + '…';
}

/** The grammatical slot a line's template puts the element in. */
export type TargetSlot =
  /** Tapping it. */
  | 'on'
  /** Typing into it, giving it a file. */
  | 'into'
  /** Choosing in it (a list). */
  | 'in'
  /** Scrolling to it. */
  | 'to'
  /** Standing alone after a colon ("Downloading a file: the “Report” link"). */
  | 'alone';

/** [named (with {name}), unnamed] forms of one kind in one case. */
type Forms = readonly [named: string, plain: string];
type Grammar<C extends string> = {
  /** Which case each slot's template needs. */
  slots: Record<TargetSlot, C>;
  kinds: Record<TargetKind, Record<C, Forms>>;
};

/** One case for every slot: the phrase never changes (articles only). */
function single(kinds: Record<TargetKind, Forms>): Grammar<'x'> {
  const out = {} as Record<TargetKind, Record<'x', Forms>>;
  for (const kind of Object.keys(kinds) as TargetKind[]) out[kind] = { x: kinds[kind] };
  return { slots: { on: 'x', into: 'x', in: 'x', to: 'x', alone: 'x' }, kinds: out };
}

const en = single({
  button: ['the “{name}” button', 'a button'],
  link: ['the “{name}” link', 'a link'],
  field: ['the “{name}” field', 'a text field'],
  checkbox: ['the “{name}” checkbox', 'a checkbox'],
  option: ['the “{name}” option', 'an option'],
  switch: ['the “{name}” switch', 'a switch'],
  list: ['the “{name}” list', 'a list'],
  image: ['the “{name}” image', 'an image'],
  file: ['the “{name}” file field', 'a file field'],
  element: ['“{name}”', 'an element on the page'],
});

// Turkish: the kind noun carries the case (compound noun with the possessive: "“Sepete ekle” düğmesine"); the name
// stays as written, so no suffix ever has to follow a quoted name. dat: tapping, typing, giving, scrolling; abl:
// choosing from a list; nom: alone.
const tr: Grammar<'dat' | 'abl' | 'nom'> = {
  slots: { on: 'dat', into: 'dat', in: 'abl', to: 'dat', alone: 'nom' },
  kinds: {
    button: {
      dat: ['“{name}” düğmesine', 'bir düğmeye'],
      abl: ['“{name}” düğmesinden', 'bir düğmeden'],
      nom: ['“{name}” düğmesi', 'bir düğme'],
    },
    link: {
      dat: ['“{name}” bağlantısına', 'bir bağlantıya'],
      abl: ['“{name}” bağlantısından', 'bir bağlantıdan'],
      nom: ['“{name}” bağlantısı', 'bir bağlantı'],
    },
    field: {
      dat: ['“{name}” alanına', 'bir metin alanına'],
      abl: ['“{name}” alanından', 'bir metin alanından'],
      nom: ['“{name}” alanı', 'bir metin alanı'],
    },
    checkbox: {
      dat: ['“{name}” onay kutusuna', 'bir onay kutusuna'],
      abl: ['“{name}” onay kutusundan', 'bir onay kutusundan'],
      nom: ['“{name}” onay kutusu', 'bir onay kutusu'],
    },
    option: {
      dat: ['“{name}” seçeneğine', 'bir seçeneğe'],
      abl: ['“{name}” seçeneğinden', 'bir seçenekten'],
      nom: ['“{name}” seçeneği', 'bir seçenek'],
    },
    switch: {
      dat: ['“{name}” anahtarına', 'bir anahtara'],
      abl: ['“{name}” anahtarından', 'bir anahtardan'],
      nom: ['“{name}” anahtarı', 'bir anahtar'],
    },
    list: {
      dat: ['“{name}” listesine', 'bir listeye'],
      abl: ['“{name}” listesinden', 'bir listeden'],
      nom: ['“{name}” listesi', 'bir liste'],
    },
    image: {
      dat: ['“{name}” görseline', 'bir görsele'],
      abl: ['“{name}” görselinden', 'bir görselden'],
      nom: ['“{name}” görseli', 'bir görsel'],
    },
    file: {
      dat: ['“{name}” dosya alanına', 'bir dosya alanına'],
      abl: ['“{name}” dosya alanından', 'bir dosya alanından'],
      nom: ['“{name}” dosya alanı', 'bir dosya alanı'],
    },
    element: {
      dat: ['“{name}” öğesine', 'sayfadaki bir öğeye'],
      abl: ['“{name}” öğesinden', 'sayfadaki bir öğeden'],
      nom: ['“{name}” öğesi', 'sayfadaki bir öğe'],
    },
  },
};

// German: article and noun in the case the preposition takes (auf/in + Akkusativ, in/zu + Dativ).
const de: Grammar<'acc' | 'dat' | 'nom'> = {
  slots: { on: 'acc', into: 'acc', in: 'dat', to: 'dat', alone: 'nom' },
  kinds: {
    button: {
      acc: ['die Schaltfläche „{name}“', 'eine Schaltfläche'],
      dat: ['der Schaltfläche „{name}“', 'einer Schaltfläche'],
      nom: ['die Schaltfläche „{name}“', 'eine Schaltfläche'],
    },
    link: {
      acc: ['den Link „{name}“', 'einen Link'],
      dat: ['dem Link „{name}“', 'einem Link'],
      nom: ['der Link „{name}“', 'ein Link'],
    },
    field: {
      acc: ['das Feld „{name}“', 'ein Textfeld'],
      dat: ['dem Feld „{name}“', 'einem Textfeld'],
      nom: ['das Feld „{name}“', 'ein Textfeld'],
    },
    checkbox: {
      acc: ['das Kontrollkästchen „{name}“', 'ein Kontrollkästchen'],
      dat: ['dem Kontrollkästchen „{name}“', 'einem Kontrollkästchen'],
      nom: ['das Kontrollkästchen „{name}“', 'ein Kontrollkästchen'],
    },
    option: {
      acc: ['die Option „{name}“', 'eine Option'],
      dat: ['der Option „{name}“', 'einer Option'],
      nom: ['die Option „{name}“', 'eine Option'],
    },
    switch: {
      acc: ['den Schalter „{name}“', 'einen Schalter'],
      dat: ['dem Schalter „{name}“', 'einem Schalter'],
      nom: ['der Schalter „{name}“', 'ein Schalter'],
    },
    list: {
      acc: ['die Liste „{name}“', 'eine Liste'],
      dat: ['der Liste „{name}“', 'einer Liste'],
      nom: ['die Liste „{name}“', 'eine Liste'],
    },
    image: {
      acc: ['das Bild „{name}“', 'ein Bild'],
      dat: ['dem Bild „{name}“', 'einem Bild'],
      nom: ['das Bild „{name}“', 'ein Bild'],
    },
    file: {
      acc: ['das Dateifeld „{name}“', 'ein Dateifeld'],
      dat: ['dem Dateifeld „{name}“', 'einem Dateifeld'],
      nom: ['das Dateifeld „{name}“', 'ein Dateifeld'],
    },
    element: {
      acc: ['„{name}“', 'ein Element der Seite'],
      dat: ['„{name}“', 'einem Element der Seite'],
      nom: ['„{name}“', 'ein Element der Seite'],
    },
  },
};

// Russian: no articles; the noun in the case of the preposition (на/в + винительный, в + предложный, к + дательный).
const ru: Grammar<'acc' | 'prep' | 'dat' | 'nom'> = {
  slots: { on: 'acc', into: 'acc', in: 'prep', to: 'dat', alone: 'nom' },
  kinds: {
    button: {
      acc: ['кнопку «{name}»', 'кнопку'],
      prep: ['кнопке «{name}»', 'кнопке'],
      dat: ['кнопке «{name}»', 'кнопке'],
      nom: ['кнопка «{name}»', 'кнопка'],
    },
    link: {
      acc: ['ссылку «{name}»', 'ссылку'],
      prep: ['ссылке «{name}»', 'ссылке'],
      dat: ['ссылке «{name}»', 'ссылке'],
      nom: ['ссылка «{name}»', 'ссылка'],
    },
    field: {
      acc: ['поле «{name}»', 'текстовое поле'],
      prep: ['поле «{name}»', 'текстовом поле'],
      dat: ['полю «{name}»', 'текстовому полю'],
      nom: ['поле «{name}»', 'текстовое поле'],
    },
    checkbox: {
      acc: ['флажок «{name}»', 'флажок'],
      prep: ['флажке «{name}»', 'флажке'],
      dat: ['флажку «{name}»', 'флажку'],
      nom: ['флажок «{name}»', 'флажок'],
    },
    option: {
      acc: ['вариант «{name}»', 'вариант'],
      prep: ['варианте «{name}»', 'варианте'],
      dat: ['варианту «{name}»', 'варианту'],
      nom: ['вариант «{name}»', 'вариант'],
    },
    switch: {
      acc: ['переключатель «{name}»', 'переключатель'],
      prep: ['переключателе «{name}»', 'переключателе'],
      dat: ['переключателю «{name}»', 'переключателю'],
      nom: ['переключатель «{name}»', 'переключатель'],
    },
    list: {
      acc: ['список «{name}»', 'список'],
      prep: ['списке «{name}»', 'списке'],
      dat: ['списку «{name}»', 'списку'],
      nom: ['список «{name}»', 'список'],
    },
    image: {
      acc: ['изображение «{name}»', 'изображение'],
      prep: ['изображении «{name}»', 'изображении'],
      dat: ['изображению «{name}»', 'изображению'],
      nom: ['изображение «{name}»', 'изображение'],
    },
    file: {
      acc: ['поле для файла «{name}»', 'поле для файла'],
      prep: ['поле для файла «{name}»', 'поле для файла'],
      dat: ['полю для файла «{name}»', 'полю для файла'],
      nom: ['поле для файла «{name}»', 'поле для файла'],
    },
    element: {
      acc: ['элемент «{name}»', 'элемент страницы'],
      prep: ['элементе «{name}»', 'элементе страницы'],
      dat: ['элементу «{name}»', 'элементу страницы'],
      nom: ['элемент «{name}»', 'элемент страницы'],
    },
  },
};

// French: the article belongs to the phrase; templates use only prepositions that never contract with it (sur, dans,
// vers), so "à le" / "de le" cannot happen.
const fr = single({
  button: ['le bouton « {name} »', 'un bouton'],
  link: ['le lien « {name} »', 'un lien'],
  field: ['le champ « {name} »', 'un champ de texte'],
  checkbox: ['la case « {name} »', 'une case à cocher'],
  option: ['l’option « {name} »', 'une option'],
  switch: ['l’interrupteur « {name} »', 'un interrupteur'],
  list: ['la liste « {name} »', 'une liste'],
  image: ['l’image « {name} »', 'une image'],
  file: ['le champ de fichier « {name} »', 'un champ de fichier'],
  element: ['« {name} »', 'un élément de la page'],
});

// Spanish: templates avoid "a" and "de" before the phrase (al / del contractions).
const es = single({
  button: ['el botón «{name}»', 'un botón'],
  link: ['el enlace «{name}»', 'un enlace'],
  field: ['el campo «{name}»', 'un campo de texto'],
  checkbox: ['la casilla «{name}»', 'una casilla'],
  option: ['la opción «{name}»', 'una opción'],
  switch: ['el interruptor «{name}»', 'un interruptor'],
  list: ['la lista «{name}»', 'una lista'],
  image: ['la imagen «{name}»', 'una imagen'],
  file: ['el campo de archivo «{name}»', 'un campo de archivo'],
  element: ['«{name}»', 'un elemento de la página'],
});

// Brazilian Portuguese: "em" contracts with the article (no, na), so the phrase carries it: em = "no botão", base =
// "o botão".
const ptBR: Grammar<'em' | 'base'> = {
  slots: { on: 'em', into: 'em', in: 'em', to: 'base', alone: 'base' },
  kinds: {
    button: { em: ['no botão “{name}”', 'em um botão'], base: ['o botão “{name}”', 'um botão'] },
    link: { em: ['no link “{name}”', 'em um link'], base: ['o link “{name}”', 'um link'] },
    field: { em: ['no campo “{name}”', 'em um campo de texto'], base: ['o campo “{name}”', 'um campo de texto'] },
    checkbox: {
      em: ['na caixa de seleção “{name}”', 'em uma caixa de seleção'],
      base: ['a caixa de seleção “{name}”', 'uma caixa de seleção'],
    },
    option: { em: ['na opção “{name}”', 'em uma opção'], base: ['a opção “{name}”', 'uma opção'] },
    switch: { em: ['no interruptor “{name}”', 'em um interruptor'], base: ['o interruptor “{name}”', 'um interruptor'] },
    list: { em: ['na lista “{name}”', 'em uma lista'], base: ['a lista “{name}”', 'uma lista'] },
    image: { em: ['na imagem “{name}”', 'em uma imagem'], base: ['a imagem “{name}”', 'uma imagem'] },
    file: {
      em: ['no campo de arquivo “{name}”', 'em um campo de arquivo'],
      base: ['o campo de arquivo “{name}”', 'um campo de arquivo'],
    },
    element: { em: ['em “{name}”', 'em um elemento da página'], base: ['“{name}”', 'um elemento da página'] },
  },
};

const id = single({
  button: ['tombol “{name}”', 'sebuah tombol'],
  link: ['link “{name}”', 'sebuah link'],
  field: ['kolom “{name}”', 'sebuah kolom teks'],
  checkbox: ['kotak centang “{name}”', 'sebuah kotak centang'],
  option: ['opsi “{name}”', 'sebuah opsi'],
  switch: ['sakelar “{name}”', 'sebuah sakelar'],
  list: ['daftar “{name}”', 'sebuah daftar'],
  image: ['gambar “{name}”', 'sebuah gambar'],
  file: ['kolom file “{name}”', 'sebuah kolom file'],
  element: ['“{name}”', 'sebuah elemen di halaman'],
});

// Japanese: particles are in the templates and never change with the noun.
const ja = single({
  button: ['「{name}」ボタン', 'ボタン'],
  link: ['「{name}」リンク', 'リンク'],
  field: ['「{name}」入力欄', '入力欄'],
  checkbox: ['「{name}」チェックボックス', 'チェックボックス'],
  option: ['選択肢「{name}」', '選択肢'],
  switch: ['「{name}」スイッチ', 'スイッチ'],
  list: ['「{name}」リスト', 'リスト'],
  image: ['「{name}」画像', '画像'],
  file: ['「{name}」ファイル欄', 'ファイル欄'],
  element: ['「{name}」', 'ページ上の要素'],
});

// Korean: the particle follows the kind noun (을/를 by its last sound, 에, 에서), so it is part of the phrase; a quoted
// name is always followed by a noun, never by a particle. nom: before 까지 and alone.
const ko: Grammar<'obj' | 'loc' | 'from' | 'nom'> = {
  slots: { on: 'obj', into: 'loc', in: 'from', to: 'nom', alone: 'nom' },
  kinds: {
    button: {
      obj: ['‘{name}’ 버튼을', '버튼을'],
      loc: ['‘{name}’ 버튼에', '버튼에'],
      from: ['‘{name}’ 버튼에서', '버튼에서'],
      nom: ['‘{name}’ 버튼', '버튼'],
    },
    link: {
      obj: ['‘{name}’ 링크를', '링크를'],
      loc: ['‘{name}’ 링크에', '링크에'],
      from: ['‘{name}’ 링크에서', '링크에서'],
      nom: ['‘{name}’ 링크', '링크'],
    },
    field: {
      obj: ['‘{name}’ 입력란을', '입력란을'],
      loc: ['‘{name}’ 입력란에', '입력란에'],
      from: ['‘{name}’ 입력란에서', '입력란에서'],
      nom: ['‘{name}’ 입력란', '입력란'],
    },
    checkbox: {
      obj: ['‘{name}’ 체크박스를', '체크박스를'],
      loc: ['‘{name}’ 체크박스에', '체크박스에'],
      from: ['‘{name}’ 체크박스에서', '체크박스에서'],
      nom: ['‘{name}’ 체크박스', '체크박스'],
    },
    option: {
      obj: ['‘{name}’ 옵션을', '옵션을'],
      loc: ['‘{name}’ 옵션에', '옵션에'],
      from: ['‘{name}’ 옵션에서', '옵션에서'],
      nom: ['‘{name}’ 옵션', '옵션'],
    },
    switch: {
      obj: ['‘{name}’ 스위치를', '스위치를'],
      loc: ['‘{name}’ 스위치에', '스위치에'],
      from: ['‘{name}’ 스위치에서', '스위치에서'],
      nom: ['‘{name}’ 스위치', '스위치'],
    },
    list: {
      obj: ['‘{name}’ 목록을', '목록을'],
      loc: ['‘{name}’ 목록에', '목록에'],
      from: ['‘{name}’ 목록에서', '목록에서'],
      nom: ['‘{name}’ 목록', '목록'],
    },
    image: {
      obj: ['‘{name}’ 이미지를', '이미지를'],
      loc: ['‘{name}’ 이미지에', '이미지에'],
      from: ['‘{name}’ 이미지에서', '이미지에서'],
      nom: ['‘{name}’ 이미지', '이미지'],
    },
    file: {
      obj: ['‘{name}’ 파일 입력란을', '파일 입력란을'],
      loc: ['‘{name}’ 파일 입력란에', '파일 입력란에'],
      from: ['‘{name}’ 파일 입력란에서', '파일 입력란에서'],
      nom: ['‘{name}’ 파일 입력란', '파일 입력란'],
    },
    element: {
      obj: ['‘{name}’ 요소를', '페이지의 요소를'],
      loc: ['‘{name}’ 요소에', '페이지의 요소에'],
      from: ['‘{name}’ 요소에서', '페이지의 요소에서'],
      nom: ['‘{name}’ 요소', '페이지의 요소'],
    },
  },
};

const GRAMMARS: Record<Language, Grammar<string>> = { en, tr, de, es, 'pt-BR': ptBR, fr, ja, ko, ru, id };

/**
 * The element as the line names it in `slot`: "the “Add to cart” button", "a text field"; in Turkish
 * "“Sepete ekle” düğmesine". Facts null (the page didn't answer): an element on the page, in the right case.
 */
export function targetPhrase(facts: TargetFacts | null | undefined, slot: TargetSlot, language: Language = getLanguage()): string {
  const grammar = GRAMMARS[language] ?? GRAMMARS.en;
  const kind = targetKind(facts);
  const [named, plain] = grammar.kinds[kind][grammar.slots[slot]];
  const name = shownName(facts?.name);
  return name ? named.replace('{name}', name) : plain;
}

/** A line's first letter in capitals (a template may start with the phrase: Turkish "Bir düğmeye dokunuluyor"). */
export function capitalizeFirst(text: string, language: Language = getLanguage()): string {
  const first = text.match(/^[\p{L}]/u);
  if (!first) return text;
  const locale = language === 'tr' ? 'tr' : language;
  return first[0].toLocaleUpperCase(locale) + text.slice(first[0].length);
}

/** What the step line names instead of a ref or a tab id (display only; the model's input is not touched). */
type StepTarget = { element?: TargetFacts | null; tabTitle?: string };
const stepTargets = new WeakMap<object, StepTarget>();

/** The slot each ref-taking tool puts its element in. */
const REF_SLOTS: Record<string, TargetSlot> = {
  click: 'on',
  type: 'into',
  select_option: 'in',
  scroll_to: 'to',
  upload_image: 'into',
  upload_file: 'into',
  download_file: 'alone',
};
const TAB_TOOLS = new Set(['switch_tab', 'read_tab', 'close_tab']);
/** How long the step line waits for the page to name the element before it says "an element". */
const TARGET_LOOKUP_MS = 400;

/**
 * Looks up, before the step's line is shown, what the page calls the element behind the call's ref (its name and
 * kind) or the title of the tab it names, for describeToolCall. Never throws; a page that doesn't answer in time
 * leaves the line with the kind-less wording.
 */
export async function prepareStepTarget(
  name: string,
  input: Record<string, unknown>,
  browser: Browser,
  agentTabId: string,
): Promise<void> {
  try {
    if (TAB_TOOLS.has(name)) {
      const tab = browser.getTab(String(input.tab_id ?? ''));
      // An incognito tab's title never goes into a step line (kept in the conversation and the history, INC-2).
      if (!tab || tab.incognito) return;
      const host = (() => {
        try {
          return new URL(tab.url).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })();
      stepTargets.set(input, { tabTitle: shownName(tab.title) || host });
      return;
    }
    if (!(name in REF_SLOTS) || input.ref === undefined || input.ref === null || input.ref === '') return;
    const tab = browser.getTab(agentTabId);
    const facts = tab
      ? await tab.run<TargetFacts | null>('targetInfo', [input.ref], TARGET_LOOKUP_MS).catch(() => null)
      : null;
    stepTargets.set(input, { element: facts && typeof facts === 'object' ? facts : null });
  } catch {
    // The line says "an element".
  }
}

/** The tab a tab step names, by its title (or host); '' when unknown. */
export function stepTabTitle(input: object): string {
  return stepTargets.get(input)?.tabTitle ?? '';
}

/** The element of a ref-taking call, in the slot its line needs. */
export function targetWords(name: string, input: Record<string, unknown>): string {
  return targetPhrase(stepTargets.get(input)?.element ?? null, REF_SLOTS[name] ?? 'on');
}
