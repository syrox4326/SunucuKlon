// Toplu işlemlerin ortak akışı: özet + onay düğmesi, ilerleme, durdurma düğmesi, sonuç.
// Kullanım: await topluCalistir(interaction, client, { baslik, ozet, butonYazisi, hedefler, uygula: async (uye) => {...} })
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { RENK, taslak } = require('./tasarim');

const calisanlar = new Set(); // sunucu başına tek toplu işlem
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const EN_UZUN_SURE = 14 * 60 * 1000; // etkileşim yanıtı 15 dk geçerli

const dugme = (id, yazi, stil, kapali = false) => new ButtonBuilder().setCustomId(id).setLabel(yazi).setStyle(stil).setDisabled(kapali);
const satir = (...d) => new ActionRowBuilder().addComponents(...d);

const mesgulMu = (guildId) => calisanlar.has(guildId);

// interaction daha önce deferReply (ephemeral) ile yanıtlanmış olmalı
async function topluCalistir(interaction, client, { baslik, ozet, butonYazisi, hedefler, uygula, bekleMs = 500, renk = RENK.bilgi }) {
  const mesaj = await interaction.editReply({
    embeds: [taslak(client, renk, `${baslik}: onay gerekli`).setDescription(ozet)],
    components: [satir(dugme('onay', butonYazisi, ButtonStyle.Danger), dugme('iptal', 'Vazgeç', ButtonStyle.Secondary))],
  });

  let tiklama;
  try {
    tiklama = await mesaj.awaitMessageComponent({ componentType: ComponentType.Button, filter: (i) => i.user.id === interaction.user.id, time: 60_000 });
  } catch {
    return interaction.editReply({ embeds: [taslak(client, RENK.bilgi, 'Süre doldu').setDescription('Onay verilmedi, hiçbir değişiklik yapılmadı.')], components: [] });
  }
  if (tiklama.customId !== 'onay') {
    return tiklama.update({ embeds: [taslak(client, RENK.bilgi, 'Vazgeçildi').setDescription('Hiçbir değişiklik yapılmadı.')], components: [] });
  }

  calisanlar.add(interaction.guildId);
  let durdur = false;
  const basla = Date.now();
  const sonuc = { tamam: 0, hata: 0 };
  const ilerleme = (bitti) =>
    taslak(client, renk, bitti ? `${baslik}: bitti` : `${baslik}: sürüyor`).setDescription(
      [
        `> • **İşlenen:** ${sonuc.tamam + sonuc.hata} / ${hedefler.length}`,
        `> • **Başarılı:** ${sonuc.tamam}`,
        `> • **Hata:** ${sonuc.hata}`,
        bitti && durdur ? '\nİşlem durduruldu veya süre sınırına ulaşıldı, kalan üyelere dokunulmadı.' : '',
      ].join('\n'),
    );
  await tiklama.update({ embeds: [ilerleme(false)], components: [satir(dugme('durdur', 'Durdur', ButtonStyle.Danger))] });
  const toplayici = mesaj.createMessageComponentCollector({ componentType: ComponentType.Button, filter: (i) => i.user.id === interaction.user.id });
  toplayici.on('collect', async (i) => {
    if (i.customId !== 'durdur') return;
    durdur = true;
    await i.update({ components: [satir(dugme('durdur', 'Durduruluyor...', ButtonStyle.Secondary, true))] }).catch(() => {});
  });

  try {
    for (const u of hedefler) {
      if (durdur || Date.now() - basla > EN_UZUN_SURE) {
        durdur = true;
        break;
      }
      try {
        await uygula(u);
        sonuc.tamam++;
      } catch (e) {
        sonuc.hata++;
        console.error(`[toplu] ${u.id}: ${e.message}`);
      }
      if ((sonuc.tamam + sonuc.hata) % 5 === 0) await interaction.editReply({ embeds: [ilerleme(false)] }).catch(() => {});
      await bekle(bekleMs);
    }
  } finally {
    calisanlar.delete(interaction.guildId);
    toplayici.stop();
  }
  return interaction.editReply({ embeds: [ilerleme(true)], components: [] }).catch(() => {});
}

module.exports = { topluCalistir, mesgulMu };
