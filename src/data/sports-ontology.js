export const ONTOLOGY_CONCEPTS = [
  { id: 'push', label: 'Push Strength', patterns: ['push', 'bench', 'press', 'dip', 'incline press', 'shoulder press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'pull', label: 'Pull Strength', patterns: ['pull', 'row', 'curl', 'pulldown', 'lat', 'dead hang'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'legs_strength', label: 'Leg Strength', patterns: ['squat', 'lunge', 'leg press', 'calf raise', 'split squat'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'walking', label: 'Outdoor Walk', patterns: ['yuruyus', 'yurume', 'walk', 'hike', 'trek', 'doga yuruyusu', 'trail walk'], tags: ['walking', 'endurance'], blockKind: 'locomotion', typeHint: 'Yuruyus', score: 4 },
  { id: 'running', label: 'Run', patterns: ['kosu', 'run', 'jog', 'interval'], tags: ['legs', 'endurance'], blockKind: 'locomotion', typeHint: 'Kosu', score: 4 },
  { id: 'cycling', label: 'Bike', patterns: ['bisiklet', 'cycling', 'bike'], tags: ['cycling', 'legs', 'endurance'], blockKind: 'locomotion', typeHint: 'Bisiklet', score: 4 },
  { id: 'ski', label: 'Ski', patterns: ['kayak', 'ski'], tags: ['ski', 'legs', 'balance', 'endurance'], blockKind: 'locomotion', typeHint: 'Kayak', score: 4 },
  { id: 'climb', label: 'Climb', patterns: ['tirman', 'climb', 'boulder', 'fingerboard'], tags: ['climbing', 'pull', 'grip'], blockKind: 'skill', typeHint: 'Tirmanis', score: 5 },
  { id: 'parkour', label: 'Parkour Drill', patterns: ['parkour', 'vault antrenmani', 'vault drill'], tags: ['parkour', 'legs', 'balance'], blockKind: 'skill', typeHint: 'Parkour', score: 6 },
  { id: 'vault', label: 'Vault', patterns: ['kong vault', 'speed vault', 'lazy vault', 'dash vault', 'vault', 'monkey vault'], tags: ['parkour', 'balance', 'explosive'], blockKind: 'skill', typeHint: 'Parkour', score: 5 },
  { id: 'precision', label: 'Precision Jump', patterns: ['precision jump', 'precision'], tags: ['parkour', 'balance', 'explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 5 },
  { id: 'box_jump', label: 'Box Jump', patterns: ['box jump', 'broad jump', 'jump drill'], tags: ['explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 4 },
  { id: 'landing', label: 'Landing Control', patterns: ['landing', 'stick landing', 'precision landing', 'drop landing'], tags: ['parkour', 'balance', 'legs'], blockKind: 'skill', typeHint: 'Parkour', score: 5 },
  { id: 'cat_leap', label: 'Cat Leap', patterns: ['cat leap', 'catleap', 'arm jump'], tags: ['parkour', 'balance', 'grip'], blockKind: 'skill', typeHint: 'Parkour', score: 5 },
  { id: 'tic_tac', label: 'Tic Tac', patterns: ['tic tac', 'tictac'], tags: ['parkour', 'balance', 'explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 5 },
  { id: 'wall_run', label: 'Wall Run', patterns: ['wall run', 'wallrun'], tags: ['parkour', 'legs', 'explosive'], blockKind: 'explosive', typeHint: 'Parkour', score: 5 },
  { id: 'climb_up_pk', label: 'Climb Up', patterns: ['climb up', 'wall climb', 'mantle'], tags: ['parkour', 'pull', 'grip'], blockKind: 'skill', typeHint: 'Parkour', score: 5 },
  { id: 'underbar', label: 'Underbar', patterns: ['underbar', 'gate vault'], tags: ['parkour', 'balance', 'core'], blockKind: 'skill', typeHint: 'Parkour', score: 4 },
  { id: 'stride', label: 'Stride', patterns: ['stride', 'stride jump'], tags: ['parkour', 'explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 4 },
  { id: 'drop', label: 'Drop', patterns: ['drop', 'drop jump', 'depth drop', 'depth jump'], tags: ['parkour', 'legs', 'balance'], blockKind: 'skill', typeHint: 'Parkour', score: 4 },
  { id: 'quadrupedal', label: 'Quadrupedal', patterns: ['quadrupedal', 'qm', 'crawl flow', 'kong crawl', 'animal flow'], tags: ['parkour', 'core', 'balance'], blockKind: 'skill', typeHint: 'Parkour', score: 4 },
  { id: 'flow', label: 'Flow Run', patterns: ['flow', 'combo run', 'line run', 'freerun', 'freerunning'], tags: ['parkour', 'balance', 'endurance'], blockKind: 'skill', typeHint: 'Parkour', score: 4 },
  { id: 'acro', label: 'Acrobatics', patterns: ['akrobasi', 'acrobatics', 'flip', 'barani', 'round off', 'roundoff'], tags: ['acrobatics', 'balance', 'explosive'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'front_flip', label: 'Front Flip', patterns: ['front flip', 'frontflip', 'on takla', 'on salto'], tags: ['acrobatics', 'explosive', 'balance'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'back_flip', label: 'Back Flip', patterns: ['back flip', 'backflip', 'geri takla', 'salto'], tags: ['acrobatics', 'explosive', 'balance'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'side_flip', label: 'Side Flip', patterns: ['side flip', 'sideflip', 'yan takla'], tags: ['acrobatics', 'explosive'], blockKind: 'skill', typeHint: 'Akrobasi', score: 4 },
  { id: 'aerial', label: 'Aerial', patterns: ['aerial', 'no hand cartwheel'], tags: ['acrobatics', 'explosive', 'balance'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'gainer', label: 'Gainer', patterns: ['gainer', 'wallflip', 'wall flip'], tags: ['acrobatics', 'explosive'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'core', label: 'Core', patterns: ['core', 'plank', 'hollow', 'leg raise', 'hanging leg raise', 'dragon flag', 'caki', 'toes to bar'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'mobility', label: 'Mobility', patterns: ['mobility', 'esneme', 'stretch', 'bridge', 'split', 'hip flexor'], tags: ['mobility', 'recovery'], blockKind: 'mobility', typeHint: 'Stretching', score: 4 },
  { id: 'recovery', label: 'Recovery', patterns: ['sauna', 'recovery', 'cooldown', 'flush', 'dinlenme', 'rest day'], tags: ['recovery'], blockKind: 'recovery', typeHint: 'Stretching', score: 3 },
  { id: 'terrain', label: 'Terrain', patterns: ['doga', 'trail', 'orman', 'zemin', 'uphill', 'yokus', 'stairs', 'hill'], tags: ['terrain'], blockKind: 'locomotion', typeHint: 'Custom', score: 2 },
  { id: 'carry', label: 'Carry', patterns: ['carry', 'farmer', 'sandbag'], tags: ['carry', 'grip'], blockKind: 'strength', typeHint: 'Custom', score: 3 },

  // ── Calisthenics & Skill — Pull family ─────────────────────────────────────
  { id: 'pull_up', label: 'Pull Up', patterns: ['pull up', 'pullup', 'pull-up', 'barfiks', 'kipping pull', 'strict pull'], tags: ['pull', 'calisthenics'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'chin_up', label: 'Chin Up', patterns: ['chin up', 'chinup', 'chin-up', 'supinated pull', 'palms up pull'], tags: ['pull', 'calisthenics'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'weighted_pull', label: 'Weighted Pull', patterns: ['weighted pull', 'weighted chin', 'weighted chin up', 'weighted chin-up', '+kg pull', 'pull+', 'agirlikli barfiks', 'agirlikli chin', 'weighted pullup'], tags: ['pull', 'calisthenics', 'weighted-calisthenics'], blockKind: 'strength', typeHint: 'Pull', score: 6 },
  { id: 'archer_pull', label: 'Archer Pull', patterns: ['archer pull', 'archer chin'], tags: ['pull', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Pull', score: 6 },
  { id: 'typewriter_pull', label: 'Typewriter Pull', patterns: ['typewriter pull', 'typewriter'], tags: ['pull', 'calisthenics'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'oac', label: 'One Arm Chin', patterns: ['oac', 'one arm chin', 'one arm pull', 'one arm pull up', 'tek kol pull'], tags: ['pull', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Pull', score: 7 },
  { id: 'assisted_pull', label: 'Assisted Pull', patterns: ['band pull up', 'assisted pull', 'asistanli barfiks', 'jumping pull'], tags: ['pull', 'calisthenics'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'inverted_row', label: 'Inverted Row', patterns: ['inverted row', 'australian pull', 'body row', 'ters cekis'], tags: ['pull', 'calisthenics', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'ring_row', label: 'Ring Row', patterns: ['ring row', 'halka row'], tags: ['pull', 'calisthenics', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'muscle_up', label: 'Muscle Up', patterns: ['muscle up', 'muscleup', 'mu', 'kipping mu', 'strict mu', 'ring mu', 'bar mu'], tags: ['pull', 'push', 'calisthenics', 'explosive'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'false_grip', label: 'False Grip', patterns: ['false grip', 'yalanci tutus', 'fg pull'], tags: ['pull', 'calisthenics', 'grip'], blockKind: 'strength', typeHint: 'Calisthenics', score: 4 },

  // ── Calisthenics — Lever family ────────────────────────────────────────────
  { id: 'front_lever', label: 'Front Lever', patterns: ['front lever', 'fl', 'full front lever'], tags: ['pull', 'core', 'calisthenics', 'lever', 'isometric'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'front_lever_tuck', label: 'FL Tuck', patterns: ['tuck lever', 'tuck fl', 'fl tuck', 'front lever tuck'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'front_lever_adv_tuck', label: 'FL Adv Tuck', patterns: ['advanced tuck lever', 'adv tuck fl', 'adv tuck lever'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'front_lever_straddle', label: 'FL Straddle', patterns: ['straddle lever', 'straddle fl', 'fl straddle'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'front_lever_half_lay', label: 'FL Half Lay', patterns: ['half lay lever', 'half lay fl', 'half lay'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'front_lever_raises', label: 'FL Raise', patterns: ['front lever raise', 'fl raise', 'fl pull'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'back_lever', label: 'Back Lever', patterns: ['back lever', 'bl', 'full bl'], tags: ['pull', 'core', 'calisthenics', 'lever', 'isometric'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'back_lever_tuck', label: 'BL Tuck', patterns: ['bl tuck', 'tuck back lever', 'adv tuck back lever', 'straddle back lever'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'human_flag', label: 'Human Flag', patterns: ['human flag', 'side lever', 'bayrak'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'dragon_press', label: 'Dragon Press', patterns: ['dragon press', 'victorian', 'victorian cross'], tags: ['push', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },

  // ── Calisthenics — Planche family ──────────────────────────────────────────
  { id: 'planche', label: 'Planche', patterns: ['planche', 'plans', 'full planche'], tags: ['push', 'core', 'calisthenics', 'isometric'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'planche_lean', label: 'Planche Lean', patterns: ['planche lean', 'frog stand', 'frog pose'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 4 },
  { id: 'tuck_planche', label: 'Tuck Planche', patterns: ['tuck planche', 'tuck plans'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'adv_tuck_planche', label: 'Adv Tuck Planche', patterns: ['advanced tuck planche', 'adv tuck planche', 'adv tuck plans'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'straddle_planche', label: 'Straddle Planche', patterns: ['straddle planche', 'straddle plans'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'half_lay_planche', label: 'Half Lay Planche', patterns: ['half lay planche'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'pseudo_planche_pushup', label: 'Pseudo Planche Pushup', patterns: ['pseudo planche', 'ppp', 'pseudo planche pushup'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },

  // ── Calisthenics — Push family ─────────────────────────────────────────────
  { id: 'push_up', label: 'Push Up', patterns: ['push up', 'pushup', 'push-up', 'sinek', 'sinav'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'archer_pushup', label: 'Archer Pushup', patterns: ['archer push up', 'archer pushup'], tags: ['push', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'diamond_pushup', label: 'Diamond Pushup', patterns: ['diamond push', 'diamond pushup', 'elmas'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'decline_pushup', label: 'Decline Pushup', patterns: ['decline pushup', 'decline push', 'egimli sinek'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'incline_pushup', label: 'Incline Pushup', patterns: ['incline pushup', 'knee push up', 'diz sinegi'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'deficit_pushup', label: 'Deficit Pushup', patterns: ['deficit pushup', 'deficit push', 'derin push'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'hindu_pushup', label: 'Hindu Pushup', patterns: ['hindu push', 'hindu pushup', 'dive bomber'], tags: ['push', 'calisthenics', 'mobility'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'oap', label: 'One Arm Pushup', patterns: ['one arm pushup', 'oap', 'single arm pushup', 'tek kol sinav'], tags: ['push', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Push', score: 7 },
  { id: 'tiger_pushup', label: 'Tiger Pushup', patterns: ['tiger push', 'tiger bend'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'clap_pushup', label: 'Clap Pushup', patterns: ['clap pushup', 'plyo pushup', 'alkis sinek'], tags: ['push', 'calisthenics', 'plyometric'], blockKind: 'explosive', typeHint: 'Push', score: 5 },
  { id: 'dip', label: 'Dip', patterns: ['dip', 'parallel dip', 'station dip'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'weighted_dip', label: 'Weighted Dip', patterns: ['weighted dip', '+kg dip', 'dip+', 'agirlikli dip'], tags: ['push', 'calisthenics', 'weighted-calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 6 },
  { id: 'ring_dip', label: 'Ring Dip', patterns: ['ring dip', 'halka dip'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'bench_dip', label: 'Bench Dip', patterns: ['bench dip', 'banc dip', 'sandalye dip'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'korean_dip', label: 'Korean Dip', patterns: ['korean dip', 'korean push'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Push', score: 5 },

  // ── Calisthenics — Handstand family ────────────────────────────────────────
  { id: 'hspu', label: 'HSPU', patterns: ['hspu', 'handstand push up', 'hs push', 'freestanding hspu'], tags: ['push', 'calisthenics', 'vertical-push'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'pike_pushup', label: 'Pike Pushup', patterns: ['pike push up', 'pike pushup', 'l-shape push'], tags: ['push', 'calisthenics', 'vertical-push'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'wall_hspu', label: 'Wall HSPU', patterns: ['wall hspu', 'duvar hspu'], tags: ['push', 'calisthenics', 'vertical-push'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'deficit_hspu', label: 'Deficit HSPU', patterns: ['deficit hspu', 'deficit handstand push'], tags: ['push', 'calisthenics', 'vertical-push'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'handstand', label: 'Handstand', patterns: ['handstand', 'amuda', 'el ustu', 'hs hold'], tags: ['push', 'balance', 'calisthenics', 'isometric'], blockKind: 'skill', typeHint: 'Calisthenics', score: 5 },
  { id: 'wall_handstand', label: 'Wall Handstand', patterns: ['wall handstand', 'duvar handstand', 'wall hs'], tags: ['push', 'balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 4 },
  { id: 'freestand_hs', label: 'Freestand HS', patterns: ['freestanding handstand', 'freestand hs', 'serbest amuda'], tags: ['push', 'balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 6 },
  { id: 'handstand_walk', label: 'HS Walk', patterns: ['handstand walk', 'hs walk', 'amuda yuruyus'], tags: ['push', 'balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 6 },
  { id: 'press_to_handstand', label: 'Press to HS', patterns: ['press to handstand', 'hs press', 'press hs'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'tuck_press', label: 'Tuck Press', patterns: ['tuck press', 'straddle press', 'hollow press'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },
  { id: 'headstand', label: 'Headstand', patterns: ['headstand', 'bas ustu', 'bas durusu'], tags: ['balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 3 },
  { id: 'tripod', label: 'Tripod', patterns: ['tripod', 'uc ayak'], tags: ['balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 3 },
  { id: 'crow_pose', label: 'Crow Pose', patterns: ['crow pose', 'karga', 'frog stand crow', 'crane'], tags: ['balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 4 },
  { id: 'side_crow', label: 'Side Crow', patterns: ['side crow', 'yan karga'], tags: ['balance', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 4 },

  // ── Calisthenics — L-sit / V-sit / Manna ───────────────────────────────────
  { id: 'lsit', label: 'L-Sit', patterns: ['l-sit', 'lsit', 'l sit', 'parallel l-sit'], tags: ['core', 'calisthenics', 'isometric'], blockKind: 'core', typeHint: 'Calisthenics', score: 5 },
  { id: 'lsit_tuck', label: 'Tuck L-Sit', patterns: ['tuck l-sit', 'tuck lsit'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Calisthenics', score: 4 },
  { id: 'one_leg_lsit', label: 'One Leg L-Sit', patterns: ['one leg lsit', 'one leg l-sit'], tags: ['core', 'calisthenics', 'unilateral'], blockKind: 'core', typeHint: 'Calisthenics', score: 5 },
  { id: 'vsit', label: 'V-Sit', patterns: ['v-sit', 'vsit', 'v sit'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Calisthenics', score: 6 },
  { id: 'manna', label: 'Manna', patterns: ['manna', 'manna press'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Calisthenics', score: 7 },
  { id: 'hanging_lsit', label: 'Hanging L-Sit', patterns: ['hanging lsit', 'hanging l-sit', 'asili l-sit'], tags: ['core', 'pull', 'calisthenics'], blockKind: 'core', typeHint: 'Calisthenics', score: 5 },

  // ── Calisthenics — Core / anti-extension / anti-rotation ───────────────────
  { id: 'hollow_body', label: 'Hollow Body', patterns: ['hollow body', 'hollow hold', 'hollow rock', 'hollow tutus'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'arch_hold', label: 'Arch Hold', patterns: ['arch hold', 'superman', 'superman hold'], tags: ['core', 'posterior'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'dragon_flag', label: 'Dragon Flag', patterns: ['dragon flag', 'dragon', 'dragonflag'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Custom', score: 6 },
  { id: 'tuck_dragon', label: 'Tuck Dragon', patterns: ['tuck dragon', 'tuck dragon flag'], tags: ['core', 'calisthenics'], blockKind: 'core', typeHint: 'Custom', score: 5 },
  { id: 'single_leg_df', label: 'Single Leg Dragon', patterns: ['single leg dragon', 'sl dragon flag'], tags: ['core', 'calisthenics', 'unilateral'], blockKind: 'core', typeHint: 'Custom', score: 5 },
  { id: 'plank', label: 'Plank', patterns: ['plank hold', 'fici', 'statik plank'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'side_plank', label: 'Side Plank', patterns: ['side plank', 'yan plank'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'copenhagen_plank', label: 'Copenhagen Plank', patterns: ['copenhagen plank', 'copenhagen', 'adductor plank'], tags: ['core', 'legs'], blockKind: 'core', typeHint: 'Custom', score: 5 },
  { id: 'rkc_plank', label: 'RKC Plank', patterns: ['rkc plank', 'hard style plank'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'pallof_press', label: 'Pallof Press', patterns: ['pallof press', 'anti-rotation', 'anti rotasyon'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'ab_wheel', label: 'Ab Wheel', patterns: ['ab wheel', 'ab roller', 'tekerlek'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 5 },
  { id: 'hanging_leg_raise', label: 'Hanging Leg Raise', patterns: ['hanging leg raise', 'hlr', 'asili bacak kaldirma'], tags: ['core', 'pull'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'toes_to_bar', label: 'Toes to Bar', patterns: ['toes to bar', 't2b', 'ttb', 'ayak bara'], tags: ['core', 'pull'], blockKind: 'core', typeHint: 'Custom', score: 5 },
  { id: 'knees_to_chest', label: 'Knees to Chest', patterns: ['knees to chest', 'k2c', 'dizleri gogse'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'windshield_wiper', label: 'Windshield Wiper', patterns: ['windshield wiper', 'silecek', 'ww'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'russian_twist', label: 'Russian Twist', patterns: ['russian twist', 'rus twist'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'dead_bug', label: 'Dead Bug', patterns: ['dead bug', 'olu bocek'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'bird_dog', label: 'Bird Dog', patterns: ['bird dog', 'kus kopek'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },
  { id: 'cocoon', label: 'Cocoon', patterns: ['cocoon', 'caki'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 3 },

  // ── Calisthenics — Leg unilateral & posterior (weak-area fix) ──────────────
  { id: 'pistol_squat', label: 'Pistol Squat', patterns: ['pistol', 'pistol squat', 'single leg squat', 'sls', 'tek bacak squat'], tags: ['legs', 'balance', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 6 },
  { id: 'assisted_pistol', label: 'Assisted Pistol', patterns: ['assisted pistol', 'box pistol', 'jumping pistol', 'asistanli pistol'], tags: ['legs', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'shrimp_squat', label: 'Shrimp Squat', patterns: ['shrimp squat', 'shrimp', 'beginner shrimp'], tags: ['legs', 'balance', 'calisthenics', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 6 },
  { id: 'nordic_curl', label: 'Nordic Curl', patterns: ['nordic curl', 'nordic', 'glute ham raise', 'ghr'], tags: ['legs', 'posterior'], blockKind: 'strength', typeHint: 'Bacak', score: 6 },
  { id: 'single_leg_dl_calisthenics', label: 'SL Deadlift', patterns: ['single leg deadlift', 'sldl', 'tek bacak deadlift'], tags: ['legs', 'posterior', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },
  { id: 'step_up', label: 'Step Up', patterns: ['step up', 'step-up', 'basamak'], tags: ['legs', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'box_squat', label: 'Box Squat', patterns: ['box squat', 'kutu squat'], tags: ['legs'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'cossack_squat', label: 'Cossack Squat', patterns: ['cossack squat', 'kazak squat'], tags: ['legs', 'mobility', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'glute_bridge', label: 'Glute Bridge', patterns: ['glute bridge', 'glut kopru', 'kalca koprusu'], tags: ['legs', 'posterior'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'single_leg_bridge', label: 'SL Bridge', patterns: ['single leg bridge', 'slhb'], tags: ['legs', 'posterior', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'hip_thrust', label: 'Hip Thrust', patterns: ['hip thrust', 'kalca itme'], tags: ['legs', 'posterior', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },

  // ── Calisthenics — Bridge & gymnastic ──────────────────────────────────────
  { id: 'bridge_full', label: 'Full Bridge', patterns: ['full bridge', 'gymnastic bridge', 'kopru'], tags: ['mobility', 'core'], blockKind: 'mobility', typeHint: 'Calisthenics', score: 4 },
  { id: 'bridge_press', label: 'Bridge Press', patterns: ['bridge press', 'stand to bridge', 'kapi kopru'], tags: ['mobility', 'core'], blockKind: 'mobility', typeHint: 'Calisthenics', score: 6 },
  { id: 'wrestler_bridge', label: 'Wrestler Bridge', patterns: ['wrestler bridge', 'guresci kopru'], tags: ['mobility', 'core'], blockKind: 'mobility', typeHint: 'Calisthenics', score: 4 },
  { id: 'wall_walk', label: 'Wall Walk', patterns: ['wall walk', 'duvar yuruyus'], tags: ['push', 'core', 'calisthenics'], blockKind: 'skill', typeHint: 'Calisthenics', score: 4 },
  { id: 'skin_the_cat', label: 'Skin the Cat', patterns: ['skin the cat', 'kediye don'], tags: ['pull', 'core', 'calisthenics', 'mobility'], blockKind: 'skill', typeHint: 'Calisthenics', score: 4 },
  { id: 'german_hang', label: 'German Hang', patterns: ['german hang', 'alman aski'], tags: ['pull', 'mobility'], blockKind: 'mobility', typeHint: 'Calisthenics', score: 4 },
  { id: 'ice_cream_maker', label: 'Ice Cream Maker', patterns: ['ice cream maker', 'dondurma'], tags: ['pull', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'back_lever_pull', label: 'BL Pull', patterns: ['back lever pull', 'bl pull'], tags: ['pull', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 6 },

  // ── Calisthenics — Ring work ───────────────────────────────────────────────
  { id: 'ring_pushup', label: 'Ring Pushup', patterns: ['ring push up', 'ring pushup', 'halka sinav'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 5 },
  { id: 'ring_muscle_up', label: 'Ring Muscle Up', patterns: ['ring muscle up', 'ring mu'], tags: ['pull', 'push', 'calisthenics', 'explosive'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'ring_fl', label: 'Ring Front Lever', patterns: ['ring front lever', 'ring fl'], tags: ['pull', 'core', 'calisthenics', 'lever'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'ring_planche', label: 'Ring Planche', patterns: ['ring planche', 'ring lean'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 7 },
  { id: 'iron_cross', label: 'Iron Cross', patterns: ['iron cross', 'demir hac'], tags: ['push', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 8 },
  { id: 'maltese', label: 'Maltese', patterns: ['maltese', 'maltez'], tags: ['push', 'core', 'calisthenics'], blockKind: 'strength', typeHint: 'Calisthenics', score: 8 },

  // ── Strength compounds — Squat family ──────────────────────────────────────
  { id: 'back_squat', label: 'Back Squat', patterns: ['back squat', 'low bar squat', 'high bar squat', 'sirt squat'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },
  { id: 'front_squat', label: 'Front Squat', patterns: ['front squat', 'fsq', 'on squat'], tags: ['legs', 'core', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },
  { id: 'overhead_squat', label: 'OHS', patterns: ['overhead squat', 'ohs', 'bas ustu squat'], tags: ['legs', 'core', 'mobility'], blockKind: 'strength', typeHint: 'Bacak', score: 6 },
  { id: 'goblet_squat', label: 'Goblet Squat', patterns: ['goblet squat', 'kupa squat'], tags: ['legs'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'zercher_squat', label: 'Zercher Squat', patterns: ['zercher squat', 'zercher'], tags: ['legs', 'core'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },
  { id: 'hack_squat', label: 'Hack Squat', patterns: ['hack squat', 'smith hack'], tags: ['legs'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'bulgarian_squat', label: 'Bulgarian Squat', patterns: ['bulgarian split squat', 'bss', 'bulgarian', 'split squat', 'bulgar'], tags: ['legs', 'balance', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },
  { id: 'lunge', label: 'Lunge', patterns: ['lunge', 'lunges', 'hamle', 'walking lunge', 'reverse lunge'], tags: ['legs', 'unilateral'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'sissy_squat', label: 'Sissy Squat', patterns: ['sissy squat'], tags: ['legs'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'pause_squat', label: 'Pause Squat', patterns: ['pause squat', 'paused squat', 'durmali squat'], tags: ['legs'], blockKind: 'strength', typeHint: 'Bacak', score: 5 },

  // ── Strength compounds — Bench family ──────────────────────────────────────
  { id: 'bench_press', label: 'Bench Press', patterns: ['bench press', 'duz bench', 'flat bench', 'bp'], tags: ['push', 'gym', 'horizontal-push'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'incline_bench', label: 'Incline Bench', patterns: ['incline bench', 'incline press', 'egimli bench'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'decline_bench', label: 'Decline Bench', patterns: ['decline bench', 'decline press', 'ters bench'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'close_grip_bench', label: 'Close Grip Bench', patterns: ['close grip bench', 'cgbp', 'dar tutus bench', 'narrow bench'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'paused_bench', label: 'Paused Bench', patterns: ['paused bench', 'dur bench', 'bottom paused', 'spoto'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'floor_press', label: 'Floor Press', patterns: ['floor press', 'yer press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'dumbbell_bench', label: 'DB Bench', patterns: ['dumbbell bench', 'db bench', 'dambil bench'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'dumbbell_fly', label: 'Fly', patterns: ['dumbbell fly', 'fly', 'dambil acis', 'kelebek'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'cable_fly', label: 'Cable Fly', patterns: ['cable fly', 'cable cross'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },

  // ── Strength compounds — Press family ──────────────────────────────────────
  { id: 'ohp', label: 'OHP', patterns: ['ohp', 'overhead press', 'military press', 'strict press', 'omuz press', 'bas ustu press'], tags: ['push', 'gym', 'vertical-push'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'push_press', label: 'Push Press', patterns: ['push press', 'jerk press'], tags: ['push', 'gym', 'explosive'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'jerk', label: 'Jerk', patterns: ['split jerk', 'push jerk'], tags: ['push', 'gym', 'explosive'], blockKind: 'explosive', typeHint: 'Push', score: 6 },
  { id: 'behind_neck_press', label: 'Behind Neck Press', patterns: ['behind neck press', 'bnp', 'ense press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'seated_press', label: 'Seated Press', patterns: ['seated press', 'oturarak press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'landmine_press', label: 'Landmine Press', patterns: ['landmine press', 'landmine', 'hammer press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'z_press', label: 'Z Press', patterns: ['z press', 'zercher press'], tags: ['push', 'core', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'arnold_press', label: 'Arnold Press', patterns: ['arnold press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },

  // ── Strength compounds — Deadlift family ───────────────────────────────────
  { id: 'deadlift', label: 'Deadlift', patterns: ['deadlift', 'conventional deadlift', 'conv dl'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 6 },
  { id: 'sumo_deadlift', label: 'Sumo Deadlift', patterns: ['sumo deadlift', 'sumo dl', 'sumo'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 6 },
  { id: 'romanian_deadlift', label: 'RDL', patterns: ['romanian deadlift', 'rdl', 'romanian'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'stiff_leg_dl', label: 'SLDL', patterns: ['stiff leg deadlift', 'duz bacak deadlift'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'deficit_dl', label: 'Deficit DL', patterns: ['deficit deadlift', 'deficit dl'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 6 },
  { id: 'block_pull', label: 'Block Pull', patterns: ['block pull', 'blok deadlift'], tags: ['pull', 'posterior', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'rack_pull', label: 'Rack Pull', patterns: ['rack pull', 'rack deadlift'], tags: ['pull', 'posterior', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'trap_bar_dl', label: 'Trap Bar DL', patterns: ['trap bar deadlift', 'trap bar', 'hex bar dl'], tags: ['pull', 'posterior', 'legs', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },

  // ── Strength compounds — Olympic lifts ─────────────────────────────────────
  { id: 'snatch', label: 'Snatch', patterns: ['snatch', 'full snatch', 'koparma'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 7 },
  { id: 'power_snatch', label: 'Power Snatch', patterns: ['power snatch', 'guc koparma'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 6 },
  { id: 'hang_snatch', label: 'Hang Snatch', patterns: ['hang snatch', 'aski koparma'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 6 },
  { id: 'clean', label: 'Clean', patterns: ['full clean', 'silkme'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 6 },
  { id: 'power_clean', label: 'Power Clean', patterns: ['power clean', 'guc silkme'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 6 },
  { id: 'hang_clean', label: 'Hang Clean', patterns: ['hang clean', 'aski silkme'], tags: ['pull', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 6 },
  { id: 'clean_and_jerk', label: 'Clean & Jerk', patterns: ['clean and jerk', 'c&j', 'silkme jerk'], tags: ['pull', 'push', 'explosive', 'gym'], blockKind: 'explosive', typeHint: 'Pull', score: 7 },
  { id: 'clean_pull', label: 'Clean Pull', patterns: ['clean pull', 'silkme cek'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 'snatch_pull', label: 'Snatch Pull', patterns: ['snatch pull', 'koparma cek'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 5 },

  // ── Strength compounds — Posterior / Glute / Hamstring ─────────────────────
  { id: 'back_extension', label: 'Back Extension', patterns: ['back extension', 'hyperextension', 'hyper', 'romanian chair', 'sirt ekstansiyonu'], tags: ['posterior', 'core'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'reverse_hyper', label: 'Reverse Hyper', patterns: ['reverse hyper', 'ters hyper'], tags: ['posterior', 'core'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'kettlebell_swing', label: 'KB Swing', patterns: ['kb swing', 'kettlebell swing', 'gulle swing'], tags: ['posterior', 'explosive'], blockKind: 'explosive', typeHint: 'Pull', score: 4 },
  { id: 'good_morning', label: 'Good Morning', patterns: ['good morning', 'gunaydin'], tags: ['posterior', 'legs'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'ghd_situp', label: 'GHD Situp', patterns: ['ghd situp', 'glute ham developer'], tags: ['posterior', 'core'], blockKind: 'core', typeHint: 'Custom', score: 5 },

  // ── Strength compounds — Quad isolation ────────────────────────────────────
  { id: 'leg_press', label: 'Leg Press', patterns: ['leg press', 'lp', 'bacak press'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'leg_extension', label: 'Leg Extension', patterns: ['leg extension', 'leg ext', 'bacak acis'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'leg_curl', label: 'Leg Curl', patterns: ['leg curl', 'lc', 'bacak buk', 'lying curl', 'seated curl'], tags: ['legs', 'posterior', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },

  // ── Strength compounds — Calf ──────────────────────────────────────────────
  { id: 'standing_calf', label: 'Standing Calf Raise', patterns: ['standing calf raise', 'calf raise', 'ayakta kalf', 'baldir'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'seated_calf', label: 'Seated Calf', patterns: ['seated calf', 'oturarak kalf'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'donkey_calf', label: 'Donkey Calf', patterns: ['donkey calf'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },
  { id: 'tibialis_raise', label: 'Tibialis Raise', patterns: ['tibialis raise', 'tibialis', 'on baldir'], tags: ['legs', 'mobility'], blockKind: 'strength', typeHint: 'Bacak', score: 3 },

  // ── Strength compounds — Row family ────────────────────────────────────────
  { id: 'barbell_row', label: 'Barbell Row', patterns: ['barbell row', 'bb row', 'halter row', 'pendlay row', 'pendlay'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 5 },
  { id: 't_bar_row', label: 'T-Bar Row', patterns: ['t-bar row', 't bar row', 't-bar'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'cable_row', label: 'Cable Row', patterns: ['cable row', 'kablo row'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'seal_row', label: 'Seal Row', patterns: ['seal row', 'muhur row'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'chest_supported_row', label: 'Chest Supported Row', patterns: ['chest supported row', 'csr'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'meadows_row', label: 'Meadows Row', patterns: ['meadows row'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'db_row', label: 'DB Row', patterns: ['db row', 'dumbbell row', 'single arm row', 'dambil row'], tags: ['pull', 'gym', 'horizontal-pull', 'unilateral'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'kroc_row', label: 'Kroc Row', patterns: ['kroc row'], tags: ['pull', 'gym', 'horizontal-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },

  // ── Strength compounds — Lat ───────────────────────────────────────────────
  { id: 'lat_pulldown', label: 'Lat Pulldown', patterns: ['lat pulldown', 'lpd', 'lat cekis'], tags: ['pull', 'gym', 'vertical-pull'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'straight_arm_pulldown', label: 'Straight Arm Pulldown', patterns: ['straight arm pulldown', 'sapd', 'duz kol pulldown'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'pullover', label: 'Pullover', patterns: ['pullover', 'db pullover'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },

  // ── Strength compounds — Curl & Tricep ─────────────────────────────────────
  { id: 'bb_curl', label: 'Barbell Curl', patterns: ['barbell curl', 'bb curl', 'halter curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'db_curl', label: 'DB Curl', patterns: ['dumbbell curl', 'db curl', 'dambil curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'hammer_curl', label: 'Hammer Curl', patterns: ['hammer curl', 'cekic curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'preacher_curl', label: 'Preacher Curl', patterns: ['preacher curl', 'preacher'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'incline_curl', label: 'Incline Curl', patterns: ['incline curl', 'egimli curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'spider_curl', label: 'Spider Curl', patterns: ['spider curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'concentration_curl', label: 'Concentration Curl', patterns: ['concentration curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'zottman_curl', label: 'Zottman Curl', patterns: ['zottman curl'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'curl_21s', label: '21s Curl', patterns: ['21s curl', '21s'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'skullcrusher', label: 'Skullcrusher', patterns: ['skullcrusher', 'skull crusher', 'kafa kiran'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'tricep_pushdown', label: 'Tricep Pushdown', patterns: ['tricep pushdown', 'pushdown'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'rope_pushdown', label: 'Rope Pushdown', patterns: ['rope pushdown', 'halat pushdown'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'overhead_extension', label: 'Overhead Extension', patterns: ['overhead extension', 'bas ustu uzatma', 'french press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'kickback', label: 'Tricep Kickback', patterns: ['tricep kickback', 'kickback'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'jm_press', label: 'JM Press', patterns: ['jm press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },

  // ── Strength compounds — Carry & Strongman ─────────────────────────────────
  { id: 'farmer_carry', label: 'Farmer Carry', patterns: ['farmer carry', 'farmer walk', 'ciftci yuruyus', 'farmers'], tags: ['carry', 'grip', 'core'], blockKind: 'strength', typeHint: 'Custom', score: 4 },
  { id: 'suitcase_carry', label: 'Suitcase Carry', patterns: ['suitcase carry', 'valiz tasi'], tags: ['carry', 'grip', 'core', 'unilateral'], blockKind: 'strength', typeHint: 'Custom', score: 4 },
  { id: 'overhead_carry', label: 'Overhead Carry', patterns: ['overhead carry', 'waiter walk', 'garson yuruyus'], tags: ['carry', 'core'], blockKind: 'strength', typeHint: 'Custom', score: 4 },
  { id: 'yoke_walk', label: 'Yoke Walk', patterns: ['yoke walk', 'yoke carry'], tags: ['carry', 'core'], blockKind: 'strength', typeHint: 'Custom', score: 5 },
  { id: 'sandbag_carry', label: 'Sandbag Carry', patterns: ['sandbag carry', 'kum torbasi tasi'], tags: ['carry', 'grip'], blockKind: 'strength', typeHint: 'Custom', score: 4 },
  { id: 'zercher_carry', label: 'Zercher Carry', patterns: ['zercher carry'], tags: ['carry', 'core'], blockKind: 'strength', typeHint: 'Custom', score: 4 },
  { id: 'atlas_stone', label: 'Atlas Stone', patterns: ['atlas stone', 'atlas tasi'], tags: ['carry', 'pull', 'posterior'], blockKind: 'strength', typeHint: 'Custom', score: 6 },
  { id: 'log_press', label: 'Log Press', patterns: ['log press', 'kutuk press'], tags: ['push', 'core'], blockKind: 'strength', typeHint: 'Push', score: 5 },
  { id: 'tire_flip', label: 'Tire Flip', patterns: ['tire flip', 'lastik cevirme'], tags: ['posterior', 'explosive'], blockKind: 'explosive', typeHint: 'Custom', score: 5 },
  { id: 'sled_push', label: 'Sled Push', patterns: ['sled push', 'kizak it'], tags: ['legs', 'endurance'], blockKind: 'locomotion', typeHint: 'Custom', score: 4 },
  { id: 'sled_pull', label: 'Sled Pull', patterns: ['sled pull', 'kizak cek'], tags: ['legs', 'pull', 'endurance'], blockKind: 'locomotion', typeHint: 'Custom', score: 4 },
  { id: 'prowler', label: 'Prowler', patterns: ['prowler', 'prowler push'], tags: ['legs', 'endurance', 'explosive'], blockKind: 'locomotion', typeHint: 'Custom', score: 4 },

  // ── Strength compounds — Other compound / accessory ────────────────────────
  { id: 'face_pull', label: 'Face Pull', patterns: ['face pull', 'ypa', 'band pull apart'], tags: ['pull', 'mobility'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'shrug', label: 'Shrug', patterns: ['shrug', 'omuz silkme', 'trap shrug'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'lateral_raise', label: 'Lateral Raise', patterns: ['lateral raise', 'side raise', 'yan kaldiris', 'omuz yan'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'front_raise', label: 'Front Raise', patterns: ['front raise', 'on kaldiris'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 3 },
  { id: 'rear_delt_fly', label: 'Rear Delt Fly', patterns: ['rear delt fly', 'ters fly', 'arka delt'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'upright_row', label: 'Upright Row', patterns: ['upright row', 'dik cekis'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 3 },
  { id: 'landmine_row', label: 'Landmine Row', patterns: ['landmine row'], tags: ['pull', 'gym', 'unilateral'], blockKind: 'strength', typeHint: 'Pull', score: 4 },

  // ── Conditioning & Energy systems ──────────────────────────────────────────
  { id: 'hiit', label: 'HIIT', patterns: ['hiit', 'tabata', 'interval training', 'sprint repeat'], tags: ['endurance', 'explosive'], blockKind: 'locomotion', typeHint: 'Custom', score: 5 },
  { id: 'emom', label: 'EMOM', patterns: ['emom', 'every minute', 'every min on min'], tags: ['endurance', 'explosive'], blockKind: 'locomotion', typeHint: 'Custom', score: 5 },
  { id: 'amrap', label: 'AMRAP', patterns: ['amrap', 'max rounds', 'as many rounds'], tags: ['endurance'], blockKind: 'locomotion', typeHint: 'Custom', score: 5 },
  { id: 'crossfit_metcon', label: 'Metcon', patterns: ['metcon', 'wod', 'crossfit', 'circuit'], tags: ['endurance'], blockKind: 'locomotion', typeHint: 'Custom', score: 5 },
  { id: 'sprint', label: 'Sprint', patterns: ['sprint', 'all out', 'anaerobic sprint'], tags: ['legs', 'explosive', 'endurance'], blockKind: 'locomotion', typeHint: 'Kosu', score: 5 },
  { id: 'zone2', label: 'Zone 2', patterns: ['zone 2', 'z2', 'easy pace', 'aerobic base', 'steady state', 'ss cardio'], tags: ['endurance', 'aerobic'], blockKind: 'locomotion', typeHint: 'Custom', score: 4 },
  { id: 'threshold', label: 'Threshold', patterns: ['threshold', 'lactate', 'anaerobic threshold', 'lt', 'tempo run'], tags: ['endurance', 'glycolytic'], blockKind: 'locomotion', typeHint: 'Custom', score: 5 },
]

// ── Risk & wellness sinyalleri (ayrı export — blok değil, sinyal) ─────────────
export const RISK_SIGNAL_CONCEPTS = [
  { id: 'pain_signal', label: 'Pain', patterns: ['agri', 'sizi', 'tutulma', 'sore', 'dolgun', 'hassas', 'omuz aciyor', 'diz aciyor', 'bilek aciyor', 'bel agri'], tags: ['pain', 'injury', 'risk'], severity: 'high' },
  { id: 'fatigue_signal', label: 'Fatigue', patterns: ['yorgunum', 'bitkinim', 'halsizim', 'fatigue', 'exhausted', 'tukendim', 'pilim bitik'], tags: ['fatigue', 'risk'], severity: 'medium' },
  { id: 'injury_signal', label: 'Injury', patterns: ['sakatlik', 'sakat', 'injured', 'strain', 'sprain', 'cekildi', 'zorlandi', 'yirtildi'], tags: ['injury', 'risk'], severity: 'high' },
  { id: 'mental_block', label: 'Mental Block', patterns: ['korktum', 'gergindim', 'blokaj', 'mental', 'motivasyon yok', 'icim yok', 'isteksiz'], tags: ['mental', 'risk'], severity: 'low' },
  { id: 'incomplete_signal', label: 'Incomplete', patterns: ['yapamadim', 'pas gectim', 'yarida kaldi', 'kestim', 'isinamadim', 'vazgectim', 'devam edemedim'], tags: ['incomplete', 'risk'], severity: 'medium' },
  { id: 'pr_attempt', label: 'PR Attempt', patterns: ['pr', 'max effort', '1rm', 'en yuksek', 'rekor', 'max test', 'kisisel rekor', 'yeni rekor'], tags: ['pr'], severity: 'positive' },
  { id: 'wellness_sleep', label: 'Sleep', patterns: ['uyku', 'sleep', 'uyudum', 'az uyku', 'uykusuz'], tags: ['wellness', 'sleep'], severity: 'wellness' },
  { id: 'wellness_nutrition', label: 'Nutrition', patterns: ['protein', 'kalori', 'makro', 'yedim', 'yemek', 'beslenme'], tags: ['wellness', 'nutrition'], severity: 'wellness' },
  { id: 'wellness_hydration', label: 'Hydration', patterns: ['su ', 'hidrasyon', 'water', 'litre su', 'susuz'], tags: ['wellness', 'hydration'], severity: 'wellness' },
  { id: 'wellness_mood', label: 'Mood', patterns: ['iyi hissettim', 'kotu hissettim', 'motivasyonum yuksek', 'bitik', 'formdayim', 'bugun iyiydim'], tags: ['mood'], severity: 'wellness' },
  { id: 'wellness_stress', label: 'Stress', patterns: ['stres', 'stresli', 'gergin gun', 'baski', 'is stresi'], tags: ['stress', 'wellness'], severity: 'wellness' },
]

// ── Movement quality / intensity modifiers ────────────────────────────────────
export const MODIFIER_CONCEPTS = [
  // tempo
  { id: 'tempo_marker', label: 'Tempo', patterns: ['tempo', 'slow rep', 'slow eccentric', 'controlled', 'kontrollu'], category: 'tempo' },
  { id: 'paused_rep', label: 'Paused', patterns: ['paused rep', 'durmali', 'bottom hold', 'pause at chest', 'dead stop'], category: 'tempo' },
  { id: 'tempo_explicit', label: 'Tempo Explicit', patterns: ['3-1-1', '4-0-2', '5-1-1', '3010', '4010', '2-0-1'], category: 'tempo' },
  { id: 'isometric_hold', label: 'Isometric Hold', patterns: ['isometric hold', 'izometrik', 'statik tutus'], category: 'tempo' },
  { id: 'eccentric_only', label: 'Eccentric Only', patterns: ['eccentric only', 'negative only', 'sadece eksantrik', 'negatif only'], category: 'tempo' },
  { id: 'concentric_focus', label: 'Concentric Focus', patterns: ['concentric focus', 'fast concentric', 'hizli konsentrik'], category: 'tempo' },
  // effort
  { id: 'rpe_marker', label: 'RPE', patterns: ['rpe', '@8', '@9', '@10', 'effort', 'rir'], category: 'effort' },
  { id: 'percent_1rm', label: 'Percent 1RM', patterns: ['1rm', '%70', '%80', '%90'], category: 'effort' },
  { id: 'failure_marker', label: 'Failure', patterns: ['failure', 'til failure', 'tukenene kadar', 'son repe kadar', 'technical failure'], category: 'effort' },
  { id: 'near_failure', label: 'Near Failure', patterns: ['near failure', 'almost failure', '1 rir', '0 rir'], category: 'effort' },
  { id: 'easy_marker', label: 'Easy', patterns: ['easy', 'hafif', 'kolay', 'recovery weight', 'light weight'], category: 'effort' },
  { id: 'moderate_marker', label: 'Moderate', patterns: ['moderate', 'orta', 'stabil', 'controlled effort'], category: 'effort' },
  { id: 'hard_marker', label: 'Hard', patterns: ['hard', 'agir', 'zorlu', 'heavy', 'max effort'], category: 'effort' },
  { id: 'explosive_marker', label: 'Explosive', patterns: ['explosive', 'ballistic', 'dynamic', 'dynamic effort', 'hizli', 'patlayici', 'speed rep'], category: 'effort' },
  // range
  { id: 'full_rom', label: 'Full ROM', patterns: ['full rom', 'full range', 'tam range'], category: 'range' },
  { id: 'partial_rom', label: 'Partial ROM', patterns: ['partial rom', 'half rep', 'yarim rep', 'lockout', 'ust yari'], category: 'range' },
  { id: 'deficit_modifier', label: 'Deficit', patterns: ['deficit', 'derin', 'deeper'], category: 'range' },
  { id: 'paused_at_bottom', label: 'Paused at Bottom', patterns: ['paused at bottom', 'alt nokta dur'], category: 'range' },
  // structure
  { id: 'superset', label: 'Superset', patterns: ['superset', 'super set', 'ss with', 'esli set'], category: 'structure' },
  { id: 'giant_set', label: 'Giant Set', patterns: ['giant set', 'dev set'], category: 'structure' },
  { id: 'tri_set', label: 'Tri Set', patterns: ['tri set', 'uclu set'], category: 'structure' },
  { id: 'drop_set', label: 'Drop Set', patterns: ['drop set', 'dropset', 'mechanical drop', 'descending'], category: 'structure' },
  { id: 'rest_pause', label: 'Rest Pause', patterns: ['rest pause', 'rp', 'dinlenme-tutus'], category: 'structure' },
  { id: 'cluster_set', label: 'Cluster Set', patterns: ['cluster set', 'mikro set'], category: 'structure' },
  { id: 'pre_exhaust', label: 'Pre-Exhaust', patterns: ['pre exhaust', 'on yorum', 'pre-exhaust'], category: 'structure' },
  { id: 'post_exhaust', label: 'Post-Exhaust', patterns: ['post exhaust', 'finisher', 'bitirici'], category: 'structure' },
  { id: 'pyramid_set', label: 'Pyramid', patterns: ['pyramid', 'piramit', 'ascending', 'descending pyramid'], category: 'structure' },
  // method protocols
  { id: 'method_5x5', label: '5x5', patterns: ['5x5', '5×5', 'stronglifts', 'starting strength'], category: 'method' },
  { id: 'method_3x5', label: '3x5', patterns: ['3x5', '3×5'], category: 'method' },
  { id: 'method_531', label: '5/3/1', patterns: ['5/3/1', 'wendler', '531'], category: 'method' },
  { id: 'method_10x10', label: '10x10', patterns: ['10x10', 'gvt', 'german volume training'], category: 'method' },
  { id: 'method_nsuns', label: 'nSuns', patterns: ['nsuns', 'n suns'], category: 'method' },
  { id: 'method_ppl', label: 'PPL', patterns: ['ppl', 'push pull legs'], category: 'method' },
  { id: 'method_bro', label: 'Bro Split', patterns: ['bro split'], category: 'method' },
  { id: 'method_full_body', label: 'Full Body', patterns: ['full body split', 'fbw'], category: 'method' },
  // load notation
  { id: 'bw_marker', label: 'Bodyweight', patterns: ['bw', 'bodyweight', 'bw+', 'vucut agirligi', 'vag'], category: 'load' },
  { id: 'weighted_marker', label: 'Weighted', patterns: ['weighted', 'agirlikli'], category: 'load' },
  { id: 'assisted_marker', label: 'Assisted', patterns: ['asistanli', 'band assisted', 'assisted', 'partner help', 'bantli', 'bant yardimi'], category: 'load' },
  { id: 'lbs_unit', label: 'LBS', patterns: ['lbs', 'lb', 'pound', 'paunt'], category: 'unit' },
  { id: 'kg_unit', label: 'KG', patterns: ['kg', 'kilogram', 'kilo'], category: 'unit' },
  // rest
  { id: 'short_rest', label: 'Short Rest', patterns: ['short rest', 'kisa rest', '60s rest', '30s rest', '1dk rest'], category: 'rest' },
  { id: 'long_rest', label: 'Long Rest', patterns: ['long rest', 'uzun rest', '3dk rest', '5dk rest'], category: 'rest' },
  { id: 'unspecified_rest', label: 'Rest As Needed', patterns: ['rest as needed', 'dinlenme: serbest'], category: 'rest' },
]

// ── Body region overload markers ──────────────────────────────────────────────
export const BODY_REGION_CONCEPTS = [
  // joints
  { id: 'shoulder_focus', label: 'Shoulder', patterns: ['omuz', 'shoulder', 'deltoid', 'delt', 'scapula', 'kurek'], category: 'joint', region: 'shoulder' },
  { id: 'wrist_load', label: 'Wrist', patterns: ['bilek', 'wrist', 'el bilegi'], category: 'joint', region: 'wrist' },
  { id: 'elbow_load', label: 'Elbow', patterns: ['dirsek', 'elbow', "golfer's elbow", 'tennis elbow', 'golfer dirsegi', 'tenisci dirsegi'], category: 'joint', region: 'elbow' },
  { id: 'knee_load', label: 'Knee', patterns: ['diz', 'knee', 'patella', 'patellar', 'dizkapagi'], category: 'joint', region: 'knee' },
  { id: 'ankle_load', label: 'Ankle', patterns: ['ayak bilegi', 'ankle', 'achilles', 'asil'], category: 'joint', region: 'ankle' },
  { id: 'hip_load', label: 'Hip', patterns: ['kalca', 'hip', 'hip flexor', 'sciatic', 'siyatik'], category: 'joint', region: 'hip' },
  { id: 'lower_back_load', label: 'Lower Back', patterns: ['bel', 'lumbar', 'alt sirt', 'lower back', 'lumbosakral'], category: 'joint', region: 'lower-back' },
  { id: 'upper_back_load', label: 'Upper Back', patterns: ['ust sirt', 'upper back', 'kurek arasi', 'thoracic'], category: 'joint', region: 'upper-back' },
  { id: 'neck_load', label: 'Neck', patterns: ['boyun', 'neck', 'cervical'], category: 'joint', region: 'neck' },
  { id: 'finger_load', label: 'Finger', patterns: ['parmak', 'finger', 'finger tendon', 'pulley'], category: 'joint', region: 'finger' },
  // muscles
  { id: 'pec_focus', label: 'Pec', patterns: ['gogus', 'pec', 'pectoral', 'chest'], category: 'muscle', region: 'pec' },
  { id: 'lat_focus', label: 'Lat', patterns: ['latissimus', 'kanat', 'kanat kasi'], category: 'muscle', region: 'lat' },
  { id: 'trap_focus', label: 'Trap', patterns: ['trap', 'trapez', 'trapezius', 'ust trap', 'lower trap'], category: 'muscle', region: 'trap' },
  { id: 'rhomboid_focus', label: 'Rhomboid', patterns: ['rhomboid', 'rhomboids', 'kurek arasi kaslari'], category: 'muscle', region: 'rhomboid' },
  { id: 'bicep_focus', label: 'Bicep', patterns: ['bicep', 'biceps', 'biseps', 'on kol'], category: 'muscle', region: 'bicep' },
  { id: 'tricep_focus', label: 'Tricep', patterns: ['tricep', 'triceps', 'triseps', 'arka kol'], category: 'muscle', region: 'tricep' },
  { id: 'forearm_focus', label: 'Forearm', patterns: ['forearm', 'fore arm', 'kavrama kasi'], category: 'muscle', region: 'forearm' },
  { id: 'glute_focus', label: 'Glute', patterns: ['glut', 'glute', 'kalca kasi', 'gluteus'], category: 'muscle', region: 'glute' },
  { id: 'ham_focus', label: 'Hamstring', patterns: ['hamstring', 'arka bacak', 'biceps femoris'], category: 'muscle', region: 'hamstring' },
  { id: 'quad_focus', label: 'Quad', patterns: ['quad', 'quadriceps', 'kuadriseps', 'on bacak'], category: 'muscle', region: 'quad' },
  { id: 'calf_focus', label: 'Calf', patterns: ['calf', 'kalf', 'baldir', 'soleus', 'gastroc', 'gastrocnemius'], category: 'muscle', region: 'calf' },
  { id: 'core_focus', label: 'Core Region', patterns: ['rectus', 'transverse'], category: 'muscle', region: 'core' },
  { id: 'oblique_focus', label: 'Oblique', patterns: ['oblique', 'yan karin', 'side abs'], category: 'muscle', region: 'oblique' },
  { id: 'serratus_focus', label: 'Serratus', patterns: ['serratus', 'serratus anterior'], category: 'muscle', region: 'serratus' },
  { id: 'rotator_cuff_focus', label: 'Rotator Cuff', patterns: ['rotator cuff', 'rotator', 'supraspinatus', 'infraspinatus'], category: 'muscle', region: 'rotator-cuff' },
  // tendon / sendrom
  { id: 'tendinopati_signal', label: 'Tendinopati', patterns: ['tendinopati', 'tendonitis', 'tendinitis', 'tendinit'], category: 'tendon' },
  { id: 'bursitis_signal', label: 'Bursitis', patterns: ['bursitis', 'bursit'], category: 'tendon' },
  { id: 'impingement_signal', label: 'Impingement', patterns: ['impingement', 'sikisma', 'sikisma sendromu'], category: 'tendon' },
  { id: 'plantar_signal', label: 'Plantar', patterns: ['plantar', 'plantar fasiit', 'fasiit'], category: 'tendon' },
  { id: 'iliotibial_signal', label: 'IT Band', patterns: ['iliotibial', 'it band', 'it bant'], category: 'tendon' },
  { id: 'runners_knee', label: "Runner's Knee", patterns: ["runner's knee", 'kosucu dizi'], category: 'tendon' },
  { id: 'jumpers_knee', label: "Jumper's Knee", patterns: ["jumper's knee", 'atlayici dizi', 'patellar tendinitis'], category: 'tendon' },
  // posture
  { id: 'forward_head_signal', label: 'Forward Head', patterns: ['forward head', 'anterior head', 'kafa one'], category: 'posture' },
  { id: 'kyphosis_signal', label: 'Kyphosis', patterns: ['kyphosis', 'kifoz', 'yuvarlak sirt'], category: 'posture' },
  { id: 'lordosis_signal', label: 'Lordosis', patterns: ['lordosis', 'lordoz'], category: 'posture' },
  { id: 'apt_signal', label: 'APT', patterns: ['apt', 'anterior pelvic tilt', 'on pelvik egim'], category: 'posture' },
  { id: 'scapular_winging_signal', label: 'Scapular Winging', patterns: ['scapular winging', 'kurek kanatlanmasi'], category: 'posture' },
  { id: 'text_neck_signal', label: 'Text Neck', patterns: ['text neck', 'telefon boynu'], category: 'posture' },
  // pattern
  { id: 'morning_stiffness', label: 'Morning Stiffness', patterns: ['sabah agri', 'sabah katilik', 'morning stiffness'], category: 'pattern' },
  { id: 'post_workout_pain', label: 'Post-Workout Pain', patterns: ['antrenman sonrasi agri', 'sonradan agridi', 'ertesi gun agri'], category: 'pattern' },
  { id: 'warmup_relief', label: 'Warmup Relief', patterns: ['isininca azaldi', 'warmup relief', 'isininca gecti'], category: 'pattern' },
  { id: 'chronic_pattern', label: 'Chronic', patterns: ['kronik', 'surekli agri', 'hep agrili'], category: 'pattern' },
]

const BLOCK_CATEGORY_MAP = {
  strength: 'strength',
  locomotion: 'endurance',
  core: 'strength',
  mobility: 'recovery',
  recovery: 'recovery',
  explosive: 'movement',
  skill: 'movement',
  mixed: 'mixed',
}

export function normalizeOntologyText(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

function includesPattern(text, pattern) {
  return text.includes(normalizeOntologyText(pattern))
}

export function detectOntologySignals(input = '') {
  const text = normalizeOntologyText(input)
  if (!text) return []

  return ONTOLOGY_CONCEPTS
    .filter(concept => concept.patterns.some(pattern => includesPattern(text, pattern)))
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      tags: [...concept.tags],
      blockKind: concept.blockKind,
      typeHint: concept.typeHint,
      score: concept.score,
      evidence: String(input || '').trim(),
    }))
}

export function detectRiskSignals(input = '') {
  const text = normalizeOntologyText(input)
  if (!text) return []
  return RISK_SIGNAL_CONCEPTS
    .filter(concept => concept.patterns.some(pattern => includesPattern(text, pattern)))
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      tags: [...concept.tags],
      severity: concept.severity,
      evidence: String(input || '').trim(),
    }))
}

export function detectModifiers(input = '') {
  const text = normalizeOntologyText(input)
  if (!text) return []
  return MODIFIER_CONCEPTS
    .filter(concept => concept.patterns.some(pattern => includesPattern(text, pattern)))
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      category: concept.category,
      evidence: String(input || '').trim(),
    }))
}

export function detectBodyRegions(input = '') {
  const text = normalizeOntologyText(input)
  if (!text) return []
  return BODY_REGION_CONCEPTS
    .filter(concept => concept.patterns.some(pattern => includesPattern(text, pattern)))
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      category: concept.category,
      region: concept.region,
      evidence: String(input || '').trim(),
    }))
}

export function summarizeSignals(signals = []) {
  const seen = new Set()
  return signals
    .filter(signal => {
      if (!signal?.id || seen.has(signal.id)) return false
      seen.add(signal.id)
      return true
    })
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
}

export function deriveTagsFromSignals(signals = []) {
  return [...new Set(summarizeSignals(signals).flatMap(signal => signal.tags || []))]
}

export function deriveTypeFromSignals(signals = [], fallback = 'Custom') {
  const scores = summarizeSignals(signals).reduce((acc, signal) => {
    const key = signal.typeHint || 'Custom'
    acc[key] = (acc[key] || 0) + Number(signal.score || 0)
    return acc
  }, {})

  const ranked = Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .map(([type]) => type)

  return ranked[0] || fallback || 'Custom'
}

export function deriveBlockKindFromSignals(signals = [], fallback = 'mixed') {
  const ranked = summarizeSignals(signals)
  return ranked[0]?.blockKind || fallback
}

export function primaryCategoryFromBlockKind(kind = 'mixed') {
  return BLOCK_CATEGORY_MAP[kind] || 'mixed'
}
