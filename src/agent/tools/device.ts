import { Platform } from 'react-native';
import { addCalendarEvent, addReminder, DeviceToolError, readCalendarEvents } from '../../device/calendar';
import { openDefaultBrowserSettings } from '../../device/defaultBrowser';
import { notificationOrigin, scheduleNotification } from '../../device/notifications';
import { kindForSchedule } from '../alwaysAllow';
import { t } from '../../i18n';
import { ensureLocationPermission, LocationUnavailableError, readPosition } from '../../device/location';
import { openSystemSettings, PermissionDeniedError } from '../../device/settings';
import { deviceName, uiLabel, uiPath } from '../uiLabels';
import { declinedNotice, incognitoNotice } from '../stepLine';
import { siteKey } from '../sitePolicy';
import { describeCalendarRead, describePlan, formatCalendarRead, localIso, planCalendarRead, planSchedule, SchedulingTool } from '../scheduling';
import { cutText } from '../../utils/wellFormed';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * Phone tools that confirm on their own with their details: settings screens, calendar events, reminders,
 * notifications, reading the calendar and the location.
 */

/**
 * Opens a settings screen. The phone's settings send Qutai to the background, so this returns as
 * soon as they are open: the run pauses until the user comes back, and the model is told to wait for them.
 */
export async function openSettingsTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const target = String(input.target ?? 'system');
  if (target === 'app') {
    if (!ctx.showAppSettings) return { content: "Qutai's settings screen is not available here.", isError: true };
    ctx.showAppSettings();
    return {
      content:
        `Opened Qutai's own settings screen, ${uiLabel('settings.title')}. Its sections: ` +
        `${uiPath('settings.assistant')} (AI provider, model and key, memory, saved tasks; site permissions are in the page menu, not here), ` +
        `${uiPath('settings.privacySection')}, ${uiPath('settings.appearance')}, ${uiPath('settings.search')}, ` +
        `${uiPath('backup.section')}, ${uiPath('settings.about')}. Tell the user briefly what to change there, ` +
        'naming the section as written here; they close it when done.',
      isError: false,
    };
  }
  if (target !== 'system' && target !== 'default_browser')
    return { content: 'target must be "system", "default_browser" or "app".', isError: true };
  // INTRO-32: without Apple's web-browser entitlement the phone's Default Browser App list doesn't offer Qutai.
  if (target === 'default_browser' && Platform.OS === 'ios')
    return { content: `Qutai can't be chosen as the default browser on iPhone, iPad or Mac yet. Tell the user that plainly; don't send them to the ${deviceName()}'s settings for it.`, isError: true };
  try {
    if (target === 'default_browser') await openDefaultBrowserSettings();
    else await openSystemSettings();
  } catch (e) {
    return {
      content:
        `The ${deviceName()} refused to open its settings (${e instanceof Error ? e.message : String(e)}). ` +
        `Tell the user where to find it themselves: Qutai's page in the ${deviceName()}'s settings app, under its apps.`,
      isError: true,
    };
  }
  return {
    content:
      `Opened the ${deviceName()}'s settings; the user has left Qutai to change the setting there. Don't call more tools now: ` +
      'tell them in one short sentence what to change, and wait for them to say they are done.',
    isError: false,
  };
}

/** What the action history says about a scheduling tool: what kind of thing was added, not its content. */
export const SCHEDULING_LOG_KEYS = {
  add_calendar_event: 'action.addCalendarEventLogged',
  add_reminder: 'action.addReminderLogged',
  schedule_notification: 'action.scheduleNotificationLogged',
} as const;

/**
 * Calendar events, reminders and notifications. Never from incognito conversations, and the user
 * confirms every write with its details, whatever the "ask before actions" setting.
 */
export async function schedulingTool(name: SchedulingTool, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        'Not allowed: this conversation involves incognito tabs, so nothing is added to the calendar, reminders ' +
        'or notifications. Tell the user they can ask again from a normal tab.',
      isError: true,
      notice: incognitoNotice(),
    };
  }
  const plan = planSchedule(name, input);
  if (typeof plan === 'string') return { content: plan, isError: true };
  const android = Platform.OS === 'android';
  if (plan.kind === 'reminder' && android && !plan.due) {
    return {
      content:
        'On Android a reminder needs a due date and time (it becomes a calendar event with an alarm). ' +
        'Ask the user when they want to be reminded.',
      isError: true,
    };
  }
  if (!ctx.confirm) return { content: 'This needs the user\'s confirmation, which is not available here.', isError: true };
  if (!(await ctx.confirm(describePlan(plan, android), null, kindForSchedule(plan.kind))))
    return { content: 'The user declined this. Ask them how to proceed.', isError: true, notice: declinedNotice() };
  try {
    if (plan.kind === 'event') {
      const { calendar, note } = await addCalendarEvent(plan);
      return { content: `Added the event to the calendar "${calendar}".${note}`, isError: false };
    }
    if (plan.kind === 'reminder') {
      const where = await addReminder(plan);
      return { content: `Added the reminder to ${where}`, isError: false };
    }
    const from = ctx.browser.getTab(ctx.askedFrom?.id ?? ctx.agentTab.id);
    await scheduleNotification(plan, from ? notificationOrigin(from) : null);
    return {
      content:
        plan.delaySeconds !== undefined
          ? `Scheduled the notification. Qutai will show it ${plan.delaySeconds} seconds from now.`
          : 'Scheduled the notification. Qutai will show it at that time.',
      isError: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: e instanceof DeviceToolError ? message : `Could not add it: ${message}`, isError: true };
  }
}

