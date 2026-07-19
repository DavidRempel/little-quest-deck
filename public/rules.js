(function () {
  'use strict';

  const config = Object.freeze({
    buildVersion: 'v4.29-finisher-bank',
    startHandSize: 5,
    maxHandSize: 7,
    maxTemper: 3,
    cleanVictoryGold: 2,
    overkillThreshold: 4,
    overkillGold: 1,
    overkillTreasureBonus: 0.15,
    maxRegroupTokens: 9,
    shopRerollStartCost: 4,
    shopRerollCostStep: 2,
    finalBossBaseHp: 72,
    crownCrackHpPerClean: 2,
    crownCrackHpCap: 12,
    monsterEquipmentDropChance: 0.15,
    finalEncounter: 16,
    colors: Object.freeze(['red', 'green', 'blue', 'purple']),
    weaknessTypes: Object.freeze(['match', 'sequence', 'flush']),
    weaknessLabel: Object.freeze({ match: 'Match', sequence: 'Sequence', flush: 'Flush' }),
    weaknessIcon: Object.freeze({ match: '⚔️', sequence: '🏹', flush: '✨' }),
    comboScores: Object.freeze({
      match: Object.freeze({ 2: 9, 3: 27, 4: 63 }),
      sequence: Object.freeze({ 2: 5, 3: 15, 4: 35, 5: 68, 6: 120, 7: 192 }),
      flush: Object.freeze({ 2: 4, 3: 12, 4: 28, 5: 55, 6: 96, 7: 154 })
    })
  });

  function countCards(cards, keyFn) {
    return cards.reduce((counts, card) => {
      const key = keyFn(card);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function rankCounts(cards) {
    return Object.values(countCards(cards, card => card.n)).sort((a, b) => b - a);
  }

  function familyScore(family, count) {
    return config.comboScores[family][count] || 0;
  }

  function crownCrackReduction(cleanVictories) {
    const victories = Math.max(0, Math.floor(Number(cleanVictories) || 0));
    return Math.min(config.crownCrackHpCap, victories * config.crownCrackHpPerClean);
  }

  function matchChunkScore(cards, finalPenalty = false) {
    if (cards.length < 2) return 0;
    const counts = rankCounts(cards);
    let penaltyUsed = false;
    return counts.reduce((score, count) => {
      let effectiveCount = count;
      if (finalPenalty && !penaltyUsed && effectiveCount > 1) {
        effectiveCount--;
        penaltyUsed = true;
      }
      return score + (effectiveCount >= 2 ? familyScore('match', effectiveCount) : 0);
    }, 0);
  }

  function isMatchCombo(cards) {
    return matchChunkScore(cards) > 0;
  }

  function isSequenceCombo(cards) {
    if (cards.length < 3) return false;
    const numbers = cards.map(card => card.n).sort((a, b) => a - b);
    if (new Set(numbers).size !== numbers.length) return false;
    return numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1);
  }

  function isFlushCombo(cards) {
    return cards.length >= 3 && cards.every(card => card.color === cards[0].color);
  }

  function traitInfo(cards) {
    const traits = [];
    if (isMatchCombo(cards)) traits.push('match');
    if (isSequenceCombo(cards)) traits.push('sequence');
    if (isFlushCombo(cards)) traits.push('flush');
    return traits;
  }

  function comboName(traits) {
    return traits.length ? traits.map(trait => config.weaknessLabel[trait]).join(' + ') : 'Basic Hit';
  }

  function scoreCombo(cards, options = {}) {
    const traits = traitInfo(cards);
    const valid = cards.length > 0;
    const hasCombo = traits.length > 0;
    const finalPenalty = !!options.finalBoss && hasCombo;
    const scoreCount = finalPenalty ? Math.max(1, cards.length - 1) : cards.length;
    const matchBase = traits.includes('match') ? matchChunkScore(cards, finalPenalty) : 0;
    const sequenceBase = traits.includes('sequence') ? familyScore('sequence', scoreCount) : 0;
    const flushBase = traits.includes('flush') ? familyScore('flush', scoreCount) : 0;
    const basicBase = hasCombo ? 0 : cards.length;
    const baseBeforeWeakness = basicBase + matchBase + sequenceBase + flushBase;
    const weaknessMultiplier = valid && traits.includes(options.weakness) ? 1.5 : 1;
    const weapon = options.weapon || {};
    const item = options.item || {};
    const weaponBonus = weapon.mode && traits.includes(weapon.mode) ? weapon.bonus || 0 : 0;
    const weaponAnyBonus = weapon.damageBonus || 0;
    const itemBonus = item.damageBonus || 0;
    const weaknessScore = Math.floor(baseBeforeWeakness * weaknessMultiplier);
    const weaknessBonus = weaknessScore - baseBeforeWeakness;
    const total = valid
      ? weaknessScore + weaponBonus + weaponAnyBonus + itemBonus
      : 0;
    const pieces = [];
    if (basicBase) pieces.push(`basic ${cards.length} card${cards.length === 1 ? '' : 's'} = ${basicBase}`);
    if (matchBase) pieces.push(`match chunks ${matchBase}`);
    if (finalPenalty) pieces.push(`final boss curse: scores as ${scoreCount} card${scoreCount === 1 ? '' : 's'}`);
    if (sequenceBase) pieces.push(`sequence ${scoreCount} cards = ${sequenceBase}`);
    if (flushBase) pieces.push(`flush ${scoreCount} cards = ${flushBase}`);
    if (weaknessBonus) pieces.push(`weakness +${weaknessBonus} (×1.5)`);
    if (weaponBonus) pieces.push(`+${weaponBonus} weapon`);
    if (weaponAnyBonus) pieces.push(`+${weaponAnyBonus} weapon`);
    if (itemBonus) pieces.push(`+${itemBonus} item`);
    const enemyHp = options.enemyHp == null ? 99 : options.enemyHp;

    return {
      mode: traits[0] || 'basic',
      traits,
      valid,
      total,
      multiplier: weaknessMultiplier,
      breakdown: {
        basic: basicBase,
        match: matchBase,
        sequence: sequenceBase,
        flush: flushBase,
        base: baseBeforeWeakness,
        weaknessBonus,
        weaponModeBonus: weaponBonus,
        weaponDamageBonus: weaponAnyBonus,
        itemDamageBonus: itemBonus,
        equipmentBonus: weaponBonus + weaponAnyBonus + itemBonus,
        finalPenalty,
        scoreCount
      },
      formula: valid ? `${pieces.join(' + ')} = ${total}` : '',
      margin: valid ? total - enemyHp : null
    };
  }

  window.LittleQuestDeckRules = Object.freeze({
    config,
    countCards,
    familyScore,
    crownCrackReduction,
    matchChunkScore,
    isMatchCombo,
    isSequenceCombo,
    isFlushCombo,
    traitInfo,
    comboName,
    scoreCombo
  });
})();
