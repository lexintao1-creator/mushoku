const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const frames = (roots, heights, feet = roots) => roots.map((root, i) => ({
  frame: i, rect: [(i % 4) * 640, Math.floor(i / 4) * 640, 640, 640],
  root, footProxy: feet[i], heightPx: heights[i],
}));

// Copied scalar measurements, not a runtime JSON fetch or planted-foot approval.
export const MEOWA_ACTOR_10 = freeze({
  worldHeight: 48,
  rowOrder: ['front', 'left', 'right', 'back'],
  strideDistance: 390 * 48 / 534,
  decodedTextureBytes: (3 * 2560 * 1920 + 6 * 1024 * 1024) * 4,
  heightMethods: { front: 'alpha128-bbox', back: 'alpha128-bbox', side: 'head-ROI-to-visible-support-sole' },
  idleStaffTips: { front: [674, 356], back: [693, 329], side: [339, 370] },
  castMotion: { tensionStartMs: 1800, tensionRampMs: 4200, tensionMaxPx: .28, recoilPeakMs: 28, recoilEndMs: 110, recoverEndMs: 240, recoilPx: 1.1 },
  castMeasurement: {
    method: 'alpha128; root X averages two boot bottom-five-row span centers, Y is lowest sole; staff tip is rounded blue-pixel centroid inside ROI',
    bluePredicate: 'alpha >= 128, B > R*1.3, G > R*1.15, B > 90',
    front: { alphaRange: [0,254], alpha128BBox: [249,12,776,987], heightPx: 975, root: [511.25,986], staffTip: [372,340], tipROI: [318,290,430,400], blueCount: 6007,
      soleROIs: [[260,800,395,990],[615,800,760,990]], soles: [[288,358,986],[664,735,986]], flip: false },
    side: { alphaRange: [0,254], alpha128BBox: [30,52,916,972], heightPx: 920, root: [599,971], staffTip: [77,329], tipROI: [30,270,135,385], blueCount: 6072,
      soleROIs: [[390,800,550,975],[695,800,830,975]], soles: [[406,506,952],[706,778,971]], flip: true },
    back: { alphaRange: [0,254], alpha128BBox: [116,16,986,995], heightPx: 979, root: [392.25,994], staffTip: [939,305], tipROI: [888,250,990,360], blueCount: 5983,
      soleROIs: [[120,810,255,1000],[550,810,715,1000]], soles: [[147,215,979],[571,636,994]], flip: false },
    status: 'inspected two-hand braced stills; subtle aim-axis sprite support motion only; not authored limb animation',
  },
  walkAxisMeasurement: {
    method: 'alpha128 row-span medians; mean head/shoulder rounded to 0.5px; pelvis observed, not pinned',
    roiX: [160, 405], topSearchY: [0, 180], offsets: [80, 210, 330], bandRadius: 10,
    front: [[308.5,322.5,302.5],[309,323,305],[309.5,322.5,308.5],[309,322.5,311],[308,322.5,309.5],[306,322.5,310.5],[309,322.5,311],[309,323,311],[309.5,322.5,306],[309.5,322.5,301.5],[309,322.5,297],[308,322.5,295]],
    back: [[307.5,307,305.5],[307,306.5,309],[306,307.5,310.5],[307,307,307.5],[306.5,307,304],[306.5,307,298],[308,306.5,296.5],[307,306.5,300],[305.5,306.5,298],[307,306.5,299],[307.5,307,300.5],[306.5,307,304.5]],
  },
  backIdleMeasurement: {
    sourcePath: 'C:/Users/2024/.codex/meowa-out/backidlefix11/Edit_only_the_solid_white_patch_inside_the_hair_loop_at_the_very_top_of_the_head_fill_that_patch_with_matching_a55c2b6c/edited.png',
    sha256: '8f31385a112d6b7ce68a0932854a8b9ab04c383a7b865533065f3c13989e7910',
    previousSourcePath: 'C:/Users/2024/.codex/meowa-out/backidle10/Edit_only_the_hair_color_of_the_rear-facing_character_in_the_first_image_to_match_the_warm_chestnut_brown_hair_69091514/edited.png',
    previousSha256: '63319b7bc108acff11567d62eb458dffdf271389ed3a2cf0d3fac7e8f6a2c0c8',
    originalSha256: '52b67eb9caf7ec4b769863ef50e756a18d9a2d8c8b6774e1c82999ae99c39a52',
    alphaRange: [0, 254], alpha128BBox: [275, 51, 747, 969], heightPx: 919,
    rootMethod: 'midpoint of alpha128 pixels at bottom row y969', root: [520.5, 969],
    staffMethod: 'rounded blue-pixel centroid in ROI [645,287,742,374]',
    staffTip: [693, 329], loopSample: [531, 84], loopSampleAlpha: 6, loopROI: [500, 65, 554, 104],
    comparison: { maskAdded: 357, maskRemoved: 831, outsideLoopAdded: 357, outsideLoopRemoved: 254, outsideLoopContourTolerancePx: 2 },
    status: 'geometry-checked repair candidate; transparent loop negative-space, NOT strict brown fill; main-copy-required; runtime-review-pending',
  },
  status: 'four-direction-adapter; source-foot-proxies; contact-unverified',
  limitations: [
    'Height measures alpha silhouette including hair/cloak, not a calibrated skeleton.',
    'Fixed reference height only: back walk varies 555..587px (5.494%); no frame fitting.',
    'Front/back X follows head/shoulder axis, Y remains sole proxy; side X is inferred pelvis.',
    'Idle boots visually close together, but planted contact and transitions need real review.',
    'right-idle filename faces LEFT visually; its mirror rule differs from right-walk.',
    'Left is mirrored side art; staff handedness is mirrored and not canon-verified.',
    'Back idle fix11 makes crown loop near-transparent negative-space, not a strict brown fill.',
    'Fix11 has minor RGB/alpha changes outside loop; contour stays within 2px, runtime review pending.',
    'Back idle metadata targets edited candidate; main must copy its exact PNG before integration.',
    'Cast/channel/release use measured two-hand stills with subpixel aim-axis support motion, not authored limb animation.',
    'Cast roots average boot supports; planted contact is unverified and support motion moves the whole still by at most 1.1 world pixels.',
    'Rear cast is three-quarter rear with a lateral staff, not a fully foreshortened upward rifle aim.',
    'Cast/idle transitions switch stills without an authored settling animation; side mirror changes handedness.',
    'Stride is the side candidate applied provisionally to all directions; validate foot slip.',
    'Front/back walk files need main to copy paid finals or override the relative paths.',
  ],
  files: {
    frontWalk: { path: 'realm/assets/rudy-front-walk.png', kind: 'sheet', size: [2560, 1920], cell: [640, 640], columns: 4, rows: 3, count: 12, mainCopyRequired: true,
      sourcePath: 'C:/Users/2024/.codex/meowa-out/frontwalk09/The_boy_walks_toward_the_camera_in_place_in_one_smooth_repeating_gait_Alternate_natural_heel_contacts_and_rela_4613dfbf/result_output_transparent_output_urls_png.png' },
    backWalk: { path: 'realm/assets/rudy-back-walk.png', kind: 'sheet', size: [2560, 1920], cell: [640, 640], columns: 4, rows: 3, count: 12, mainCopyRequired: true,
      sourcePath: 'C:/Users/2024/.codex/meowa-out/backwalk09/The_boy_walks_away_from_the_camera_in_place_in_one_smooth_repeating_gait_viewed_from_behind_Alternate_natural_559c3906/result_output_transparent_output_urls_png.png' },
    sideWalk: { path: 'realm/assets/rudy-side-walk.png', kind: 'sheet', size: [2560, 1920], cell: [640, 640], columns: 4, rows: 3, count: 12 },
    frontIdle: { path: 'realm/assets/rudy-front-idle.png', kind: 'image', size: [1024, 1024] },
    backIdle: { path: 'realm/assets/rudy-back-idle.png', kind: 'image', size: [1024, 1024] },
    sideIdle: { path: 'realm/assets/rudy-right-idle.png', kind: 'image', size: [1024, 1024] },
    frontCast: { path: 'realm/assets/rudy-front-cast.png', kind: 'image', size: [1024, 1024], sha256: 'da19545a9f56d903da1cc0cb64c63a85acbcbe6e7a565745707cd37ad8a55c22',
      sourcePath: 'C:/Users/2024/.codex/meowa-out/castfront12/Keep_the_exact_boy_and_front-facing_view_from_image_one_Give_him_the_two-handed_braced_casting_stance_from_ima_8005e8aa/edited.png' },
    backCast: { path: 'realm/assets/rudy-back-cast.png', kind: 'image', size: [1024, 1024], sha256: '42980c8722e51be2e2619e11757e3af732bdb87608628f118dc9ce788308945d',
      sourcePath: 'C:/Users/2024/.codex/meowa-out/castback12/Keep_the_exact_boy_and_rear-facing_view_from_image_one_Give_him_the_two-handed_braced_casting_stance_from_imag_ae8b47f5/edited.png' },
    sideCast: { path: 'realm/assets/rudy-side-cast.png', kind: 'image', size: [1024, 1024], sha256: '7dda8d234c9b2f39b04495db1de19f4e31a0b8643c1f05297578109260d4ff1b',
      sourcePath: 'C:/Users/2024/.codex/meowa-out/castside12/Keep_this_exact_boy_clothing_staff_full_body_size_and_left-facing_side_view_Change_only_his_casting_stance_bot_cd9ba755/edited.png' },
  },
  profiles: {
    front: { walk: 'frontWalk', idle: 'frontIdle', walkHeight: 585, idleHeight: 919, walkFlip: false, idleFlip: false, idleRoot: [473.5, 969], heightRange: [579, 592],
      frames: frames([[315.5,608],[316,606],[316,600],[316,595],[315.5,596],[314.5,608],[316,608],[316,607],[316,601],[316,595],[316,596],[315.5,606]], [587,592,590,585,579,583,585,592,591,585,582,585],
        [[302.5,608],[302,606],[300,600],[352.5,595],[347,596],[333,608],[332,608],[332.5,607],[333,601],[280,595],[293,596],[301.5,606]]) },
    back: { walk: 'backWalk', idle: 'backIdle', walkHeight: 582.5, idleHeight: 919, walkFlip: false, idleFlip: false, idleRoot: [520.5, 969], heightRange: [555, 587],
      frames: frames([[307.5,604],[307,603],[307,577],[307,584],[307,598],[307,606],[307.5,606],[307,605],[306,575],[307,586],[307.5,597],[307,607]], [583,582,555,572,587,587,580,585,559,574,583,586],
        [[297.5,604],[296,603],[280,577],[324.5,584],[325.5,598],[328,606],[346,606],[328.5,605],[336.5,575],[285.5,586],[280.5,597],[282,607]]) },
    side: { walk: 'sideWalk', idle: 'sideIdle', walkHeight: 534, idleHeight: 919, walkFlip: false, idleFlip: true, idleRoot: [488, 969], heightRange: [526, 539],
      frames: frames([[343,587],[344,586],[351,586],[351,586],[347,586],[342,586],[341,584],[349,583],[345,584],[347,583],[347,583],[349,583]], [539,533,530,535,535,533,531,526,528,532,533,534],
        [[415.5,587],[388,586],[355.5,586],[318.5,586],[287.5,586],[248.5,586],[429,584],[400.5,583],[367,584],[327,583],[291,583],[251.5,583]]) },
  },
});

