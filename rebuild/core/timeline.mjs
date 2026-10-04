// Simulation time owns releases; animation consumes the emitted events.
export class SpellTimeline {
  #mana; #skills; #stepMs; #maxCatchupSteps; #tick = 0; #accumulator = 0;
  #sequence = 0; #castSequence = 0; #paused = false; #pending = null;
  #cooldowns = new Map(); #events = [];

  constructor({ mana, skills, stepMs = 1000 / 60, maxCatchupSteps = 120 }) {
    if (!Number.isFinite(stepMs) || stepMs <= 0 || !Array.isArray(skills) ||
        !Number.isSafeInteger(maxCatchupSteps) || maxCatchupSteps < 1) throw new TypeError('Invalid clock or skills');
    this.mana = mana;
    this.#skills = new Map(skills.map(skill => {
      if (!skill.id || !Number.isInteger(skill.windupTicks) || skill.windupTicks < 0 ||
          !Number.isInteger(skill.cooldownTicks) || skill.cooldownTicks < 0 ||
          !Number.isSafeInteger(skill.cost) || skill.cost < 0) throw new TypeError('Invalid skill');
      return [skill.id, Object.freeze({ ...skill })];
    }));
    if (this.#skills.size !== skills.length) throw new TypeError('Duplicate skill');
    this.#stepMs = stepMs;
    this.#maxCatchupSteps = maxCatchupSteps;
  }

  get mana() { return this.#mana; }
  set mana(value) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid mana');
    this.#mana = value;
  }
  get tick() { return this.#tick; }
  get paused() { return this.#paused; }

  #emit(type, data) {
    this.#events.push(Object.freeze({ version: 1, id: `spell:${++this.#sequence}`, tick: this.#tick, type, ...data }));
  }

  begin(skillId, power = 1) {
    const skill = this.#skills.get(skillId);
    if (this.#paused || this.#pending || !skill || !Number.isFinite(power) || power < 1) return false;
    if ((this.#cooldowns.get(skillId) ?? 0) > this.#tick || this.mana < skill.cost) return false;
    const castId = `cast:${++this.#castSequence}`;
    this.#pending = { skill, power, castId, releaseTick: this.#tick + skill.windupTicks };
    this.#emit('CastStarted', { castId, skillId, power });
    if (skill.windupTicks === 0) this.#release();
    return true;
  }

  #release() {
    if (!this.#pending || this.#tick < this.#pending.releaseTick) return;
    const { skill, castId, power } = this.#pending;
    const cost = Math.ceil(skill.cost * (power > 1.4 ? 1.25 : 1));
    if (!Number.isSafeInteger(cost) || cost > this.mana) { this.cancel('resources'); return; }
    this.mana -= cost;
    this.#pending = null;
    this.#cooldowns.set(skill.id, this.#tick + skill.cooldownTicks);
    this.#emit('CastReleased', { castId, skillId: skill.id, power, cost, mana: this.mana });
  }

  cancel(reason = 'input') {
    if (!['input', 'pause', 'interrupt', 'resources'].includes(reason)) throw new TypeError('Invalid cancel reason');
    if (!this.#pending) return false;
    const { skill, castId } = this.#pending;
    this.#pending = null;
    this.#emit('CastCancelled', { castId, skillId: skill.id, reason });
    return true;
  }

  setPaused(value) {
    if (this.#paused === !!value) return;
    this.#paused = !!value;
    this.#accumulator = 0;
    if (this.#paused) this.cancel('pause');
  }

  advance(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new TypeError('Invalid elapsed time');
    if (this.#paused) return;
    // Discard suspension debt rather than blocking the browser with unbounded catch-up.
    this.#accumulator += Math.min(elapsedMs, this.#stepMs * this.#maxCatchupSteps);
    let steps = 0;
    while (steps < this.#maxCatchupSteps && this.#accumulator + 1e-9 >= this.#stepMs) {
      this.#accumulator = Math.max(0, this.#accumulator - this.#stepMs);
      this.#tick++;
      steps++;
      if (this.#pending && this.#tick >= this.#pending.releaseTick) this.#release();
    }
  }

  drainEvents() {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