/** What the action history says about read_calendar: that it was read and the range, never the events. */
export function readCalendarLog(input: Record<string, unknown>): string {
  const plan = planCalendarRead(input);
  if (typeof plan === 'string') return t('action.readCalendar');
  const when = (date: Date) => localIso(date).replace('T', ' ');
  return t('action.readCalendarLogged', { from: when(plan.start), to: when(plan.end) });
}

/**
 * The user's calendar for the assistant. Same rules as the write tools: never in incognito conversations, and the
 * user confirms every read with the range and where it goes, whatever the "ask before actions" setting.
 */
export async function readCalendarTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        "Not allowed: this conversation involves incognito tabs, so Qutai doesn't read the calendar from it. Tell the " +
        'user they can ask again from a normal tab. Do not guess their availability.',
      isError: true,
      notice: incognitoNotice(),
    };
  }
  const plan = planCalendarRead(input);
  if (typeof plan === 'string') return { content: plan, isError: true };
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  if (!(await ctx.confirm(describeCalendarRead(plan), null, 'calendarRead'))) {
    return {
      content:
        "The user declined to share their calendar. Don't guess their schedule or availability: ask them directly.",
      isError: true,
      notice: declinedNotice(),
    };
  }
  try {
    const entries = await readCalendarEvents(plan);
    return { content: formatCalendarRead(plan, entries), isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof DeviceToolError) return { content: message, isError: true };
    return {
      content: `Could not read the calendar: ${message}. Don't guess the user's availability.`,
      isError: true,
    };
  }
}

/**
 * The user's location for the assistant. Never in incognito conversations (same rule as the calendar), the user
 * confirms every read, and the result goes only to the model: the action history just says it was read.
 */
export async function locationTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) {
    return {
      content:
        "Not allowed: this conversation involves incognito tabs, so Qutai doesn't share the location from it. Tell " +
        'the user they can ask again from a normal tab, or ask them for a starting point.',
      isError: true,
      notice: incognitoNotice(),
    };
  }
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const purpose = typeof input.purpose === 'string' ? cutText(input.purpose.trim(), 200) : '';
  const site = tab && !tab.isNewTab ? siteKey(tab.url) : null;
  const lines = [t('location.agentConfirm')];
  if (purpose) lines.push(`“${purpose}”`);
  if (site) lines.push(t('location.agentSite', { host: site }));
  if (!(await ctx.confirm(lines.join('\n\n'), null, 'location'))) {
    return {
      content: "The user declined to share their location. Don't guess it: ask them where to start from.",
      isError: true,
      notice: declinedNotice(),
    };
  }
  try {
    await ensureLocationPermission();
    const position = await readPosition({ highAccuracy: input.precise === true });
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    return {
      content:
        `Latitude: ${round(position.latitude)}\nLongitude: ${round(position.longitude)}\n` +
        `Accuracy: about ${Math.round(position.accuracy)} m\n` +
        `Measured: ${new Date(position.timestamp).toISOString()}\n` +
        'Use these coordinates for this task only (e.g. "lat,lng" in a maps directions URL). Never save them with ' +
        'remember. If the accuracy is large (approximate location), mention that the start point is approximate.',
      isError: false,
    };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return {
        content:
          'Permission denied: the user has not allowed Qutai to use their location. Offer them (with ask_user) to ' +
          `open Qutai's page in the ${deviceName()}'s settings with open_settings (target system), where they can allow it, ` +
          'or ask them for a starting point. Do not call get_location again unless they say they allowed it.',
        isError: true,
      };
    }
    if (e instanceof LocationUnavailableError && e.reason === 'servicesOff') {
      return {
        content:
          `Location services are turned off on the ${deviceName()}. Tell the user to turn on location in the ${deviceName()}'s ` +
          'settings, or ask them for a starting point.',
        isError: true,
      };
    }
    if (e instanceof LocationUnavailableError && e.reason === 'needsBuild') {
      return { content: `${e.message} Tell the user it is not available yet and ask for a starting point.`, isError: true };
    }
    return {
      content: `Could not read the location (${e instanceof Error ? e.message : String(e)}). Ask the user for a starting point.`,
      isError: true,
    };
  }
}
