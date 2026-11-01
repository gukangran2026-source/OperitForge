"use strict";
/**
 * Empty chat overlay hook: shows a centered sparkle icon + time-aware greeting
 * when opening an empty chat, and fades it out when the first message arrives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEmptyOverlayHook = registerEmptyOverlayHook;
const greetings_1 = require("./greetings");
const OVERLAY_TAG = 'claudeCodeThemeEmptyOverlay';
let activeOverlayDialogs = new Map();
let isHookRegistered = false;
/**
 * Register the overlay hook (call this from main.ts initialization).
 */
function registerEmptyOverlayHook() {
    if (isHookRegistered)
        return;
    isHookRegistered = true;
    // Listen for chat view opened
    ToolPkg.registerChatViewHook({
        id: 'claude-code-theme-empty-overlay',
        function: async (event) => {
            if (event.eventName !== 'view_opened')
                return;
            const chatId = event.eventPayload.chatId;
            if (!chatId)
                return;
            // Check if chat is empty
            const messagesResult = await Tools.Chat.getMessages(chatId, { limit: 1 });
            if (messagesResult.messages.length > 0)
                return;
            // Show overlay on main thread
            showOverlayOnMainThread(chatId);
        }
    });
    // Listen for first message to dismiss overlay
    ToolPkg.registerChatMessageHook({
        id: 'claude-code-theme-empty-overlay-dismiss',
        function: async (event) => {
            if (event.eventName !== 'message_persisted')
                return;
            const chatId = event.eventPayload.chatId;
            dismissOverlay(chatId);
        }
    });
}
/**
 * Show overlay dialog on Android main thread.
 */
function showOverlayOnMainThread(chatId) {
    const greeting = (0, greetings_1.getGreeting)();
    Java.type('android.os.Handler')(Java.type('android.os.Looper').getMainLooper()).post(Java.implement('java.lang.Runnable', {
        run: () => {
            try {
                const Context = Java.type('android.content.Context');
                const Dialog = Java.type('android.app.Dialog');
                const Window = Java.type('android.view.Window');
                const WindowManager = Java.type('android.view.WindowManager');
                const ColorDrawable = Java.type('android.graphics.drawable.ColorDrawable');
                const Color = Java.type('android.graphics.Color');
                const Gravity = Java.type('android.view.Gravity');
                const context = Java.type('com.operit.android.App').instance;
                const dialog = new Dialog(context, Java.type('android.R').style.Theme_Translucent_NoTitleBar_Fullscreen);
                // Make dialog transparent and non-blocking
                const window = dialog.getWindow();
                window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                window.setFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE);
                window.setGravity(Gravity.CENTER);
                // Create ComposeView with Canvas
                const ComposeView = Java.type('androidx.compose.ui.platform.ComposeView');
                const composeView = new ComposeView(context);
                // Set Compose content using Operit's Compose DSL bridge
                const content = createOverlayContent(greeting);
                Java.type('com.operit.android.ui.compose.ComposeBridge').setContent(composeView, content);
                dialog.setContentView(composeView);
                dialog.show();
                activeOverlayDialogs.set(chatId, dialog);
            }
            catch (e) {
                console.error('[EmptyOverlay] Failed to show overlay:', e);
            }
        }
    }));
}
/**
 * Dismiss overlay with fade-out animation.
 */
function dismissOverlay(chatId) {
    const dialog = activeOverlayDialogs.get(chatId);
    if (!dialog)
        return;
    Java.type('android.os.Handler')(Java.type('android.os.Looper').getMainLooper()).post(Java.implement('java.lang.Runnable', {
        run: () => {
            try {
                // Simple fade-out: just dismiss (add animation later if needed)
                dialog.dismiss();
                activeOverlayDialogs.delete(chatId);
            }
            catch (e) {
                console.error('[EmptyOverlay] Failed to dismiss overlay:', e);
            }
        }
    }));
}
/**
 * Create Compose content: centered sparkle icon + greeting text.
 */
function createOverlayContent(greeting) {
    // Return Compose DSL object
    return {
        type: 'Box',
        props: {
            modifier: {
                fillMaxSize: true,
            },
            contentAlignment: 'Center',
        },
        children: [
            {
                type: 'Column',
                props: {
                    horizontalAlignment: 'CenterHorizontally',
                },
                children: [
                    // Sparkle icon using Canvas
                    {
                        type: 'Canvas',
                        props: {
                            modifier: {
                                width: { value: 48, unit: 'dp' },
                                height: { value: 48, unit: 'dp' },
                            },
                            commands: createSparklePathCommands(),
                        },
                    },
                    // Spacing
                    {
                        type: 'Spacer',
                        props: {
                            modifier: {
                                height: { value: 16, unit: 'dp' },
                            },
                        },
                    },
                    // Greeting text
                    {
                        type: 'Text',
                        props: {
                            text: greeting,
                            fontSize: { value: 18, unit: 'sp' },
                            color: '#E0E0E0', // Light gray for visibility on both dark/light
                        },
                    },
                ],
            },
        ],
    };
}
/**
 * Create sparkle icon path commands (8-pointed star).
 */
function createSparklePathCommands() {
    const centerX = 24; // dp
    const centerY = 24;
    const outerRadius = 20;
    const innerRadius = 8;
    const points = 8;
    const path = [];
    for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) {
            path.push({
                type: 'moveTo',
                x: { value: x, unit: 'dp' },
                y: { value: y, unit: 'dp' },
            });
        }
        else {
            path.push({
                type: 'lineTo',
                x: { value: x, unit: 'dp' },
                y: { value: y, unit: 'dp' },
            });
        }
    }
    path.push({ type: 'close' });
    return [
        {
            type: 'path',
            path: path,
            color: '#FFB84D', // Warm amber for sparkle
            filled: true,
            unit: 'dp',
        },
    ];
}
