// /sil miktar : bulunduğun kanaldaki en son N mesajı siler (en fazla 500). (Trial Moderator ve üstü)
// Discord toplu silmeyi sadece 14 günden yeni mesajlarda destekler; daha eskileri tek tek silinir (yavaştır).
// Sabitlenmiş mesajlara dokunulmaz.
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, hata } = require('../utils/tasarim');

const EN_COK = 500;
const ONDORT_GUN = 14 * 24 * 3600 * 1000 - 60_000; // 1 dk güvenlik payı
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Kanalın en yeni mesajlarından, sabitlenmemiş olanları `adet` kadar toplar
async function mesajlariTopla(kanal, adet) {
  const secilen = [];
  let sabitli = 0;
  let once;
  while (secilen.length < adet) {
    const parca = await kanal.messages.fetch({ limit: 100, ...(once ? { before: once } : {}) });
    if (parca.size === 0) break;
    for (const m of parca.values()) {
      if (m.pinned) sabitli++;
      else if (secilen.length < adet) secilen.push(m);
    }
    once = parca.last().id;
  }
  return { secilen, sabitli };
}

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('sil')
    .setDescription('Bu kanaldaki son mesajları siler (en fazla 500).')
    .addIntegerOption((o) => o.setName('miktar').setDescription('Silinecek mesaj sayısı (1-500)').setRequired(true).setMinValue(1).setMaxValue(EN_COK))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kanal = interaction.channel;
    const miktar = interaction.options.getInteger('miktar');

    const izinler = kanal?.permissionsFor?.(interaction.guild.members.me);
    if (!kanal?.messages || !izinler?.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
      return interaction.reply({
        embeds: [hata('Bu kanalda mesaj silemiyorum. Botun bu kanalda "Mesajları Yönet" ve "Mesaj Geçmişini Oku" izinleri olmalı.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { secilen, sabitli } = await mesajlariTopla(kanal, miktar);
      if (secilen.length === 0) {
        return interaction.editReply({ embeds: [hata('Silinecek mesaj bulunamadı.')] });
      }

      const sinir = Date.now() - ONDORT_GUN;
      const yeniler = secilen.filter((m) => m.createdTimestamp > sinir);
      const eskiler = secilen.filter((m) => m.createdTimestamp <= sinir);
      let silinen = 0;

      for (let i = 0; i < yeniler.length; i += 100) {
        const grup = yeniler.slice(i, i + 100);
        if (grup.length === 1) {
          await grup[0].delete().then(() => silinen++).catch(() => {});
        } else {
          const sonuc = await kanal.bulkDelete(grup, true).catch(() => null);
          silinen += sonuc?.size ?? 0;
        }
      }
      for (const m of eskiler) {
        if (await m.delete().then(() => true).catch(() => false)) silinen++;
        await bekle(400);
      }

      const e = taslak(client, RENK.bilgi, 'Mesajlar silindi')
        .addFields(alan('Kanal', `${kanal}`), alan('Silinen mesaj', `${silinen} / ${miktar}`));
      if (eskiler.length) e.addFields(alan('Not', `${eskiler.length} mesaj 14 günden eski olduğu için tek tek silindi.`));
      if (sabitli) e.addFields(alan('Atlanan', `${sabitli} sabitlenmiş mesaja dokunulmadı.`));
      if (silinen < secilen.length) e.addFields(alan('Silinemeyen', `${secilen.length - silinen} mesaj silinemedi (zaten silinmiş olabilir).`));
      return interaction.editReply({ embeds: [e] });
    } catch (e) {
      console.error('[sil]', e);
      return interaction.editReply({ embeds: [hata('Mesajlar silinemedi: ' + e.message)] });
    }
  },
};
