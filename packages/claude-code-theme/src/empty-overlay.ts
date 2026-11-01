/**
 * Empty-chat state: switches the chat background to the icon + greeting art
 * while the conversation has no messages, and restores the normal background
 * as soon as the user sends the first message.
 *
 * Why a background instead of an overlay: Operit renders the whole UI (drawer,
 * top bar, chat, input) inside a single Compose container that sits under
 * android.R.id.content. Anything injected as a sibling View therefore floats
 * above the drawer, blocks the IME, and lingers across screen switches. A
 * background lives at the bottom of that container, so it behaves correctly in
 * all three cases.
 *
 * Host constraint: hook callbacks must be named exports, not inline closures.
 */

import { switchEmptyStateBackground } from './theme';
import { recordObservation } from './habits';

const PREFS = 'claude_code_theme_v1';
/** Either switch being on is enough to show art; both off means plain background. */
const OPT_EMPTY_ICON = 'opt:empty_icon';
const OPT_EMPTY_SLOGAN = 'opt:empty_slogan';
const OPT_EMPTY_LEGACY = 'opt:empty_state_test';

/** Chat id whose empty-state background is currently applied, '' when none. */
let activeChatId = '';
/** Serialises background switches; see apply(). */
let queue: Promise<void> = Promise.resolve();

/** Diagnostics: append a line to a log file so the hook path can be verified. */
function logLine(message: string) {
  try {
    const path = '/sdcard/Download/Operit/dev_package/hook.log';
    const FileOutputStream = Java.type('java.io.FileOutputStream');
    const StringClass = Java.type('java.lang.String');
    const fos = new FileOutputStream(path, true);
    fos.write(StringClass.newInstance(message + '\n').getBytes('UTF-8'));
    fos.flush();
    fos.close();
  } catch (error) {
    // ignore
  }
}

function readSwitch(storage: JavaBridgeInstance, key: string, legacy: boolean): boolean {
  const raw = String(storage.getString(key, ''));
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return legacy;
}

/** True when at least one of the two switches wants art on screen. */
function enabled(): boolean {
  try {
    const app = Java.getApplicationContext();
    const storage = app.getSharedPreferences(PREFS, 0);
    // Upgrading from 1.8.0: the single old switch seeds both new ones.
    const raw = String(storage.getString(OPT_EMPTY_LEGACY, ''));
    const legacy = raw === 'on';
    return readSwitch(storage, OPT_EMPTY_ICON, legacy) || readSwitch(storage, OPT_EMPTY_SLOGAN, legacy);
  } catch (error) {
    return false;
  }
}

/**
 * Applies or removes the empty-state background.
 *
 * Requests are serialised through a promise chain rather than dropped. A burst
 * of view/runtime events regularly overlaps, and `switchEmptyStateBackground`
 * takes a shared lock, so an earlier naive `if (pending) return` threw away the
 * newest request and left the art stuck in whatever state it was in. Chaining
 * guarantees the last requested state is the one that ends up applied.
 */
function apply(empty: boolean) {
  queue = queue.then(() => doApply(empty)).catch((error) => {
    logLine('[bg] chain failed: ' + String(error));
  });
}

async function doApply(empty: boolean) {
  try {
    const result: any = await switchEmptyStateBackground(empty);
    logLine('[bg] switch empty=' + empty + ' -> ' + JSON.stringify(result));
  } catch (error) {
    logLine('[bg] switch failed: ' + String(error));
  }
}

/** Hook: chat view opened / updated / closed. */
export function onChatViewEvent(event: any) {
  const name = String(event && event.eventName ? event.eventName : '');
  const payload = event && event.eventPayload ? event.eventPayload : {};
  const chatId = payload.chatId ? String(payload.chatId) : '';

  if (name === 'view_closed') {
    // The view that closed may not be the one showing the art: switching from
    // an empty chat to another screen fires this too, and clearing then would
    // blank art that a still-open empty view depends on. Only clear when the
    // closed view is the one we applied to.
    const closedId = payload.chatId ? String(payload.chatId) : '';
    if (activeChatId && (!closedId || closedId === activeChatId)) {
      activeChatId = '';
      logLine('[view] closed chatId=' + closedId + ', clearing');
      apply(false);
    }
    return;
  }
  if (name !== 'view_opened' && name !== 'view_updated') return;

  if (!chatId) return;

  if (!enabled()) {
    if (activeChatId) {
      activeChatId = '';
      apply(false);
    }
    return;
  }

  Tools.Chat.getMessages(chatId, { order: 'asc', limit: 1 })
    .then((result: any) => {
      const messages = result && result.messages ? result.messages : [];
      logLine('[view] ' + name + ' chatId=' + chatId + ' messages=' + messages.length);
      if (messages.length > 0) {
        // The conversation has content: normal background.
        if (activeChatId) {
          activeChatId = '';
          apply(false);
        }
        return;
      }
      // Empty conversation: show the icon + greeting art.
      if (activeChatId === chatId) return;
      activeChatId = chatId;
      // Record one local observation before choosing, so the night-owl branch
      // can react to the moment the user actually opened a chat.
      try {
        const app = Java.getApplicationContext();
        const storage = app.getSharedPreferences(PREFS, 0);
        const habit = recordObservation(storage, new Date());
        logLine('[habit] total=' + habit.total + ' nightOwl=' + habit.nightOwl
          + ' bytes=' + habit.bytes + ' evicted=' + habit.evicted);
      } catch (error) {
        logLine('[habit] record failed: ' + String(error));
      }
      apply(true);
    })
    .catch((error: any) => {
      logLine('[view] getMessages failed: ' + String(error));
    });
}

/** Hook: a message was persisted, so the conversation is no longer empty. */
export function onChatMessageEvent(event: any) {
  const name = String(event && event.eventName ? event.eventName : '');
  if (name !== 'message_persisted') return;
  if (!activeChatId) return;
  // Only the chat currently showing the art may clear it. Messages landing in
  // other conversations (background replies, parallel chats) must not.
  const payload = event && event.eventPayload ? event.eventPayload : {};
  const chatId = payload.chatId ? String(payload.chatId) : '';
  if (chatId && chatId !== activeChatId) return;
  logLine('[msg] message_persisted chatId=' + chatId + ', restoring normal background');
  activeChatId = '';
  apply(false);
}

/** Hook: AI runtime state changed. Extra safety net for the same transition. */
export function onChatRuntimeEvent(event: any) {
  if (!event) return;
  if (String(event.eventName ? event.eventName : '') !== 'state_changed') return;
  const payload = event.eventPayload || {};
  // `chatId` is the conversation the state belongs to. Without this check a
  // reply running in ANY other chat tears the art off the empty one, which is
  // exactly what happens when the user opens a new chat while another is busy.
  const chatId = payload.chatId ? String(payload.chatId) : '';
  if (!chatId || chatId !== activeChatId) return;
  const state = payload.state ? String(payload.state) : '';
  if (!state || state === 'idle' || state === 'completed') return;
  logLine('[runtime] state=' + state + ' chatId=' + chatId + ', restoring normal background');
  activeChatId = '';
  apply(false);
}

/** Registers all hooks. Called from registerToolPkg(). */
export function registerEmptyOverlay() {
  ToolPkg.registerChatViewHook({
    id: 'claude_theme_empty_view',
    function: onChatViewEvent
  });
  ToolPkg.registerChatMessageHook({
    id: 'claude_theme_empty_message',
    function: onChatMessageEvent
  });
  ToolPkg.registerChatRuntimeHook({
    id: 'claude_theme_empty_runtime',
    function: onChatRuntimeEvent
  });
}