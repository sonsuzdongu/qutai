import { useI18n } from '../lib/i18n';
import { Icon } from './Icon';

/**
 * The Qutai app drawn in HTML/CSS: address bar with the Q button, a shop page, the assistant panel with a short
 * exchange and, beside it, the app's confirmation dialog for the next step. Strings and colours are the app's own
 * (src/i18n, src/ui/theme.ts); the action lines use line icons where the app shows emoji. Read by screen readers as one image with a label.
 */
export function PhoneMock() {
  const { t } = useI18n();
  return (
    <figure className="phone-figure">
      <div className="phone" role="img" aria-label={t('mock.label')}>
        <div className="phone-screen">
          <div className="ph-status" aria-hidden="true">
            <span>9:41</span>
            <span className="ph-status-icons">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="ph-bar">
            <div className="ph-url">{t('mock.url')}</div>
            <span className="ph-q">
              <img src="/img/q-64.webp" width="22" height="22" alt="" />
            </span>
          </div>

          <div className="ph-page">
            <div className="ph-product" />
            <p className="ph-kicker">{t('mock.pageKicker')}</p>
            <p className="ph-title">{t('mock.pageTitle')}</p>
            <p className="ph-price">{t('mock.pagePrice')}</p>
            <span className="ph-buy">{t('mock.pageButton')}</span>
          </div>

          <div className="ph-panel">
            <div className="ph-grab" />
            <div className="ph-head">
              <img src="/img/q-64.webp" width="24" height="24" alt="" />
              <div>
                <p className="ph-head-title">{t('mock.panelTitle')}</p>
                <p className="ph-head-model">{t('mock.model')}</p>
              </div>
            </div>
            <div className="ph-msgs">
              <p className="ph-user">{t('mock.user')}</p>
              <p className="ph-action">
                <Icon name="reader" size={12} />
                {t('mock.actionReadPage')}
              </p>
              <p className="ph-action">
                <Icon name="list" size={12} />
                {t('mock.actionSelect')}
              </p>
              <p className="ph-answer">{t('mock.answer')}</p>
            </div>
            <div className="ph-input">
              <span>{t('mock.placeholder')}</span>
              <i className="ph-send" />
            </div>
          </div>
        </div>
        <div className="ph-callout" data-depth="-0.08">
          <div className="ph-dialog">
            <p className="ph-dialog-title">{t('mock.confirmTitle')}</p>
            <p className="ph-dialog-body">{t('mock.confirmBody')}</p>
            <p className="ph-dialog-check">
              <i />
              {t('mock.confirmAlways')}
            </p>
            <div className="ph-dialog-buttons">
              <span>{t('mock.deny')}</span>
              <span className="ph-allow">{t('mock.allow')}</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption>{t('mock.caption')}</figcaption>
    </figure>
  );
}
