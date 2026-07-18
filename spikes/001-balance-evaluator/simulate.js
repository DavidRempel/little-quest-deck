#!/usr/bin/env node
'use strict';

// Little Quest Deck balance spike.
// This loads the production rules and game-state files directly so gameplay
// changes cannot silently leave the evaluator's combat model behind.

const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
let nextCardId = 0;
let activeCardPrefix = 'sim';
Object.defineProperty(global, 'crypto', {
  configurable: true,
  value: { randomUUID: () => `${activeCardPrefix}-card-${++nextCardId}` }
});

require(path.join(__dirname, '../../public/rules.js'));
require(path.join(__dirname, '../../public/game-state.js'));

const Rules = global.LittleQuestDeckRules;
const GameState = global.LittleQuestDeckState;
const { config } = Rules;

const POLICY_NAMES = ['random-valid', 'max-score', 'heuristic', 'lookahead'];
const VARIANTS = Object.freeze({
  baseline: Object.freeze({ name: 'Baseline' }),
  'no-crown': Object.freeze({ name: 'No Crown Cracks', crownPerClean: 0, crownCap: 0 }),
  'crown-1': Object.freeze({ name: 'Crown Cracks 1 HP', crownPerClean: 1, crownCap: 8 }),
  'crown-2': Object.freeze({ name: 'Crown Cracks 2 HP', crownPerClean: 2, crownCap: 12 }),
  'boss-edit': Object.freeze({ name: 'Best boss deck edit', bossDeckEdit: 'best' }),
  'boss-remove': Object.freeze({ name: 'Boss remove only', bossDeckEdit: 'remove' }),
  'boss-recolor': Object.freeze({ name: 'Boss recolour only', bossDeckEdit: 'recolor' }),
  'boss-shift': Object.freeze({ name: 'Boss rank shift only', bossDeckEdit: 'shift' })
});

