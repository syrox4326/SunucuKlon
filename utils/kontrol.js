// Klonlamadan ÖNCE yapılan kontroller: yetki, rol sırası, limitler, Topluluk durumu.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { yapiOzeti, TIP_ADI } = require('./yapi');

const ROL_LIMITI = 250;
const KANAL_LIMITI = 500;
const EMOJI_LIMITLERI = [50, 100, 150, 250]; // boost seviyesine göre (statik ve hareketli ayrı ayrı)
const CIKARTMA_LIMITLERI = [5, 15, 30, 60];

const TOPLULUK_KISA = 'Hedefte Topluluk (Community) kapalı';
const TOPLULUK_NOTU =
  'Hedef sunucuda Topluluk (Community) özelliği kapalı olduğu için duyuru, sahne ve forum/medya kanalları oluşturulamadı. ' +
  'Çözüm: Hedef sunucuda Sunucu Ayarları > Topluluğu Etkinleştir adımlarını tamamla, sonra komutu tekrar çalıştır.';

// Bu kanal türü hedefte oluşturulamıyorsa nedenini yazar, oluşturulabiliyorsa null döner.
function atlamaNedeni(hedef, tip) {
  const ozellikler = hedef.features || [];
  const topluluk = ozellikler.includes('COMMUNITY');
  if (tip === ChannelType.GuildAnnouncement && !topluluk && !ozellikler.includes('NEWS')) return TOPLULUK_KISA;
  if ([ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia].includes(tip) && !topluluk) return TOPLULUK_KISA;
  return null;
}

// Hedefte silinebilecek roller (bot/yönetilen roller ve @everyone hariç)
function silinecekRoller(hedef) {
  return [...hedef.roles.cache.values()].filter((r) => !r.managed && r.id !== hedef.id);
}

