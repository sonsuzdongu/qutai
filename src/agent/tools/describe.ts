import { t, type MessageKey } from '../../i18n';
import { fileNameFromUrl } from '../../device/download';
import { composedFileName, isFileFormat } from '../../device/composedFile';
import { looksLikeHandle } from '../contactHandles';
import { describeBookmarkCall } from '../bookmarkTool';
import { describeSettingsCall } from '../settingsTool';
import { looksLikeIdNumber } from '../memory';
import { cutText } from '../../utils/wellFormed';
import { capitalizeFirst, stepTabTitle, targetWords } from '../stepTarget';
import { describeSiteRulesCall } from '../siteRulesTool';
import { describePageCustomCall } from '../pageCustomTool';
import { describeScriptCall } from '../scriptTool';
import { describeAppsCall } from '../appTool';

/**
 * The short line the chat shows for each tool call (the step line), and what the action history and the
 * confirmation dialog name.
 */

/** Who a call or message is for in its step line when no name was given: the number, or "a contact" for a handle. */
export function phoneWho(phone: unknown): string {
  return looksLikeHandle(phone) ? t('action.aContact') : String(phone ?? '');
}

/** Short label shown in the chat for each tool call. */
export function describeToolCall(name: string, input: Record<string, unknown>): string {
  const str = (value: unknown) => String(value ?? '');
  // A template may start with the element (Turkish "Bir düğmeye dokunuluyor"): its first letter is capitalised.
  const onTarget = (key: MessageKey, params: Record<string, string> = {}) =>
    capitalizeFirst(t(key, { ...params, target: targetWords(name, input) }));
  const tabLine = (key: 'action.switchTab' | 'action.readTab' | 'action.closeTab') => {
    const title = stepTabTitle(input);
    return title ? t(key, { title }) : t(`${key}Plain`);
  };
  switch (name) {
    case 'read_page':
      return t('action.readPage');
    case 'read_source':
      return t('action.readSource');
    case 'navigate':
      return t('action.navigate', { url: str(input.url) });
    case 'go_back':
      return t('action.goBack');
    case 'click':
      return onTarget('action.click');
    case 'type':
      return input.memory !== undefined && input.memory !== null && input.memory !== ''
        ? onTarget('action.typeHidden')
        : onTarget('action.type', { text: cutText(str(input.text), 40) });
    case 'select_option':
      return onTarget('action.select', { value: str(input.value) });
    case 'scroll':
      return t('action.scroll', { direction: str(input.direction) });
    case 'scroll_to':
      return onTarget('action.scrollTo');
    case 'save_pdf':
      return t(input.from_screenshots === true ? 'action.savePdfScreenshots' : 'action.savePdf');
    case 'save_screenshot':
      return t(input.full_page === true ? 'action.saveFullScreenshot' : 'action.saveScreenshot');
    case 'view_screenshot':
      return t('action.viewScreenshot');
    case 'view_attachment':
      return t('action.viewAttachment');
    case 'edit_image':
      return t('action.editImage');
    case 'upload_image':
      return onTarget('action.uploadImage');
    case 'upload_file':
      return onTarget('action.uploadFile');
    case 'share':
      return t(input.app === 'whatsapp' ? 'action.shareWhatsApp' : 'action.share');
    case 'read_pdf':
      return input.view_pages !== undefined && input.view_pages !== null
        ? t('action.viewPdfPages')
        : t('action.readPdf');
    case 'click_at':
      return t('action.clickAt', { x: str(input.x), y: str(input.y) });
    case 'read_aloud':
      return t(input.text ? 'action.readAloudText' : 'action.readAloudPage');
    case 'list_tabs':
      return t('action.listTabs');
    case 'open_tab':
      return t('action.openTab', { url: str(input.url) });
    case 'switch_tab':
      return tabLine('action.switchTab');
    case 'read_tab':
      return tabLine('action.readTab');
    case 'search_history':
      if (input.by_site === true)
        return str(input.query).trim()
          ? t('action.topSitesFor', { query: str(input.query) })
          : t('action.topSites');
      return t('action.searchHistory', { query: str(input.query) });
    case 'bookmarks':
      return describeBookmarkCall(input);
    case 'list_saved_tasks':
      return t('action.listSavedTasks');
    case 'get_saved_task':
      return t('action.getSavedTask', { name: cutText(str(input.name).trim() || str(input.id), 60) });
    case 'settings':
      return describeSettingsCall(input);
    case 'try_hide':
    case 'save_site_rules':
    case 'site_rules':
      return describeSiteRulesCall(name, input);
    case 'restyle_page':
    case 'page_cookies':
      return describePageCustomCall(name, input);
    case 'run_script':
      return describeScriptCall(input);
    case 'apps':
      return describeAppsCall(input);
    case 'draft_email':
      return t('action.draftEmail', { subject: cutText(str(input.subject), 60) });
    case 'find_contact':
      return t('action.findContact', { name: cutText(str(input.name).trim(), 60) });
    case 'offer_call':
      return t('action.offerCall', { who: cutText(str(input.name).trim() || phoneWho(input.phone), 60) });
    case 'draft_sms':
      return t('action.draftSms', { who: cutText(str(input.name).trim() || phoneWho(input.phone), 60) });
    case 'draft_whatsapp':
      return str(input.name).trim() || str(input.phone).trim()
        ? t('action.draftWhatsApp', { who: cutText(str(input.name).trim() || phoneWho(input.phone), 60) })
        : t('action.draftWhatsAppNoNumber');
    case 'close_tab':
      return tabLine('action.closeTab');
    case 'close_tabs':
      return t('action.closeTabs');
    case 'take_notes':
      return t('action.takeNotes');
    case 'wait':
      return t('action.wait', { seconds: str(input.seconds) });
    case 'remember':
      // An ID or passport number is saved hidden: the chat and the action history don't repeat it either.
      return looksLikeIdNumber(str(input.text))
        ? t('action.rememberHidden')
        : t('action.remember', { text: cutText(str(input.text), 80) });
    case 'forget':
      return t('action.forget');
    case 'add_calendar_event':
      return t('action.addCalendarEvent', { title: cutText(str(input.title), 60) });
    case 'add_reminder':
      return t('action.addReminder', { title: cutText(str(input.title), 60) });
    case 'schedule_notification':
      return t('action.scheduleNotification', { title: cutText(str(input.title), 60) });
    case 'get_location':
      return t('action.getLocation');
    case 'save_file':
      return t('action.saveFile', { name: composedFileName(input.name, isFileFormat(input.format) ? input.format : 'txt') });
    case 'download_file':
      return typeof input.url === 'string' && input.url.trim()
        ? t('action.downloadFile', { name: fileNameFromUrl(input.url.trim()) })
        : onTarget('action.downloadFileRef');
    case 'read_calendar':
      return t('action.readCalendar');
    case 'request_approval':
      return t(
        input.kind === 'pay' ? 'action.requestApprovalPay' : input.kind === 'change' ? 'action.requestApprovalChange' : 'action.requestApproval',
      );
    case 'open_settings':
      return t(
        input.target === 'app'
          ? 'action.openAppSettings'
          : input.target === 'default_browser'
            ? 'action.openDefaultBrowserSettings'
            : 'action.openSystemSettings',
      );
    default:
      return name;
  }
}
