export function runtimePerformance({ mobile = false, dpr = 1 } = {}) {
  // This bundled Phaser uses CSS-sized RESIZE buffers, not a global resolution option.
  return Object.freeze({ sourceDpr: Number.isFinite(dpr) ? Math.max(1, dpr) : 1,
    renderDpr: 1, dprCap: 1, lightingHz: mobile ? 10 : 20,
    lightingIntervalMs: mobile ? 100 : 50, frameSampleLimit: 180 });
}

export const loaderPercent = value => Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 90);
export const releaseRecoveryMs = heldMs => heldMs >= 1800 ? 240 : 60;

export function yieldToBrowser(schedule = done => requestAnimationFrame(() => setTimeout(done, 0))) {
  return new Promise(resolve => schedule(resolve));
}

export function clearTransientGraphics(scene) {
  for (const layer of [scene.fx, scene.groundFX, ...(scene.effectLayers || []), ...(scene.pressureFlowLayers || [])]) layer?.clear();
  scene.fxLights = [];
  scene.effectObservations = [];
  scene.lightDirty = true;
}

export function compactWaterAudit(output) {
  if (!output) return null;
  const { paused, active, allocated, dropped, byStage, impactState, budgets } = output;
  return { paused, active, allocated, dropped, byStage, impactState, budgets,
    missingTextures: output.missingTextures?.slice(0, 8), diagnostics: output.diagnostics?.slice(0, 8),
    lightCount: output.lights?.length || 0, flowPresent: !!output.flow,
    flowSerialized: false };
}
