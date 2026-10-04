const id = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);

// Call only from the simulation boundary, with simulation-owned transform data.
export function toContractEvent(event, context) {
  for (const key of ['runId', 'timelineId', 'actorId', 'actionTimelineId']) {
    if (typeof context[key] !== 'string' || !id.test(context[key])) throw new TypeError(`Invalid ${key}`);
  }
  if (context.causationId != null && (typeof context.causationId !== 'string' || !id.test(context.causationId))) throw new TypeError('Invalid causation ID');
  if (!point(context.origin) || !point(context.direction) ||
      Math.abs(Math.hypot(context.direction.x, context.direction.y) - 1) > 1e-6) throw new TypeError('Invalid simulation transform');
  if (!Number.isSafeInteger(event.tick) || event.tick < 0 ||
      typeof event.castId !== 'string' || !id.test(event.castId) ||
      typeof event.skillId !== 'string' || !id.test(event.skillId) ||
      typeof event.id !== 'string' || !/^spell:[1-9][0-9]*$/.test(event.id)) throw new TypeError('Invalid internal event');
  const sequence = Number(event.id.split(':')[1]);
  if (!Number.isSafeInteger(sequence)) throw new TypeError('Invalid event sequence');
  const payload = { castId: event.castId, skillId: event.skillId };
  if (event.type === 'CastCancelled') payload.reason = event.reason;
  else if (event.type === 'CastStarted' || event.type === 'CastReleased') {
    if (!Number.isFinite(event.power) || event.power < 1) throw new TypeError('Invalid spell scale');
    payload.actionTimelineId = context.actionTimelineId;
    // Scale currently means requested spell strength, not sprite size or geometry radius.
    payload.scale = event.power;
    if (event.type === 'CastReleased') {
      if (!Number.isFinite(event.cost) || event.cost < 0) throw new TypeError('Invalid resource cost');
      payload.resourceCost = event.cost;
      payload.origin = { x: context.origin.x, y: context.origin.y };
      payload.direction = { x: context.direction.x, y: context.direction.y };
    }
  } else throw new TypeError('Unsupported lifecycle event');
  if (event.type === 'CastCancelled' && !['resources', 'input', 'pause', 'interrupt'].includes(event.reason)) throw new TypeError('Invalid cancellation');
  return {
    documentType: 'event', contractVersion: '1.0.0',
    eventId: `${context.runId}/${context.timelineId}/${event.id}`,
    authority: 'simulation', runId: context.runId, timelineId: context.timelineId,
    tick: event.tick, sequence, causationId: context.causationId ?? null,
    source: context.actorId, target: null, type: event.type, payload
  };
}
