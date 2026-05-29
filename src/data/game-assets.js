import commandBgDesktop from '../assets/game/cozy-v4/command-bg-desktop.jpg'
import commandBgMobile from '../assets/game/cozy-v4/command-bg-mobile.jpg'
import worldMapDesktop from '../assets/game/cozy-v4/world-map-desktop.jpg'
import worldMapMobile from '../assets/game/cozy-v4/world-map-mobile.jpg'
import odieRoomDesktop from '../assets/game/cozy-v4/odie-room-desktop.jpg'
import odieRoomMobile from '../assets/game/cozy-v4/odie-room-mobile.jpg'
import panelParchment from '../assets/game/cozy-v4/panel-parchment.jpg'
import boardLayer from '../assets/game/cozy-v4/board-layer-v4.jpg'
import navPlate from '../assets/game/cozy-v4/nav-plate.png'
import detailSheetBg from '../assets/game/cozy-v4/detail-sheet-bg.jpg'
import questBoardBg from '../assets/game/cozy-v4/quest-board-bg.jpg'
import navCommand from '../assets/game/cozy-v4/nav-command.png'
import navMap from '../assets/game/cozy-v4/nav-map.png'
import navOdie from '../assets/game/cozy-v4/nav-odie.png'
import avatarAthlete from '../assets/game/cozy-v4/avatar-athlete.png'
import odiePortrait from '../assets/game/cozy-v4/odie-portrait.jpg'
import odieIdle from '../assets/game/cozy-v4/odie-idle.png'
import odieListening from '../assets/game/cozy-v4/odie-listening.png'
import odieConfirm from '../assets/game/cozy-v4/odie-confirm.png'
import odieWarning from '../assets/game/cozy-v4/odie-warning.png'
import routeMarker from '../assets/game/cozy-v4/route-marker.png'
import statStr from '../assets/game/cozy-v4/stat-str.png'
import statAgi from '../assets/game/cozy-v4/stat-agi.png'
import statEnd from '../assets/game/cozy-v4/stat-end.png'
import statDex from '../assets/game/cozy-v4/stat-dex.png'
import statCon from '../assets/game/cozy-v4/stat-con.png'
import statSta from '../assets/game/cozy-v4/stat-sta.png'
import zoneForge from '../assets/game/cozy-v4/zone-forge.png'
import zoneParkour from '../assets/game/cozy-v4/zone-parkour.png'
import zoneRecovery from '../assets/game/cozy-v4/zone-recovery.png'
import zoneEndurance from '../assets/game/cozy-v4/zone-endurance.png'
import zoneSkill from '../assets/game/cozy-v4/zone-skill.png'
import zoneBody from '../assets/game/cozy-v4/zone-body.png'
import rewardXp from '../assets/game/cozy-v4/reward-xp.png'
import rewardGift from '../assets/game/cozy-v4/reward-gift.png'
import rewardStreak from '../assets/game/cozy-v4/reward-streak.png'
import rewardUnlock from '../assets/game/cozy-v4/reward-unlock.png'
import rewardRecovery from '../assets/game/cozy-v4/reward-recovery.png'
import rewardPr from '../assets/game/cozy-v4/reward-pr.png'
import rewardShield from '../assets/game/cozy-v4/reward-shield.png'
import badgeLevel from '../assets/game/cozy-v4/badge-level.png'
import badgePr from '../assets/game/cozy-v4/badge-pr.png'
import badgeStreak from '../assets/game/cozy-v4/badge-streak.png'
import badgeLocked from '../assets/game/cozy-v4/badge-locked.png'
import badgeQuest from '../assets/game/cozy-v4/badge-quest.png'
import infoXp from '../assets/game/cozy-v4/info-xp.png'
import infoBodyPressure from '../assets/game/cozy-v4/info-body-pressure.png'
import infoUnlock from '../assets/game/cozy-v4/info-unlock.png'
import infoStatRank from '../assets/game/cozy-v4/info-stat-rank.png'
import infoRecoveryGate from '../assets/game/cozy-v4/info-recovery-gate.png'
import infoPrGate from '../assets/game/cozy-v4/info-pr-gate.png'

export const GAME_ASSETS = {
  backgrounds: {
    command: { desktop: commandBgDesktop, mobile: commandBgMobile },
    worldMap: { desktop: worldMapDesktop, mobile: worldMapMobile },
    odieRoom: { desktop: odieRoomDesktop, mobile: odieRoomMobile },
  },
  ui: {
    panelParchment,
    boardLayer,
    navPlate,
    detailSheetBg,
    questBoardBg,
  },
  nav: {
    command: navCommand,
    map: navMap,
    odie: navOdie,
  },
  avatarAthlete,
  odie: {
    portrait: odiePortrait,
    idle: odieIdle,
    listening: odieListening,
    confirm: odieConfirm,
    warning: odieWarning,
  },
  routeMarker,
  stat: {
    str: statStr,
    agi: statAgi,
    end: statEnd,
    dex: statDex,
    con: statCon,
    sta: statSta,
  },
  zone: {
    forge: zoneForge,
    parkour: zoneParkour,
    recovery: zoneRecovery,
    endurance: zoneEndurance,
    skill: zoneSkill,
    body: zoneBody,
  },
  reward: {
    xp: rewardXp,
    gift: rewardGift,
    streak: rewardStreak,
    unlock: rewardUnlock,
    recovery: rewardRecovery,
    pr: rewardPr,
    shield: rewardShield,
  },
  badge: {
    level: badgeLevel,
    pr: badgePr,
    streak: badgeStreak,
    locked: badgeLocked,
    quest: badgeQuest,
  },
  info: {
    xp: infoXp,
    bodyPressure: infoBodyPressure,
    unlock: infoUnlock,
    statRank: infoStatRank,
    recoveryGate: infoRecoveryGate,
    prGate: infoPrGate,
  },
}

export const STAT_AXES = [
  { key: 'str', short: 'KUV', icon: GAME_ASSETS.stat.str },
  { key: 'agi', short: 'CEV', icon: GAME_ASSETS.stat.agi },
  { key: 'end', short: 'DAY', icon: GAME_ASSETS.stat.end },
  { key: 'dex', short: 'BEC', icon: GAME_ASSETS.stat.dex },
  { key: 'con', short: 'GOV', icon: GAME_ASSETS.stat.con },
  { key: 'sta', short: 'STM', icon: GAME_ASSETS.stat.sta },
]
