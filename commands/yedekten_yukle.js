// /yedekten_yukle hedef_id dosya [temizle] [emoji] [kuru_calistirma]
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { yapiDogrula } = require('../utils/yapi');
const { klonAkisi } = require('../utils/akis');
const { sunucuOtomatik } = require('../utils/yardimci');

const EN_BUYUK_DOSYA = 8 * 1024 * 1024; // 8 MB

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yedekten_yukle')
    .setDescription('/yedek_al ile alınan JSON dosyasındaki yapıyı hedef sunucuya yükler.')
    .addStringOption((o) => o.setName('hedef_id').setDescription('Yedeğin yükleneceği sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .addAttachmentOption((o) => o.setName('dosya').setDescription('/yedek_al ile aldığın .json yedek dosyası').setRequired(true))
    .addBooleanOption((o) => o.setName('temizle').setDescription('DİKKAT: Hedefteki tüm kanalları ve rolleri önce siler'))
    .addBooleanOption((o) => o.setName('emoji').setDescription('Yedekteki emojileri ve çıkartmaları da yükle'))
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
    const dosya = interaction.options.getAttachment('dosya');
    if (dosya.size > EN_BUYUK_DOSYA) return interaction.editReply('❌ Dosya çok büyük (en fazla 8 MB).');

    let hedef, yapi;
    try {
      hedef = await sunucuGetir(client, interaction.options.getString('hedef_id'), 'Hedef sunucu');
      const cevap = await fetch(dosya.url);
      if (!cevap.ok) throw new Error('Dosya indirilemedi.');
      yapi = yapiDogrula(JSON.parse(await cevap.text()));
    } catch (e) {
      const mesaj = e instanceof SyntaxError ? 'Dosya geçerli bir JSON değil. /yedek_al ile aldığın dosyayı değiştirmeden yükle.' : e.message;
      return interaction.editReply('❌ ' + mesaj);
    }
    await klonAkisi(interaction, { hedef, yapi, sec, baslik: `Yedek: ${yapi.kaynakAd} ➜ ${hedef.name}` });
  },
};
