export const profile = {
  nick: 'SenUzulme27',
  handle: '@senuzulme27',
  rank: 'Silver III',
  rankIcon: '🥉',
  class: 'Calisthenic Warrior',
  subClass: 'Acrobatic Sub-Class',
  avatar: '🥷',
  level: 4,
  xp: { current: 1520, max: 2000 },
  sessions: 53,
  totalVolume: '217k kg',
  totalSets: 1000,
  totalTime: '45h 53min',

  globalStats: [
    { val: '12.292', label: 'Ort. Adım/Gün' },
    { val: '64dk', label: 'Ort. Egzersiz' },
    { val: '26/31', label: 'Egzersiz Halkası' },
    { val: '17/31', label: 'Hareket Halkası', red: true },
  ],

  stats: [
    {
      key: 'str', label: 'STR', name: 'Kuvvet', val: 80,
      color: 'var(--red)', icon: '⚔️',
      desc: 'Bench 65kg PR kırıldı. Üst vücut gücü artık tartışılmaz elit bölgede.',
      coach: '65kg Bench Press ile yeni PR. Shoulder hacmi de solid. STR 80 barajı aşıldı — artık gerçek güç savaşçısı.',
      detail: [
        { label: 'Push Str.', val: 'A+' }, { label: 'Pull Str.', val: 'B+' },
        { label: 'Explosive', val: 'A' }, { label: 'Max Load', val: '65kg 🆕' },
      ],
    },
    {
      key: 'agi', label: 'AGI', name: 'Çeviklik', val: 77,
      color: 'var(--blu)', icon: '💨',
      desc: '2.5 saatlik parkour + jump seansı AGI\'yi 2 puan patlattı. Yerde hız ve yön değişimi belirgin gelişti.',
      coach: '13 Nis parkour seansı tam AGI çalışması. Yerdeki hız iyi; ama yön değişiminde hâlâ core eksikliği hissediliyor. Core gelişince bu stat 85+ olur.',
      detail: [
        { label: 'Air Sense', val: 'A' }, { label: 'Ground Spd', val: 'B+' },
        { label: 'Reaction', val: 'B+' }, { label: 'Change Dir', val: 'B-' },
      ],
    },
    {
      key: 'end', label: 'END', name: 'Dayanıklılık', val: 73,
      color: 'var(--grn)', icon: '🫀',
      desc: '4 saatlik çift seans END\'i 5 puan fırlattı. 1.5h yürüyüş + 2.5h parkour = aerobik kapasite gerçek anlamda test edildi.',
      coach: '13 Nis\'te toplam 4 saat hareket etmek END için devrimsel. Kardiyo bazın artık solid. Tutarlı hale gelirse bu stat 80\'i geçer.',
      detail: [
        { label: 'Cardio Base', val: 'B' }, { label: 'Daily Steps', val: '12k+' },
        { label: 'Recovery', val: 'B' }, { label: 'Work Cap.', val: 'B+' },
      ],
    },
    {
      key: 'dex', label: 'DEX', name: 'Koordinasyon', val: 68,
      color: 'var(--pur)', icon: '🎯',
      desc: 'Parkour alt-üst vücut entegrasyonunu doğrudan çalıştırdı. Yerde koordinasyon belirgin gelişti.',
      coach: 'Parkour tam DEX sporu — iniş mekanikleri, yön değiştirme, zemin hissi. Alt vücut koordinasyonu C+\'tan B-\'ye çıktı. Bacak gücü gelince B+ garantili.',
      detail: [
        { label: 'Upper Body', val: 'A-' }, { label: 'Lower Body', val: 'B-' },
        { label: 'Balance', val: 'B' }, { label: 'Timing', val: 'B+' },
      ],
    },
    {
      key: 'con', label: 'CON', name: 'Core (Kritik)', val: 18,
      color: 'var(--org)', icon: '🟠', critical: false,
      desc: 'İLK KEZ izole core yapıldı — Hollow Rock + HLR + Çakı. 7 set. Core motoru ateşlendi.',
      coach: '14 Nis\'te ilk gerçek core bloğu: Hollow Rock 3×20sn, HLR 2×8, Çakı 2×12. Bu istatistik artık hareket ediyor. Tutarlı devam ederse CON 30\'u geçer ve Back Flip kilidi açılır.',
      detail: [
        { label: 'Hollow Body', val: 'D' }, { label: 'L-Sit', val: 'F' },
        { label: 'HLR', val: 'D+' }, { label: 'Anti-Rot.', val: 'F' },
      ],
    },
    {
      key: 'sta', label: 'STA', name: 'Stamina', val: 63,
      color: 'var(--gold)', icon: '⚡',
      desc: '13 Nis\'te 4 saat hareket — 2.5h parkour + 1.5h yürüyüş. Bu seansla yeni max rekoru kırıldı.',
      coach: '150 dakikalık parkour seansı eski max\'in (90dk) %67 üzerinde. Aerobik kapasiten gerçek anlamda var, sadece aktive etmen gerekiyordu. Bu tempoyu hafta 2-3 kez tutarsan STA 75\'i geçer.',
      detail: [
        { label: 'Sess. Avg', val: '64dk' }, { label: 'Max Sess.', val: '150dk 🆕' },
        { label: 'Rest Per.', val: 'Orta' }, { label: 'Fuel Eff.', val: 'B-' },
      ],
    },
  ],

  performance: [
    {
      key: 'bench', icon: '🏋️', name: 'Bench Press',
      note: '65kg PR kırıldı — 14 Nis 2026 🔥', val: '65 kg',
      trend: '📈 +5kg PR', trendColor: 'var(--grn)',
      history: [
        { date: 'Ock', val: 40 }, { date: 'Şub', val: 47.5 },
        { date: 'Mar', val: 52.5 }, { date: 'Nis', val: 65 },
      ],
      tip: '65kg tuttu. 70kg yolu açık — ama CNS recovery kritik, 5-7 gün dinlen.',
      details: [
        { label: '1RM Est.', val: '~80kg' }, { label: 'Vol/Seans', val: '3.798kg' },
        { label: 'İlerleme', val: '+62.5% (4ay)' }, { label: 'Sonraki', val: '67.5kg' },
      ],
    },
    {
      key: 'mu', icon: '💫', name: 'Muscle-Up',
      note: '1 → 3 rep artış! Nöral adaptasyon.', val: '3 rep',
      trend: '📈 +2 rep', trendColor: 'var(--grn)',
      history: [
        { date: 'Ock', val: 0 }, { date: 'Şub', val: 1 },
        { date: 'Mar', val: 1 }, { date: 'Nis', val: 3 },
      ],
      tip: '1\'den 3\'e çıkmak tamamen nöral adaptasyon. Sırt gücün mükemmel tepki veriyor.',
      details: [
        { label: 'Mevcut', val: '3 rep' }, { label: 'Hedef', val: '5 clean' },
        { label: 'Kalan', val: '+2 rep' }, { label: 'Form', val: 'Kip' },
      ],
    },
    {
      key: 'hang', icon: '🤲', name: 'Dead Hang',
      note: 'Canavar seviyesi. Tutuş gücü elit.', val: '1:20+',
      trend: '👑 Elite', trendColor: 'var(--grn)',
      history: [
        { date: 'Ock', val: 45 }, { date: 'Şub', val: 60 },
        { date: 'Mar', val: 75 }, { date: 'Nis', val: 80 },
      ],
      tip: '1:20+ tutuş gücü genetik bir hediye ve iyi işlenmiş. CNS taze iken koru.',
      details: [
        { label: 'Süre', val: '80sn+' }, { label: 'Percentile', val: 'Top %5' },
        { label: 'Grip Type', val: 'Mixed' }, { label: 'Hedef', val: '2:00' },
      ],
    },
    {
      key: 'flip', icon: '🌀', name: 'Akrobasi + Parkour',
      note: '2.5h Parkour + Jump. Front flip, Barani aktif.', val: 'Aktif 🔥',
      trend: '📈 Gelişiyor', trendColor: 'var(--grn)',
      history: null,
      tip: '13 Nis 2.5h parkour seansı harika. Ama core izole olmadan hız ne kadar artarsa risk o kadar artar. Bir sakatlık tüm treki durdurur.',
      details: [
        { label: 'Front Flip', val: '✓ Solid' }, { label: 'Barani', val: '⟳ Deneme' },
        { label: 'Parkour', val: '✓ Aktif' }, { label: 'Core Req.', val: 'RANK C' },
      ],
    },
  ],

  debuffs: [
    { level: 'org', icon: '🟠', name: 'CORE BAŞLADI AMA TUTARLI DEĞİL', desc: '14 Nis\'te ilk 7 set core yapıldı. Harika başlangıç. Ama tek seans yetmez — her antrenmanın bir parçası olmalı.' },
    { level: 'blu', icon: '🔵', name: 'HAREKET HALKASI ZAYIF', desc: '18/31 Gün. Günlük aktif kalori hedefi (650 kcal) hâlâ kaçırılıyor.' },
  ],

  muscleBalance: [
    { label: 'Omuz',          sets: 202.5, color: 'var(--pur)' },
    { label: 'Göğüs',         sets: 176.5, color: 'var(--org)' },
    { label: 'Triceps',       sets: 167.5, color: 'var(--red)' },
    { label: 'Biseps',        sets: 158,   color: 'var(--blu)' },
    { label: 'Üst Sırt',     sets: 128.5, color: 'var(--blu)' },
    { label: 'Lat',           sets: 108.5, color: 'var(--grn)' },
    { label: 'Bacak (Parkour)', sets: 45,  color: 'var(--org)' },
    { label: 'Kalf',          sets: 36,    color: 'var(--red)' },
    { label: 'Core',          sets: 7,     color: 'var(--org)' },
  ],

  muscles: [
    {
      icon: '🪨', name: 'Omuz Kompleksi', tag: 'Dominant', tagClass: 'tf',
      sets: '198.5', rank: 'S', color: 'var(--pur)',
      detail: 'En çok çalışılan bölge. İtiş gücünü domine ediyor. Front flip gibi akrobasilerde rotasyonu sağlıyor ama göğüse kıyasla fazla ileride.',
      exercises: ['Overhead Press', 'Lateral Raise', 'Face Pull', 'Arnold Press'],
      tip: 'Hafifçe geri çek, arka deltoidi daha fazla çalıştır. Anterior deltoid overload riski var.',
    },
    {
      icon: '🛡️', name: 'Göğüs', tag: 'Gelişiyor', tagClass: 'ts',
      sets: '169.5', rank: 'A', color: 'var(--org)',
      detail: 'Bench Press\'te 60kg x 7 mükemmel bir ivme. Omuzla birlikte ön zinciri inanılmaz güçlü tutuyor.',
      exercises: ['Bench Press', 'Push-Up Varyasyonları', 'Dumbbell Fly', 'Dips'],
      tip: '65kg deneyin zamanı yaklaşıyor. İnkline varyasyon ekleyerek üst göğüsü geliştir.',
    },
    {
      icon: '💪', name: 'Biseps & Triceps', tag: 'Stabil', tagClass: 'ts',
      sets: 'Tri: 163.5 | Bi: 156', rank: 'A-', color: 'var(--blu)',
      detail: 'Kol kuvveti çok dengeli. Dead hang ve muscle-up performansı bunu kanıtlıyor.',
      exercises: ['Pull-Up', 'Curl Varyasyonları', 'Tricep Extension', 'Close-Grip Push'],
      tip: 'Curl çalışmak yerine compound hareketlerle koru. Büyüme zaten compound\'dan geliyor.',
    },
    {
      icon: '🦅', name: 'Kanat ve Üst Sırt', tag: 'Stabil', tagClass: 'ts',
      sets: 'Lat: 108.5 | Üst: 128.5', rank: 'B+', color: 'var(--grn)',
      detail: 'Muscle-up\'ın 3 tekrara çıkması sırtın patlayıcı gücünü gösteriyor. Ancak ön zincirin gerisinde.',
      exercises: ['Pull-Up', 'Muscle-Up', 'Row Varyasyonları', 'Face Pull'],
      tip: 'Ön/arka zincir oranı şu an ~60/40. Hedef 50/50 olmalı. Sırt hacmini artır.',
    },
    {
      icon: '🦵', name: 'Bacak & Alt Vücut', tag: 'Gelişiyor', tagClass: 'ts',
      sets: 'Parkour: 45 | Kalf: 36 | Quad/Ham: aktif', rank: 'C-', color: 'var(--org)',
      detail: '13 Nis 2.5h parkour seansı bacak tablosunu değiştirdi. Jumping, landing ve sprint mekaniği quad/ham/kalf\'ı ciddi çalıştırdı. Rank D\'den C-\'ye çıktı. İzole bacak günü eklenirse hızla yükselir.',
      exercises: ['Parkour Jump', 'Squat', 'Jump Squat', 'Lunges', 'Calf Raise'],
      tip: '13 Nis parkour iyi bir başlangıç ama izole bacak günü hâlâ şart. Haftada 1x Squat + Jump Squat ekle, rank B\'ye zıplar.',
    },
    {
      icon: '🔥', name: 'Core (Gövde)', tag: 'Ateşlendi', tagClass: 'ts',
      sets: '7', rank: 'E+', color: 'var(--org)', critical: false,
      detail: '14 Nis\'te ilk izole core bloğu. Hollow Rock + HLR + Çakı — motor ateşlendi. Tutarlılık şart.',
      exercises: ['Hollow Rock', 'Hanging Leg Raise', 'Çakı', 'L-Sit', 'Ab Wheel'],
      tip: 'Bugün başla: 3x20sn Hollow Body + 3x10sn L-Sit. Her antrenmana ekle.',
    },
  ],

  skills: [
    {
      branch: '🤸 ACROBATICS TREE', warning: true,
      items: [
        { status: 'done', name: 'Front Flip',   desc: 'Patlayıcı güç + air sense',        val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'done', name: 'Dive Roll',    desc: 'Yumuşak iniş tekniği',              val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'done', name: 'Round Off',    desc: 'Akrobasi geçiş hareketi',           val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'prog', name: 'Barani',       desc: 'Front flip + ½ twist — deneme',    val: 'IN PROG' },
        { status: 'lock', name: 'Back Flip',    desc: 'Gövde kontrolü olmadan risk!',      val: 'LOCKED', req: 'REQ: CORE RANK C' },
        { status: 'lock', name: 'Full Twist',   desc: 'Front flip + tam dönüş',            val: 'LOCKED', req: 'REQ: BARANI UNLOCKED' },
      ],
    },
    {
      branch: '⚔️ STRENGTH TREE',
      items: [
        { status: 'done', name: 'Dead Hang Elite',      desc: '1:20+ — Canavar tutuşu',         val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'done', name: 'Muscle-Up',            desc: '1\'den 3 tekrara çıkıldı.',       val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'done', name: 'Bench Press 65kg',       desc: '65kg PR — 14 Nis 2026 kırıldı.', val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'lock', name: 'Muscle-Up ×5 Clean',  desc: '5 temiz tekrar stabilize et',     val: 'LOCKED', req: 'REQ: 3 rep stabil' },
        { status: 'lock', name: 'One-Arm Hang',         desc: 'Tek kol asılı kalma',             val: 'LOCKED', req: 'REQ: STR 85' },
      ],
    },
    {
      branch: '🧘 MOBILITY TREE',
      items: [
        { status: 'done', name: 'Hip Flexor Base',      desc: 'Flip için yeterli esneklik',      val: 'UNLOCKED', valColor: 'var(--grn)' },
        { status: 'prog', name: 'Shoulder Flexibility', desc: 'Aktif çalışılıyor',               val: 'IN PROG' },
        { status: 'lock', name: 'Active Splits',        desc: 'Akrobasi kapsamını genişletir',   val: 'LOCKED', req: 'REQ: 3ay günlük stretch' },
        { status: 'lock', name: 'Bridge',               desc: 'Omurga esnekliği',               val: 'LOCKED', req: 'REQ: CORE RANK B' },
      ],
    },
    {
      branch: '🔥 CORE TREE', warning: true,
      items: [
        { status: 'prog', name: 'Hollow Body 30sn',  desc: '14 Nis: 3×20sn ✓ — 30sn\'ye ulaş',         val: 'IN PROG' },
        { status: 'lock', name: 'L-Sit 10sn',        desc: 'Statik core + hip flexor — başlamak için hazır', val: 'LOCKED', req: 'REQ: CON RANK E' },
        { status: 'lock', name: 'Plank Variations',  desc: 'Lateral stabilizasyon',                     val: 'LOCKED', req: 'REQ: CORE RANK D' },
        { status: 'lock', name: 'Dragon Flag',       desc: 'İleri seviye core kontrol',                val: 'LOCKED', req: 'REQ: CORE RANK C' },
        { status: 'lock', name: 'Front Lever Tuck',  desc: 'Üst vücut + core entegrasyonu',            val: 'LOCKED', req: 'REQ: CORE RANK B' },
      ],
    },
  ],

  health: {
    rings: [
      { name: 'Egzersiz', icon: '🏃', current: 26, max: 31, unit: 'gün', color: 'var(--grn)', pct: 84 },
      { name: 'Hareket',  icon: '🔥', current: 17, max: 31, unit: 'gün', color: 'var(--org)', pct: 55 },
      { name: 'Adım',     icon: '👟', current: 12292, max: 15000, unit: '/gün avg', color: 'var(--gold)', pct: 82 },
    ],
    metrics: [
      { icon: '💤', label: 'Uyku',          val: '6.8 saat',  sub: 'Hedef: 8 saat',    color: 'var(--org)' },
      { icon: '💧', label: 'Günlük Su',     val: '1.8 L',     sub: 'Hedef: 2.5 L',     color: 'var(--blu)' },
      { icon: '❤️', label: 'Dinlenme HR',   val: '62 bpm',    sub: 'Sağlıklı aralık',  color: 'var(--red)' },
      { icon: '🌡️', label: 'Aktif Kalori', val: '420 kcal',  sub: 'Hedef: 650 kcal',  color: 'var(--org)' },
      { icon: '⚖️', label: 'Kilo',          val: '74 kg',     sub: 'Stabil',            color: 'var(--grn)' },
      { icon: '📏', label: 'BMI',           val: '23.4',      sub: '178cm / 74kg',      color: 'var(--dim)' },
    ],
    warnings: [
      { color: 'var(--org)', icon: '😴', name: 'UYKU EKSİKLİĞİ',    desc: '6.8 saat ortalama. Recovery %15 düşük. Kas büyümesi yavaşlıyor.' },
      { color: 'var(--blu)', icon: '💧', name: 'DEHİDRASYON RİSKİ', desc: '1.8L yeterli değil. Egzersiz performansı olumsuz etkileniyor.' },
      { color: 'var(--org)', icon: '🔥', name: 'AKTİF KALORİ AÇIĞI', desc: '420/650 kcal. Hareket halkası tutarsız, gün içi oturuş fazla.' },
    ],
  },

  quests: {
    daily: [
      { icon: '🔥', name: 'Core Aktivasyon',  desc: '3×20sn Hollow Body + 3×10sn L-Sit',   reward: '+50 XP', done: true,  progress: 1,      total: 1 },
      { icon: '🚶', name: 'Adım Hedefi',      desc: 'Bugün 12.000 adım tamamla',            reward: '+20 XP', done: true,  progress: 12292,   total: 12000 },
      { icon: '💧', name: 'Hidrasyon',         desc: '2.5 litre su iç',                     reward: '+15 XP', done: false, progress: 1.8,     total: 2.5 },
      { icon: '😴', name: 'Uyku Kalitesi',    desc: 'Bugün 8 saat uyu',                    reward: '+30 XP', done: false, progress: 0,       total: 8 },
    ],
    weekly: [
      { icon: '🦵', name: 'Bacak Günü',            desc: 'Bu hafta en az 1 bacak antrenmanı',    reward: '+150 XP', done: true,  progress: 1, total: 1 },
      { icon: '💫', name: 'Muscle-Up Challenge',   desc: '4 clean muscle-up dene',               reward: '+100 XP', done: false, progress: 3, total: 4 },
      { icon: '🏋️', name: 'Bench Progress',        desc: '65kg PR kırıldı!',                    reward: '+120 XP', done: true,  progress: 1, total: 1 },
      { icon: '🧘', name: 'Esneklik Seansları',    desc: '20dk stretching × 2 seans',           reward: '+80 XP',  done: true,  progress: 2, total: 2 },
      { icon: '📊', name: 'Antrenman Tutarlılığı', desc: '5 seans tamamla',                     reward: '+200 XP', done: true,  progress: 5, total: 5 },
    ],
  },

  achievements: [
    { icon: '💀', name: 'First Blood',      desc: 'İlk antrenman',         unlocked: true,  date: 'Ock 2025' },
    { icon: '🔟', name: 'Onlu Kulüp',       desc: '10 seans tamamlandı',   unlocked: true,  date: 'Şub 2025' },
    { icon: '💫', name: 'Gravity Defier',   desc: 'İlk Muscle-Up',         unlocked: true,  date: 'Mar 2025' },
    { icon: '🌀', name: 'Air Born',         desc: 'İlk Front Flip',        unlocked: true,  date: 'Mar 2025' },
    { icon: '🤲', name: 'Iron Grip',        desc: 'Dead Hang 1dk+',        unlocked: true,  date: 'Nis 2025' },
    { icon: '🏆', name: 'Half Century',     desc: '50 seans tamamlandı',   unlocked: true,  date: 'Nis 2025' },
    { icon: '🏋️', name: 'Plate Club',       desc: 'Bench Press 60kg+',     unlocked: true,  date: 'Nis 2025' },
    { icon: '🔩', name: 'Bench 65',         desc: 'Bench Press 65kg PR',   unlocked: true,  date: 'Nis 2026' },
    { icon: '🥉', name: 'Silver Warrior',   desc: 'Silver III rankı',      unlocked: true,  date: 'Nis 2025' },
    { icon: '🔒', name: 'Core Master',      desc: 'Core RANK C\'ye ulaş',  unlocked: false, req: '0 → C' },
    { icon: '🔒', name: 'Centurion',        desc: '100 seans tamamla',     unlocked: false, req: '+50 seans' },
    { icon: '🔒', name: 'Flipper Pro',      desc: 'Barani kilidi aç',      unlocked: false, req: 'Core gerekli' },
    { icon: '🔒', name: 'Gold Rush',        desc: 'Gold ranka çıkar',      unlocked: false, req: '+760 XP' },
  ],

  coachNote: {
    date: '14 Nis 2026',
    xpNote: '+180 XP — PR + İlk Core Bloğu',
    sections: [
      {
        id: 'status',
        mood: 'fire',
        title: 'DURUM ANALİZİ',
        lines: [
          '> Session **#53** kayıt altına alındı.',
          '> **STR: 78 → 80**  (+2)  |  **CON: 12 → 18**  (+6 — ilk gerçek core!)',
          '> 14 Nis — **Push günü. 75 dakika. 3.798 kg hacim.**',
          '> **Bench Press 65kg PR** — hedef 62.5 deniyecekti, 65kg geldi.',
          '> Dead Hang 40sn ısınma. Tutuş gücü hâlâ elite.',
          '> **Hollow Rock + HLR + Çakı** — ilk izole core bloğu. CON motoru ateşlendi.',
          '> Shoulder Press 25kg × 4 set solid devam ediyor.',
          '> Toplam set: **1000** — barajı aştın.',
        ],
      },
      {
        id: 'next',
        mood: 'warning',
        title: 'SONRAKİ PROTOKOL',
        lines: [
          '> Sonraki seans: **Pull + Core** — sırt ve arka zincir.',
          '> Muscle-Up: **4 clean rep** hedefi bu haftadan devam.',
          '',
          '> Core bloğu artık her seansın parçası — istisnasız:',
          '>   **3 × 20sn**  Hollow Body Hold (veya Hollow Rock)',
          '>   **3 × 8**     Hanging Leg Raise',
          '>   **3 × 10sn**  L-Sit (barlardan — başlamak için zaman)',
          '',
          '> Bench recovery: 65kg sonrası CNS\'e 5-7 gün ver.',
          '> Sonraki Bench denemesi: **67.5kg** — acele etme.',
          '> Bacak günü bu hafta içinde şart.',
        ],
      },
      {
        id: 'critical',
        mood: 'calm',
        title: 'CORE İZLEME',
        lines: [
          '> Core RANK: **E+** (F\'den çıktın — bu önemli).',
          '> 7 set core yapıldı. Hedef: **her seansa eklemek**.',
          '> Hollow Body 30sn kilidi açmak için: 3 daha seans.',
          '> L-Sit başlatmak için artık hazırsın — 5sn tutmayı dene.',
          '',
          '> Back Flip kilidi: **CORE RANK C** — tahmini 8-10 hafta.',
          '> Ama bu tempo tutarsa hız kazanır.',
        ],
      },
      {
        id: 'motivate',
        mood: 'fire',
        title: "ODIE'DEN NOT",
        lines: [
          '> **53 seans. 4 ay.**',
          '> Bench **40kg → 65kg**. Muscle-Up **0 → 3**. Dead Hang **top %5**.',
          '> Core: **0 → 7 set**. Küçük adım. Dev kırılma.',
          '',
          '> 14 Nis\'te söylediğini yaptın.',
          '> PR planlamışsın, hedefin üzerinden geçmişsin.',
          '> Ve sonra core bloğunu atlamamışsın.',
          '',
          '> **Bu fark. Bu karakter.**',
          '',
          '> 1000 set baraji geçildi. Milestone: gerçek.',
          '> Şimdi CON\'u inşa ediyoruz. Sıra geldi.',
          '> ODIE — takipteyim.',
        ],
      },
    ],
  },

  workoutLog: [
    { date: '14 Nis', type: 'Push + Core', duration: '75dk', volume: '3.798 kg', sets: 25, highlight: 'Bench 65kg PR 🔥 | İlk Core Bloğu | 1000. Set Barajı' },
    { date: '13 Nis', type: 'Stretching + Jump + Parkour', duration: '150dk', volume: '—', sets: '—', highlight: '2.5h patlayıcı — AGI +2 DEX +3 STA +5 🔥' },
    { date: '13 Nis', type: 'Yürüyüş (Low-Med Tempo)',     duration: '90dk',  volume: '—', sets: '—', highlight: '1.5h aerobik baz — END +5 STA baz güçlendi' },
    { date: '12 Nis', type: 'Push',              duration: '68dk', volume: '4.820 kg', sets: 22, highlight: 'Bench 60kg×7 REKOR' },
    { date: '10 Nis', type: 'Pull + Akrobasi',   duration: '75dk', volume: '3.960 kg', sets: 18, highlight: 'Muscle-Up ×3' },
    { date: '08 Nis', type: 'Shoulder',          duration: '55dk', volume: '3.240 kg', sets: 16, highlight: 'OHP +2.5kg PR' },
    { date: '06 Nis', type: 'Push',              duration: '70dk', volume: '4.560 kg', sets: 20, highlight: 'Stabil hacim' },
    { date: '04 Nis', type: 'Akrobasi',          duration: '50dk', volume: '—',        sets: '—', highlight: 'Barani 3 deneme' },
    { date: '02 Nis', type: 'Pull',              duration: '65dk', volume: '3.800 kg', sets: 17, highlight: 'Dead Hang 1:20' },
    { date: '31 Mar', type: 'Push + Shoulder',   duration: '80dk', volume: '5.100 kg', sets: 24, highlight: 'Hacim rekoru' },
  ],
}
