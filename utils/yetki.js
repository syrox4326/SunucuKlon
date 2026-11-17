// Komut yetkisi: bot sahibi her şeyi yapar; yetkili komutlarda sunucudaki yetkili roller (veritabanından) aranır.
const ayar = require('./ayar');
const { yetkiliRoller } = require('./veritabani');

const sahipMi = (kullaniciId) => kullaniciId === ayar.ownerId();

// "En az şu rol ve üstü" kontrolü. Roller veritabanındaki `sira` değerine göre sıralıdır.
function yetkiliMi(interaction, enAzRolAdi) {
  if (sahipMi(interaction.user.id)) return true;
  const roller = yetkiliRoller(interaction.guildId); // yüksekten düşüğe
  const esik = roller.find((r) => r.ad === enAzRolAdi);
  if (!esik || !interaction.member?.roles?.cache) return false;
  const izinli = new Set(roller.filter((r) => r.sira >= esik.sira).map((r) => r.rol_id));
  return interaction.member.roles.cache.some((r) => izinli.has(r.id));
}

// Kick/ban gibi işlemlerde ortak kontrol. Sorun varsa hata metni, yoksa null döner.
function hedefHatasi(interaction, client, kullanici, uye) {
  if (kullanici.id === interaction.user.id) return 'Bu işlemi kendine uygulayamazsın.';
  if (kullanici.id === client.user.id) return 'Beni bu işlemle hedef alamazsın.';
  if (kullanici.id === interaction.guild.ownerId) return 'Sunucu sahibine bu işlem uygulanamaz.';
  if (uye && !sahipMi(interaction.user.id) && uye.roles.highest.position >= interaction.member.roles.highest.position) {
    return 'Senin rolüne eşit veya senden yüksek roldeki birine bu işlemi uygulayamazsın.';
  }
  return null;
}

module.exports = { sahipMi, yetkiliMi, hedefHatasi };