const rowIndex = row => {
  const index = typeof row === 'string' ? MEOWA_ACTOR_10.rowOrder.indexOf(row) : row;
  if (!Number.isInteger(index) || index < 0 || index > 3) throw new RangeError('row must be front/left/right/back or locomotion bodyRow 0..3');
  return index;
};

/** URLs resolve relative to the document (rebuild/index.html by default), NOT this
 * module. Main must supply copied front/back PNGs. Returned manifest is also
 * accepted by createMeowaActor10; keys are namespaced, all frame coords declared.
 */
export function preloadMeowaActor10(scene, { files = {}, prefix = 'meowa-actor-10' } = {}) {
  if (!scene?.load?.image || !scene.load.spritesheet) throw new TypeError('Phaser loader required');
  const manifest = {};
  for (const [id, descriptor] of Object.entries(MEOWA_ACTOR_10.files)) {
    const path = files[id] ?? descriptor.path;
    if (typeof path !== 'string' || !path) throw new TypeError(`Invalid asset URL: ${id}`);
    const key = `${prefix}:${id}`;
    manifest[id] = { ...descriptor, key, path };
    if (scene.textures?.exists(key)) continue;
    if (descriptor.kind === 'sheet') scene.load.spritesheet(key, path, { frameWidth: 640, frameHeight: 640, startFrame: 0, endFrame: 11 });
    else scene.load.image(key, path);
  }
  return freeze(manifest);
}

