// /durum : devam eden işlemin ilerlemesini gösterir
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const islemYonetimi = require('../utils/islem');
const { sureYaz } = require('../utils/yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('durum')
    .setDescription('Devam eden klonlama işleminin ilerlemesini gösterir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const islem = islemYonetimi.aktifGetir();
    if (islem) {
      const e = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ Devam eden işlem')
        .setDescription(`**${islem.baslik}**\n\n${islem.durumMetni()}`)
        .addFields({ name: 'Son adımlar', value: islem.sonLoglar.slice(-4).map((l) => `• ${l}`).join('\n') || 'Henüz yok' });
      return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }
    const son = islemYonetimi.sonGetir();
    if (son) {
      const durum = son.ozet?.iptal ? 'iptal edildi' : son.ozet?.hatalar?.length ? 'hatalarla bitti' : 'başarıyla bitti';
      return interaction.reply({
        content: `💤 Şu anda devam eden işlem yok.\nSon işlem: **${son.baslik}** — ${durum} (${sureYaz(son.bitisZamani - son.baslangic)} sürdü, ${son.hataSayisi} hata, ${son.atlananSayisi} atlanan).`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({ content: '💤 Şu anda devam eden bir işlem yok.', flags: MessageFlags.Ephemeral });
  },
};
