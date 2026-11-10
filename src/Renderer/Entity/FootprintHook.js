/**
 * Renderer/Entity/FootprintHook.js
 *
 * Where entities leave Chase Walk prints: EffectManager sets leave(x, y, direction, left) when it loads. EntityWalk
 * can't import EffectManager itself (EffectManager imports Entity).
 */
const FootprintHook = { leave: null };

export default FootprintHook;