/** Moving row MUST be locomotion BODY row (0 down, 1 left, 2 right, 3 up), not
 * cast aim. For a stationary cast/channel, main instead passes the casting aim row.
 * traveled is actual distance for this update, not cumulative distance.
 * Walking phase follows displacement only. Stop immediately shows joined-feet idle.
 * No scale changes, canvas crops, texture allocations or legacy fallback in update.
 * chargeElapsedMs is time since charge began; aim is a world direction vector.
 * releaseAgeMs is time since release, continuing through recover (not state age).
 * Short casts retain idle art. A >=1800ms charge latches its brace through release;
 * chargedRelease can explicitly select it if main skips the held-charge update.
 * Loaded textures are borrowed/shared; destroy removes our nine images/container and
 * shutdown listener, leaving preload textures to the scene/game texture owner.
 */
export function createMeowaActor10(scene, { manifest, prefix = 'meowa-actor-10', row = 0, foot = { x: 0, y: 0 } } = {}) {
  let bodyRow = rowIndex(row);
  if (![foot.x, foot.y].every(Number.isFinite)) throw new RangeError('Invalid world foot');
  const assets = manifest ?? Object.fromEntries(Object.entries(MEOWA_ACTOR_10.files).map(([id, descriptor]) => [id, { ...descriptor, key: `${prefix}:${id}` }]));
  // Validate all directions before allocating: missing art never mixes with legacy.
  for (const [id, descriptor] of Object.entries(MEOWA_ACTOR_10.files)) {
    const key = assets[id]?.key;
    if (!key || !scene.textures.exists(key)) throw new Error(`Missing Meowa actor texture: ${id}`);
    const texture = scene.textures.get(key);
    const source = texture.getSourceImage();
    if (source.width !== descriptor.size[0] || source.height !== descriptor.size[1]) throw new Error(`Invalid Meowa actor dimensions: ${id}`);
    if (descriptor.kind === 'sheet') for (let i = 0; i < 12; i++) if (!texture.has(i)) throw new Error(`Missing Meowa actor frame: ${id}:${i}`);
    texture.setFilter(0); // Phaser LINEAR, not nearest/pixel-art sampling.
  }
  const container = scene.add.container(foot.x, foot.y).setDepth(foot.y);
  const pieces = {};
  for (const [direction, profile] of Object.entries(MEOWA_ACTOR_10.profiles)) {
    const walk = scene.add.image(0, 0, assets[profile.walk].key, 0).setScale(48 / profile.walkHeight).setVisible(false);
    const idle = scene.add.image(0, 0, assets[profile.idle].key).setScale(48 / profile.idleHeight).setVisible(false);
    const cast = scene.add.image(0, 0, assets[`${direction}Cast`].key).setScale(48 / MEOWA_ACTOR_10.castMeasurement[direction].heightPx).setVisible(false);
    pieces[direction] = { walk, idle, cast };
    container.add([walk, idle, cast]);
  }
  let distance = 0;
  let destroyed = false;
  let initialized = false;
  let observation;
  let bracedCharge = false;
  const orient = (image, root, size, flip) => image.setOrigin(flip ? 1 - root[0] / size : root[0] / size, root[1] / size).setFlipX(flip);
  const update = ({ row: nextRow = bodyRow, traveled = 0, timeMs = 0, chargeElapsedMs = 0, aim, releaseAgeMs = 0, chargedRelease = false, foot: position = { x: container.x, y: container.y }, state = traveled > 0 ? 'walk' : 'idle' } = {}) => {
    if (destroyed) return null;
    const candidate = rowIndex(nextRow);
    if (![traveled, timeMs, chargeElapsedMs, releaseAgeMs, position?.x, position?.y].every(Number.isFinite) || traveled < 0 || timeMs < 0 || chargeElapsedMs < 0 || releaseAgeMs < 0 || (aim != null && ![aim.x, aim.y].every(Number.isFinite))) throw new RangeError('Invalid actor update');
    const moving = traveled > .0001;
    const casting = ['cast', 'channel', 'charging', 'release', 'recover'].includes(state);
    // Main supplies actual movement row while moving, casting aim only at rest.
    if (moving || casting || !initialized) bodyRow = candidate;
    initialized = true;
    const walking = moving && ['walk', 'start', 'dodge'].includes(state);
    if (walking) distance = (distance + traveled) % MEOWA_ACTOR_10.strideDistance;
    else distance = 0;
    const frame = Math.min(11, Math.floor(distance / MEOWA_ACTOR_10.strideDistance * 12));
    const direction = bodyRow === 0 ? 'front' : bodyRow === 3 ? 'back' : 'side';
    const profile = MEOWA_ACTOR_10.profiles[direction];
    const castProfile = MEOWA_ACTOR_10.castMeasurement[direction];
    const motion = MEOWA_ACTOR_10.castMotion;
    const releasing = state === 'release' || state === 'recover';
    const age = state === 'recover' ? Math.max(motion.recoilEndMs, releaseAgeMs) : releaseAgeMs;
    if (!casting || walking || (releasing && age >= motion.recoverEndMs)) bracedCharge = false;
    else if (!releasing) bracedCharge = chargeElapsedMs >= motion.tensionStartMs;
    else if (chargedRelease || chargeElapsedMs >= motion.tensionStartMs) bracedCharge = true;
    const castVisible = casting && !walking && bracedCharge && (!releasing || age < motion.recoverEndMs);
    const visual = walking ? 'walk' : castVisible ? 'cast' : 'idle';
    const left = bodyRow === 1;
    const flip = (walking ? profile.walkFlip : castVisible ? castProfile.flip : profile.idleFlip) !== left;
    for (const piece of Object.values(pieces)) for (const image of Object.values(piece)) { image.setVisible(false); image.x = image.y = 0; }
    const image = pieces[direction][visual];
    const root = walking ? profile.frames[frame].root : castVisible ? castProfile.root : profile.idleRoot;
    const size = walking ? 640 : 1024;
    if (walking) image.setFrame(frame);
    orient(image, root, size, flip).setVisible(true);
    const fallbackAim = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }][bodyRow];
    const length = aim ? Math.hypot(aim.x, aim.y) : 0;
    const axis = length > .0001 ? { x: aim.x / length, y: aim.y / length } : fallbackAim;
    let supportPx = 0;
    if (castVisible && releasing) {
      // One short backwards impulse, then a small monotonic return to support.
      if (age < motion.recoilPeakMs) supportPx = -motion.recoilPx * Math.sin(age / motion.recoilPeakMs * Math.PI / 2);
      else if (age < motion.recoilEndMs) supportPx = -.12 - (motion.recoilPx - .12) * (1 - (age - motion.recoilPeakMs) / (motion.recoilEndMs - motion.recoilPeakMs)) ** 2;
      else supportPx = -.12 * (1 - (age - motion.recoilEndMs) / (motion.recoverEndMs - motion.recoilEndMs));
    } else if (castVisible) {
      const tension = Math.min(1, Math.max(0, (chargeElapsedMs - motion.tensionStartMs) / motion.tensionRampMs));
      supportPx = motion.tensionMaxPx * tension * Math.sin((chargeElapsedMs - motion.tensionStartMs) / 1000 * Math.PI * 14);
    }
    image.x = axis.x * supportPx;
    image.y = axis.y * supportPx;
    container.setPosition(position.x, position.y).setDepth(position.y);
    observation = { row: bodyRow, direction, visual, state, frame: walking ? frame : null, timeMs, chargeElapsedMs, releaseAgeMs, supportPx,
      phaseDistance: distance, flipX: flip, root: [...root], scale: 48 / (walking ? profile.walkHeight : castVisible ? castProfile.heightPx : profile.idleHeight),
      worldFoot: { ...position }, sourceHeightRange: [...profile.heightRange], contactVerified: false, finalCastAnimation: false,
      castRepresentation: castVisible ? 'two-hand-still-with-aim-axis-support-motion' : null };
    return { ...observation, root: [...observation.root], worldFoot: { ...position }, sourceHeightRange: [...profile.heightRange] };
  };
  const staffAnchor = () => {
    if (destroyed || !['idle', 'cast'].includes(observation?.visual) || !container.visible || container.alpha <= 0) return null;
    const image = pieces[observation.direction][observation.visual];
    if (!image.visible || image.alpha <= 0) return null;
    const tip = observation.visual === 'cast' ? MEOWA_ACTOR_10.castMeasurement[observation.direction].staffTip : MEOWA_ACTOR_10.idleStaffTips[observation.direction];
    // Phaser's world matrix excludes texture flip and display origin. Apply both
    // in sprite-local coordinates, then let the live matrix handle all parents.
    const x = (image.flipX ? image.width - tip[0] : tip[0]) - image.displayOriginX;
    const y = (image.flipY ? image.height - tip[1] : tip[1]) - image.displayOriginY;
    const point = image.getWorldTransformMatrix().transformPoint(x, y);
    return { x: point.x, y: point.y, row: bodyRow, source: `meowa-${observation.visual}-staff-tip`, measured: true, contactVerified: false };
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    scene.events?.off('shutdown', destroy);
    container.destroy(true);
  };
  scene.events?.once('shutdown', destroy);
  update({ row: bodyRow, foot, state: 'idle' });
  return { container, pieces, update, staffAnchor, destroy, get debug() { return observation ? { ...observation, root: [...observation.root], worldFoot: { ...observation.worldFoot }, sourceHeightRange: [...observation.sourceHeightRange] } : null; } };
}
