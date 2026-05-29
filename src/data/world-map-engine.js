import { cleanGameText } from './game-copy.js'

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function first(list = []) {
  return Array.isArray(list) && list.length ? list[0] : null
}

function topBy(list = [], getter = item => item?.progress || 0, count = 1) {
  return [...(Array.isArray(list) ? list : [])]
    .sort((left, right) => Number(getter(right)) - Number(getter(left)))
    .slice(0, count)
}

function zoneState({ active = false, blocked = false, ready = false } = {}) {
  if (blocked) return 'blocked'
  if (active) return 'active'
  if (ready) return 'ready'
  return 'idle'
}

export function buildWorldMapModel({
  bodyMap = {},
  missionLoop = {},
  nextSession = {},
  zones = [],
  profile = {},
} = {}) {
  const priority = bodyMap.priority || {}
  const quest = bodyMap.dailyQuest || {}
  const movementLines = Array.isArray(bodyMap.movementLines) ? bodyMap.movementLines : []
  const unlockTargets = Array.isArray(bodyMap.unlockTargets) ? bodyMap.unlockTargets : []
  const regions = Array.isArray(bodyMap.regions) ? bodyMap.regions : []
  const riskyRegion = priority.region || first(topBy(regions, item => item.risk, 1))
  const movement = priority.movement || first(topBy(movementLines, item => (item.risk || 0) + (100 - clamp(item.progress ?? item.score)), 1))
  const unlock = priority.unlock || first(unlockTargets)
  const readiness = nextSession.readiness || {}
  const safeMode = Boolean(quest.safeMode || nextSession.tone === 'warn' || nextSession.tone === 'danger')
  const mapProgress = Array.isArray(missionLoop.mapProgress) ? missionLoop.mapProgress : []
  const activeZoneKey = quest.safeMode
    ? 'recovery'
    : quest.linkedUnlock
      ? 'skill'
      : movement?.id
        ? 'parkour'
        : riskyRegion?.trend === 'ihmal'
          ? 'body'
          : 'forge'

  const zoneData = [
    {
      key: 'forge',
      name: 'Güç Ocağı',
      short: 'Güç',
      icon: '⚒',
      x: 18,
      y: 38,
      progress: clamp((zones.find(item => item.key === 'gym')?.count || 0) * 12, 0, 100),
      state: zoneState({ active: activeZoneKey === 'forge', ready: !safeMode }),
      detail: cleanGameText(`Kuvvet hattı. ${missionLoop.statImpact || 'KUV'} etkisi burada büyür.`),
    },
    {
      key: 'parkour',
      name: 'Parkur Avlusu',
      short: 'Parkur',
      icon: '◇',
      x: 43,
      y: 24,
      progress: clamp(movement?.progress ?? movement?.score ?? 0),
      state: zoneState({ active: activeZoneKey === 'parkour', blocked: safeMode && movement?.tone === 'risk' }),
      detail: cleanGameText(movement?.todayStep || 'İniş, akış ve denge hattı burada ilerler.'),
    },
    {
      key: 'recovery',
      name: 'Toparlanma Kulübesi',
      short: 'Can',
      icon: '✚',
      x: 74,
      y: 32,
      progress: clamp(readiness.score ?? readiness.armor ?? 0),
      state: zoneState({ active: activeZoneKey === 'recovery', ready: safeMode }),
      detail: cleanGameText(quest.safeMode ? quest.desc : 'Can, uyku ve yorgunluk bu kapıda dengelenir.'),
    },
    {
      key: 'endurance',
      name: 'Dayanıklılık Yolu',
      short: 'Rota',
      icon: '〰',
      x: 29,
      y: 72,
      progress: clamp((zones.find(item => item.key === 'walk')?.count || 0) * 10, 0, 100),
      state: zoneState({ ready: true }),
      detail: cleanGameText('Yürüyüş, koşu, bisiklet ve uzun nefes bu yolda işlenir.'),
    },
    {
      key: 'skill',
      name: 'Beceri Kapısı',
      short: 'Kilit',
      icon: '◆',
      x: 59,
      y: 70,
      progress: clamp(unlock?.progress ?? 0),
      state: zoneState({ active: activeZoneKey === 'skill', ready: Boolean(unlock) }),
      detail: cleanGameText(unlock?.todayStep || unlock?.missing || 'Yakın kilitler burada açılır.'),
    },
    {
      key: 'body',
      name: 'Vücut Demirhanesi',
      short: 'Bölge',
      icon: '⬢',
      x: 82,
      y: 70,
      progress: clamp(100 - (riskyRegion?.risk || 0)),
      state: zoneState({ active: activeZoneKey === 'body', blocked: (riskyRegion?.risk || 0) >= 70 }),
      detail: cleanGameText(riskyRegion ? `${riskyRegion.label}: ${riskyRegion.trend || 'takip'}.` : 'Bölge dengesi yeni kayıtlarla işlenir.'),
    },
  ]

  const nodes = [
    {
      key: 'active-quest',
      type: 'activeQuestNode',
      zone: activeZoneKey,
      title: cleanGameText(quest.name || missionLoop.questTitle || 'Bugünün Görevi'),
      body: cleanGameText(quest.desc || missionLoop.questBody || 'Tek temiz hamle yeter.'),
      reward: quest.reward || missionLoop.rewardChips?.[0]?.label || '+XP',
    },
    unlock && {
      key: 'unlock-gate',
      type: 'unlockGateNode',
      zone: 'skill',
      title: cleanGameText(unlock.name || 'Kilit'),
      body: cleanGameText(unlock.todayStep || unlock.missing || 'Bir temiz blok kilidi yaklaştırır.'),
      progress: clamp(unlock.progress),
    },
    riskyRegion && {
      key: 'risk-region',
      type: 'riskNode',
      zone: 'body',
      title: cleanGameText(riskyRegion.label || 'Bölge'),
      body: cleanGameText(riskyRegion.injury?.command || riskyRegion.tip || riskyRegion.detail || 'Bu hat temkin istiyor.'),
      progress: clamp(riskyRegion.risk),
    },
    movement && {
      key: 'movement-line',
      type: 'movementLineNode',
      zone: 'parkour',
      title: cleanGameText(movement.label || 'Hareket Hattı'),
      body: cleanGameText(movement.todayStep || 'Mini teknik blok ilerletir.'),
      progress: clamp(movement.progress ?? movement.score),
    },
    {
      key: 'reward',
      type: 'rewardNode',
      zone: activeZoneKey,
      title: 'Ödül Sandığı',
      body: cleanGameText((missionLoop.rewardChips || []).map(item => item.label).join(' / ') || 'Kayıt gelince ödül açılır.'),
      progress: clamp(mapProgress[0]?.progress || profile.xp?.current || 0),
    },
  ].filter(Boolean)

  return {
    title: 'Dünya Haritası',
    subtitle: cleanGameText(quest.why || missionLoop.questWhy || 'Bugünün rotası son kayıtlara göre seçildi.'),
    activeZoneKey,
    zones: zoneData,
    nodes,
  }
}
