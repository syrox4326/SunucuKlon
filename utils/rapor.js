// Bitiş raporunu (embed + ayrıntılı metin dosyası) hazırlar.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { kisalt, sureYaz } = require('./yardimci');

// Madde listesi: ilk birkaç satırı gösterir, kalanı "+N daha" diye özetler
function maddeler(liste, adet = 6) {
  if (!liste.length) return 'Yok';
  const gorunen = liste.slice(0, adet).map((x) => `• ${kisalt(x, 180)}`);
  if (liste.length > adet) gorunen.push(`...ve ${liste.length - adet} tane daha (tam liste ekteki dosyada)`);
  return kisalt(gorunen.join('\n'), 1000);
}

function raporUret(rapor, { baslik, sureMs, emojiSecili }) {
  const c = rapor.sayac;
  const renk = rapor.iptal ? 0xfee75c : rapor.hatalar.length ? 0xfaa61a : 0x57f287;
  const durum = rapor.iptal ? '🛑 İşlem iptal edildi' : rapor.hatalar.length ? '⚠️ İşlem bitti (bazı hatalarla)' : rapor.basariBasligi || '✅ İşlem başarıyla bitti';

  const basarili = rapor.ozelBasarili || [
    c.silinenKanal || c.silinenRol ? `Silinen: ${c.silinenKanal} kanal/kategori, ${c.silinenRol} rol` : null,
    `Rol: ${c.rol}`,
    `Kategori: ${c.kategori}`,
    `Kanal: ${c.kanal}`,
    `Kanal izni: ${c.izin}`,
    `Sunucu ayarı: ${c.ayar}`,
    emojiSecili ? `Emoji: ${c.emoji}, Çıkartma: ${c.cikartma}` : null,
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(renk)
    .setTitle(durum)
    .setDescription(`**${baslik}**\n⏱️ Süre: ${sureYaz(sureMs)}`)
    .addFields(
      { name: '✅ Başarılı', value: basarili.join('\n') },
      { name: `⏭️ Atlanan (${rapor.atlanan.length})`, value: maddeler(rapor.atlanan) },
      { name: `❌ Hata alan (${rapor.hatalar.length})`, value: maddeler(rapor.hatalar) },
    );
  if (rapor.notlar.length) embed.addFields({ name: 'ℹ️ Notlar', value: kisalt(rapor.notlar.map((n) => `• ${n}`).join('\n'), 1000) });

  // Tam ayrıntılı kayıt dosyası
  const metin = [
    durum,
    baslik,
    `Süre: ${sureYaz(sureMs)}`,
    '',
    '--- BAŞARILI ---',
    ...basarili,
    '',
    `--- ATLANAN (${rapor.atlanan.length}) ---`,
    ...(rapor.atlanan.length ? rapor.atlanan : ['Yok']),
    '',
    `--- HATA ALAN (${rapor.hatalar.length}) ---`,
    ...(rapor.hatalar.length ? rapor.hatalar : ['Yok']),
    '',
    '--- NOTLAR ---',
    ...(rapor.notlar.length ? rapor.notlar : ['Yok']),
    ...(rapor.ayrintilar ? ['', `--- DEĞİŞİKLİKLER (${rapor.ayrintilar.length}) ---`, ...(rapor.ayrintilar.length ? rapor.ayrintilar : ['Fark bulunamadı'])] : []),
  ].join('\n');

  const dosya = new AttachmentBuilder(Buffer.from(metin, 'utf8'), { name: rapor.dosyaAdi || 'klon-raporu.txt' });
  return { embeds: [embed], files: [dosya], content: '' };
}

module.exports = { raporUret };
