/**
 * Epic Volume & Geography Raider
 * -------------------------------
 * Toplam hacim (kg) ve yürüyüş/parkour mesafesi (km) ilerlemeyi
 * doğa ve vahşi yaşamla karşılaştırır. Tek bir teknoloji ya da
 * ekipman yok — sadece kan, ter ve vahşi dünya.
 *
 * Sıralama: en küçük hedef en üstte. Engine en yüksek eşiği
 * döndürürken geçilen ve geçilemeyen sonraki hedefi birlikte verir.
 */

// ── Volume tiers (kg) ────────────────────────────────────────────────────────
// kg cinsinden toplam hacim — kaldırılan her kilogram toplanır.
export const VOLUME_TIERS = [
  { kg: 1000,     icon: '🐺', name: 'Sürü Lideri',         msg: 'Bir bozkır kurdunu sırtına aldın.' },
  { kg: 5000,     icon: '🦌', name: 'Geyik Boynuzu',       msg: 'Beş erkek kızıl geyik kadar kütle kaldırdın.' },
  { kg: 10000,    icon: '🐗', name: 'Yaban Domuzu',        msg: 'Bir sürü yaban domuzu yolundan çekildi.' },
  { kg: 25000,    icon: '🐎', name: 'Mustang Savuşu',      msg: 'Bir Mustang sürüsü ağırlığını omuzladın.' },
  { kg: 50000,    icon: '🦬', name: 'Bizon Sürüsü',        msg: 'Bir Amerikan bizonunu yerden kaldırabilir bir güç.' },
  { kg: 80000,    icon: '🦍', name: 'Silver Back',         msg: 'Orta Afrika\'nın en kıdemli gorilini öne geçtin.' },
  { kg: 120000,   icon: '🐃', name: 'Kafkas Boğası',       msg: '8 yetişkin bufalo. Sessizce yolu açtılar.' },
  { kg: 180000,   icon: '🦏', name: 'Beyaz Gergedan',      msg: 'Afrika\'nın en büyük otoburu kadar toprağı ittin.' },
  { kg: 250000,   icon: '🦛', name: 'Nil Suaygırı',        msg: '50 suaygırı. Her biri 5 ton gazap.' },
  { kg: 400000,   icon: '🐘', name: 'Afrika Fili',         msg: 'Bir yaşlı dişi fil kadar — 400 ton toprak taşıdı elin.' },
  { kg: 700000,   icon: '🦕', name: 'Diplodocus Gölgesi',  msg: 'Jurassic devi uyandı. Sen onu kaldırdın.' },
  { kg: 1000000,  icon: '🐋', name: 'Mavi Balina Kalbi',   msg: 'Gezegenin en büyük yüreği kadar — 1.000 ton.' },
  { kg: 1500000,  icon: '🌲', name: 'Sekoya Gövdesi',      msg: 'California\'nın 1200 yıllık devi. Kökünden söktün.' },
  { kg: 2500000,  icon: '🏔️', name: 'Granit Sırt',         msg: 'Kayalık Dağlar\'dan bir zirveyi yerinden oynattın.' },
  { kg: 5000000,  icon: '☄️', name: 'Göktaşı',             msg: '5 kiloton — Tunguska\'nın küçük kardeşi.' },
]

// ── Geography tiers (km — yürüyüş + parkour + akrobasi mesafeleri) ──────────
export const GEOGRAPHY_TIERS = [
  { km: 10,    icon: '🏞️', name: 'Belgrad Ormanı Turu',  msg: 'İstanbul\'un yeşil ciğerini taradın.' },
  { km: 25,    icon: '🏔️', name: 'Uludağ Zirvesi',       msg: 'Deniz seviyesinden zirveye — 2.543 m.' },
  { km: 50,    icon: '🗻', name: 'Babadağ Sırtı',        msg: 'Ölüdeniz\'e bakan ana sırtı baştan sona yürüdün.' },
  { km: 100,   icon: '🏝️', name: 'Likya Yolu Başlangıcı',msg: 'Fethiye-Patara. Antik taşlar ayaklarının altında.' },
  { km: 250,   icon: '🌊', name: 'Karadeniz Yalı Yolu',  msg: 'Sinop-Samsun kıyı şeridini tamamladın.' },
  { km: 500,   icon: '🏜️', name: 'Kızılırmak Boyu',      msg: 'Sivas\'tan Karadeniz\'e — en uzun nehrin kaderi.' },
  { km: 1000,  icon: '🌄', name: 'Doğu Ekspresi Rayı',   msg: 'Ankara-Kars. Rayların her metresine bastın.' },
  { km: 2000,  icon: '🐪', name: 'İpek Yolu Parçası',    msg: 'Antik kervanların 2 aylık yolunu katlettin.' },
  { km: 4000,  icon: '🌵', name: 'Sahra Çölü Yayı',      msg: 'Kum denizinin büyük bir yayını geçtin.' },
  { km: 6000,  icon: '❄️', name: 'Sibirya Kuşağı',       msg: 'Ural\'dan Vladivostok\'a — beyaz sessizlik.' },
  { km: 9000,  icon: '🦁', name: 'Afrika Kuzey-Güney',   msg: 'Kahire\'den Cape Town\'a. Bir kıta ayaklarının altında.' },
  { km: 12000, icon: '🗺️', name: 'Amazon Kaynağı',       msg: 'And Dağları\'ndan Atlantik\'e — 12 ülke, 1 nehir.' },
  { km: 20000, icon: '🌍', name: 'Dünya Yarısı',         msg: 'Dünya\'nın çevresinin yarısını yürüdün. Yarısı kaldı.' },
  { km: 40075, icon: '🌐', name: 'Ekvator Turu',         msg: 'Dünya\'nın çevresi kadar — hiçbir insan yapmadı, sen yaptın.' },
]

// ── Deep tiers (m — irtifa/derinlik — tırmanış mesafesi dikey toplam) ───────
export const DEPTH_TIERS = [
  { m: 500,   icon: '⛰️', name: 'Kayalık Tırmanış',     msg: 'Bir duvar boyunca 500 metre dikey çıktın.' },
  { m: 1500,  icon: '🧗', name: 'El Capitan Yüzü',      msg: 'Yosemite\'nin dik yüzü kadar tırmandın.' },
  { m: 3000,  icon: '🗻', name: 'Ararat Eteği',         msg: 'Ağrı\'nın ilk kampına ulaştın — 3000 m dikey.' },
  { m: 5000,  icon: '🏔️', name: 'Everest Base Camp',    msg: '5364 m — temel kampa vardın.' },
  { m: 8848,  icon: '🏔️🏳️', name: 'Everest Zirvesi',   msg: 'Dünya\'nın çatısına dikey olarak ulaştın.' },
]
