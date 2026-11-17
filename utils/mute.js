// Mute motoru: "Muted" rolü kurulumu, mute/unmute işlemleri ve süresi dolanları otomatik açan zamanlayıcı.
const { ChannelType, PermissionFlagsBits: P } = require('discord.js');
const { db } = require('./veritabani');

const ROL_ADI = 'Muted';
const KONTROL_ARALIGI = 15_000; // süresi dolanlar 15 sn'de bir kontrol edilir

// Muted rolüne her kanalda kapatılan izinler
const YASAKLAR = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  AddReactions: false,
  Speak: false,
  Stream: false,
  SendVoiceMessages: false,
  UseApplicationCommands: false,
  RequestToSpeak: false,
};

const KANAL_TIPLERI = new Set([
  ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice,
  ChannelType.GuildForum, ChannelType.GuildMedia, ChannelType.GuildCategory,
]);

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Muted rolünü bulur, yoksa oluşturur (renksiz, izinsiz — görünümü etkilemez).
async function mutedRolunuGetir(guild) {
  await guild.roles.fetch();
  let rol = guild.roles.cache.find((r) => r.name.toLowerCase() === ROL_ADI.toLowerCase() && !r.managed);
  if (!rol) {
    rol = await guild.roles.create({
      name: ROL_ADI,
      color: 0,
      permissions: 0n,
      hoist: false,
      mentionable: false,
      reason: "Kerem's Bot: mute sistemi için oluşturuldu",
    });
  }
  return rol;
}

// Bir kanalda Muted yasakları tam mı?
function kanalHazirMi(kanal, rol) {
  const o = kanal.permissionOverwrites.cache.get(rol.id);
  if (!o) return false;
  return Object.keys(YASAKLAR).every((ad) => o.deny.has(P[ad]));
}

async function kanalHazirla(kanal, rol) {
  if (!KANAL_TIPLERI.has(kanal.type) || kanalHazirMi(kanal, rol)) return false;
  await kanal.permissionOverwrites.edit(rol, YASAKLAR, { reason: "Kerem's Bot: Muted rolü izinleri" });
  return true;
}

// Muted rolünü oluşturur/doğrular ve TÜM kanallara yasakları uygular. ilerleme(n, toplam) isteğe bağlı.
async function mutedRolunuHazirla(guild, ilerleme) {
  const rol = await mutedRolunuGetir(guild);
  const kanallar = [...(await guild.channels.fetch()).values()].filter((k) => k && KANAL_TIPLERI.has(k.type));
  let degisen = 0;
  let hata = 0;
  for (let i = 0; i < kanallar.length; i++) {
    try {
      if (await kanalHazirla(kanallar[i], rol)) {
        degisen++;
        await bekle(250);
      }
    } catch (e) {
      hata++;
      console.error(`[mute] ${kanallar[i].name} kanalı hazırlanamadı: ${e.message}`);
    }
    ilerleme?.(i + 1, kanallar.length);
  }
  return { rol, toplam: kanallar.length, degisen, hata };
}

// ---------------- mute / unmute ----------------
function muteKaydet({ guildId, userId, bitis, yetkiliId, sebep }) {
  db.prepare(
    `INSERT INTO mutelar (guild_id, user_id, bitis, baslangic, yetkili_id, sebep) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET bitis = excluded.bitis, baslangic = excluded.baslangic,
       yetkili_id = excluded.yetkili_id, sebep = excluded.sebep`,
  ).run(guildId, userId, bitis, Date.now(), yetkiliId, sebep ?? null);
}

const muteGetir = (guildId, userId) => db.prepare('SELECT * FROM mutelar WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
const muteSil = (guildId, userId) => db.prepare('DELETE FROM mutelar WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

async function muteUygula(uye, ms, yetkiliId, sebep) {
  const rol = await mutedRolunuGetir(uye.guild);
  await uye.roles.add(rol, `Mute (${yetkiliId}): ${sebep || 'sebep yok'}`);
  const bitis = Date.now() + ms;
  muteKaydet({ guildId: uye.guild.id, userId: uye.id, bitis, yetkiliId, sebep });
  return { rol, bitis };
}

// Mute'u kaldırır. Döner: true (kaldırıldı) / false (zaten mute değildi)
async function muteKaldir(guild, userId, sebep) {
  const kayit = muteGetir(guild.id, userId);
  const rol = await mutedRolunuGetir(guild).catch(() => null);
  let rolVardi = false;
  const uye = await guild.members.fetch(userId).catch(() => null);
  if (uye && rol && uye.roles.cache.has(rol.id)) {
    await uye.roles.remove(rol, `Unmute: ${sebep || 'süre doldu'}`);
    rolVardi = true;
  }
  muteSil(guild.id, userId);
  return Boolean(kayit) || rolVardi;
}

// Süresi dolan mute'ları açar (bot açılışında ve düzenli aralıkla çalışır)
async function sureDolanlariAc(client) {
  const dolanlar = db.prepare('SELECT guild_id, user_id FROM mutelar WHERE bitis <= ?').all(Date.now());
  for (const { guild_id, user_id } of dolanlar) {
    const guild = client.guilds.cache.get(guild_id);
    if (!guild) continue;
    try {
      await muteKaldir(guild, user_id, 'süre doldu');
    } catch (e) {
      console.error(`[mute] ${user_id} otomatik açılamadı: ${e.message}`);
    }
  }
}

function zamanlayiciyiBaslat(client) {
  sureDolanlariAc(client).catch(() => {});
  setInterval(() => sureDolanlariAc(client).catch(() => {}), KONTROL_ARALIGI).unref();
}

// Yeni açılan kanallara da Muted yasaklarını koy
async function yeniKanal(kanal) {
  if (!kanal.guild) return;
  const rol = kanal.guild.roles.cache.find((r) => r.name.toLowerCase() === ROL_ADI.toLowerCase() && !r.managed);
  if (rol) await kanalHazirla(kanal, rol).catch((e) => console.error('[mute] yeni kanal:', e.message));
}

module.exports = {
  ROL_ADI, mutedRolunuGetir, mutedRolunuHazirla, muteUygula, muteKaldir, muteGetir, muteSil, zamanlayiciyiBaslat, yeniKanal,
};
