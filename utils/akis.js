// /klonla ve /yedekten_yukle için ortak akış:
// ön kontrol > (kuru çalıştırma) > özet + onay > (temizle için ikinci onay) > çalıştır > rapor
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const islemYonetimi = require('./islem');
const { onKontrol, ROL_LIMITI, KANAL_LIMITI } = require('./kontrol');
const { yapiDogrula, yapiOzeti, tipYazisi } = require('./yapi');
const { uygula, kuruPlan } = require('./klonlayici');
const { IlerlemeMesaji } = require('./ilerleme');
const { raporUret } = require('./rapor');
const { silinecekRoller } = require('./kontrol');
const { kisalt } = require('./yardimci');

// Onayla / İptal butonları gösterir; onaylanırsa true döner.
async function butonOnay(interaction, embed, { onayEtiket = 'Onayla', onayStil = ButtonStyle.Success, sureMs = 120000 } = {}) {
  const satir = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('onay_evet').setLabel(onayEtiket).setStyle(onayStil),
    new ButtonBuilder().setCustomId('onay_hayir').setLabel('İptal').setStyle(ButtonStyle.Secondary),
  );
  const mesaj = await interaction.editReply({ embeds: [embed], components: [satir], files: [] });
  try {
    const tik = await mesaj.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: sureMs,
    });
    await tik.deferUpdate();
    if (tik.customId !== 'onay_evet') {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x99aab5).setDescription('❌ İşlem iptal edildi. Hiçbir değişiklik yapılmadı.')], components: [] });
      return false;
    }
    return true;
  } catch {
    await interaction
      .editReply({ embeds: [new EmbedBuilder().setColor(0x99aab5).setDescription('⏱️ Süre doldu, işlem iptal edildi. Hiçbir değişiklik yapılmadı.')], components: [] })
      .catch(() => {});
    return false;
  }
}

async function klonAkisi(interaction, { hedef, yapi: hamYapi, sec, baslik }) {
  const yapi = yapiDogrula(hamYapi);

  // 0) Aynı anda tek işlem
  if (islemYonetimi.aktifGetir()) {
    return interaction.editReply('⏳ Şu anda devam eden bir işlem var. Durumu görmek için `/durum`, durdurmak için `/iptal` yaz.');
  }

  // 1) Ön kontrol
  const { hatalar, uyarilar, ozet } = await onKontrol(hedef, yapi, sec);
  if (hatalar.length) {
    const e = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('❌ İşlem başlatılamadı')
      .setDescription(kisalt(hatalar.join('\n\n'), 4000))
      .setFooter({ text: 'Sorunu çözüp komutu tekrar çalıştır. Hiçbir değişiklik yapılmadı.' });
    return interaction.editReply({ embeds: [e], components: [] });
  }

  // 2) Kuru çalıştırma: sadece listele
  if (sec.kuruCalistirma) {
    const plan = kuruPlan(hedef, yapi, sec);
    const e = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🧪 Kuru çalıştırma tamamlandı')
      .setDescription(`**${baslik}**\nHiçbir şey oluşturulmadı veya silinmedi. Ayrıntılı plan ekteki dosyada.`)
      .addFields(
        { name: 'Yapı', value: `${ozet.rol} rol, ${ozet.kategori} kategori, ${ozet.kanalToplam - ozet.kategori} kanal (${tipYazisi(ozet.tipSayilari)})` },
      );
    if (uyarilar.length) e.addFields({ name: '⚠️ Uyarılar', value: kisalt(uyarilar.map((u) => `• ${u}`).join('\n'), 1000) });
    const dosya = new AttachmentBuilder(Buffer.from(plan.join('\n'), 'utf8'), { name: 'kuru-calistirma-plani.txt' });
    return interaction.editReply({ embeds: [e], files: [dosya], components: [] });
  }

  // 3) Özet ve onay
  const ozetEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 Klonlama özeti')
    .setDescription(`**${baslik}**\nOnaylarsan işlem başlar.`)
    .addFields(
      { name: 'Kopyalanacak', value: `🎭 ${ozet.rol} rol\n📁 ${ozet.kategori} kategori\n💬 ${ozet.kanalToplam - ozet.kategori} kanal (${tipYazisi(ozet.tipSayilari)})\n🔐 ${ozet.izinSayisi} kanal izni` },
      { name: 'Seçenekler', value: `Temizle: ${sec.temizle ? '**EVET** ⚠️' : 'Hayır'}\nEmoji/Çıkartma: ${sec.emoji ? `Evet (${ozet.emoji} emoji, ${ozet.cikartma} çıkartma)` : 'Hayır'}` },
      { name: 'Limitler', value: `Rol: en fazla ${ROL_LIMITI}, Kanal: en fazla ${KANAL_LIMITI}` },
    );
  if (uyarilar.length) ozetEmbed.addFields({ name: '⚠️ Uyarılar', value: kisalt(uyarilar.map((u) => `• ${u}`).join('\n'), 1000) });
  if (!(await butonOnay(interaction, ozetEmbed))) return;

  // 4) Temizle seçiliyse İKİNCİ onay
  if (sec.temizle) {
    const kanalSayisi = hedef.channels.cache.size;
    const rolSayisi = silinecekRoller(hedef).length;
    const kirmizi = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🚨 TEHLİKELİ İŞLEM: HEDEF SUNUCU TEMİZLENECEK')
      .setDescription(
        `**${hedef.name}** sunucusundaki:\n• **${kanalSayisi}** kanal/kategori\n• **${rolSayisi}** rol\n\n` +
          '**KALICI OLARAK SİLİNECEK. Bu işlem GERİ ALINAMAZ.**\n(Mesajlar da bu kanallarla birlikte silinir.)\n\n' +
          'Emin değilsen "İptal" de. Önce `/klonla ... kuru_calistirma:True` ile denemeni öneririm.',
      );
    if (!(await butonOnay(interaction, kirmizi, { onayEtiket: 'Evet, hepsini sil ve devam et', onayStil: ButtonStyle.Danger }))) return;
  }

  // 5) Çalıştır
  const islem = islemYonetimi.baslat('klonla', baslik);
  if (!islem) return interaction.editReply({ content: '⏳ Başka bir işlem az önce başladı.', embeds: [], components: [] });
  const ilerleme = new IlerlemeMesaji(interaction, islem);
  ilerleme.baslat();
  let rapor;
  try {
    rapor = await uygula(hedef, yapi, sec, islem);
  } finally {
    // Ne olursa olsun işlemi "bitti" olarak işaretle ki kilit açılsın
    if (!rapor) rapor = { sayac: { silinenKanal: 0, silinenRol: 0, rol: 0, kategori: 0, kanal: 0, izin: 0, ayar: 0, emoji: 0, cikartma: 0 }, atlanan: [], hatalar: ['İşlem beklenmedik şekilde durdu. Konsol kaydına bak.'], notlar: [], iptal: false };
    islemYonetimi.bitir(islem, rapor);
  }
  await ilerleme.bitir(raporUret(rapor, { baslik, sureMs: Date.now() - islem.baslangic, emojiSecili: sec.emoji }));
}

module.exports = { klonAkisi, butonOnay };
