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

module.exports = { sahipMi, yetkiliMi };
