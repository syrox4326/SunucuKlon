// /mutelist : sunucudaki AKTİF mute'ları listeler. (Trial Moderator ve üstü)
const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../utils/veritabani');
const { sureYaz } = require('../utils/sure');
const { RENK, bilgi } = require('../utils/tasarim');
const { listeGonder, gizliBekle } = require('../utils/liste');

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('mutelist')
    .setDescription('Şu an susturulmuş olan üyeleri listeler.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    await gizliBekle(interaction);
    const kayitlar = db.prepare('SELECT * FROM mutelar WHERE guild_id = ? AND bitis > ? ORDER BY bitis ASC').all(interaction.guildId, Date.now());
    if (kayitlar.length === 0) return interaction.editReply({ embeds: [bilgi('Şu anda susturulmuş üye yok.')] });

    const girdiler = await Promise.all(
      kayitlar.map(async (k) => {
        const u = await client.users.fetch(k.user_id).catch(() => null);
        return {
          baslik: `<@${k.user_id}>  \`${u?.username ?? k.user_id}\``,
          satirlar: [
            ['Yetkili', `<@${k.yetkili_id}>`],
            ['Süre', `${sureYaz(k.bitis - k.baslangic)}  ·  <t:${Math.floor(k.bitis / 1000)}:R> bitiyor`],
            ['Sebep', k.sebep || 'Belirtilmedi'],
          ],
        };
      }),
    );
    return listeGonder(interaction, client, {
      renk: RENK.mute,
      baslik: 'Aktif susturmalar',
      ozet: `Şu anda **${kayitlar.length}** üye susturulmuş durumda.`,
      girdiler,
    });
  },
};
