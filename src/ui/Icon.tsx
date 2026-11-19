import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { ColorValue, Platform, StyleProp, Text, useWindowDimensions, ViewStyle } from 'react-native';

type SymbolName = SymbolViewProps['name'];

/**
 * The app's icons by meaning: SF Symbols on iOS, Material Symbols on Android, so each platform
 * shows its own familiar glyphs in one consistent style.
 */
const ICONS = {
  back: { ios: 'chevron.left', android: 'arrow_back' },
  forward: { ios: 'chevron.right', android: 'arrow_forward' },
  more: { ios: 'ellipsis', android: 'more_vert' },
  moreHorizontal: { ios: 'ellipsis.circle', android: 'more_horiz' },
  ellipsis: { ios: 'ellipsis', android: 'more_horiz' },
  info: { ios: 'info.circle', android: 'info' },
  selectText: { ios: 'character.cursor.ibeam', android: 'select_all' },
  assistant: { ios: 'sparkles', android: 'auto_awesome' },
  reload: { ios: 'arrow.clockwise', android: 'refresh' },
  close: { ios: 'xmark', android: 'close' },
  bookmark: { ios: 'star', android: 'star' },
  bookmarked: { ios: 'star.fill', android: 'star' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  find: { ios: 'magnifyingglass', android: 'search' },
  shield: { ios: 'checkmark.shield', android: 'shield' },
  textSize: { ios: 'textformat.size', android: 'format_size' },
  palette: { ios: 'paintpalette', android: 'palette' },
  script: { ios: 'curlybraces', android: 'data_object' },
  cookies: { ios: 'list.bullet.rectangle', android: 'cookie' },
  trash: { ios: 'trash', android: 'delete' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  edit: { ios: 'pencil', android: 'edit' },
  desktop: { ios: 'desktopcomputer', android: 'desktop_windows' },
  qrCode: { ios: 'qrcode', android: 'qr_code' },
  scanQr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  pdf: { ios: 'doc.richtext', android: 'picture_as_pdf' },
  saveOffline: { ios: 'arrow.down.doc', android: 'download_for_offline' },
  print: { ios: 'printer', android: 'print' },
  screenshot: { ios: 'camera.viewfinder', android: 'screenshot' },
  readAloud: { ios: 'speaker.wave.2', android: 'volume_up' },
  stopReading: { ios: 'stop.circle', android: 'stop_circle' },
  library: { ios: 'books.vertical', android: 'library_books' },
  bookmarks: { ios: 'book', android: 'bookmarks' },
  folder: { ios: 'folder', android: 'folder' },
  newFolder: { ios: 'folder.badge.plus', android: 'create_new_folder' },
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  savedPages: { ios: 'tray.full', android: 'inventory_2' },
  downloads: { ios: 'arrow.down.circle', android: 'download' },
  newTab: { ios: 'plus', android: 'add' },
  incognito: { ios: 'eyeglasses', android: 'visibility_off' },
  settings: { ios: 'gearshape', android: 'settings' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  stop: { ios: 'stop.fill', android: 'stop' },
  secure: { ios: 'lock.fill', android: 'lock' },
  insecure: { ios: 'exclamationmark.triangle', android: 'warning' },
  chevronUp: { ios: 'chevron.up', android: 'keyboard_arrow_up' },
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  reopen: { ios: 'arrow.uturn.backward', android: 'undo' },
  research: { ios: 'magnifyingglass.circle', android: 'travel_explore' },
  compare: { ios: 'rectangle.split.2x1', android: 'compare' },
  summarize: { ios: 'text.alignleft', android: 'notes' },
  keyPoints: { ios: 'list.bullet', android: 'format_list_bulleted' },
  translate: { ios: 'globe', android: 'translate' },
  review: { ios: 'cart', android: 'shopping_cart' },
  image: { ios: 'photo', android: 'image' },
  link: { ios: 'link', android: 'link' },
  download: { ios: 'square.and.arrow.down', android: 'download' },
  openInNew: { ios: 'plus.square.on.square', android: 'open_in_new' },
  addToHome: { ios: 'plus.app', android: 'add_to_home_screen' },
  check: { ios: 'checkmark', android: 'check' },
  selected: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  unselected: { ios: 'circle', android: 'radio_button_unchecked' },
  phone: { ios: 'phone.fill', android: 'call' },
  message: { ios: 'message.fill', android: 'sms' },
  location: { ios: 'location.fill', android: 'location_on' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  reminder: { ios: 'checklist', android: 'task_alt' },
  notifications: { ios: 'bell.fill', android: 'notifications' },
  camera: { ios: 'video.fill', android: 'videocam' },
  microphone: { ios: 'mic.fill', android: 'mic' },
  reader: { ios: 'doc.plaintext', android: 'chrome_reader_mode' },
  document: { ios: 'doc.text', android: 'description' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  tasks: { ios: 'list.bullet.rectangle', android: 'checklist' },
  attach: { ios: 'paperclip', android: 'attach_file' },
  photo: { ios: 'camera', android: 'photo_camera' },
  // Memory categories.
  person: { ios: 'person.crop.circle', android: 'person' },
  home: { ios: 'house', android: 'home' },
  delivery: { ios: 'shippingbox', android: 'local_shipping' },
  travel: { ios: 'airplane', android: 'flight' },
  food: { ios: 'fork.knife', android: 'restaurant' },
  wallet: { ios: 'wallet.pass', android: 'account_balance_wallet' },
  key: { ios: 'key', android: 'key' },
  preferences: { ios: 'slider.horizontal.3', android: 'tune' },
  // Assistant steps.
  globe: { ios: 'globe', android: 'language' },
  source: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code' },
  tap: { ios: 'hand.tap', android: 'touch_app' },
  keyboard: { ios: 'keyboard', android: 'keyboard' },
  select: { ios: 'chevron.up.chevron.down', android: 'unfold_more' },
  scroll: { ios: 'arrow.up.and.down', android: 'swap_vert' },
  view: { ios: 'eye', android: 'visibility' },
  upload: { ios: 'arrow.up.circle', android: 'upload' },
  tabs: { ios: 'square.on.square', android: 'tab' },
  switchTab: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  email: { ios: 'envelope', android: 'mail' },
  notes: { ios: 'square.and.pencil', android: 'edit_note' },
  wait: { ios: 'hourglass', android: 'hourglass_empty' },
  memory: { ios: 'brain', android: 'psychology' },
  alarm: { ios: 'alarm', android: 'alarm' },
  tool: { ios: 'wrench.and.screwdriver', android: 'build' },
  // Page load errors.
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  unreachable: { ios: 'powerplug', android: 'power_off' },
  unlocked: { ios: 'lock.open', android: 'lock_open' },
  apps: { ios: 'square.grid.2x2', android: 'apps' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

/** A line of text with an optional icon before it; the icon is decorative (the text says the same thing). */
export type IconLine = {
  icon?: IconName;
  text: string;
  /** 'danger': shown in red (a script's flags); the text must say the same on its own. */
  tone?: 'danger';
};

/**
 * A confirmation's message as lines with icons; spaced: a paragraph's space between the lines instead of none.
 * The text alone (lines joined) must still read in full, e.g. for a screen reader.
 */
export type IconLines = { lines: IconLine[]; spaced?: boolean };

/** The plain text of icon lines, as one string. */
export function iconLinesText({ lines, spaced }: IconLines): string {
  return lines.map((line) => line.text).join(spaced ? '\n\n' : '\n');
}

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color, style }: Props) {
  // On Android the symbol is a glyph of the Material Symbols font in a size×size box, and text follows the
  // system font size: at large text it would outgrow the box and be cut off. Icons keep their size instead.
  const { fontScale } = useWindowDimensions();
  const glyph = Platform.OS === 'android' && fontScale > 0 ? size / fontScale : size;
  return (
    <SymbolView
      name={ICONS[name]}
      size={glyph}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      // Decorative: the label or text beside it says what it is.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      // Shown only where neither symbol set is available (e.g. tests, very old systems).
      fallback={<Text style={{ width: size, height: size, color, fontSize: size * 0.8 }}>•</Text>}
    />
  );
}
