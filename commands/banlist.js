// /banlist : sunucudaki yasaklıları listeler (kaynak: Discord'un ban listesi + botun kayıtları). (Moderator ve üstü)
const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../utils/veritabani');
const { RENK, bilgi } = require('../utils/tasarim');
const { listeGonder, gizliBekle } = require('../utils/liste');

async function tumBanlar(guild) {
  const hepsi = [];
  let son;
  for (;;) {
    const parca = await guild.bans.fetch({ limit: 1000, ...(son ? { after: son } : {}) });
    hepsi.push(...parca.values());
    if (parca.size < 1000) break;
    son = parca.last().user.id;
  }
  return hepsi;
}

module.exports = {
  yetki: { enAzRol: 'Moderator' },
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('Sunucudaki yasaklı kişileri listeler.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    await gizliBekle(interaction);
    let banlar;
    try {
      banlar = await tumBanlar(interaction.guild);
    } catch (e) {
      return interaction.editReply({ embeds: [bilgi('Ban listesi okunamadı: ' + e.message)] });
    }
    if (banlar.length === 0) return interaction.editReply({ embeds: [bilgi('Sunucuda yasaklı kimse yok.')] });

    const kayit = new Map(db.prepare('SELECT * FROM banlar WHERE guild_id = ?').all(interaction.guildId).map((k) => [k.user_id, k]));
    const girdiler = banlar
      .map((b) => ({ b, k: kayit.get(b.user.id) }))
      .sort((x, y) => (y.k?.zaman ?? 0) - (x.k?.zaman ?? 0)) // botla yapılanlar yeni → eski, kayıtsızlar sonda
      .map(({ b, k }) => ({
        baslik: `<@${b.user.id}>  \`${b.user.username}\``,
        satirlar: [
          ['Yetkili', k ? `<@${k.yetkili_id}>` : 'Kayıt yok'],
          ['Tarih', k ? `<t:${Math.floor(k.zaman / 1000)}:f>` : 'Bilinmiyor'],
          ['Sebep', k?.sebep || b.reason || 'Belirtilmedi'],
        ],
      }));
    return listeGonder(interaction, client, {
      renk: RENK.ban,
      baslik: 'Yasaklı üyeler',
      ozet: `Sunucuda **${banlar.length}** yasaklı kişi var.`,
      girdiler,
    });
  },
};
