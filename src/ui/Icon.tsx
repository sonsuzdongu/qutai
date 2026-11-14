import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { ColorValue, StyleProp, Text, ViewStyle } from 'react-native';

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
  phone: { ios: 'phone.fill', android: 'call' },
  message: { ios: 'message.fill', android: 'sms' },
  location: { ios: 'location.fill', android: 'location_on' },
  camera: { ios: 'video.fill', android: 'videocam' },
  microphone: { ios: 'mic.fill', android: 'mic' },
  reader: { ios: 'doc.plaintext', android: 'chrome_reader_mode' },
  document: { ios: 'doc.text', android: 'description' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color, style }: Props) {
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      // Shown only where neither symbol set is available (e.g. tests, very old systems).
      fallback={<Text style={{ width: size, height: size, color, fontSize: size * 0.8 }}>•</Text>}
    />
  );
}
