export const profile = {
  nick: 'SenUzulme27',
  handle: '@senuzulme27',
  rank: 'Silver III',
  rankIcon: '🥉',
  class: 'Calisthenic Warrior',
  subClass: 'Acrobatic Sub-Class',
  avatar: '🥷',
  level: 4,
  xp: { current: 1240, max: 2000 },
  sessions: 50,
  totalVolume: '213k kg',
  totalSets: 975,
  totalTime: '40h 38min',

  globalStats: [
    { val: '12.292', label: 'Ort. Adım/Gün' },
    { val: '62dk', label: 'Ort. Egzersiz' },
    { val: '25/31', label: 'Egzersiz Halkası' },
    { val: '16/31', label: 'Hareket Halkası', red: true },
  ],

  stats: [
    {
      key: 'str', label: 'STR', name: 'Kuvvet', val: 78,
      color: 'var(--red)', icon: '⚔️',
      desc: 'İtiş ve çekiş (Muscle-up/Bench) muazzam seviyede. Potansiyel yüksek.',
      coach: '60kg Bench Press ve 3 Muscle-Up bu statı sağlam gösteriyor. Üst vücut dominant bir fighter profili.',
      detail: [
        { label: 'Push Str.', val: 'A+' }, { label: 'Pull Str.', val: 'B+' },
        { label: 'Explosive', val: 'A' }, { label: 'Max Load', val: '60kg' },
      ],
    },
    {
      key: 'agi', label: 'AGI', name: 'Çeviklik', val: 75,
      color: 'var(--blu)', icon: '💨',
      desc: 'Barani denemeleri ve flip yetenekleri çok iyi ama altyapı eksik.',
      coach: 'Havada çevik ama yerde tempo değişimi hâlâ sınırlı. Core gelişince bu stat patlayacak.',
      detail: [
        { label: 'Air Sense', val: 'A' }, { label: 'Ground Spd', val: 'B' },
        { label: 'Reaction', val: 'B+' }, { label: 'Change Dir', val: 'C+' },
      ],
    },
    {
      key: 'end', label: 'END', name: 'Dayanıklılık', val: 68,
      color: 'var(--grn)', icon: '🫀',
      desc: 'Adım sayın iyi (12k) ama günlük egzersiz ritmin dalgalı.',
      coach: '12k adım/gün iyi bir baz ama egzersiz halkası %80 dolmuyor. Kardiyo bazını güçlendir.',
      detail: [
        { label: 'Cardio Base', val: 'B-' }, { label: 'Daily Steps', val: '12k' },
        { label: 'Recovery', val: 'B' }, { label: 'Work Cap.', val: 'B' },
      ],
    },
    {
      key: 'dex', label: 'DEX', name: 'Koordinasyon', val: 65,
      color: 'var(--pur)', icon: '🎯',
      desc: 'Vücut koordinasyonun havada iyi, yerde bacak bağlatısı zayıf.',
      coach: 'Üst vücut koordinasyonu çok iyi. Alt-üst vücut entegrasyonu eksik; tek bacak denge çalışmaları ekle.',
      detail: [
        { label: 'Upper Body', val: 'A-' }, { label: 'Lower Body', val: 'C+' },
        { label: 'Balance', val: 'B-' }, { label: 'Timing', val: 'B' },
      ],
    },
    {
      key: 'con', label: 'CON', name: 'Core (Kritik)', val: 8,
      color: 'var(--red)', icon: '🔴', critical: true,
      desc: '0 Set İzole Core! Bütün gücünü ve hızını bağlayacak gövde omurgan tamamen savunmasız.',
      coach: 'Bu bir kriz seviyesi. Havada takla atan biri için 0 izole core kabul edilemez. Hollow Body + L-Sit BUGÜN başlamalı.',
      detail: [
        { label: 'Hollow Body', val: 'F' }, { label: 'L-Sit', val: 'F' },
        { label: 'Plank', val: 'D' }, { label: 'Anti-Rot.', val: 'F' },
      ],
    },
    {
      key: 'sta', label: 'STA', name: 'Stamina', val: 58,
      color: 'var(--gold)', icon: '⚡',
      desc: '50 seanslık disiplin harika ama daha uzun seanslar için yakıt depon gelişmeli.',
      coach: 'Ortalama 62dk seans biraz kısa. Seansları 75dk+ yapabilmek için aerobik kapasite artırılmalı.',
      detail: [
        { label: 'Sess. Avg', val: '62dk' }, { label: 'Max Sess.', val: '90dk' },
        { label: 'Rest Per.', val: 'Uzun' }, { label: 'Fuel Eff.', val: 'C+' },
      ],
    },
  ],

  performance: [
    {
      key: 'bench', icon: '🏋️', name: 'Bench Press',
      note: '60kg × 7 rep — Solid itiş gücü', val: '60 kg',
      trend: '📈 Rekor', trendColor: 'var(--grn)',
      history: [
        { date: 'Ock', val: 40 }, { date: 'Şub', val: 47.5 },
        { date: 'Mar', val: 52.5 }, { date: 'Nis', val: 60 },
      ],
      tip: '60kg x 7 ile güç üretim bandın çok verimli. 65kg denemesi yakındır.',
      details: [
        { label: '1RM Est.', val: '~75kg' }, { label: 'Vol/Seans', val: '420kg' },
        { label: 'İlerleme', val: '+50% (4ay)' }, { label: 'Sonraki', val: '62.5kg' },
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
      key: 'flip', icon: '🌀', name: 'Akrobasi',
      note: 'Front flip, Dive Roll, Round off OK. Barani deneme.', val: 'Aktif',
      trend: '⚠️ Core Lazım', trendColor: 'var(--org)',
      history: null,
      tip: 'Front flip ve barani yapıyorsun ama core sıfır iken bel fıtığı davetiyesi çıkarıyorsun!',
      details: [
        { label: 'Front Flip', val: '✓ OK' }, { label: 'Barani', val: '⟳ Deneme' },
        { label: 'Back Flip', val: '🔒 Locked' }, { label: 'Core Req.', val: 'RANK C' },
      ],
    },
  ],

  debuffs: [
    { level: 'red', icon: '🔴', name: 'KORKUNÇ CORE EKSİKLİĞİ', desc: '0 set izole core! Akrobasi yaparken omurgan ağlıyor. Derhal L-Sit ve Hollow Body başla!' },
    { level: 'org', icon: '🟡', name: 'BACAKLAR İHMAL EDİLMİŞ', desc: 'Sadece 16 set Kalf. Havada uçuyorsun ama iniş takımların zayıf. Sakatlık riski.' },
    { level: 'blu', icon: '🔵', name: 'HAREKET HALKASI ZAYIF', desc: '16/31 Gün. 12k adım atıyorsun ama gün içi aktif kalori hedefini (650) kaçırıyorsun.' },
  ],

  muscleBalance: [
    { label: 'Omuz',       sets: 198.5, color: 'var(--pur)' },
    { label: 'Göğüs',      sets: 169.5, color: 'var(--org)' },
    { label: 'Triceps',    sets: 163.5, color: 'var(--red)' },
    { label: 'Biseps',     sets: 156,   color: 'var(--blu)' },
    { label: 'Üst Sırt',  sets: 128.5, color: 'var(--blu)' },
    { label: 'Lat',        sets: 108.5, color: 'var(--grn)' },
    { label: 'Kalf',       sets: 16,    color: 'var(--red)' },
    { label: 'Core',       sets: 0,     color: 'var(--red)', critical: true },
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
      icon: '🦵', name: 'Bacak & Alt Vücut', tag: 'KRİTİK EKSİK', tagClass: 'tw',
      sets: 'Kalf: 16 | Quad/Ham: 0', rank: 'D', color: 'var(--red)',
      detail: 'İniş mekaniği zayıf. Akrobasi yapan biri için bu tehlikeli. Kalf çalışıyorsun ama quad ve hamstring yok.',
      exercises: ['Squat', 'Jump Squat', 'Lunges', 'Calf Raise'],
      tip: 'Akrobasi için patlayıcı bacak gücü şart. Haftada 2x bacak günü mutlak öncelik.',
    },
    {
      icon: '⚠️', name: 'Core (Gövde)', tag: 'KRİTİK EKSİK', tagClass: 'tw',
      sets: '0', rank: 'F', color: 'var(--red)', critical: true,
      detail: 'Vücudunun en büyük açığı. Bütün kinetik zincirin burada kopuyor. Acil müdahale gerekiyor.',
      exercises: ['L-Sit', 'Hollow Body Hold', 'Dragon Flag', 'Ab Wheel'],
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
        { status: 'prog', name: 'Bench Press 65kg+',    desc: 'Şu an 60kg x 7. Yakın.',         val: 'IN PROG' },
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
        { status: 'lock', name: 'Hollow Body 30sn',  desc: 'Temel gövde stabilizasyonu — BUGÜN BAŞLA',  val: 'LOCKED', req: 'REQ: 0 → başla' },
        { status: 'lock', name: 'L-Sit 10sn',        desc: 'Statik core + hip flexor — BUGÜN BAŞLA',   val: 'LOCKED', req: 'REQ: 0 → başla' },
        { status: 'lock', name: 'Plank Variations',  desc: 'Lateral stabilizasyon',                     val: 'LOCKED', req: 'REQ: CORE RANK D' },
        { status: 'lock', name: 'Dragon Flag',       desc: 'İleri seviye core kontrol',                val: 'LOCKED', req: 'REQ: CORE RANK C' },
        { status: 'lock', name: 'Front Lever Tuck',  desc: 'Üst vücut + core entegrasyonu',            val: 'LOCKED', req: 'REQ: CORE RANK B' },
      ],
    },
  ],

  health: {
    rings: [
      { name: 'Egzersiz', icon: '🏃', current: 25, max: 31, unit: 'gün', color: 'var(--grn)', pct: 80 },
      { name: 'Hareket',  icon: '🔥', current: 16, max: 31, unit: 'gün', color: 'var(--red)', pct: 52 },
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
      { icon: '🔥', name: 'Core Aktivasyon',  desc: '3×20sn Hollow Body + 3×10sn L-Sit',   reward: '+50 XP', done: false, progress: 0,      total: 1,     urgent: true },
      { icon: '🚶', name: 'Adım Hedefi',      desc: 'Bugün 12.000 adım tamamla',            reward: '+20 XP', done: true,  progress: 12292,   total: 12000 },
      { icon: '💧', name: 'Hidrasyon',         desc: '2.5 litre su iç',                     reward: '+15 XP', done: false, progress: 1.8,     total: 2.5 },
      { icon: '😴', name: 'Uyku Kalitesi',    desc: 'Bugün 8 saat uyu',                    reward: '+30 XP', done: false, progress: 0,       total: 8 },
    ],
    weekly: [
      { icon: '🦵', name: 'Bacak Günü',            desc: 'Bu hafta en az 1 bacak antrenmanı',    reward: '+150 XP', done: false, progress: 0, total: 1, urgent: true },
      { icon: '💫', name: 'Muscle-Up Challenge',   desc: '4 clean muscle-up dene',               reward: '+100 XP', done: false, progress: 3, total: 4 },
      { icon: '🏋️', name: 'Bench Progress',        desc: '62.5kg, 1 rep dene',                  reward: '+120 XP', done: false, progress: 0, total: 1 },
      { icon: '🧘', name: 'Esneklik Seansları',    desc: '20dk stretching × 2 seans',           reward: '+80 XP',  done: false, progress: 1, total: 2 },
      { icon: '📊', name: 'Antrenman Tutarlılığı', desc: '5 seans tamamla',                     reward: '+200 XP', done: false, progress: 3, total: 5 },
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
    { icon: '🥉', name: 'Silver Warrior',   desc: 'Silver III rankı',      unlocked: true,  date: 'Nis 2025' },
    { icon: '🔒', name: 'Core Master',      desc: 'Core RANK C\'ye ulaş',  unlocked: false, req: '0 → C' },
    { icon: '🔒', name: 'Centurion',        desc: '100 seans tamamla',     unlocked: false, req: '+50 seans' },
    { icon: '🔒', name: 'Flipper Pro',      desc: 'Barani kilidi aç',      unlocked: false, req: 'Core gerekli' },
    { icon: '🔒', name: 'Gold Rush',        desc: 'Gold ranka çıkar',      unlocked: false, req: '+760 XP' },
  ],

  workoutLog: [
    { date: '12 Nis', type: 'Push',              duration: '68dk', volume: '4.820 kg', sets: 22, highlight: 'Bench 60kg×7 REKOR' },
    { date: '10 Nis', type: 'Pull + Akrobasi',   duration: '75dk', volume: '3.960 kg', sets: 18, highlight: 'Muscle-Up ×3' },
    { date: '08 Nis', type: 'Shoulder',          duration: '55dk', volume: '3.240 kg', sets: 16, highlight: 'OHP +2.5kg PR' },
    { date: '06 Nis', type: 'Push',              duration: '70dk', volume: '4.560 kg', sets: 20, highlight: 'Stabil hacim' },
    { date: '04 Nis', type: 'Akrobasi',          duration: '50dk', volume: '—',        sets: '—', highlight: 'Barani 3 deneme' },
    { date: '02 Nis', type: 'Pull',              duration: '65dk', volume: '3.800 kg', sets: 17, highlight: 'Dead Hang 1:20' },
    { date: '31 Mar', type: 'Push + Shoulder',   duration: '80dk', volume: '5.100 kg', sets: 24, highlight: 'Hacim rekoru' },
  ],
}
