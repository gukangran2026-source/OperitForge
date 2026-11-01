"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onToolLogRender = onToolLogRender;
const log_screen_1 = require("./log-screen");
const log_model_1 = require("./log-model");
function onToolLogRender(event) {
    const enabled = Java.getApplicationContext().getSharedPreferences('claude_code_theme_v1', 0).getString('global:enabled', '') === 'yes';
    const xmlContent = String(event.eventPayload?.xmlContent || '');
    const parsed = (0, log_model_1.parseToolLog)(xmlContent);
    if (!enabled || !parsed)
        return { handled: false };
    return { handled: true, composeDsl: { screen: log_screen_1.default, state: { xmlContent } } };
}
