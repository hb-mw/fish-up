// Eels of the SHARKS art set: green moray, gulper eel, giant oarfish — sinuous bodies drawn as a straight cached
// sprite laid along a travelling-wave spine (eel-spine.js), with live jaws, fins and lights on top.
import { moray_eel } from './eel-moray.js';
import { gulper_eel } from './eel-gulper.js';
import { oarfish } from './eel-oarfish.js';

/** @type {Record<string, {draw:Function, drawGlow?:Function, bounds:object, mouth:object}>} */
export const DRAWERS = { moray_eel, gulper_eel, oarfish };
