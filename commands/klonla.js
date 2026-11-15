// /klonla kaynak_id hedef_id [temizle] [emoji] [kuru_calistirma]
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { yapiOku } = require('../utils/yapi');
const { klonAkisi } = require('../utils/akis');
const { sunucuOtomatik } = require('../utils/yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klonla')
    .setDescription('Kaynak sunucunun yapısını hedef sunucuya kopyalar (mesajlar ve üyeler kopyalanmaz).')
    .addStringOption((o) => o.setName('kaynak_id').setDescription('Kopyalanacak (kaynak) sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('hedef_id').setDescription('Kopyanın yapılacağı (hedef) sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .addBooleanOption((o) => o.setName('temizle').setDescription('DİKKAT: Hedefteki tüm kanalları ve rolleri önce siler'))
    .addBooleanOption((o) => o.setName('emoji').setDescription('Özel emojileri ve çıkartmaları da kopyala'))
    .addBooleanOption((o) => o.setName('kuru_calistirma').setDescription('Hiçbir şey yapma, sadece ne yapılacağını listele'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  autocomplete: sunucuOtomatik,

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sec = {
      temizle: interaction.options.getBoolean('temizle') ?? false,
      emoji: interaction.options.getBoolean('emoji') ?? false,
      kuruCalistirma: interaction.options.getBoolean('kuru_calistirma') ?? false,
    };
    const kaynakId = interaction.options.getString('kaynak_id').trim();
    const hedefId = interaction.options.getString('hedef_id').trim();
    if (kaynakId === hedefId) return interaction.editReply('❌ Kaynak ve hedef aynı sunucu olamaz.');

    let kaynak, hedef;
    try {
      kaynak = await sunucuGetir(client, kaynakId, 'Kaynak sunucu');
      hedef = await sunucuGetir(client, hedefId, 'Hedef sunucu');
    } catch (e) {
      return interaction.editReply('❌ ' + e.message);
    }

    await interaction.editReply('🔎 Kaynak sunucu okunuyor ve kontroller yapılıyor...');
    const yapi = await yapiOku(kaynak);
    await klonAkisi(interaction, { hedef, yapi, sec, baslik: `${kaynak.name} ➜ ${hedef.name}` });
  },
};
