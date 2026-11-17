// /duzelt kaynak_id hedef_id [eksikleri_olustur] [kuru_calistirma]
// Hedefi kaynakla tekrar karşılaştırır; yanlış sıra, eksik/yanlış izin ve ayarları düzeltir. Hiçbir şey silmez.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { yapiOku } = require('../utils/yapi');
const { sunucuOtomatik, kisalt } = require('../utils/yardimci');
const { butonOnay } = require('../utils/akis');
const islemYonetimi = require('../utils/islem');
const { IlerlemeMesaji } = require('../utils/ilerleme');
const { raporUret } = require('../utils/rapor');
const { duzelt } = require('../utils/duzeltici');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duzelt')
    .setDescription('Hedefi kaynakla karşılaştırıp yanlış sıra, izin ve ayarları düzeltir (silme yapmaz).')
    .addStringOption((o) => o.setName('kaynak_id').setDescription('Kaynak sunucu').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('hedef_id').setDescription('Düzeltilecek (hedef) sunucu').setRequired(true).setAutocomplete(true))
    .addBooleanOption((o) => o.setName('eksikleri_olustur').setDescription('Hedefte eksik olan rol/kanalları da oluştur (varsayılan: Evet)'))
    .addBooleanOption((o) => o.setName('kuru_calistirma').setDescription('Hiçbir şey değiştirme, sadece neyin düzeltileceğini listele'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  autocomplete: sunucuOtomatik,

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sec = {
      olustur: interaction.options.getBoolean('eksikleri_olustur') ?? true,
      kuruCalistirma: interaction.options.getBoolean('kuru_calistirma') ?? false,
    };
    const kaynakId = interaction.options.getString('kaynak_id').trim();
    const hedefId = interaction.options.getString('hedef_id').trim();
    if (kaynakId === hedefId) return interaction.editReply('❌ Kaynak ve hedef aynı sunucu olamaz.');

    if (islemYonetimi.aktifGetir()) {
      return interaction.editReply('⏳ Şu anda devam eden bir işlem var. Durumu görmek için `/durum`, durdurmak için `/iptal` yaz.');
    }

    let kaynak, hedef;
    try {
      kaynak = await sunucuGetir(client, kaynakId, 'Kaynak sunucu');
      hedef = await sunucuGetir(client, hedefId, 'Hedef sunucu');
    } catch (e) {
      return interaction.editReply('❌ ' + e.message);
    }

    // Ön kontrol: bot hedefte Yönetici mi?
    const ben = await hedef.members.fetchMe();
    if (!ben.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply('❌ Bot hedef sunucuda Yönetici yetkisine sahip değil. Botu Yönetici izniyle yeniden davet et.');
    }

    await interaction.editReply('🔎 Kaynak ve hedef sunucu okunuyor...');
    let yapi;
    try {
      yapi = await yapiOku(kaynak);
    } catch (e) {
      return interaction.editReply('❌ Kaynak sunucu okunamadı: ' + e.message);
    }
    const baslik = `${kaynak.name} ➜ ${hedef.name} (düzeltme)`;

    // Onay (kuru çalıştırmada gerekmez)
    if (!sec.kuruCalistirma) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🛠️ Düzeltme özeti')
        .setDescription(
          `**${baslik}**\n\nBot, hedefi kaynakla ada göre eşleştirip şunları düzeltir:\n` +
            '• Rol ayarları, izinleri ve sıralaması\n• Kategori/kanal ayarları, kategorisi ve sıralaması\n• Kanal ve kategori izinleri (bot rolleri dahil)\n• Sunucu ayarları\n\n' +
            `Eksikleri oluştur: **${sec.olustur ? 'Evet' : 'Hayır'}**\n**Hiçbir şey silinmez.**\n\n` +
            'İlk seferde neyin değişeceğini görmek istersen İptal de ve `kuru_calistirma:True` ile çalıştır.',
        );
      if (!(await butonOnay(interaction, embed))) return;
    }

    const islem = islemYonetimi.baslat('duzelt', baslik);
    if (!islem) return interaction.editReply({ content: '⏳ Başka bir işlem az önce başladı.', embeds: [], components: [] });
    const ilerleme = new IlerlemeMesaji(interaction, islem);
    ilerleme.baslat();
    let rapor;
    try {
      rapor = await duzelt(kaynak, hedef, yapi, sec, islem);
    } finally {
      if (!rapor) {
        rapor = { sayac: {}, atlanan: [], hatalar: ['İşlem beklenmedik şekilde durdu. Konsol kaydına bak.'], notlar: [], ayrintilar: [], iptal: false };
      }
      islemYonetimi.bitir(islem, rapor);
    }
    await ilerleme.bitir(raporUret(rapor, { baslik: kisalt(baslik, 200), sureMs: Date.now() - islem.baslangic, emojiSecili: false }));
  },
};
