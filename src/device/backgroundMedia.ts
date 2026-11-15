import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { t } from '../i18n';

/**
 * Android: the local module modules/qutai-media (mediaPlayback foreground service, media notification and
 * MediaSession, picture-in-picture). Playback state reaches it natively from the patched WebView; this only passes
 * the settings and the translated labels. Missing in builds made before it was added (nothing happens then), and
 * on iOS, where WebKit itself handles background audio, the lock screen and headphone controls (see playback.ts).
 */
type QutaiMediaModule = {
  configure(options: {
    backgroundPlayback: boolean;
    channel: string;
    privateTab: string;
    play: string;
    pause: string;
    next: string;
    previous: string;
  }): void;
  setPictureInPictureAllowed(allowed: boolean): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<QutaiMediaModule>('QutaiMedia') : null;

/** "Keep playing in the background", and the notification's labels in the app's language. */
export function configureBackgroundMedia(backgroundPlayback: boolean) {
  native?.configure({
    backgroundPlayback,
    channel: t('playback.channel'),
    privateTab: t('playback.privateTab'),
    play: t('playback.play'),
    pause: t('playback.pause'),
    next: t('playback.next'),
    previous: t('playback.previous'),
  });
}

/** Whether a playing video may go into picture-in-picture when the user leaves the app (modules/qutai-media). */
export function setPictureInPictureAllowed(allowed: boolean) {
  native?.setPictureInPictureAllowed(allowed);
}