function hashText(text) {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function sample(values, random) {
  return values[Math.floor(random() * values.length)];
}

function shuffleCopy(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function cardKey(card) {
  return card.id;
}

function subsetCards(cards, mask) {
  return cards.filter((_, index) => mask & (1 << index));
}

function allAttacks(game, cards = game.state.hand) {
  const attacks = [];
  for (let mask = 1; mask < (1 << cards.length); mask++) {
    const chosen = subsetCards(cards, mask);
    const score = game.scoreCards(chosen);
    if (score.valid && score.total > 0) attacks.push({ cards: chosen, damage: score.total, score });
  }
  return attacks;
}

function bestDamage(game, cards) {
  const attacks = allAttacks(game, cards);
  return attacks.reduce((best, attack) => Math.max(best, attack.damage), 0);
}

function retaliationDamage(state, multiplier = 1) {
  const raw = Math.floor((state.enemy.damage + state.enemy.temper + (multiplier === 1 ? 1 : 0)) * multiplier);
  const extraBlock = multiplier < 1 ? state.equipment.armor.discardBlock || 0 : 0;
  return Math.max(0, raw - (state.equipment.armor.reduction || 0) - extraBlock);
}

function lethalSort(enemyHp) {
  return (a, b) => {
    const aOverkill = a.damage - enemyHp;
    const bOverkill = b.damage - enemyHp;
    const aClean = aOverkill >= 0 && aOverkill <= 3 ? 0 : 1;
    const bClean = bOverkill >= 0 && bOverkill <= 3 ? 0 : 1;
    return aClean - bClean || a.cards.length - b.cards.length || aOverkill - bOverkill;
  };
}

function discardAction(cards) {
  return { type: 'discard', cards };
}

function attackAction(attack) {
  return { type: 'attack', cards: attack.cards, attack };
}

function randomValidPolicy(game, context) {
  const { state } = game;
  const attacks = allAttacks(game);
  if (!attacks.length) {
    const shuffled = shuffleCopy(state.hand, context.random);
    return discardAction(shuffled.slice(0, 1 + Math.floor(context.random() * Math.min(3, shuffled.length))));
  }
  const lethal = attacks.filter(attack => attack.damage >= state.enemy.hp);
  if (lethal.length) return attackAction(sample(lethal, context.random));
  if (!state.enemy.freeDiscardUsed && context.random() < 0.25) {
    const shuffled = shuffleCopy(state.hand, context.random);
    return discardAction(shuffled.slice(0, 1 + Math.floor(context.random() * Math.min(3, shuffled.length))));
  }
  return attackAction(sample(attacks, context.random));
}

function maxScorePolicy(game) {
  const attacks = allAttacks(game);
  if (!attacks.length) return discardAction([...game.state.hand]);
  attacks.sort((a, b) => b.damage - a.damage || a.cards.length - b.cards.length);
  return attackAction(attacks[0]);
}

function heuristicPolicy(game) {
  const { state } = game;
  const attacks = allAttacks(game);
  if (!attacks.length) return discardAction([...state.hand]);
  const lethal = attacks.filter(attack => attack.damage >= state.enemy.hp).sort(lethalSort(state.enemy.hp));
  if (lethal.length) return attackAction(lethal[0]);

  attacks.sort((a, b) => b.damage / b.cards.length - a.damage / a.cards.length || b.damage - a.damage);
  const efficient = attacks[0];
  const shouldRegroup = !state.enemy.freeDiscardUsed && efficient.damage < state.enemy.hp * 0.42;
  if (!shouldRegroup || state.enemy.temper >= 1) return attackAction(efficient);

  const keep = new Set(efficient.cards.map(cardKey));
  const toss = state.hand.filter(card => !keep.has(cardKey(card))).slice(0, 3);
  return discardAction(toss.length ? toss : [state.hand[0]]);
}

function actionKey(action) {
  return `${action.type}:${action.cards.map(cardKey).sort().join(',')}`;
}

function addUniqueAction(actions, seen, action) {
  const key = actionKey(action);
  if (!seen.has(key)) {
    seen.add(key);
    actions.push(action);
  }
}

function lookaheadCandidates(game) {
  const { state } = game;
  const attacks = allAttacks(game);
  const actions = [];
  const seen = new Set();
  const lethal = attacks.filter(attack => attack.damage >= state.enemy.hp).sort(lethalSort(state.enemy.hp));
  lethal.slice(0, 2).forEach(attack => addUniqueAction(actions, seen, attackAction(attack)));

  [...attacks]
    .sort((a, b) => b.damage - a.damage || a.cards.length - b.cards.length)
    .slice(0, 4)
    .forEach(attack => addUniqueAction(actions, seen, attackAction(attack)));
  [...attacks]
    .sort((a, b) => b.damage / b.cards.length - a.damage / a.cards.length || b.damage - a.damage)
    .slice(0, 4)
    .forEach(attack => {
      addUniqueAction(actions, seen, attackAction(attack));
      if (!state.enemy.freeDiscardUsed) {
        const keep = new Set(attack.cards.map(cardKey));
        const toss = state.hand.filter(card => !keep.has(cardKey(card))).slice(0, 3);
        if (toss.length) addUniqueAction(actions, seen, discardAction(toss));
      }
    });

  if (!state.enemy.freeDiscardUsed || !attacks.length) {
    for (let mask = 1; mask < (1 << state.hand.length); mask++) {
      const cards = subsetCards(state.hand, mask);
      if (cards.length === 1) addUniqueAction(actions, seen, discardAction(cards));
    }
  }
  return actions;
}

function sampledFutureHand(state, action, random) {
  const removed = new Set(action.cards.map(cardKey));
  const kept = state.hand.filter(card => !removed.has(cardKey(card)));
  const bonus = action.type === 'discard' ? state.equipment.item.extraDiscardDraw || 0 : 0;
  const drawCount = Math.min(state.handSize - kept.length, action.cards.length + bonus);
  let pool = [...state.deck];
  if (pool.length < drawCount) pool = [...pool, ...state.discard, ...action.cards];
  return [...kept, ...shuffleCopy(pool, random).slice(0, drawCount)];
}

function expectedNextDamage(game, action, context) {
  let total = 0;
  const samples = 2;
  for (let index = 0; index < samples; index++) {
    const random = mulberry32(hashText(`${context.decisionSeed}:${actionKey(action)}:${index}`));
    total += bestDamage(game, sampledFutureHand(game.state, action, random));
  }
  return total / samples;
}

function lookaheadValue(game, action, context) {
  const { state } = game;
  const nextDamage = expectedNextDamage(game, action, context);
  if (action.type === 'discard') {
    const damageTaken = retaliationDamage(state, 0.5);
    const repeatTemperPenalty = state.enemy.freeDiscardUsed ? 18 : 0;
    const lethalPenalty = damageTaken >= state.hp ? 100000 : 0;
    return nextDamage * 2.2 - damageTaken * 22 - repeatTemperPenalty - lethalPenalty;
  }

  const attack = action.attack;
  const overkill = attack.damage - state.enemy.hp;
  if (overkill >= 0) {
    const cleanBonus = overkill <= 3 ? 350 : 0;
    return 100000 + cleanBonus + (state.hand.length - attack.cards.length) * 20 - overkill;
  }
  const damageTaken = retaliationDamage(state, 1);
  const lethalPenalty = damageTaken >= state.hp ? 100000 : 0;
  return attack.damage * 10 + nextDamage * 1.35 - damageTaken * 24 - lethalPenalty;
}

function lookaheadPolicy(game, context) {
  const candidates = lookaheadCandidates(game);
  if (!candidates.length) return discardAction([...game.state.hand]);
  return candidates
    .map(action => ({ action, value: lookaheadValue(game, action, context) }))
    .sort((a, b) => b.value - a.value)[0].action;
}

const POLICIES = Object.freeze({
  'random-valid': randomValidPolicy,
  'max-score': maxScorePolicy,
  heuristic: heuristicPolicy,
  lookahead: lookaheadPolicy
});

function gearUtility(item) {
  return (item.damageBonus || 0) * 4 + (item.bonus || 0) * 2.3 + (item.reduction || 0) * 5.5 +
    (item.hpBonus || 0) * 1.6 + (item.discardBlock || 0) * 1.5 + (item.healAfterBoss || 0) * 1.3 +
    (item.extraDiscardDraw || 0) * 1.2 + (item.goldBonus || 0) * 0.6;
}

function handlePendingReward(game) {
  const { state } = game;
  if (!state.pendingReward) return;
  const item = state.pendingReward;
  if (gearUtility(item) > gearUtility(state.equipment[item.slot]) * 1.05) game.equipPendingReward();
  else game.sellPendingReward();
}

function buyOffer(game, kind) {
  const index = game.state.shopOffers.findIndex(offer => offer.kind === kind && offer.cost <= game.state.gold);
  return index >= 0 ? game.buyShopOffer(index) : false;
}

function handleShop(game) {
  const { state } = game;
  if (!state.shopOffers.length) return;
  if (state.hp <= state.maxHp - 5) buyOffer(game, 'heal');
  if (state.handSize < config.maxHandSize) buyOffer(game, 'hand');

  const gear = state.shopOffers
    .map((offer, index) => ({ offer, index, gain: offer.kind === 'gear' ? gearUtility(offer.item) - gearUtility(state.equipment[offer.item.slot]) : -Infinity }))
    .filter(candidate => candidate.offer.kind === 'gear' && candidate.offer.cost <= state.gold && candidate.gain > 3)
    .sort((a, b) => b.gain / b.offer.cost - a.gain / a.offer.cost)[0];
  if (gear) game.buyShopOffer(gear.index);
  state.shopOffers = [];
}

function choose(n, k) {
  if (k < 0 || n < k) return 0;
  if (k === 0 || n === k) return 1;
  let value = 1;
  for (let index = 1; index <= k; index++) value = value * (n - index + 1) / index;
  return value;
}

function cardCounts(cards, key) {
  const counts = new Map();
  for (const card of cards) counts.set(card[key], (counts.get(card[key]) || 0) + 1);
  return counts;
}

function deckQuality(cards) {
  const total = cards.length;
  if (total < 3) return -Infinity;
  const ranks = cardCounts(cards, 'n');
  const colors = cardCounts(cards, 'color');
  const pairChance = [...ranks.values()].reduce((sum, count) => sum + choose(count, 2), 0) / choose(total, 2);
  const tripleChance = [...ranks.values()].reduce((sum, count) => sum + choose(count, 3), 0) / choose(total, 3);
  const flushChance = [...colors.values()].reduce((sum, count) => sum + choose(count, 3), 0) / choose(total, 3);
  let sequenceChance = 0;
  for (let rank = 1; rank <= 6; rank++) {
    sequenceChance += (ranks.get(rank) || 0) * (ranks.get(rank + 1) || 0) * (ranks.get(rank + 2) || 0);
  }
  sequenceChance /= choose(total, 3);
  return pairChance * 9 + tripleChance * 27 + flushChance * 12 + sequenceChance * 15;
}

function cloneCard(card) {
  return { n: card.n, color: card.color, id: card.id };
}

function allCards(state) {
  return [...state.hand, ...state.deck, ...state.discard];
}

function bestDeckEdit(state, allowedType = 'best') {
  const cards = allCards(state);
  let best = { type: 'none', score: deckQuality(cards) };
  const removable = new Set([...state.deck, ...state.discard].map(cardKey));
  const allowed = type => allowedType === 'best' || allowedType === type;

  cards.forEach((card, cardIndex) => {
    if (allowed('remove') && removable.has(cardKey(card))) {
      const edited = cards.filter((_, index) => index !== cardIndex).map(cloneCard);
      const score = deckQuality(edited);
      if (score > best.score) best = { type: 'remove', card, score };
    }

    for (const color of allowed('recolor') ? config.colors : []) {
      if (color === card.color) continue;
      const edited = cards.map(cloneCard);
      edited[cardIndex].color = color;
      const score = deckQuality(edited);
      if (score > best.score) best = { type: 'recolor', card, color, score };
    }

    for (const delta of allowed('shift') ? [-1, 1] : []) {
      const rank = card.n + delta;
      if (rank < 1 || rank > 8) continue;
      const edited = cards.map(cloneCard);
      edited[cardIndex].n = rank;
      const score = deckQuality(edited);
      if (score > best.score) best = { type: 'shift', card, rank, score };
    }
  });
  return best;
}

function removeCardFromState(state, target) {
  for (const zone of [state.deck, state.discard]) {
    const index = zone.findIndex(card => card.id === target.id);
    if (index >= 0) {
      zone.splice(index, 1);
      return true;
    }
  }
  return false;
}

function applyBossDeckEdit(state, allowedType) {
  const edit = bestDeckEdit(state, allowedType);
  if (edit.type === 'remove') removeCardFromState(state, edit.card);
  if (edit.type === 'recolor') edit.card.color = edit.color;
  if (edit.type === 'shift') edit.card.n = edit.rank;
  return edit.type;
}

function applyCrownCracks(state, variant, runStats) {
  if (!state.enemy.finalBoss || runStats.finalBossStartHp != null) return;
  const overridesProduction = Object.prototype.hasOwnProperty.call(variant, 'crownPerClean');
  const reduction = overridesProduction
    ? Math.min(variant.crownCap, state.stats.cleanVictories * variant.crownPerClean)
    : state.enemy.crownCrackReduction || 0;
  if (overridesProduction) {
    state.enemy.hp = Math.max(1, config.finalBossBaseHp - reduction);
    state.enemy.maxHp = state.enemy.hp;
    state.enemy.crownCrackReduction = reduction;
    state.finalBossCrownReduction = reduction;
  }
  runStats.crownApplied = reduction;
  runStats.finalBossStartHp = state.enemy.hp;
}

function resolveAction(game, action) {
  game.state.selected = action.cards.map(cardKey);
  return action.type === 'attack' ? game.attack() : game.discardSelected();
}

function run(seedIndex, policyName, variantKey) {
  const seed = `BAL-${String(seedIndex).padStart(6, '0')}`;
  const variant = VARIANTS[variantKey];
  activeCardPrefix = seed;
  nextCardId = 0;
  const game = GameState.createGame(seed);
  const policy = POLICIES[policyName];
  const policyRandom = mulberry32(hashText(`${seed}:${policyName}`));
  const runStats = { actions: 0, crownApplied: 0, finalBossStartHp: null, deckEdits: [], reachedFinal: false };

  while (!game.state.gameOver && !game.state.finalDefeated && runStats.actions < 120) {
    if (game.state.enemy.finalBoss) runStats.reachedFinal = true;
    applyCrownCracks(game.state, variant, runStats);
    const context = {
      random: policyRandom,
      decisionSeed: `${seed}:${policyName}:${runStats.actions}:${game.state.defeated}:${game.state.enemy.hp}`
    };
    const action = policy(game, context);
    const wasBoss = game.state.enemy.boss;
    const beforeDefeated = game.state.defeated;
    resolveAction(game, action);
    runStats.actions++;
    handlePendingReward(game);
    handleShop(game);
    if (variant.bossDeckEdit && wasBoss && game.state.defeated > beforeDefeated && game.state.defeated < config.finalEncounter) {
      runStats.deckEdits.push(applyBossDeckEdit(game.state, variant.bossDeckEdit));
    }
  }

  return {
    won: game.state.finalDefeated,
    encounter: game.state.finalDefeated ? config.finalEncounter + 1 : game.state.defeated + 1,
    hp: game.state.hp,
    actions: runStats.actions,
    damageTaken: game.state.stats.damageTaken,
    discards: game.state.stats.discards,
    partials: game.state.stats.partialAttacks,
    cleanVictories: game.state.stats.cleanVictories,
    reachedFinal: runStats.reachedFinal,
    finalBossStartHp: runStats.finalBossStartHp,
    crownApplied: runStats.crownApplied,
    deckEdits: runStats.deckEdits
  };
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function summarize(variantKey, policyName, results) {
  const wins = results.filter(result => result.won);
  const deaths = new Map();
  for (const result of results.filter(result => !result.won)) {
    deaths.set(result.encounter, (deaths.get(result.encounter) || 0) + 1);
  }
  const deathHotspots = [...deaths.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([encounter, count]) => `${encounter}:${(100 * count / results.length).toFixed(1)}%`)
    .join(', ');
  const mean = key => results.reduce((sum, result) => sum + result[key], 0) / results.length;
  const reachedFinal = results.filter(result => result.reachedFinal);
  const meanFinalBossStartHp = reachedFinal.length
    ? reachedFinal.reduce((sum, result) => sum + result.finalBossStartHp, 0) / reachedFinal.length
    : 0;
  const editCounts = new Map();
  results.flatMap(result => result.deckEdits).forEach(type => editCounts.set(type, (editCounts.get(type) || 0) + 1));
  return {
    variant: VARIANTS[variantKey].name,
    policy: policyName,
    runs: results.length,
    winRate: 100 * wins.length / results.length,
    medianEncounter: percentile(results.map(result => result.encounter), 0.5),
    p25Encounter: percentile(results.map(result => result.encounter), 0.25),
    finalReachRate: 100 * results.filter(result => result.reachedFinal).length / results.length,
    actions: mean('actions'),
    damage: mean('damageTaken'),
    discards: mean('discards'),
    partials: mean('partials'),
    cleanVictories: mean('cleanVictories'),
    finalBossStartHp: meanFinalBossStartHp,
    winnerHp: wins.length ? wins.reduce((sum, result) => sum + result.hp, 0) / wins.length : 0,
    editMix: [...editCounts.entries()].map(([type, count]) => `${type}:${count}`).join(', '),
    deathHotspots
  };
}

function selfTest() {
  assert.deepEqual(Object.keys(POLICIES), POLICY_NAMES);
  assert.equal(config.buildVersion, Rules.config.buildVersion);
  const game = GameState.createGame('SELF-TEST');
  game.state.hand = [
    { n: 2, color: 'red', id: 'a' },
    { n: 2, color: 'blue', id: 'b' },
    { n: 1, color: 'green', id: 'c' },
    { n: 4, color: 'purple', id: 'd' },
    { n: 8, color: 'green', id: 'e' }
  ];
  game.state.enemy.hp = 50;
  const choice = maxScorePolicy(game);
  assert.equal(choice.type, 'attack');
  assert.equal(choice.attack.damage, 9);
  assert.equal(deckQuality(allCards(game.state)) > 0, true);

  game.state.enemy.freeDiscardUsed = true;
  assert.equal(lookaheadCandidates(game).every(action => action.type === 'attack'), true);

  const crownState = { enemy: { finalBoss: true, hp: 72, maxHp: 72 }, stats: { cleanVictories: 10 } };
  const crownStats = { crownApplied: 0, finalBossStartHp: null };
  applyCrownCracks(crownState, VARIANTS['crown-2'], crownStats);
  assert.equal(crownState.enemy.hp, 60);
  assert.equal(crownStats.crownApplied, 12);
  applyCrownCracks(crownState, VARIANTS['crown-2'], crownStats);
  assert.equal(crownState.enemy.hp, 60);
}

function parseArgs(argv) {
  const args = { runs: 200, variants: ['no-crown', 'baseline', 'boss-edit'], policies: POLICY_NAMES };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--runs') args.runs = Number(argv[++index]);
    else if (arg === '--variants') args.variants = argv[++index].split(',');
    else if (arg === '--policies') args.policies = argv[++index].split(',');
    else if (arg === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  args.variants.forEach(key => { if (!VARIANTS[key]) throw new Error(`Unknown variant: ${key}`); });
  args.policies.forEach(key => { if (!POLICIES[key]) throw new Error(`Unknown policy: ${key}`); });
  return args;
}

function main() {
  selfTest();
  const args = parseArgs(process.argv.slice(2));
  const summaries = [];
  for (const variantKey of args.variants) {
    for (const policyName of args.policies) {
      const results = [];
      for (let seedIndex = 1; seedIndex <= args.runs; seedIndex++) results.push(run(seedIndex, policyName, variantKey));
      summaries.push(summarize(variantKey, policyName, results));
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ buildVersion: config.buildVersion, ...args, summaries }, null, 2));
    return;
  }

  console.log(`Little Quest Deck balance evaluator — production ${config.buildVersion}`);
  console.log(`${args.runs.toLocaleString()} matched seeds per variant/policy`);
  console.table(summaries.map(summary => ({
    variant: summary.variant,
    policy: summary.policy,
    'win %': summary.winRate.toFixed(1),
    'reach final %': summary.finalReachRate.toFixed(1),
    'median enc': summary.medianEncounter,
    'p25 enc': summary.p25Encounter,
    actions: summary.actions.toFixed(1),
    damage: summary.damage.toFixed(1),
    partials: summary.partials.toFixed(1),
    discards: summary.discards.toFixed(1),
    clean: summary.cleanVictories.toFixed(1),
    'final HP': summary.finalBossStartHp.toFixed(1),
    'winner HP': summary.winnerHp.toFixed(1),
    'edit mix': summary.editMix,
    'death hotspots': summary.deathHotspots
  })));
}

main();
