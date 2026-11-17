// Komut yetkisi: bot sahibi her şeyi yapar; yetkili komutlarda sunucudaki yetkili roller (veritabanından) aranır.
const { PermissionFlagsBits } = require('discord.js');
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

// Komutun `yetki` tanımına göre kullanım izni: { enAzRol: 'Admin' } veya { yonetici: true }; tanımsızsa sadece bot sahibi
function izinliMi(interaction, yetki) {
  if (sahipMi(interaction.user.id)) return true;
  if (yetki?.yonetici) return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  if (yetki?.enAzRol) return yetkiliMi(interaction, yetki.enAzRol);
  return false;
}

function retMesaji(yetki) {
  if (yetki?.yonetici) return 'Bu komutu sadece yönetici iznine sahip olanlar kullanabilir.';
  if (yetki?.enAzRol) return `Bu komutu en az **${yetki.enAzRol}** rolündeki yetkililer kullanabilir.`;
  return 'Bu komutu sadece bot sahibi kullanabilir.';
}

module.exports = { sahipMi, yetkiliMi, hedefHatasi, izinliMi, retMesaji };
