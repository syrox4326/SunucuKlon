// /iptal : devam eden işlemi güvenle durdurur
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const islemYonetimi = require('../utils/islem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('iptal')
    .setDescription('Devam eden klonlama işlemini güvenle durdurur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const islem = islemYonetimi.aktifGetir();
    if (!islem) return interaction.reply({ content: '💤 İptal edilecek devam eden bir işlem yok.', flags: MessageFlags.Ephemeral });
    islem.iptalIstendi = true;
    islem.log('İptal istendi');
    return interaction.reply({
      content: '🛑 İptal istendi. Bot şu anki adımı bitirip duracak ve ne kadarının yapıldığını rapor edecek. (Yapılanlar geri alınmaz.)',
      flags: MessageFlags.Ephemeral,
    });
  },
};