// Tüm ön kontroller. { hatalar, uyarilar, ozet } döner. Hata varsa işlem BAŞLAMAZ.
async function onKontrol(hedef, yapi, sec) {
  const hatalar = [];
  const uyarilar = [];
  const ozet = yapiOzeti(yapi);

  await Promise.all([hedef.roles.fetch(), hedef.channels.fetch()]);
  const ben = await hedef.members.fetchMe();

  // 1) Yönetici yetkisi
  if (!ben.permissions.has(PermissionFlagsBits.Administrator)) {
    hatalar.push(
      '**Bot hedef sunucuda Yönetici (Administrator) yetkisine sahip değil.**\n' +
        'Çözüm: Botu "Yönetici" izniyle yeniden davet et veya Sunucu Ayarları > Roller bölümünden bot rolüne Yönetici izni ver.',
    );
  }

  // 2) Rol sırası: botun rolü hedefteki rollerin altındaysa o rolleri silemez/düzenleyemez
  const botSira = ben.roles.highest.position;
  if (botSira <= 0) {
    hatalar.push('**Botun hedef sunucuda hiç rolü yok.** Botu Yönetici izniyle yeniden davet et.');
  }
  const ustundekiler = silinecekRoller(hedef).filter((r) => r.position >= botSira);
  if (ustundekiler.length > 0) {
    const adlar = ustundekiler.slice(0, 10).map((r) => `@${r.name}`).join(', ') + (ustundekiler.length > 10 ? ' ...' : '');
    const aciklama =
      `Botun rolü şu rollerin altında veya aynı seviyede: ${adlar}\n` +
      'Çözüm: Hedef sunucuda Sunucu Ayarları > Roller bölümünde bot rolünü listenin EN ÜSTÜNE sürükle. (README adım 6)';
    if (sec.temizle) hatalar.push('**Bot rolü yeterince yüksek değil, temizleme yapılamaz.**\n' + aciklama);
    else uyarilar.push(aciklama + '\n(Yeni roller yine de oluşturulur ama bot bu eski rolleri düzenleyemez.)');
  }

  // 3) Rol ve kanal limitleri
  const kalanRol = sec.temizle ? silinecekRoller(hedef).filter((r) => r.position >= botSira).length : silinecekRoller(hedef).length;
  const mevcutRol = [...hedef.roles.cache.values()].filter((r) => r.managed || r.id === hedef.id).length + kalanRol;
  if (mevcutRol + yapi.roller.length > ROL_LIMITI) {
    hatalar.push(
      `**Rol limiti aşılıyor.** Discord en fazla ${ROL_LIMITI} role izin verir. Hedefte ${mevcutRol} rol kalacak, ` +
        `${yapi.roller.length} rol daha eklenecek.\nÇözüm: "temizle" seçeneğini kullan veya hedefteki gereksiz rolleri sil.`,
    );
  }
  const olusacakKanal = yapi.kanallar.filter((k) => !atlamaNedeni(hedef, k.tip)).length;
  const kalanKanal = sec.temizle ? 0 : hedef.channels.cache.size;
  if (kalanKanal + olusacakKanal > KANAL_LIMITI) {
    hatalar.push(
      `**Kanal limiti aşılıyor.** Discord en fazla ${KANAL_LIMITI} kanala izin verir. Hedefte ${kalanKanal} kanal kalacak, ` +
        `${olusacakKanal} kanal daha eklenecek.\nÇözüm: "temizle" seçeneğini kullan veya hedefteki gereksiz kanalları sil.`,
    );
  }

  // 4) Topluluk kapalıysa atlanacak kanallar
  const atlanacak = yapi.kanallar.filter((k) => atlamaNedeni(hedef, k.tip));
  if (atlanacak.length > 0) {
    const turler = {};
    for (const k of atlanacak) turler[TIP_ADI[k.tip]] = (turler[TIP_ADI[k.tip]] || 0) + 1;
    const yazi = Object.entries(turler).map(([t, n]) => `${n} ${t}`).join(', ');
    uyarilar.push(`${TOPLULUK_NOTU}\nAtlanacak kanallar: ${yazi}.`);
  }

  // 5) Boost seviyesine bağlı özellikler
  const ozellik = hedef.features || [];
  const s = yapi.sunucu;
  if (s.banner && !ozellik.includes('BANNER')) uyarilar.push('Sunucu banner\'ı atlanacak: hedefin boost seviyesi yetersiz (Seviye 2 gerekir).');
  if (yapi.roller.some((r) => r.ikon || r.emoji) && !ozellik.includes('ROLE_ICONS')) {
    uyarilar.push('Rol ikonları/emojileri atlanacak: hedefin boost seviyesi yetersiz (Seviye 2 gerekir).');
  }
  if (sec.emoji) {
    const tier = hedef.premiumTier;
    const statik = yapi.emojiler.filter((e) => !e.animasyon).length;
    const hareketli = yapi.emojiler.length - statik;
    if (statik > EMOJI_LIMITLERI[tier] || hareketli > EMOJI_LIMITLERI[tier] || yapi.cikartmalar.length > CIKARTMA_LIMITLERI[tier]) {
      uyarilar.push(
        `Hedefin emoji/çıkartma limiti (boost seviyesi ${tier}: ${EMOJI_LIMITLERI[tier]} emoji, ${CIKARTMA_LIMITLERI[tier]} çıkartma) ` +
          'kaynaktaki sayıdan az olabilir. Limit dolunca kalanlar atlanır ve raporlanır.',
      );
    }
  }
  const uyeOzel = yapi.kanallar.reduce((t, k) => t + (k.uyeOzelSayisi || 0), 0);
  if (uyeOzel > 0) uyarilar.push(`${uyeOzel} adet üyeye özel kanal izni kopyalanmayacak (sadece rol izinleri kopyalanır).`);

  return { hatalar, uyarilar, ozet };
}

module.exports = {
  ROL_LIMITI, KANAL_LIMITI, EMOJI_LIMITLERI, CIKARTMA_LIMITLERI,
  TOPLULUK_KISA, TOPLULUK_NOTU, atlamaNedeni, silinecekRoller, onKontrol,
};
